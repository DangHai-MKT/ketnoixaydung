import {requirePageActor} from '../../../lib/auth/server';
import {listPartnerRequests,partnerSchemaUnavailable,partnerStaff} from '../../../services/partner-requests';

export default async function Page({searchParams}:{searchParams:Promise<{page?:string}>}) {
  const actor = await requirePageActor('/admin/partner-requests',partnerStaff);
  const {page:raw} = await searchParams;
  const page = raw && /^\d{1,4}$/.test(raw) ? Math.max(1,Number(raw)) : 1;
  const rows = await listPartnerRequests(actor,true,page).catch(error=>{
    if (partnerSchemaUnavailable(error)) return null;
    throw error;
  });
  return <main className="partner-page">
    <header className="partner-hero"><h1>Nhu cầu tìm đối tác</h1><p>Chọn nhu cầu để xem công việc và gửi giới thiệu.</p></header>
    {rows===null ? <section className="partner-card"><p role="status">Cần áp dụng SQL 0014 để mở danh sách.</p></section> :
    <section className="partner-card">
      {rows.length ? <ul className="partner-items">{rows.slice(0,20).map(row=><li key={row.id}><a href={'/admin/partner-requests/'+row.id}>{row.trade}</a><small>{row.province} · {row.timing}</small></li>)}</ul>:<p>Chưa có nhu cầu ở trang này.</p>}
      <nav className="fw-actions">{page>1&&<a href={'?page='+(page-1)}>Trang trước</a>}{rows.length>20&&page<9999&&<a href={'?page='+(page+1)}>Trang sau</a>}</nav>
    </section>}
  </main>;
}
