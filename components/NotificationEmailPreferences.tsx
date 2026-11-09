'use client';

import {useState} from 'react';
import type {EmailPreferences} from '../services/notification-email-preferences';

export default function NotificationEmailPreferences() {
  const [preferences,setPreferences]=useState<EmailPreferences|null>(null);
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  async function request(method:'GET'|'PUT') {
    if(busy)return;
    setBusy(true);setError('');setMessage('');
    try {
      const response=await fetch('/api/notifications/preferences',method==='GET'?{cache:'no-store'}:{
        method,headers:{'Content-Type':'application/json'},body:JSON.stringify(preferences),
      });
      const result=await response.json().catch(()=>null);
      if(!response.ok||typeof result?.revision!=='number')throw new Error(result?.error||'Chưa thể tải tùy chọn email.');
      setPreferences(result);
      if(method==='PUT')setMessage('Đã lưu tùy chọn email.');
    } catch(cause) {setError(cause instanceof Error?cause.message:'Chưa thể kết nối.');}
    finally {setBusy(false);}
  }
  return <section className="notices-email" aria-label="Tùy chọn nhận email">
    <button type="button" className="button button-secondary" aria-expanded={open} onClick={()=>{
      if(!open&&!preferences)void request('GET');
      setOpen(!open);
    }}>Tùy chọn nhận email</button>
    {open&&<div className="notices-email-panel" aria-busy={busy}>
      <h2>Email nghiệp vụ</h2>
      <p>Chọn những cập nhật bạn muốn nhận qua email đã xác minh. Thông báo trên website và email bảo mật của tài khoản vẫn hoạt động theo quy trình hiện có.</p>
      {preferences&&<form onSubmit={event=>{event.preventDefault();void request('PUT');}}>
        <fieldset disabled={busy}>
          <label><input type="checkbox" checked={preferences.seller} onChange={event=>setPreferences({...preferences,seller:event.target.checked})}/> Kết quả xét duyệt hồ sơ nhà cung cấp</label>
          <label><input type="checkbox" checked={preferences.project} onChange={event=>setPreferences({...preferences,project:event.target.checked})}/> Kết quả kiểm duyệt tin dự án</label>
          <button type="submit" className="button button-primary">{busy?'Đang lưu…':'Lưu tùy chọn'}</button>
        </fieldset>
      </form>}
      {busy&&!preferences&&<p role="status">Đang tải tùy chọn…</p>}
      {error&&<p role="alert">{error} <button type="button" disabled={busy} onClick={()=>request('GET')}>Tải lại</button></p>}
      {message&&<p role="status">{message}</p>}
    </div>}
  </section>;
}
