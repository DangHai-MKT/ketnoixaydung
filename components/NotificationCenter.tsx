'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import Icon from './MarketplaceIcon';
import {formatNotificationDate,type NotificationPage} from '../lib/notifications/contracts';
import {markNotification,type ReadResult} from '../lib/notifications/client';
import NotificationEmailPreferences from './NotificationEmailPreferences';
import NotificationLink from './NotificationLink';

export default function NotificationCenter({initial,base,filter,page,emailEnabled}:{
  initial:NotificationPage;base:string;filter:'all'|'unread';page:number;emailEnabled:boolean;
}) {
  const router=useRouter();
  const [pending,setPending]=useState<string|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [override,setOverride]=useState<{source:NotificationPage;data:NotificationPage}|null>(null);
  const data=override?.source===initial?override.data:initial;
  function href(nextFilter:'all'|'unread',nextPage=1) {
    const params=new URLSearchParams();
    if(nextFilter==='unread')params.set('filter','unread');
    if(nextPage>1)params.set('page',String(nextPage));
    return base+(params.size?'?'+params:'');
  }
  function applyRead(result:ReadResult,id?:string) {
    const readAt=result.readAt??new Date().toISOString();
    setOverride(previous=>{
      const current=previous?.source===initial?previous.data:initial;
      const rows=current.rows.map(row=>!row.readAt&&(!id||row.id===id)?{...row,readAt}:row);
      return {source:initial,data:{...current,unread:result.unread,rows:filter==='unread'?rows.filter(row=>!row.readAt):rows}};
    });
  }
  async function mark(id?:string) {
    if(pending)return;
    setPending(id??'all');setError('');setNotice('');
    try {
      applyRead(await markNotification(id),id);
      setNotice(id?'Đã đánh dấu thông báo đã đọc.':'Đã đánh dấu tất cả thông báo đã đọc.');
      if(filter==='unread'&&page>1)router.replace(href('unread'));
      router.refresh();
    } catch(cause) {setError(cause instanceof Error?cause.message:'Chưa thể kết nối. Vui lòng thử lại.');}
    finally {setPending(null);}
  }

  return <main className="notices-page">
    <header className="notices-header">
      <div className="notices-heading"><span aria-hidden="true"><Icon name="bell" size={27}/></span>
        <div><h1>Thông báo của tôi</h1><p>Cập nhật về tài khoản, dự án và giao dịch của bạn.</p></div></div>
      <button className="button button-secondary" type="button" disabled={!data.unread||Boolean(pending)} onClick={()=>mark()}>
        {pending==='all'?'Đang cập nhật…':'Đánh dấu tất cả đã đọc'}</button>
    </header>
    {emailEnabled&&<NotificationEmailPreferences/>}
    <div className="notices-sheet" aria-busy={Boolean(pending)}>
      <nav className="notices-filters" aria-label="Lọc thông báo">
        <a href={href('all')} aria-current={filter==='all'?'page':undefined}>Tất cả</a>
        <a href={href('unread')} aria-current={filter==='unread'?'page':undefined}>Chưa đọc <span>{data.unread}</span></a>
      </nav>
      {error&&<p className="notices-feedback auth-error" role="alert">{error}</p>}
      {notice&&<p className="notices-feedback" role="status">{notice}</p>}
      {data.rows.length>0?<ul className="notices-list">{data.rows.map(row=><li key={row.id} className={!row.readAt?'notice-unread':undefined}>
        <span className="notice-icon" aria-hidden="true"><Icon name="bell" size={18}/></span>
        <div className="notice-copy"><div className="notice-title"><h2>{row.title}</h2><span className={row.readAt?'notice-read':undefined}>{row.readAt?'Đã xem':'Chưa đọc'}</span></div>
          <p>{row.body}</p><time dateTime={row.createdAt}>{formatNotificationDate(row.createdAt)}</time>
          <div className="notice-actions">
            {row.href&&<NotificationLink id={row.id} href={row.href} readAt={row.readAt} onRead={result=>applyRead(result,row.id)}>Xem chi tiết <span aria-hidden="true">→</span></NotificationLink>}
            {!row.readAt&&<button type="button" disabled={Boolean(pending)} onClick={()=>mark(row.id)} aria-label={'Đánh dấu đã đọc: '+row.title}>
              {pending===row.id?'Đang cập nhật…':'Đánh dấu đã đọc'}</button>}
          </div>
        </div>
      </li>)}</ul>:<div className="notices-empty">
        <Icon name="bell" size={32}/><h2>{page>1?'Trang này không còn thông báo':filter==='unread'?'Bạn đã đọc hết thông báo':'Chưa có thông báo'}</h2>
        <p>{filter==='unread'?'Bạn vẫn có thể xem lại các thông báo trước đây.':'Thông báo về hoạt động tài khoản của bạn sẽ xuất hiện tại đây.'}</p>
        {(filter==='unread'||page>1)&&<a href={href('all')}>Xem tất cả thông báo →</a>}
      </div>}
      {(page>1||data.hasNext)&&<nav className="notices-pagination" aria-label="Phân trang thông báo">
        {page>1&&<a href={href(filter,page-1)}>← Trang trước</a>}<span>Trang {page}</span>
        {data.hasNext&&page<9999&&<a href={href(filter,page+1)}>Trang sau →</a>}
      </nav>}
    </div>
  </main>;
}
