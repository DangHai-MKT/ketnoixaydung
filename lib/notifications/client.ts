import {notificationUpdateEvent} from './contracts';

export type ReadResult = {unread: number; readAt?: string};

export async function markNotification(id?: string): Promise<ReadResult> {
  const response = await fetch('/api/notifications/' + (id ? encodeURIComponent(id) + '/read' : 'read-all'), {
    method: 'POST',
    keepalive: true,
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !Number.isSafeInteger(result?.unread) || result.unread < 0) {
    throw new Error(result?.error || 'Chưa cập nhật được thông báo. Vui lòng thử lại.');
  }
  window.dispatchEvent(new CustomEvent(notificationUpdateEvent, {detail: result.unread}));
  return result;
}
