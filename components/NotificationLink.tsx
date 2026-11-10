'use client';

import {useRef, useState, type MouseEvent, type ReactNode} from 'react';
import {markNotification, type ReadResult} from '../lib/notifications/client';

export default function NotificationLink({id, href, readAt, children, onRead}: {
  id: string;
  href: string;
  readAt: string | null;
  children: ReactNode;
  onRead: (result: ReadResult) => void;
}) {
  const writing = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function open(event: MouseEvent<HTMLAnchorElement>) {
    if (readAt || event.defaultPrevented) return;
    const sameTab = event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
    if (sameTab) event.preventDefault();
    if (writing.current) return;
    writing.current = true;
    setPending(true);
    setError('');
    try {
      onRead(await markNotification(id));
      if (sameTab) window.location.assign(href);
    } catch {
      setError('Chưa đánh dấu được thông báo. Vui lòng thử lại.');
    } finally {
      writing.current = false;
      setPending(false);
    }
  }

  return <>
    <a href={href} aria-busy={pending} onClick={open} onAuxClick={event => {
      if (event.button === 1) void open(event);
    }}>{children}</a>
    {error && <small role="alert">{error}</small>}
  </>;
}
