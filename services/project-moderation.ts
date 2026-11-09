import {searchPattern} from '../lib/projects/query';
import 'server-only';
import { and, asc, desc, eq, ilike, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { auditLogs, moderationReviews, projectPrivateData, projectVersions, projects, users, sellerProfiles } from '../db/schema';
import { AccessError, requireRoles, type Actor } from '../lib/auth/permissions';
import { assertProjectRevision, projectReviewerRoles } from '../lib/projects/workflow';
import { reviewCommand } from '../lib/projects/validation';
import { lockProject, projectEvent, versionContent } from './project-context';
import {checkProjectPublication} from './project-publication-check';
import {projectFieldFilters} from './project-filters';
import type {projectQuery} from '../lib/projects/query';
import {notifyProjectWatch} from './project-watch';
import { findProjectOverlap } from './project-overlap';

export async function listModerationProjects(actor: Actor, status = 'pending_review', page = 1, q = '', sort = 'oldest',filters?:ReturnType<typeof projectQuery>) {
  requireRoles(actor, projectReviewerRoles);
  if (!['pending_review','needs_correction','rejected','published','paused','archived'].includes(status) || !Number.isSafeInteger(page) || page < 1 || page > 10000 || q.length>100 || !['oldest','newest','updated','price_asc','price_desc'].includes(sort)) throw new AccessError(400,'Bộ lọc kiểm duyệt không hợp lệ.');
  const proposed=['pending_review','needs_correction','rejected'].includes(status);
  const state=proposed?and(eq(projectVersions.submissionStatus,status as 'pending_review'),eq(projectVersions.versionNo,projects.workingVersion),sql`${projects.status}<>'archived'`):and(eq(projects.status,status as 'published'),eq(projectVersions.versionNo,projects.currentVersion));
  const where=and(state,filters?projectFieldFilters(filters):undefined,q?ilike(projectVersions.title,searchPattern(q)):undefined),pageSize=filters?.pageSize??20;
  const order=sort==='price_asc'?asc(projectVersions.pricePoints):sort==='price_desc'?desc(projectVersions.pricePoints):sort==='newest'?desc(projectVersions.submittedAt):sort==='updated'?desc(projects.updatedAt):asc(projectVersions.submittedAt);
  const [rows,counts,pending]=await Promise.all([
    db.select({id:projects.id,title:projectVersions.title,sellerId:projects.sellerId,sellerName:users.displayName,sellerStatus:sellerProfiles.verificationStatus,category:projectVersions.category,status:projects.status,versionId:projectVersions.id,versionNo:projectVersions.versionNo,submissionStatus:projectVersions.submissionStatus,submittedAt:projectVersions.submittedAt,pricePoints:sql<string>`${projectVersions.pricePoints}::text`}).from(projects).innerJoin(projectVersions,eq(projectVersions.projectId,projects.id)).innerJoin(users,eq(users.id,projects.sellerId)).leftJoin(sellerProfiles,eq(sellerProfiles.userId,projects.sellerId)).where(where).orderBy(order,asc(projects.id)).limit(pageSize).offset((page-1)*pageSize),
    db.select({total:sql<number>`count(*)::int`}).from(projects).innerJoin(projectVersions,eq(projectVersions.projectId,projects.id)).where(where),
    db.select({total:sql<number>`count(*)::int`}).from(projects).innerJoin(projectVersions,and(eq(projectVersions.projectId,projects.id),eq(projectVersions.versionNo,projects.workingVersion))).where(and(eq(projectVersions.submissionStatus,'pending_review'),sql`${projects.status}<>'archived'`))
  ]);
  return {data:rows,page,pageSize,hasMore:page*pageSize<counts[0].total,total:counts[0].total,pendingCount:pending[0].total};
}
export async function moderateProject(actor: Actor, id: string, value: unknown) {
  const request = reviewCommand(value);
  return db.transaction(async (tx) => {
    const { project } = await lockProject(tx, actor, id, true, ['approve', 'restore'].includes(request.action));
    if (project.status === 'archived') throw new AccessError(409, 'Không thể kiểm duyệt dự án đã lưu trữ.');
    const [version] = await tx.select().from(projectVersions).where(and(eq(projectVersions.id, request.versionId), eq(projectVersions.projectId, id))).for('update');
    if (!version) throw new AccessError(404, 'Phiên bản không thuộc dự án này.');
    const decision = request.action === 'approve' ? 'approved' : request.action === 'reject' ? 'rejected'
      : request.action === 'request_changes' ? 'changes_requested' : request.action === 'suspend' ? 'paused' : 'restored';
    if (project.revision === request.revision + 1) {
      const [event] = await tx.select().from(auditLogs).where(and(eq(auditLogs.actorId, actor.id), eq(auditLogs.entityId, id),
        eq(auditLogs.action, `project.review.${request.action}`), sql`${auditLogs.metadata}->>'revision' = ${String(project.revision)}`, sql`${auditLogs.metadata}->>'versionId' = ${version.id}`)).limit(1);
      const [review] = await tx.select().from(moderationReviews).where(and(eq(moderationReviews.projectId, id), eq(moderationReviews.projectVersionId, version.id),
        eq(moderationReviews.reviewerId, actor.id), eq(moderationReviews.decision, decision), eq(moderationReviews.reason, request.reason))).limit(1);
      if (event && review) return { id, revision: project.revision };
    }
    assertProjectRevision(project.revision, request.revision);
    if (['suspend', 'restore'].includes(request.action)) {
      if (version.versionNo !== project.currentVersion || !version.approvedAt) throw new AccessError(409, 'Cần chọn đúng phiên bản hiện hành đã duyệt.');
      if ((request.action === 'suspend' && project.status !== 'published') || (request.action === 'restore' && project.status !== 'paused')) throw new AccessError(409, 'Trạng thái công bố đã thay đổi.');
    } else if (project.workingVersion !== version.versionNo || version.submissionStatus !== 'pending_review' || !version.submittedAt || version.approvedAt) {
      throw new AccessError(409, 'Chỉ xét duyệt đúng phiên bản đang chờ và đã qua kiểm tra ban đầu.');
    }
    let changes: Partial<typeof projects.$inferInsert> = { revision: project.revision + 1, updatedAt: new Date() };
    let overlapWarning = false;
    if (['approve', 'restore'].includes(request.action)) {
      await checkProjectPublication(tx, version, request.action === 'restore');
      const [protectedRow] = await tx.select({ data: projectPrivateData.privateData }).from(projectPrivateData)
        .where(eq(projectPrivateData.projectVersionId, version.id));
      const overlap = await findProjectOverlap(tx, version, project.sellerId, protectedRow?.data ?? {});
      overlapWarning = overlap.matches.some(match => match.finding !== 'related_package');
    }
    if (request.action === 'approve') {
      await tx.update(projectVersions).set({ submissionStatus: 'published', approvedAt: new Date(), reviewedBy: actor.id, reviewedAt: new Date() }).where(eq(projectVersions.id, version.id));
      changes = { ...changes, ...versionContent(version), currentVersion: version.versionNo, workingVersion: null,
        status: project.status === 'paused' ? 'paused' : 'published', publishedAt: project.publishedAt ?? new Date() };
    } else if (request.action === 'reject' || request.action === 'request_changes') {
      const state = request.action === 'reject' ? 'rejected' : 'needs_correction';
      await tx.update(projectVersions).set({ submissionStatus: state, reviewedBy: actor.id, reviewedAt: new Date() }).where(eq(projectVersions.id, version.id));
      if (!['published', 'paused'].includes(project.status)) changes.status = state;
    } else changes.status = request.action === 'suspend' ? 'paused' : 'published';
    const [updated] = await tx.update(projects).set(changes).where(eq(projects.id, id)).returning();
    await tx.insert(moderationReviews).values({ projectId: id, projectVersionId: version.id, reviewerId: actor.id, decision,
      reason: request.reason, automatedChecks: { passed: true, versionId: version.id } });
    await projectEvent(tx, actor.id, updated, `project.review.${request.action}`, version.id, { overlapWarning }, true);
    if (request.action === 'approve' && updated.status === 'published') {
      await projectEvent(tx, actor.id, updated, project.publishedAt ? 'project.revision_published' : 'project.published', version.id);
      if (!project.publishedAt) await notifyProjectWatch(tx,updated,version);
    }
    return { id, revision: updated.revision };
  });
}

