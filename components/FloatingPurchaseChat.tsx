'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { formatNotificationDate, notificationUpdateEvent } from '../lib/notifications/contracts';
import { chatMessageLimit, chatPath, type ChatSide } from '../lib/projects/purchase-chat';
import { acknowledgeChatMessages, loadChatUnread, loadFloatingChat, sendFloatingChat } from '../lib/projects/purchase-chat-actions';
import Icon from './MarketplaceIcon';

type Thread = Extract<Awaited<ReturnType<typeof loadFloatingChat>>, { order: object }>;

export default function FloatingPurchaseChat({ purchaseId = '', side = 'buyer' }: { purchaseId?: string; side?: ChatSide }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [id, setId] = useState(purchaseId);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [thread, setThread] = useState<Thread>();
  const [conversations, setConversations] = useState<NonNullable<Thread['conversations']>>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [sendError, setSendError] = useState('');
  const [empty, setEmpty] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const request = useRef<{ id: string; body: string; key: string } | null>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const close = useRef<HTMLButtonElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const selectedId = thread?.selectedId ?? id;
  const draft = drafts[selectedId] ?? '';
  const peer = side === 'buyer' ? 'Người bán' : 'Người mua';
  const title = side === 'buyer' ? 'Trao đổi với người bán' : 'Trao đổi với người mua';
  const unreadTotal = Object.values(unread).reduce((total, count) => total + count, 0);

  function hide() {
    restoreFocus.current = true;
    setOpen(false);
  }

  useEffect(() => {
    if (open) close.current?.focus();
    else if (restoreFocus.current) {
      launcher.current?.focus();
      restoreFocus.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (open && page === 1) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function refreshUnread() {
      try {
        if (document.hidden) return;
        const counts = await loadChatUnread(side);
        if (!stopped && counts) setUnread(counts);
      } catch {
        // Keep the last confirmed count until the next refresh.
      } finally {
        if (!stopped) timer = setTimeout(() => void refreshUnread(), 12000);
      }
    }
    void refreshUnread();
    return () => { stopped = true; clearTimeout(timer); };
  }, [open, page, side]);

  useEffect(() => {
    if (!open) return;
    let current = true;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh(initial: boolean) {
      try {
        if (!initial && document.hidden) return;
        const result = await loadFloatingChat(side, id, page, initial || page === 1);
        if (!current) return;
        if (result.unread) setUnread(result.unread);
        setLoadError(result.error ?? '');
        if (result.conversations) setConversations(result.conversations);
        setEmpty(Boolean(result.empty));
        if (result.order) {
          if (!id) setId(result.selectedId);
          setThread(previous => {
            if (previous?.selectedId === result.selectedId && previous.order.writable === result.order.writable
              && previous.hasOlder === result.hasOlder && previous.messages.length === result.messages.length
              && previous.messages.every((message, index) => message.id === result.messages[index].id)) return previous;
            return result;
          });
          if (!document.hidden && result.unread[chatPath(side, result.selectedId)]) {
            const seen = result.messages.filter(message => !message.mine).map(message => message.id);
            try {
              const counts = await acknowledgeChatMessages(side, result.selectedId, seen);
              if (counts) {
                if (current) setUnread(counts);
                window.dispatchEvent(new Event(notificationUpdateEvent));
              }
            } catch {
              // Leave the count in place and retry on the next refresh.
            }
          }
        } else if (result.error) {
          setThread(undefined);
        }
      } catch {
        if (current) setLoadError('Kết nối chat bị gián đoạn.');
      } finally {
        if (current) {
          setLoading(false);
          if (page === 1) timer = setTimeout(() => void refresh(false), 4000);
        }
      }
    }
    void refresh(true);
    return () => { current = false; clearTimeout(timer); };
  }, [open, side, id, page, revision]);

  useEffect(() => {
    if (thread && page === 1 && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [thread, page]);

  function load(nextId = selectedId, nextPage = 1) {
    setLoading(true);
    setLoadError('');
    setSendError('');
    setEmpty(false);
    setThread(undefined);
    setId(nextId);
    setPage(nextPage);
    setRevision(value => value + 1);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending || loading || !thread?.order.writable) return;
    if (request.current?.id !== selectedId || request.current.body !== body) {
      request.current = { id: selectedId, body, key: crypto.randomUUID() };
    }
    setSending(true);
    setSendError('');
    try {
      const result = await sendFloatingChat(side, selectedId, request.current.key, body);
      if (result.ok) {
        request.current = null;
        setDrafts(previous => ({ ...previous, [selectedId]: '' }));
        load(selectedId);
      } else setSendError(result.error);
    } catch {
      setSendError('Chưa xác nhận được tin nhắn. Vui lòng thử lại.');
    } finally {
      setSending(false);
    }
  }

  return <>
    {purchaseId && <button className="dash-primary" type="button" aria-expanded={open}
      disabled={sending} onClick={() => { load(purchaseId); setOpen(true); }}>{title}</button>}
    {!open && <button ref={launcher} className="floating-chat-launcher" type="button"
      aria-label={unreadTotal ? `Mở cửa sổ chat, ${unreadTotal} tin chưa đọc` : 'Mở cửa sổ chat'}
      onClick={() => { if (!sending) load(); setOpen(true); }}>
      <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16v12H9l-5 4zM8 8h8m-8 4h5"/></svg> Chat
      {unreadTotal > 0 && <span className="floating-chat-unread" aria-hidden="true">{unreadTotal > 99 ? '99+' : unreadTotal}</span>}
    </button>}
    {open && createPortal(<section id="purchase-chat-window" className="floating-purchase-chat" role="dialog" aria-label="Trao đổi với người bán"
      onKeyDown={event => { if (event.key === 'Escape') hide(); }}>
      <header className="floating-chat-header">
        <strong>Trao đổi dự án</strong>
        <div>
          {selectedId && <a href={chatPath(side, selectedId)} title="Mở trang trò chuyện">Mở rộng ↗</a>}
          <button ref={close} type="button" aria-label="Thu nhỏ chat" title="Thu nhỏ chat" onClick={hide}>−</button>
        </div>
      </header>
      <div className="floating-chat-layout">
        <nav aria-label="Các cuộc trao đổi" className="floating-chat-list">
          <strong>{side === 'buyer' ? 'Dự án đã mua' : 'Đơn đã bán'}</strong>
          {conversations.map(item => {
            const count = unread[chatPath(side, item.id)] ?? 0;
            return <button key={item.id} type="button" aria-current={item.id === selectedId ? 'true' : undefined}
            disabled={sending} onClick={() => load(item.id)}>
            <span className="floating-chat-icon"><Icon name="file" size={17}/></span>
            <span><b>{item.title}</b><small>Phiên bản {item.version}</small></span>
            {count > 0 && <span className="floating-chat-unread" aria-label={`${count} tin chưa đọc`}>{count > 99 ? '99+' : count}</span>}
          </button>;})}
          <a href={side === 'buyer' ? '/account/purchases' : '/seller/transactions'}>Xem tất cả giao dịch →</a>
        </nav>
        <div className="floating-chat-conversation">
          <div className="floating-chat-project">
            <div><b>{thread?.order.title ?? title}</b>{thread && <small>Phiên bản {thread.order.version} · {peer}</small>}</div>
            {thread && page === 1 && <small>Tự cập nhật</small>}
          </div>
          <div ref={scroll} className="floating-chat-scroll" aria-busy={loading}>
            {loading && <p role="status">Đang tải tin nhắn…</p>}
            {empty && <p>Chưa có giao dịch hoàn tất để trao đổi.</p>}
            {thread && <>
              <div className="floating-chat-pages">
                {page > 1 && <button type="button" disabled={sending} onClick={() => load(selectedId, page - 1)}>Tin gần đây hơn</button>}
                {thread.hasOlder && page < 9999 && <button type="button" disabled={sending} onClick={() => load(selectedId, page + 1)}>Tin cũ hơn</button>}
              </div>
              {thread.messages.length ? <ol className="purchase-chat-thread" aria-label="Lịch sử tin nhắn">
                {thread.messages.map(message => <li key={message.id} className={message.mine ? 'is-mine' : undefined}>
                  <header><strong>{message.mine ? 'Bạn' : peer}</strong>
                    <time dateTime={message.createdAt}>{formatNotificationDate(message.createdAt)}</time></header>
                  <p>{message.body}</p>
                </li>)}
              </ol> : <p>{side === 'buyer' ? 'Hãy hỏi người bán về đầu mối liên hệ, tiến độ hoặc cách gửi hồ sơ năng lực.' : 'Cuộc trao đổi chưa có tin nhắn.'}</p>}
            </>}
          </div>
          {loadError && <p className="floating-chat-error" role="alert">{loadError}{' '}
            <button type="button" disabled={sending} onClick={() => load(selectedId, page)}>Thử lại</button></p>}
          {sendError && <p className="floating-chat-error" role="alert">{sendError}</p>}
          {thread?.order.writable && <form onSubmit={submit} className="floating-chat-compose">
            <textarea rows={2} maxLength={chatMessageLimit} aria-label="Nội dung tin nhắn" placeholder="Nhập tin nhắn…"
              value={draft} readOnly={sending} onChange={event => setDrafts(previous => ({ ...previous, [selectedId]: event.target.value }))}/>
            <button className="dash-primary" disabled={sending || !draft.trim()} type="submit">{sending ? 'Đang gửi…' : 'Gửi'}</button>
          </form>}
          {thread && !thread.order.writable && <p className="floating-chat-error">Đơn này chỉ cho phép xem lịch sử trao đổi.</p>}
        </div>
      </div>
    </section>, document.body)}
  </>;
}
