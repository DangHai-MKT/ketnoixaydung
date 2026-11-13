'use server';

import { redirect } from 'next/navigation';
import { AccessError } from '../auth/permissions';
import { requirePageActor } from '../auth/server';
import { requireVerifiedSeller } from '../seller/server';
import { getPurchaseChatUnread, listPurchaseChats, markPurchaseChatRead, readPurchaseChat, sendPurchaseMessage } from '../../services/purchase-chat';
import { chatPath, type ChatSide } from './purchase-chat';

export async function sendChatAction(side: ChatSide, id: string, key: string, _state: string, data: FormData) {
  const path = chatPath(side, id);
  const actor = side === 'buyer' ? await requirePageActor(path, ['buyer']) : (await requireVerifiedSeller()).actor;
  try {
    await sendPurchaseMessage(actor, side, id, key, data.get('message'));
  } catch (error) {
    if (error instanceof AccessError) return error.message;
    console.error('Purchase message send failed', { code: (error as { code?: string; cause?: { code?: string } })?.cause?.code });
    return 'Chưa gửi được tin nhắn. Vui lòng thử lại.';
  }
  redirect(path + '#tin-nhan-moi');
}

export async function loadFloatingChat(side: ChatSide, id: string, page = 1, includeList = true) {
  if (side !== 'buyer' && side !== 'seller') return { error: 'Vai trò trao đổi không hợp lệ.' };
  const actor = side === 'buyer' ? await requirePageActor('/account/purchases', ['buyer']) : (await requireVerifiedSeller()).actor;
  try {
    if (!Number.isSafeInteger(page) || page < 1 || page > 9999) throw new AccessError(400, 'Trang tin nhắn không hợp lệ.');
    const unread = await getPurchaseChatUnread(actor, side);
    const unreadIds = Object.keys(unread).map(href => href.split('/').at(-2) ?? '')
      .filter(id => /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id));
    const conversations = includeList || !id ? await listPurchaseChats(actor, side, unreadIds) : undefined;
    const selectedId = id || conversations?.[0]?.id;
    if (!selectedId) return { empty: true as const, conversations, unread };
    const thread = await readPurchaseChat(actor, side, selectedId, page);
    return {
      selectedId,
      order: { title: thread.order.title, version: thread.order.version, writable: thread.order.status === 'completed' },
      messages: thread.messages.map(({ id, senderId, body, createdAt }) => ({
        id, mine: senderId === actor.id, body, createdAt: createdAt.toISOString(),
      })),
      hasOlder: thread.hasOlder,
      conversations,
      unread,
    };
  } catch (error) {
    if (error instanceof AccessError) return { error: error.message };
    return { error: 'Kênh trao đổi chưa sẵn sàng. Vui lòng thử lại.' };
  }
}

export async function loadChatUnread(side: ChatSide) {
  if (side !== 'buyer' && side !== 'seller') return null;
  const actor = side === 'buyer' ? await requirePageActor('/account/purchases', ['buyer']) : (await requireVerifiedSeller()).actor;
  return getPurchaseChatUnread(actor, side);
}

export async function acknowledgeChatMessages(side: ChatSide, id: string, messageIds: string[]) {
  if (side !== 'buyer' && side !== 'seller') return null;
  const actor = side === 'buyer' ? await requirePageActor('/account/purchases', ['buyer']) : (await requireVerifiedSeller()).actor;
  const changed = await markPurchaseChatRead(actor, side, id, messageIds);
  return changed ? await getPurchaseChatUnread(actor, side) : null;
}

export async function sendFloatingChat(side: ChatSide, id: string, key: string, message: string) {
  if (side !== 'buyer' && side !== 'seller') return { error: 'Vai trò trao đổi không hợp lệ.' };
  const actor = side === 'buyer' ? await requirePageActor('/account/purchases', ['buyer']) : (await requireVerifiedSeller()).actor;
  try {
    await sendPurchaseMessage(actor, side, id, key, message);
    return { ok: true as const };
  } catch (error) {
    return { error: error instanceof AccessError ? error.message : 'Chưa gửi được tin nhắn. Vui lòng thử lại.' };
  }
}
