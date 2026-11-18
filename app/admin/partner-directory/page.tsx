import {desc,sql} from 'drizzle-orm';
import {db} from '../../../db/client';
import {partnerCompanies} from '../../../db/schema';
import {requirePageActor} from '../../../lib/auth/server';
import {partnerSchemaUnavailable,partnerStaff} from '../../../services/partner-requests';
import PartnerDirectoryImport from '../../../components/PartnerDirectoryImport';
import YellowPagesImport from '../../../components/YellowPagesImport';
import {setCompanyPublication} from '../../../lib/site/partner-directory-actions';
import {profileFields} from '../../../lib/site/partner-directory-csv';

export default async function Page({searchParams}:{searchParams:Promise<{page?:string}>}) {
  await requirePageActor('/admin/partner-directory',partnerStaff);
  const {page:raw}=await searchParams;
  const page=typeof raw==='string' && /^[1-9]\d{0,3}$/.test(raw) ? Number(raw) : 1;
  const data=await Promise.all([
    db.select()
      .from(partnerCompanies).orderBy(desc(partnerCompanies.createdAt),desc(partnerCompanies.id)).limit(20).offset((page-1)*20),
    db.select({total:sql<number>`count(*)::int`}).from(partnerCompanies),
  ]).catch(error=>{if(partnerSchemaUnavailable(error)) return null;throw error;});
  return <main className="partner-page">
    <a href="/admin/partner-requests">← Nhu cầu tìm đối tác</a>
    <header className="partner-hero"><h1>Danh bạ doanh nghiệp</h1><p>Nhập danh sách doanh nghiệp để bộ phận hỗ trợ dùng khi tìm đối tác.</p></header>
    {data ? <div className="partner-layout">
      <section className="partner-card"><h2>Nhập từ Trang Vàng</h2>
        <p>Dán một liên kết hồ sơ để lấy tên, chuyên môn, tỉnh/thành, mã số thuế và website. Kiểm tra dữ liệu trước khi lưu.</p>
        <YellowPagesImport/>
        <hr/>
        <h2>Nhập từ CSV</h2>
        <p>Xóa hai dòng minh họa trước khi nhập. Giữ tiêu đề cột. Mã số thuế và website có thể để trống. Chỉ nhập dữ liệu bạn được phép sử dụng.</p>
        <PartnerDirectoryImport/>
      </section>
      <section className="partner-card"><h2>{data[1][0].total} hồ sơ đã nhập</h2>
        {data[0].length ? <ul className="partner-items">{data[0].map(row=>
          <li key={row.id}><strong>{row.name}</strong><small>{row.trade} · {row.province} · {row.publishedAt?'Đang công khai':'Nội bộ'}</small>
            <details><summary>Xem hồ sơ và trạng thái công khai</summary>
              <a href={row.sourceUrl} target="_blank" rel="noreferrer">Đối chiếu nguồn</a>
              <dl>{profileFields.map(([key,,label])=>row.profile[key]&&<div key={key}><dt>{label}</dt><dd>{row.profile[key]}</dd></div>)}</dl>
              <form action={setCompanyPublication.bind(null,row.id,!row.publishedAt)}>
                {!row.publishedAt&&<label><input type="checkbox" name="reviewed" required/> Tôi đã kiểm tra thông tin và có quyền công khai đầu mối doanh nghiệp trong hồ sơ.</label>}
                <div><button className="button button-secondary">{row.publishedAt?'Ẩn khỏi danh bạ công khai':'Công khai hồ sơ'}</button></div>
              </form>
            </details>
          </li>)}</ul>:<p>Trang này chưa có hồ sơ.</p>}
        <nav className="fw-actions" aria-label="Phân trang hồ sơ">{page>1&&<a href={'?page='+(page-1)}>Trang trước</a>}
          {page*20<data[1][0].total&&page<9999&&<a href={'?page='+(page+1)}>Trang sau</a>}</nav>
      </section>
    </div> : <section className="partner-card"><p role="status">Cần áp dụng SQL 0015 để mở công cụ nhập CSV.</p><a href="/mau-ho-so-doanh-nghiep.csv" download>Tải CSV mẫu</a></section>}
  </main>;
}
