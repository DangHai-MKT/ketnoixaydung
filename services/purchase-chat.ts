import 'server-only';
import { and, desc, eq, inArray, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { notifications, projectVersions, purchaseMessages, purchaseOrders } from '../db/schema';
import { AccessError, requireRoles, type Actor } from '../lib/auth/permissions';
import { chatMessageLimit, chatPath, type ChatSide } from '../lib/projects/purchase-chat';
import { uuidInput } from '../lib/seller/validation';

const pageSize = 30;
const messageNotification = 'purchase.message.received';
const notificationLink = sql<string>`${notifications.data}->>'href'`;
const ownership = (actor: Actor, side: ChatSide, id: string) =>
  and(eq(purchaseOrders.id, uuidInput(id)),
    eq(side === 'buyer' ? purchaseOrders.buyerId : purchaseOrders.sellerId, requireRoles(actor, [side]).id));

export async function getPurchaseChatUnread(actor: Actor, side: ChatSide) {
  const owner = requireRoles(actor, [side]).id;
  const pattern = chatPath(side, '%');
  const rows = await db.select({ href: notificationLink, count: sql<number>`count(*)::int` })
    .from(notifications).where(and(eq(notifications.userId, owner), eq(notifications.type, messageNotification),
      isNull(notifications.readAt), sql`${notificationLink} LIKE ${pattern}`))
    .groupBy(notificationLink);
  return Object.fromEntries(rows.map(row => [row.href, row.count]));
}

export async function markPurchaseChatRead(actor: Actor, side: ChatSide, id: string, messageIds: string[]) {
  if (!Array.isArray(messageIds) || messageIds.length > pageSize) throw new AccessError(400, 'Danh sách tin nhắn không hợp lệ.');
  if (!messageIds.length) return false;
  const [order] = await db.select({ id: purchaseOrders.id }).from(purchaseOrders).where(ownership(actor, side, id));
  if (!order) throw new AccessError(404, 'Không tìm thấy cuộc trao đổi.');
  const result = await db.update(notifications).set({ readAt: new Date() }).where(and(
    eq(notifications.userId, actor.id), eq(notifications.type, messageNotification), isNull(notifications.readAt),
    eq(notificationLink, chatPath(side, order.id)),
    sql`EXISTS (SELECT 1 FROM ${purchaseMessages} WHERE ${purchaseMessages.purchaseId} = ${order.id}
      AND ${inArray(purchaseMessages.id, messageIds.map(uuidInput))} AND ${ne(purchaseMessages.senderId, actor.id)}
      AND (${notifications.data}->>'messageId' = ${purchaseMessages.id}::text
        OR (${notifications.data}->>'messageId' IS NULL AND ${notifications.createdAt} = ${purchaseMessages.createdAt})))`,
  ));
  return (result.rowCount ?? 0) > 0;
}

export function listPurchaseChats(actor: Actor, side: ChatSide, unreadIds: string[] = []) {
  const owner = requireRoles(actor, [side]).id;
  return db.select({ id: purchaseOrders.id, title: projectVersions.title, version: projectVersions.versionNo })
    .from(purchaseOrders).innerJoin(projectVersions, eq(projectVersions.id, purchaseOrders.projectVersionId))
    .where(and(eq(side === 'buyer' ? purchaseOrders.buyerId : purchaseOrders.sellerId, owner), isNotNull(purchaseOrders.completedAt)))
    .orderBy(...(unreadIds.length ? [desc(inArray(purchaseOrders.id, unreadIds))] : []),
      desc(purchaseOrders.completedAt), desc(purchaseOrders.id)).limit(20);
}

export async function readPurchaseChat(actor: Actor, side: ChatSide, id: string, page: number) {
  return db.transaction(async tx => {
    const [order] = await tx.select({
      status: purchaseOrders.status, completedAt: purchaseOrders.completedAt,
      title: projectVersions.title, version: projectVersions.versionNo, projectId: purchaseOrders.projectId,
    }).from(purchaseOrders).innerJoin(projectVersions, eq(projectVersions.id, purchaseOrders.projectVersionId))
      .where(ownership(actor, side, id));
    if (!order?.completedAt) throw new AccessError(404, 'Không tìm thấy cuộc trao đổi.');
    const messages = await tx.select().from(purchaseMessages).where(eq(purchaseMessages.purchaseId, id))
      .orderBy(desc(purchaseMessages.createdAt), desc(purchaseMessages.id)).limit(pageSize + 1).offset((page - 1) * pageSize);
    return { order, messages: messages.slice(0, pageSize).reverse(), hasOlder: messages.length > pageSize };
  }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
}

export async function sendPurchaseMessage(actor: Actor, side: ChatSide, id: string, key: string, value: FormDataEntryValue | null) {
  const body = typeof value === 'string' ? value.trim() : '';
  if (!body || body.length > chatMessageLimit || body.includes('\0')) {
    throw new AccessError(400, 'Nhập tin nhắn từ 1 đến 2.000 ký tự.');
  }
  key = uuidInput(key);
  await db.transaction(async tx => {
    const [order] = await tx.select().from(purchaseOrders).where(ownership(actor, side, id)).for('update');
    if (!order?.completedAt) throw new AccessError(404, 'Không tìm thấy cuộc trao đổi.');
    const [prior] = await tx.select().from(purchaseMessages).where(eq(purchaseMessages.id, key));
    if (prior) {
      if (prior.purchaseId === order.id && prior.senderId === actor.id && prior.body === body) return;
      throw new AccessError(409, 'Biểu mẫu đã thay đổi. Vui lòng tải lại trang.');
    }
    if (order.status !== 'completed') throw new AccessError(409, 'Đơn mua hiện chỉ cho phép xem lịch sử trao đổi.');
    await tx.insert(purchaseMessages).values({ id: key, purchaseId: order.id, senderId: actor.id, body });
    const recipient = side === 'buyer' ? 'seller' : 'buyer';
    await tx.insert(notifications).values({
      userId: recipient === 'seller' ? order.sellerId : order.buyerId,
      type: messageNotification,
      title: 'Có tin nhắn mới về dự án',
      body: 'Mở cuộc trao đổi để xem và trả lời tin nhắn.',
      data: { href: chatPath(recipient, order.id), messageId: key },
    });
  });
}
