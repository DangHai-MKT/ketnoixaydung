import 'server-only';
import { asc, eq, inArray, isNull, and } from 'drizzle-orm';
import { db } from '../db/client';
import { auditLogs, notifications, sellerProfiles, sellerVerificationDocuments, users, userRoles } from '../db/schema';
import { AccessError, isRole, requireActive, type Actor } from '../lib/auth/permissions';

export type SellerTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type SellerProfile = typeof sellerProfiles.$inferSelect;

export async function lockActors(tx: SellerTx, actorId: string, ownerId = actorId): Promise<Actor> {
  const records = await tx.select({ id: users.id, displayName: users.displayName, email: users.email, status: users.status })
    .from(users).where(inArray(users.id, [actorId, ownerId])).orderBy(asc(users.id)).for('update');
  const user = records.find((record) => record.id === actorId);
  const grants = await tx.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, actorId));
  const actor = requireActive(user ? { ...user, roles: grants.map((grant) => grant.role).filter(isRole) } : null);
  const owner = records.find((record) => record.id === ownerId);
  if (!owner || owner.status !== 'active') throw new AccessError(403, 'Tài khoản người nộp hồ sơ hiện không hoạt động.');
  return actor;
}
export async function ownProfile(tx: SellerTx, userId: string): Promise<SellerProfile> {
  const [profile] = await tx.select().from(sellerProfiles).where(eq(sellerProfiles.userId, userId)).for('update');
  if (!profile) throw new AccessError(404, 'Bạn chưa tạo hồ sơ người bán.');
  return profile;
}
export function activeDocuments(tx: SellerTx, profileId: string) {
  return tx.select().from(sellerVerificationDocuments).where(and(eq(sellerVerificationDocuments.sellerProfileId, profileId), isNull(sellerVerificationDocuments.supersededAt)));
}
export async function recordSellerEvent(tx: SellerTx, actorId: string, profile: SellerProfile, action: string, notify = true) {
  await tx.insert(auditLogs).values({ actorId, action, entityType: 'seller_profile', entityId: profile.id,
    metadata: { revision: profile.revision, status: profile.verificationStatus } });
  if (notify) await tx.insert(notifications).values({ userId: profile.userId, type: action,
    title: 'Cập nhật hồ sơ người bán', body: 'Hồ sơ người bán có cập nhật mới. Vui lòng mở trang hồ sơ để xem trạng thái và hướng dẫn.',
    data: { applicationId: profile.id, href: '/seller/application' } });
}
