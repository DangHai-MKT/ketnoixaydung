'use client';
import {useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {categoryLabels,formatPoints} from '../lib/projects/workflow';
import {watchDays,watchPrice,type WatchPeriod} from '../lib/projects/watch';
import {formatNotificationDate} from '../lib/notifications/contracts';

type Dashboard={periods:WatchPeriod[];balance:string;emailVerified:boolean;observedAt:number};
const api='/api/account/project-watch';
const fullDate=(time:number)=>formatNotificationDate(new Date(time).toISOString());
export default function ProjectWatchManager({initial,initialCategory}:{initial:Dashboard;initialCategory:string}) {
  const router=useRouter();
  const [category,setCategory]=useState(initialCategory),[email,setEmail]=useState(false),[busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const [local,setLocal]=useState<{source:Dashboard;data:Dashboard}|null>(null);
  const data=local?.source===initial?local.data:initial;
  const request=useRef<{fingerprint:string;id:string}|null>(null), lock=useRef(false);
  const now=data.observedAt;
  const latest=data.periods.find(period=>period.category===category);
  const active=data.periods.find(period=>period.category===category&&Date.parse(period.startsAt)<=now&&Date.parse(period.endsAt)>now);
  const queued=latest&&Date.parse(latest.startsAt)>now;
  const starts=active?Date.parse(active.endsAt):now,ends=starts+watchDays*86400000;
  const insufficient=BigInt(data.balance)<watchPrice;
  async function purchase() {
    if(lock.current||queued||insufficient)return;
    if(!window.confirm(`Xác nhận trả ${formatPoints(watchPrice)} POINT để theo dõi ${categoryLabels[category]} trong ${watchDays} ngày?`))return;
    const fingerprint=[category,latest?.id,email].join(':');
    if(request.current?.fingerprint!==fingerprint)request.current={fingerprint,id:crypto.randomUUID()};
    lock.current=true;setBusy(true);setError('');setNotice('');
    try {
      const response=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        category,email,expectedLatestId:latest?.id??null,requestId:request.current.id,
      })});
      const result=await response.json().catch(()=>null);
      if(!response.ok||!result?.period)throw new Error(result?.error||'Chưa xác nhận được giao dịch. Thử lại để đối soát cùng mã yêu cầu.');
      const period=result.period as WatchPeriod;
      setLocal({source:initial,data:{...data,periods:[period,...data.periods.filter(row=>row.id!==period.id)],
        observedAt:Date.now(),balance:typeof result.balance==='string'?result.balance:data.balance}});
      request.current=null;setNotice('Đã thanh toán. Kỳ theo dõi có hiệu lực từ '+formatNotificationDate(period.startsAt)+'.');router.refresh();
    } catch(cause) {setError(cause instanceof Error?cause.message:'Chưa xác nhận được giao dịch. Vui lòng thử lại.');}
    finally {lock.current=false;setBusy(false);}
  }
  async function changeEmail(next:boolean) {
    if(lock.current)return;
    lock.current=true;setBusy(true);setError('');setNotice('');
    try {
      const response=await fetch(api,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({category,email:next})});
      const result=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(result?.error||'Chưa cập nhật được tùy chọn email.');
      setLocal({source:initial,data:{...data,periods:data.periods.map(row=>row.category===category&&Date.parse(row.endsAt)>now?{...row,email:next}:row)}});
      setNotice(next?'Đã bật nhận email.':'Đã tắt nhận email.');router.refresh();
    } catch(cause) {setError(cause instanceof Error?cause.message:'Chưa thể kết nối.');}
    finally {lock.current=false;setBusy(false);}
  }
  return <main className="notices-page">
    <header className="notices-header"><div className="notices-heading"><div><h1>Theo dõi dự án</h1>
      <p>Nhận tin khi dự án trong lĩnh vực bạn chọn lần đầu được công bố.</p></div></div><a href="/account/notifications">Mở Trung tâm thông báo →</a></header>
    <section className="watch-panel" aria-label="Chọn gói theo dõi">
      <div className="watch-details"><label>Lĩnh vực<select value={category} disabled={busy} onChange={event=>{setCategory(event.target.value);setEmail(false);setError('');setNotice('');}}>
        {Object.entries(categoryLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}
      </select></label><div><strong>{formatPoints(watchPrice)} POINT / {watchDays} ngày</strong><p>Số dư khả dụng {formatPoints(data.balance)} POINT</p></div></div>
      {active&&<p>Đang theo dõi đến <strong>{formatNotificationDate(active.endsAt)}</strong>.</p>}
      {queued?<p>Kỳ kế tiếp đã thanh toán, từ {formatNotificationDate(latest.startsAt)} đến {formatNotificationDate(latest.endsAt)}.</p>:<>
        <p>{active?'Kỳ gia hạn dự kiến':'Kỳ theo dõi dự kiến'} từ {fullDate(starts)} đến {fullDate(ends)}.</p>
        <label className="watch-check"><input type="checkbox" checked={email} disabled={busy||!data.emailVerified} onChange={event=>setEmail(event.target.checked)}/> Nhận thêm qua email đã xác minh</label>
        {!data.emailVerified&&<p><a href="/verify-email">Xác minh email</a> để chọn kênh email.</p>}
        {insufficient?<p role="status">Số dư chưa đủ. <a href="/account/wallet/top-up">Nạp POINT →</a></p>:
          <button className="button button-primary" type="button" disabled={busy} onClick={purchase}>{busy?'Đang xử lý…':active?'Xác nhận gia hạn':'Xác nhận đăng ký'}</button>}
      </>}
      <p>Thông báo trên website được bao gồm. Gói không tự gia hạn. Quyền xem thông tin bảo vệ được mua riêng theo từng dự án.</p>
      {(active||queued)&&<button className="button button-secondary" type="button" disabled={busy||(!data.emailVerified&&!active?.email&&!latest?.email)}
        onClick={()=>changeEmail(!(active?.email??latest?.email))}>{(active?.email??latest?.email)?'Tắt email cho lĩnh vực này':'Bật email cho lĩnh vực này'}</button>}
      {error&&<p className="auth-error" role="alert">{error} <button type="button" disabled={busy} onClick={()=>router.refresh()}>Tải lại thông tin</button></p>}
      {notice&&<p role="status">{notice}</p>}
    </section>
    <section className="watch-panel"><h2>Các kỳ theo dõi gần đây</h2>
      {data.periods.length?<ul className="watch-periods">{data.periods.map(period=><li key={period.id}>
        <strong>{categoryLabels[period.category]}</strong><span>{Date.parse(period.startsAt)>now?'Chờ bắt đầu':Date.parse(period.endsAt)>now?'Đang theo dõi':'Đã hết hạn'}</span>
        <time dateTime={period.endsAt}>Đến {formatNotificationDate(period.endsAt)}</time>
      </li>)}</ul>:<p>Bạn chưa có gói theo dõi.</p>}
    </section>
  </main>;
}
