'use client';

import { useEffect } from 'react';
import { notificationUpdateEvent } from '../lib/notifications/contracts';
import { acknowledgeChatMessages } from '../lib/projects/purchase-chat-actions';
import type { ChatSide } from '../lib/projects/purchase-chat';

export default function PurchaseChatReadReceipt({ side, id, messages }: {
  side: ChatSide; id: string; messages: string[];
}) {
  useEffect(() => {
    function markRead() {
      if (document.hidden || !messages.length) return;
      void acknowledgeChatMessages(side, id, messages).then(counts => {
        if (counts) window.dispatchEvent(new Event(notificationUpdateEvent));
      }).catch(() => {});
    }
    markRead();
    document.addEventListener('visibilitychange', markRead);
    return () => document.removeEventListener('visibilitychange', markRead);
  }, [side, id, messages]);
  return null;
}
