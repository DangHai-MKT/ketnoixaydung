import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users, auditLogs, userRoles } from '../db/schema';
import { requireActive, AccessError, type Actor } from '../lib/auth/permissions';
import { profileInput } from '../lib/account/validation';
const projection = { displayName: users.displayName, phone: users.phone, email: users.email, emailVerified: users.emailVerified, status: users.status, createdAt: users.createdAt, updatedAt: users.updatedAt };
export async function getOwnProfile(actor: Actor) { requireActive(actor); const [row] = await db.select(projection).from(users).where(eq(users.id, actor.id)); if (!row)
    throw new AccessError(404, 'Không tìm thấy tài khoản.'); return row; }
export async function updateOwnProfile(actor: Actor, input: unknown) {
    requireActive(actor);
    const data = profileInput(input);
    try {
        return await db.transaction(async (tx) => {
            const [row] = await tx.select().from(users).where(eq(users.id, actor.id)).for('update');
            requireActive(row ? { ...actor, status: row.status } : null);
            if (row.updatedAt.toISOString() !== new Date(data.updatedAt).toISOString())
                throw new AccessError(409, 'Hồ sơ đã thay đổi. Hãy tải lại trước khi lưu.');
            const [result] = await tx.update(users).set({ displayName: data.displayName, phone: data.phone, updatedAt: new Date() }).where(eq(users.id, actor.id)).returning(projection);
            await tx.insert(auditLogs).values({ actorId: actor.id, entityType: 'user', entityId: actor.id, action: 'user.profile.updated', metadata: { fields: ['displayName', 'phone'] } });
            return result;
        });
    }
    catch (error) {
        if (error instanceof AccessError)
            throw error;
        const cause = (error as {
            cause?: {
                code?: string;
            };
        }).cause;
        if (cause?.code === '23505' || (error as {
            code?: string;
        }).code === '23505')
            throw new AccessError(409, 'Số điện thoại đã được sử dụng.');
        throw error;
    }
}
