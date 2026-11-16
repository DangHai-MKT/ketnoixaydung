import {randomUUID} from 'node:crypto';
import {getCurrentActor} from '../../../lib/auth/server';
import {provinceOptions} from '../../../lib/projects/locations';
import {createPartnerAction} from '../../../lib/site/partner-actions';
import {listPartnerRequests,partnerSchemaUnavailable} from '../../../services/partner-requests';
import {PartnerRequestForm} from '../../../components/PartnerRequestForm';

export const dynamic = 'force-dynamic';
export const metadata = {title:'Tìm đối tác xây dựng',robots:{index:false,follow:false}};

export default async function Page({searchParams}:{searchParams:Promise<{page?:string}>}) {
  const actor = await getCurrentActor();
  const signedIn = actor?.status === 'active';
  const {page:raw} = await searchParams;
  const page = raw && /^\d{1,4}$/.test(raw) ? Math.max(1,Number(raw)) : 1;
  const rows = signedIn ? await listPartnerRequests(actor,false,page).catch(error=>{
    if (partnerSchemaUnavailable(error)) return null;
    throw error;
  }) : [];
  return <main className="partner-page">
    <header className="partner-hero"><h1>Tìm đối tác xây dựng</h1><p>Cho biết bạn cần đội nào, ở đâu và khi nào. Sau đó, mời người quen qua Zalo hoặc chờ sàn giới thiệu.</p></header>
    {rows===null ? <section className="partner-card"><p role="status">Tính năng đang được thiết lập. Vui lòng quay lại sau.</p></section> : signedIn ? <div className="partner-layout">
      <section className="partner-card"><h2>Bạn cần đối tác cho việc gì?</h2>
        <PartnerRequestForm action={createPartnerAction} label="Tạo nhu cầu">
          <input type="hidden" name="requestId" value={randomUUID()}/>
          <label>Cần ai?<input name="trade" required maxLength={100} placeholder="Ví dụ: Đội thi công PCCC"/></label>
          <label>Ở đâu?<select name="province" required defaultValue=""><option value="">Chọn tỉnh hoặc thành phố</option>{provinceOptions.map(name=><option key={name}>{name}</option>)}</select></label>
          <label>Làm gì?<textarea name="scope" rows={3} required maxLength={600} placeholder="Ví dụ: Lắp đặt hệ thống PCCC cho nhà xưởng"/></label>
          <label>Khi nào cần?<input name="timing" required maxLength={100} placeholder="Ví dụ: Trong tháng tới"/></label>
          <p>Ai có liên kết mời đều xem được bốn mục này. Giữ riêng tên công trình nhạy cảm, địa chỉ cụ thể và thông tin liên hệ.</p>
        </PartnerRequestForm>
      </section>
      <section className="partner-card"><h2>Nhu cầu của bạn</h2>
        {rows.length ? <ul className="partner-items">{rows.slice(0,20).map(row=><li key={row.id}><a href={'/find-partners/'+row.id}>{row.trade}</a><small>{row.province} · {row.closedAt?'Đã đóng':'Đang tìm'}</small></li>)}</ul> : <p>Khi tạo nhu cầu, bạn có thể mở lại từ đây để xem phản hồi.</p>}
        <nav className="fw-actions">{page>1&&<a href={'?page='+(page-1)}>Trang trước</a>}{rows.length>20&&page<9999&&<a href={'?page='+(page+1)}>Trang sau</a>}</nav>
      </section>
    </div> : <section className="partner-card"><a className="button button-primary" href="/login?next=%2Ffind-partners">Đăng nhập để tạo nhu cầu</a></section>}
  </main>;
}
