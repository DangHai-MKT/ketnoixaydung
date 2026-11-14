import 'server-only';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { auditLogs, notifications, projectFiles, projectVersions, projects, sellerProfiles, users, userRoles } from '../db/schema';
import { AccessError, requireActive, isRole, type Actor } from '../lib/auth/permissions';
import { assertProjectReviewer } from '../lib/projects/workflow';
import { type SellerTx } from './seller-context';
export type ProjectRow = typeof projects.$inferSelect;
export type VersionRow = typeof projectVersions.$inferSelect;
export function versionContent(version: VersionRow) {
  const { title, category, provinceCode, districtName, projectStage, sizeMinSqm, sizeMaxSqm, publicSummary, publicData, pricePoints } = version;
  return { title, category, provinceCode, districtName, projectStage, sizeMinSqm, sizeMaxSqm, publicSummary, publicData, pricePoints };
}
export async function checkFileBudget(tx: SellerTx, projectId: string, addedCount: number, addedBytes: bigint) {
  const retained = await tx.select({ bytes: projectFiles.sizeBytes }).from(projectFiles).innerJoin(projectVersions, eq(projectVersions.id, projectFiles.projectVersionId)).where(eq(projectVersions.projectId, projectId));
  if (retained.length + addedCount > 30 || retained.reduce((sum, row) => sum + row.bytes, 0n) + addedBytes > 50n * 1024n * 1024n) {
    throw new AccessError(413, 'Dự án đạt hạn mức lưu giữ 30 tệp hoặc 50 MB (bao gồm phiên bản cũ). Hãy liên hệ đơn vị vận hành.');
  }
}
export async function lockProject(tx: SellerTx, actor: Actor, id: string, reviewer = false, needsEligible = true) {
  const [identity] = await tx.select({ sellerId: projects.sellerId }).from(projects).where(eq(projects.id, id));
  if (!identity) throw new AccessError(404, 'Không tìm thấy dự án.');
  const people = await tx.select({ id: users.id, displayName: users.displayName, email: users.email, status: users.status }).from(users)
    .where(inArray(users.id, [actor.id, identity.sellerId])).orderBy(asc(users.id)).for('update');
  const user = people.find((person) => person.id === actor.id);
  const actorGrants = await tx.select().from(userRoles).where(eq(userRoles.userId, actor.id));
  const current = requireActive(user ? { ...user, roles: actorGrants.map((grant) => grant.role).filter(isRole) } : null);
  if (reviewer) assertProjectReviewer(current, identity.sellerId);
  else if (current.id !== identity.sellerId) throw new AccessError(403, 'Bạn không có quyền thay đổi dự án này.');
  const [seller] = await tx.select().from(sellerProfiles).where(eq(sellerProfiles.userId, identity.sellerId)).for('update');
  // Lock owner before checking eligibility so suspension/approval cannot race publication.
  const grants = await tx.query.userRoles.findMany({ where: (row, { eq }) => eq(row.userId, identity.sellerId) });
  if (needsEligible && (people.find((person) => person.id === identity.sellerId)?.status !== 'active'
    || !seller || seller.verificationStatus !== 'verified' || !grants.some((grant) => grant.role === 'seller'))) {
    throw new AccessError(403, 'Nhà cung cấp cần tài khoản hoạt động, vai trò seller và hồ sơ đã xác minh.');
  }
  const [project] = await tx.select().from(projects).where(eq(projects.id, id)).for('update');
  return { project, actor: current, seller };
}
export async function activeProjectFiles(tx: SellerTx, versionId: string) {
  return tx.select().from(projectFiles).where(and(eq(projectFiles.projectVersionId, versionId), isNull(projectFiles.supersededAt)));
}
export async function workingVersion(tx: SellerTx, project: ProjectRow): Promise<VersionRow> {
  if (!project.workingVersion) throw new AccessError(409, 'Dự án chưa có phiên bản đề xuất. Hãy tạo bản sửa mới.');
  const [version] = await tx.select().from(projectVersions).where(and(eq(projectVersions.projectId, project.id), eq(projectVersions.versionNo, project.workingVersion))).for('update');
  if (!version) throw new AccessError(409, 'Phiên bản đề xuất không hợp lệ.');
  return version;
}
export async function projectEvent(tx: SellerTx, actorId: string, project: ProjectRow, action: string, versionId: string, metadata: Record<string, unknown> = {}, notify = false) {
  await tx.insert(auditLogs).values({ actorId, entityType: 'project', entityId: project.id, action,
    metadata: { versionId, revision: project.revision, ...metadata } });
  if (notify) await tx.insert(notifications).values({ userId: project.sellerId, type: action, title: 'Tin dự án đã được duyệt',
    body: 'Mở dự án để xem phiên bản đã được duyệt.', data: { projectId: project.id, href: `/seller/projects/${project.id}` } });
}
