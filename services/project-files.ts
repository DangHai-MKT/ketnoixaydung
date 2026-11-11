import 'server-only';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { projectFiles, projectVersions, projects, sellerProfiles } from '../db/schema';
import { AccessError, requireActive, requireRoles, type Actor } from '../lib/auth/permissions';
import { assertDraft, assertProjectRevision, projectReviewerRoles } from '../lib/projects/workflow';
import { normalizeProjectFile, verifiedProjectFile, storeProjectFile, uploadLimits } from '../lib/projects/storage';
import { projectFileExtensions, validProjectFileType } from '../lib/projects/file-types';
import { activeProjectFiles, checkFileBudget, lockProject, projectEvent, workingVersion } from './project-context';
import { getPublicProject } from './public-projects';
import { hasPurchasedVersion } from './purchase-access';

export async function uploadProjectFile(actor: Actor, id: string, versionId: string, revision: number, file: File, accessLevel: string, replaceId: string | null) {
  if (!['public_preview', 'purchased_only', 'moderator_only'].includes(accessLevel)) throw new AccessError(400, 'Mức truy cập tệp không hợp lệ.');
  await db.transaction(async (tx) => {
    const { project } = await lockProject(tx, actor, id);
    if (project.status === 'archived') throw new AccessError(409, 'Dự án đã lưu trữ.');
    assertProjectRevision(project.revision, revision);
    const version = await workingVersion(tx, project);
    if (version.id !== versionId) throw new AccessError(409, 'Phiên bản không khớp.');
    assertDraft(version);
  });
  const { bytes, mimeType } = await normalizeProjectFile(file);
  if (!validProjectFileType(mimeType, accessLevel)) throw new AccessError(400, 'PDF, DOC và DOCX chỉ được tải ở chế độ bảo vệ hoặc dành cho kiểm duyệt.');
  return db.transaction(async (tx) => {
    const { project } = await lockProject(tx, actor, id);
    if (project.status === 'archived') throw new AccessError(409, 'Dự án đã lưu trữ.');
    assertProjectRevision(project.revision, revision);
    const version = await workingVersion(tx, project);
    if (version.id !== versionId) throw new AccessError(409, 'Phiên bản không khớp.');
    assertDraft(version);
    const files = await activeProjectFiles(tx, version.id);
    if (replaceId && !files.some((row) => row.id === replaceId)) throw new AccessError(404, 'Tệp thay thế không thuộc phiên bản của bạn.');
    if (!replaceId && files.length >= uploadLimits().maxDocuments) throw new AccessError(400, 'Phiên bản đã đạt giới hạn số tệp.');
    await checkFileBudget(tx, id, 1, BigInt(bytes.length));
    const storageKey = await storeProjectFile(bytes, mimeType);
    if (replaceId) await tx.update(projectFiles).set({ supersededAt: new Date() }).where(eq(projectFiles.id, replaceId));
    const [created] = await tx.insert(projectFiles).values({ projectVersionId: version.id, storageKey, originalFilename: file.name.replace(/\\/g, '/').split('/').pop()!.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 255) || 'tep-du-an.'+projectFileExtensions[mimeType],
      mimeType, sizeBytes: BigInt(bytes.length), accessLevel, checksumSha256: createHash('sha256').update(bytes).digest('hex') }).returning({ id: projectFiles.id });
    const [updated] = await tx.update(projects).set({ revision: project.revision + 1, updatedAt: new Date() }).where(eq(projects.id, id)).returning();
    await projectEvent(tx, actor.id, updated, 'project.file_uploaded', version.id);
    return { id: created.id, revision: updated.revision };
  });
}
export async function downloadProjectFile(actor: Actor | null, projectId: string, fileId: string, thumbnailWidth?: number) {
  const [row] = await db.select({ file: projectFiles, sellerId: projects.sellerId, submittedAt: projectVersions.submittedAt, approvedAt: projectVersions.approvedAt })
    .from(projectFiles).innerJoin(projectVersions, eq(projectVersions.id, projectFiles.projectVersionId)).innerJoin(projects, eq(projects.id, projectVersions.projectId))
    .where(and(eq(projectFiles.id, fileId), eq(projects.id, projectId)));
  if (!row) throw new AccessError(404, 'Không tìm thấy tệp dự án.');
  const publicListing = row.file.accessLevel === 'public_preview' ? await getPublicProject(projectId) : null;
  const isPublic = !!publicListing?.files.some((file) => file.id === fileId);
  if (thumbnailWidth && (!isPublic || !row.file.mimeType.startsWith('image/'))) {
    throw new AccessError(404, 'Không tìm thấy ảnh công khai.');
  }
  if (!isPublic) {
    requireActive(actor);
    if (actor!.id === row.sellerId) {
      requireRoles(actor, ['seller']);
      const [profile] = await db.select().from(sellerProfiles).where(eq(sellerProfiles.userId, actor!.id));
      if (profile?.verificationStatus !== 'verified') throw new AccessError(403, 'Hồ sơ người bán chưa được xác minh.');
    } else if (['purchased_only','public_preview'].includes(row.file.accessLevel) && actor!.roles.includes('buyer') && await hasPurchasedVersion(actor!,row.file.projectVersionId)) {
      // Entitlement is bound to this exact historical snapshot, never to all
      // versions of a project or moderator-only evidence.
    } else {
      requireRoles(actor, projectReviewerRoles);
      if (!row.submittedAt && !row.approvedAt) throw new AccessError(403, 'Tệp của bản nháp chưa được gửi xét duyệt.');
    }
  }
  const original = await verifiedProjectFile(row.file);
  const bytes = thumbnailWidth
    ? await sharp(original).resize({ width: thumbnailWidth, height: thumbnailWidth, fit: 'inside', withoutEnlargement: true }).webp({ quality: 76 }).toBuffer()
    : original;
  const mimeType = thumbnailWidth ? 'image/webp' : row.file.mimeType;
  const extension = thumbnailWidth ? 'webp' : projectFileExtensions[row.file.mimeType];
  return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': mimeType, 'Content-Length': String(bytes.length),
    'Content-Disposition': `${isPublic ? 'inline' : 'attachment'}; filename="du-an-${fileId}.${extension}"`, 'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" } });
}

// Soft removal only: retain the original bytes and historical associations.
export async function removeProjectFile(actor:Actor,id:string,fileId:string,versionId:string,revision:number){
 return db.transaction(async tx=>{
  const {project}=await lockProject(tx,actor,id);
  if(project.status==='archived')throw new AccessError(409,'Dự án đã lưu trữ.');
  assertProjectRevision(project.revision,revision);
  const version=await workingVersion(tx,project);
  if(version.id!==versionId)throw new AccessError(409,'Phiên bản đã thay đổi.');
  assertDraft(version);
  const files=await activeProjectFiles(tx,version.id);
  if(!files.some(file=>file.id===fileId))throw new AccessError(404,'Tệp không thuộc bản nháp này hoặc đã được gỡ.');
  await tx.update(projectFiles).set({supersededAt:new Date()}).where(eq(projectFiles.id,fileId));
  const [updated]=await tx.update(projects).set({revision:project.revision+1,updatedAt:new Date()}).where(eq(projects.id,id)).returning();
  await projectEvent(tx,actor.id,updated,'project.file_removed',version.id);
  return {id:fileId,revision:updated.revision};
 });
}
