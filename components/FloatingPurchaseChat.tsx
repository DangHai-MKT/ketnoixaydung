'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { formatNotificationDate } from '../lib/notifications/contracts';
import { chatMessageLimit, chatPath } from '../lib/projects/purchase-chat';
import { loadFloatingChat, sendFloatingChat } from '../lib/projects/purchase-chat-actions';
import Icon from './MarketplaceIcon';

type Thread = Extract<Awaited<ReturnType<typeof loadFloatingChat>>, { order: object }>;

export default function FloatingPurchaseChat({ purchaseId }: { purchaseId: string }) {
  const [open, setOpen] = useState(false);
  const [id, setId] = useState(purchaseId);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [thread, setThread] = useState<Thread>();
  const [conversations, setConversations] = useState<NonNullable<Thread['conversations']>>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const request = useRef<{ id: string; body: string; key: string } | null>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const draft = drafts[id] ?? '';

  function hide() {
    setOpen(false);
    launcher.current?.focus();
  }

  useEffect(() => {
    if (open) close.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let current = true;
    loadFloatingChat(id, page).then(result => {
      if (!current) return;
      if (result.order) {
        setThread(result);
        if (result.conversations) setConversations(result.conversations);
      } else setError(result.error);
    }).catch(() => {
      if (current) setError('Chưa tải được cuộc trò chuyện. Vui lòng thử lại.');
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => { current = false; };
  }, [open, id, page, revision]);

  useEffect(() => {
    if (thread && page === 1 && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [thread, page]);

  function load(nextId = id, nextPage = 1) {
    setLoading(true);
    setError('');
    setThread(undefined);
    setId(nextId);
    setPage(nextPage);
    setRevision(value => value + 1);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending || loading || !thread?.order.writable) return;
    if (request.current?.id !== id || request.current.body !== body) {
      request.current = { id, body, key: crypto.randomUUID() };
    }
    setSending(true);
    setError('');
    try {
      const result = await sendFloatingChat(id, request.current.key, body);
      if (result.ok) {
        request.current = null;
        setDrafts(previous => ({ ...previous, [id]: '' }));
        load();
      } else setError(result.error);
    } catch {
      setError('Chưa xác nhận được tin nhắn. Vui lòng thử lại.');
    } finally {
      setSending(false);
    }
  }

  return <>
    <button ref={launcher} className="dash-primary" type="button" aria-expanded={open} aria-controls="purchase-chat-window"
      onClick={() => { if (open) hide(); else { if (!sending) load(); setOpen(true); } }}>Trao đổi với người bán</button>
    {open && createPortal(<section id="purchase-chat-window" className="floating-purchase-chat" role="dialog" aria-label="Trao đổi với người bán"
      onKeyDown={event => { if (event.key === 'Escape') hide(); }}>
      <header className="floating-chat-header">
        <strong>Trao đổi dự án</strong>
        <div>
          <a href={chatPath('buyer', id)} title="Mở trang trò chuyện">Mở rộng ↗</a>
          <button ref={close} type="button" aria-label="Thu nhỏ chat" title="Thu nhỏ chat" onClick={hide}>−</button>
        </div>
      </header>
      <div className="floating-chat-layout">
        <nav aria-label="Các cuộc trao đổi" className="floating-chat-list">
          <strong>Dự án đã mua</strong>
          {conversations.map(item => <button key={item.id} type="button" aria-current={item.id === id ? 'true' : undefined}
            disabled={sending} onClick={() => load(item.id)}>
            <span className="floating-chat-icon"><Icon name="file" size={17}/></span>
            <span><b>{item.title}</b><small>Phiên bản {item.version}</small></span>
          </button>)}
          <a href="/account/purchases">Xem tất cả đơn mua →</a>
        </nav>
        <div className="floating-chat-conversation">
          <div className="floating-chat-project">
            <div><b>{thread?.order.title ?? 'Trao đổi với người bán'}</b>{thread && <small>Phiên bản {thread.order.version} · Người bán</small>}</div>
            <button type="button" disabled={loading || sending} onClick={() => load()}>Tải tin mới</button>
          </div>
          <div ref={scroll} className="floating-chat-scroll" aria-busy={loading}>
            {loading && <p role="status">Đang tải tin nhắn…</p>}
            {thread && <>
              <div className="floating-chat-pages">
                {page > 1 && <button type="button" disabled={sending} onClick={() => load(id, page - 1)}>Tin gần đây hơn</button>}
                {thread.hasOlder && page < 9999 && <button type="button" disabled={sending} onClick={() => load(id, page + 1)}>Tin cũ hơn</button>}
              </div>
              {thread.messages.length ? <ol className="purchase-chat-thread" aria-label="Lịch sử tin nhắn">
                {thread.messages.map(message => <li key={message.id} className={message.mine ? 'is-mine' : undefined}>
                  <header><strong>{message.mine ? 'Bạn' : 'Người bán'}</strong>
                    <time dateTime={message.createdAt}>{formatNotificationDate(message.createdAt)}</time></header>
                  <p>{message.body}</p>
                </li>)}
              </ol> : <p>Hãy hỏi người bán về đầu mối liên hệ, tiến độ hoặc cách gửi hồ sơ năng lực.</p>}
            </>}
          </div>
          {error && <p className="floating-chat-error" role="alert">{error}</p>}
          {thread?.order.writable && <form onSubmit={submit} className="floating-chat-compose">
            <textarea rows={2} maxLength={chatMessageLimit} aria-label="Nội dung tin nhắn" placeholder="Nhập tin nhắn…"
              value={draft} readOnly={sending} onChange={event => setDrafts({ ...drafts, [id]: event.target.value })}/>
            <button className="dash-primary" disabled={sending || !draft.trim()} type="submit">{sending ? 'Đang gửi…' : 'Gửi'}</button>
          </form>}
          {thread && !thread.order.writable && <p className="floating-chat-error">Đơn này chỉ cho phép xem lịch sử trao đổi.</p>}
        </div>
      </div>
    </section>, document.body)}
  </>;
}
