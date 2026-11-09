import 'server-only';
import { asc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import { auditLogs, users, userRoles } from '../db/schema';
import { AccessError, isRole, requireRoleGrant } from '../lib/auth/permissions';

// actorId must come from a verified server session. Recheck privileges under lock.
export async function grantUserRole(actorId: string, targetId: string, requestedRole: unknown, reason: string) {
  if (!reason.trim() || reason.length > 1000) throw new AccessError(400, 'Lý do phải có từ 1 đến 1.000 ký tự.');
  return db.transaction(async (tx) => {
    const locked = await tx.select().from(users).where(inArray(users.id, [actorId, targetId])).orderBy(asc(users.id)).for('update');
    const actor = locked.find((user) => user.id === actorId);
    const target = locked.find((user) => user.id === targetId);
    const grants = await tx.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, actorId));
    const role = requireRoleGrant(actor ? { ...actor, roles: grants.map((grant) => grant.role).filter(isRole) } : null, targetId, requestedRole);
    if (!target) throw new AccessError(404, 'Không tìm thấy người dùng.');
    if (target.status !== 'active') throw new AccessError(403, 'Chỉ có thể cấp vai trò cho tài khoản đang hoạt động.');
    const desiredRoles = role === 'buyer' ? ['buyer'] : ['buyer', role];
    const added = await tx.insert(userRoles)
      .values(desiredRoles.map((value) => ({ userId: targetId, role: value })))
      .onConflictDoNothing().returning({ role: userRoles.role });
    if (added.length) await tx.update(users).set({updatedAt:new Date()}).where(eq(users.id,targetId));
    if (added.length) await tx.insert(auditLogs).values({ actorId, action: 'user.role.granted', entityType: 'user', entityId: targetId, reason: reason.trim(), metadata: { role, addedRoles: added.map((grant) => grant.role) } });
    const result = await tx.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, targetId));
    return { userId: targetId, roles: result.map((grant) => grant.role), added: added.length > 0 };
  });
}

