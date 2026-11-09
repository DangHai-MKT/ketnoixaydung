'use client';

import {useEffect,useId,useRef,useState} from 'react';
import {formatNotificationDate,type NotificationPage} from '../lib/notifications/contracts';
import Icon from './MarketplaceIcon';

export default function NotificationBell({href,unread,onUnread}:{href:string;unread:number;onUnread:(count:number)=>void}) {
  const [open,setOpen]=useState(false),[data,setData]=useState<NotificationPage|null>(null),[error,setError]=useState('');
  const [attempt,setAttempt]=useState(0);
  const root=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null),panelId=useId();
  useEffect(()=>{
    if(!open)return;
    const controller=new AbortController();
    const dismiss=(event:PointerEvent)=>{if(event.target instanceof Node&&!root.current?.contains(event.target))setOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);button.current?.focus();}};
    document.addEventListener('pointerdown',dismiss);
    document.addEventListener('keydown',escape);
    fetch('/api/notifications?size=5',{cache:'no-store',signal:controller.signal})
      .then(async response=>{
        const result=await response.json().catch(()=>null);
        if(!response.ok||!Array.isArray(result?.rows)) throw new Error(result?.error||'Chưa tải được thông báo.');
        if(!controller.signal.aborted){setData(result);onUnread(result.unread);}
      }).catch(cause=>{if(!controller.signal.aborted)setError(cause.message||'Chưa tải được thông báo.');});
    return ()=>{
      controller.abort();document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',escape);
    };
  },[open,attempt,onUnread]);
  function reload() {setError('');setData(null);setAttempt(value=>value+1);}
  return <div className="notice-bell-wrap" ref={root}>
    <button type="button" className="dash-bell notice-bell-button" ref={button} aria-label={`Thông báo: ${unread} chưa đọc`}
      aria-expanded={open} aria-controls={open?panelId:undefined} onClick={()=>{setError('');setData(null);setOpen(!open);}}>
      <Icon name="bell" size={24}/>{unread>0&&<b>{unread>99?'99+':unread}</b>}
    </button>
    {open&&<section className="notice-popover" id={panelId} aria-label="Thông báo gần đây">
      <header><strong>Thông báo gần đây</strong><button type="button" onClick={()=>{setOpen(false);button.current?.focus();}} aria-label="Đóng thông báo">×</button></header>
      {error?<p role="alert">{error} <button type="button" onClick={reload}>Thử lại</button></p>:
        !data?<p role="status">Đang tải thông báo…</p>:!data.rows.length?<p>Chưa có thông báo.</p>:
        <ul>{data.rows.map(row=><li key={row.id} className={!row.readAt?'notice-unread':undefined}>
          <div>{!row.readAt&&<span className="notice-dot" aria-label="Chưa đọc"/>}
            {row.href?<a href={row.href}>{row.title}</a>:<strong>{row.title}</strong>}</div>
          <time dateTime={row.createdAt}>{formatNotificationDate(row.createdAt)}</time>
        </li>)}</ul>}
      <footer><a href={href} onClick={()=>setOpen(false)}>Xem tất cả thông báo →</a></footer>
    </section>}
  </div>;
}
