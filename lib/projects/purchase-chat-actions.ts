'use server';

import { redirect } from 'next/navigation';
import { AccessError } from '../auth/permissions';
import { requirePageActor } from '../auth/server';
import { requireVerifiedSeller } from '../seller/server';
import { sendPurchaseMessage } from '../../services/purchase-chat';
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
