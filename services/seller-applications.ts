import 'server-only';
import { and, desc, eq, like } from 'drizzle-orm';
import { db } from '../db/client';
import { auditLogs, notifications, sellerProfiles, sellerVerificationDocuments } from '../db/schema';
import { AccessError, requireActive, requireRoles, type Actor } from '../lib/auth/permissions';
import { applicationState, assertEditable, assertRevision, sellerReviewRoles } from '../lib/seller/workflow';
import { applicationInput, missingInformation, revisionInput } from '../lib/seller/validation';
import { activeDocuments, lockActors, ownProfile, recordSellerEvent } from './seller-context';

export async function getOwnApplication(actor: Actor) {
  requireActive(actor);
  const [profile] = await db.select().from(sellerProfiles).where(eq(sellerProfiles.userId, actor.id));
  return profile ? applicationDetail(profile.id, actor, false) : null;
}
export async function applicationDetail(id: string, actor: Actor, reviewer: boolean) {
  requireActive(actor);
  if (reviewer) requireRoles(actor, sellerReviewRoles);
  const [profile] = await db.select().from(sellerProfiles).where(and(eq(sellerProfiles.id, id), ...(!reviewer ? [eq(sellerProfiles.userId, actor.id)] : [])));
  if (!profile) throw new AccessError(404, 'Không tìm thấy hồ sơ.');
  const allDocs = await db.select().from(sellerVerificationDocuments).where(eq(sellerVerificationDocuments.sellerProfileId, profile.id)).orderBy(desc(sellerVerificationDocuments.createdAt));
  const docs = allDocs.filter((doc) => !doc.supersededAt);
  const history = await db.select({ id: auditLogs.id, action: auditLogs.action, createdAt: auditLogs.createdAt, metadata: auditLogs.metadata })
    .from(auditLogs).where(and(eq(auditLogs.entityType, 'seller_profile'), eq(auditLogs.entityId, profile.id)))
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id)).limit(50);
  const notices = reviewer ? [] : await db.select({ id: notifications.id, title: notifications.title, body: notifications.body, createdAt: notifications.createdAt })
    .from(notifications).where(and(eq(notifications.userId, actor.id), like(notifications.type, 'seller.%'))).orderBy(desc(notifications.createdAt)).limit(10);
  return {
    profile, state: applicationState(profile), missing: missingInformation(profile, docs.map((doc) => doc.documentType)),
    documents: docs.map(({ storageKey: _storageKey, ...doc }) => ({ ...doc, sizeBytes: doc.sizeBytes.toString() })), history, notifications: notices,
    archivedDocuments: allDocs.filter((doc) => doc.supersededAt).map(({ storageKey: _storageKey, ...doc }) => ({ ...doc, sizeBytes: doc.sizeBytes.toString() })),
  };
}
export async function saveApplication(actorId: string, input: unknown, expectedRevision: unknown) {
  const fields = applicationInput(input);
  const expected = revisionInput(expectedRevision);
  return db.transaction(async (tx) => {
    await lockActors(tx, actorId);
    const [prior] = await tx.select().from(sellerProfiles).where(eq(sellerProfiles.userId, actorId)).for('update');
    if (!prior) {
      assertRevision(0, expected);
      const [created] = await tx.insert(sellerProfiles).values({ userId: actorId, ...fields }).returning();
      await recordSellerEvent(tx, actorId, created, 'seller.application.created', false);
      return created;
    }
    assertEditable(applicationState(prior));
    assertRevision(prior.revision, expected);
    const [saved] = await tx.update(sellerProfiles).set({ ...fields, revision: prior.revision + 1, updatedAt: new Date() })
      .where(eq(sellerProfiles.id, prior.id)).returning();
    await recordSellerEvent(tx, actorId, saved, 'seller.application.draft_saved', false);
    return saved;
  });
}
export async function submitApplication(actorId: string, expectedRevision: unknown) {
  const expected = revisionInput(expectedRevision);
  return db.transaction(async (tx) => {
    await lockActors(tx, actorId);
    const profile = await ownProfile(tx, actorId);
    // A retry of precisely the prior submit returns its result without creating another event.
    if (profile.verificationStatus === 'pending' && profile.revision === expected + 1) return profile;
    assertEditable(applicationState(profile));
    assertRevision(profile.revision, expected);
    const docs = await activeDocuments(tx, profile.id);
    const missing = missingInformation(profile, docs.map((doc) => doc.documentType));
    if (missing.length) throw new AccessError(400, `Cần bổ sung: ${missing.join('; ')}.`);
    const [submitted] = await tx.update(sellerProfiles).set({ verificationStatus: 'pending', verificationSubmittedAt: new Date(),
      correctionRequestedAt: null, revision: profile.revision + 1, updatedAt: new Date() }).where(eq(sellerProfiles.id, profile.id)).returning();
    await recordSellerEvent(tx, actorId, submitted, profile.verificationSubmittedAt ? 'seller.application.resubmitted' : 'seller.application.submitted');
    return submitted;
  });
}
