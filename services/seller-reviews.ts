import 'server-only';
import { and, asc, desc, eq, isNull, isNotNull, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { auditLogs, sellerProfiles, sellerVerificationDocuments, userRoles } from '../db/schema';
import { AccessError, requireRoles, type Actor } from '../lib/auth/permissions';
import { applicationState, assertReview, assertRevision, sellerReviewRoles } from '../lib/seller/workflow';
import { missingInformation, reviewInput } from '../lib/seller/validation';
import { activeDocuments, lockActors, recordSellerEvent } from './seller-context';

export async function listApplications(actor: Actor, state = 'pending', page = 1) {
  requireRoles(actor, sellerReviewRoles);
  const status = state === 'draft' || state === 'needs_changes' ? 'unverified' : state;
  if (!['unverified', 'pending', 'verified', 'rejected', 'suspended'].includes(status)) throw new AccessError(400, 'Trạng thái lọc không hợp lệ.');
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000) throw new AccessError(400, 'Trang không hợp lệ.');
  const where = and(eq(sellerProfiles.verificationStatus, status as typeof sellerProfiles.$inferSelect.verificationStatus),
    ...(state === 'draft' ? [isNull(sellerProfiles.correctionRequestedAt)] : state === 'needs_changes' ? [isNotNull(sellerProfiles.correctionRequestedAt)] : []));
  const [rows, count] = await Promise.all([
    db.select({ id: sellerProfiles.id, legalName: sellerProfiles.legalName, sellerType: sellerProfiles.sellerType,
      verificationStatus: sellerProfiles.verificationStatus, correctionRequestedAt: sellerProfiles.correctionRequestedAt,
      submittedAt: sellerProfiles.verificationSubmittedAt, revision: sellerProfiles.revision })
      .from(sellerProfiles).where(where).orderBy(asc(sellerProfiles.verificationSubmittedAt), asc(sellerProfiles.id)).limit(20).offset((page - 1) * 20),
    db.select({ total: sql<number>`count(*)::int` }).from(sellerProfiles).where(where),
  ]);
  return { data: rows.map((row) => ({ ...row, state: applicationState(row) })), pagination: { page, pageSize: 20, total: count[0].total } };
}
export async function reviewApplication(actor: Actor, applicationId: string, input: unknown) {
  const request = reviewInput(input);
  requireRoles(actor, sellerReviewRoles);
  return db.transaction(async (tx) => {
    const [identity] = await tx.select({ userId: sellerProfiles.userId }).from(sellerProfiles).where(eq(sellerProfiles.id, applicationId));
    if (!identity) throw new AccessError(404, 'Không tìm thấy hồ sơ.');
    const currentActor = await lockActors(tx, actor.id, identity.userId);
    requireRoles(currentActor, sellerReviewRoles);
    if (currentActor.id === identity.userId) throw new AccessError(403, 'Không được xét duyệt hồ sơ của chính mình.');
    const [profile] = await tx.select().from(sellerProfiles).where(eq(sellerProfiles.id, applicationId)).for('update');
    // Retry only the exact decision for the exact prior revision, by the same reviewer.
    if (profile.revision === request.revision + 1) {
      const [last] = await tx.select().from(auditLogs).where(and(eq(auditLogs.entityId, profile.id), eq(auditLogs.entityType, 'seller_profile'), sql`${auditLogs.metadata}->>'revision' = ${String(profile.revision)}`))
        .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id)).limit(1);
      if (last?.actorId === actor.id && last.action === `seller.review.${request.action}`
        && last.metadata.revision === profile.revision && profile.reviewReason === (request.reason || null)) return profile;
    }
    assertRevision(profile.revision, request.revision);
    assertReview(currentActor, profile.userId, applicationState(profile), request.action);
    const docs = await activeDocuments(tx, profile.id);
    if (request.action === 'approve') {
      const missing = missingInformation(profile, docs.map((doc) => doc.documentType));
      if (missing.length) throw new AccessError(400, 'Hồ sơ chưa đủ thông tin hoặc tài liệu để duyệt.');
    }
    const status = request.action === 'approve' ? 'verified' : request.action === 'reject' ? 'rejected'
      : request.action === 'suspend' ? 'suspended' : 'unverified';
    const now = new Date();
    const [reviewed] = await tx.update(sellerProfiles).set({ verificationStatus: status, reviewedBy: actor.id, reviewedAt: now,
      reviewReason: request.reason || null, correctionRequestedAt: request.action === 'request_changes' ? now : null,
      verifiedAt: request.action === 'approve' ? now : profile.verifiedAt, revision: profile.revision + 1, updatedAt: now })
      .where(eq(sellerProfiles.id, profile.id)).returning();
    if (request.action === 'approve') {
      await tx.insert(userRoles).values([{ userId: profile.userId, role: 'buyer' }, { userId: profile.userId, role: 'seller' }]).onConflictDoNothing();
      await tx.update(sellerVerificationDocuments).set({ status: 'accepted', reviewedBy: actor.id, reviewedAt: now })
        .where(and(eq(sellerVerificationDocuments.sellerProfileId, profile.id), isNull(sellerVerificationDocuments.supersededAt)));
    }
    await recordSellerEvent(tx, actor.id, reviewed, `seller.review.${request.action}`);
    return reviewed;
  });
}
