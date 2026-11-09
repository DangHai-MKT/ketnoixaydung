import 'server-only';
import { and, desc, eq, gte, inArray, ne, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { auditLogs, notifications, userRoles, users } from '../db/schema';
import { AccessError, requireActive, requireRoles, type Actor } from '../lib/auth/permissions';
import { feedbackInput, feedbackRoles } from '../lib/site/feedback';

const feedbackRows = and(eq(auditLogs.entityType, 'site_feedback'), eq(auditLogs.action, 'site_feedback.submitted'));

export async function submitFeedback(actor: Actor, value: unknown) {
  requireActive(actor);
  const input = feedbackInput(value);
  return db.transaction(async tx => {
    const [user] = await tx.select({ status: users.status }).from(users).where(eq(users.id, actor.id)).for('update');
    requireActive(user ? { ...actor, status: user.status } : null);
    const own = and(feedbackRows, eq(auditLogs.actorId, actor.id));
    const [prior] = await tx.select({ reason: auditLogs.reason, metadata: auditLogs.metadata }).from(auditLogs)
      .where(and(own, eq(auditLogs.requestId, input.requestId))).limit(1);
    if (prior) {
      if (prior.reason !== input.comment || prior.metadata.rating !== input.rating || prior.metadata.topic !== input.topic) {
        throw new AccessError(409, 'Mã gửi đã dùng cho phản hồi khác. Hãy tải lại biểu mẫu.');
      }
      return { ok: true };
    }
    const recent = await tx.select({ id: auditLogs.id }).from(auditLogs)
      .where(and(own, gte(auditLogs.createdAt, new Date(Date.now() - 60 * 60 * 1000)))).limit(3);
    if (recent.length >= 3) throw new AccessError(409, 'Bạn đã gửi 3 phản hồi trong một giờ. Vui lòng thử lại sau.');
    await tx.insert(auditLogs).values({ actorId: actor.id, action: 'site_feedback.submitted', entityType: 'site_feedback',
      reason: input.comment, requestId: input.requestId, metadata: { rating: input.rating, topic: input.topic } });
    const recipients = await tx.selectDistinct({ id: users.id }).from(users).innerJoin(userRoles, eq(users.id, userRoles.userId))
      .where(and(eq(users.status, 'active'), inArray(userRoles.role, feedbackRoles), ne(users.id, actor.id)));
    if (recipients.length) await tx.insert(notifications).values(recipients.map(({ id }) => ({
      userId: id, type: 'site_feedback.submitted', title: 'Có góp ý mới về website',
      body: 'Mở hộp góp ý để xem đánh giá và nội dung phản hồi.', data: { href: '/admin/feedback' },
    })));
    return { ok: true };
  });
}

export async function listFeedback(actor: Actor, page: number, rating?: number) {
  requireRoles(actor, feedbackRoles);
  const where = and(feedbackRows, rating ? sql`${auditLogs.metadata}->>'rating' = ${String(rating)}` : undefined);
  const rows = await db.select({ id: auditLogs.id, comment: auditLogs.reason, metadata: auditLogs.metadata, createdAt: auditLogs.createdAt })
    .from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt), desc(auditLogs.id)).limit(21).offset((page - 1) * 20);
  return { rows: rows.slice(0, 20), hasNext: rows.length > 20 };
}
