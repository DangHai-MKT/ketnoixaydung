'use server';

import { redirect } from 'next/navigation';
import { AccessError } from '../auth/permissions';
import { requirePageActor } from '../auth/server';
import { requireVerifiedSeller } from '../seller/server';
import { listPurchaseChats, readPurchaseChat, sendPurchaseMessage } from '../../services/purchase-chat';
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

export async function loadFloatingChat(id: string, page = 1) {
  const actor = await requirePageActor(chatPath('buyer', id), ['buyer']);
  try {
    if (!Number.isSafeInteger(page) || page < 1 || page > 9999) throw new AccessError(400, 'Trang tin nhắn không hợp lệ.');
    const thread = await readPurchaseChat(actor, 'buyer', id, page);
    const conversations = page === 1 ? await listPurchaseChats(actor, 'buyer') : undefined;
    return {
      order: { title: thread.order.title, version: thread.order.version, writable: thread.order.status === 'completed' },
      messages: thread.messages.map(({ id, senderId, body, createdAt }) => ({
        id, mine: senderId === actor.id, body, createdAt: createdAt.toISOString(),
      })),
      hasOlder: thread.hasOlder,
      conversations,
    };
  } catch (error) {
    if (error instanceof AccessError) return { error: error.message };
    return { error: 'Kênh trao đổi chưa sẵn sàng. Vui lòng thử lại.' };
  }
}

export async function sendFloatingChat(id: string, key: string, message: string) {
  const actor = await requirePageActor(chatPath('buyer', id), ['buyer']);
  try {
    await sendPurchaseMessage(actor, 'buyer', id, key, message);
    return { ok: true as const };
  } catch (error) {
    return { error: error instanceof AccessError ? error.message : 'Chưa gửi được tin nhắn. Vui lòng thử lại.' };
  }
}
