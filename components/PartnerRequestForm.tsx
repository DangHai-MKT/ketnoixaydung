'use client';

import {useActionState, useState, type ReactNode} from 'react';

export function PartnerRequestForm({action,label,children}:{action:(state:string,form:FormData)=>Promise<string>;label:string;children?:ReactNode}) {
  const [error, submit, pending] = useActionState(action,'');
  return <form action={submit} className="partner-form">
    <fieldset disabled={pending}>{children}<button type="submit" className="button button-primary">{pending?'Đang gửi…':label}</button></fieldset>
    {error && <p role="alert">{error}</p>}
  </form>;
}

export function PartnerShare({id}:{id:string}) {
  const [copied,setCopied] = useState(false);
  const [link,setLink] = useState('');
  async function copy() {
    const url = new URL('/find-partners/'+id,window.location.origin).href;
    setLink(url);
    try { await navigator.clipboard.writeText(url);setCopied(true); } catch { setCopied(false); }
  }
  return <div className="partner-share">
    <button type="button" className="button button-primary" onClick={copy}>Sao chép link mời qua Zalo</button>
    <p role="status">{copied?'Đã sao chép. Mở Zalo rồi dán vào cuộc trò chuyện.':'Chỉ gửi liên kết cho những người bạn muốn mời.'}</p>
    {link && !copied && <input aria-label="Liên kết mời" readOnly value={link} onFocus={event=>event.target.select()} />}
    {link && <a href="https://chat.zalo.me/" target="_blank" rel="noreferrer">Mở Zalo Web ↗</a>}
  </div>;
}
