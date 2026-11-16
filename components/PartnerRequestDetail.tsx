import {randomUUID} from 'node:crypto';
import {notFound} from 'next/navigation';
import {AccessError,type Actor} from '../lib/auth/permissions';
import {getPartnerRequest} from '../services/partner-requests';
import {closePartnerAction,introducePartnerAction,respondPartnerAction} from '../lib/site/partner-actions';
import {PartnerRequestForm,PartnerShare} from './PartnerRequestForm';

export default async function PartnerRequestDetail({id,actor,staff=false}:{id:string;actor:Actor|null;staff?:boolean}) {
  const item = await getPartnerRequest(id,actor,staff).catch(error=>{
    if (error instanceof AccessError && [400,404].includes(error.status)) notFound();
    throw error;
  });
  const href = '/find-partners/'+item.id;
  return <main className="partner-page">
    <a href={staff?'/admin/partner-requests':'/find-partners'}>← {staff?'Danh sách cần hỗ trợ':'Tìm đối tác'}</a>
    <header className="partner-hero"><h1>{item.trade}</h1><p>{item.province} · {item.closedAt?'Đã đóng':'Đang tìm đối tác'}</p></header>
    <div className="partner-layout">
      <section className="partner-card"><h2>Công việc cần làm</h2><p className="partner-text">{item.scope}</p><p><strong>Khi nào cần:</strong> {item.timing}</p>
        {item.owner && !staff && !item.closedAt && <><PartnerShare id={item.id}/>
          <details><summary>Đã tìm được đối tác?</summary><PartnerRequestForm action={closePartnerAction.bind(null,item.id)} label="Đóng nhu cầu"/></details></>}
        {!item.owner && !staff && !item.closedAt && (item.ownReply ? <p role="status">Bạn đã gửi phản hồi.</p> :
          actor?.status === 'active' ? <div className="fw-actions">
            <PartnerRequestForm action={respondPartnerAction.bind(null,item.id,'interested')} label="Tôi quan tâm"/>
            <PartnerRequestForm action={respondPartnerAction.bind(null,item.id,'referral')} label="Tôi có thể giới thiệu"/>
          </div> : <a className="button button-primary" href={'/login?next='+encodeURIComponent(href)}>Đăng nhập để phản hồi</a>)}
      </section>
      {(item.owner || staff) && <section className="partner-card">
        <h2>Phản hồi từ đối tác</h2>
        {item.replies.length ? <ul className="partner-items">{item.replies.map(reply=><li key={reply.id}><strong>{reply.name}</strong><small>{reply.kind==='interested'?'Quan tâm':'Có thể giới thiệu'}</small></li>)}</ul>:<p>Chưa có phản hồi.</p>}
        <h2>Đối tác do sàn giới thiệu</h2>
        {item.introductions.length ? <ul className="partner-items">{item.introductions.map(intro=><li key={intro.id}><strong>{intro.name}</strong><p className="partner-text">{intro.note}</p></li>)}</ul>:<p>Chưa có giới thiệu.</p>}
        {staff && !item.closedAt && <PartnerRequestForm action={introducePartnerAction.bind(null,item.id)} label="Gửi giới thiệu">
          <input type="hidden" name="requestId" value={randomUUID()}/>
          <label>Tên đơn vị<input name="name" required maxLength={150}/></label>
          <label>Kinh nghiệm phù hợp và cách liên hệ<textarea name="note" rows={3} required maxLength={1000}/></label>
          <p>Chỉ chia sẻ thông tin liên hệ khi đơn vị đã đồng ý.</p>
        </PartnerRequestForm>}
      </section>}
    </div>
  </main>;
}
