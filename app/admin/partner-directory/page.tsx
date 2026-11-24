import Link from 'next/link';
import {and,desc,eq,ilike,isNull,isNotNull,or,sql} from 'drizzle-orm';
import {db} from '../../../db/client';
import {partnerCompanies as companies} from '../../../db/schema';
import {requirePageActor} from '../../../lib/auth/server';
import {partnerSchemaUnavailable,partnerStaff} from '../../../services/partner-requests';
import PartnerDirectoryImport from '../../../components/PartnerDirectoryImport';
import YellowPagesImport from '../../../components/YellowPagesImport';
import CompanyDirectoryAdminTable from '../../../components/CompanyDirectoryAdminTable';
import {provinceOptions} from '../../../lib/projects/locations';

type Query={import?:string;page?:string;q?:string;province?:string;status?:string;quality?:string;size?:string};
export default async function Page({searchParams}:{searchParams:Promise<Query>}) {
  await requirePageActor('/admin/partner-directory',partnerStaff);
  const params=await searchParams;
  const rawPage=typeof params.page==='string'&&/^[1-9]\d{0,3}$/.test(params.page)?Number(params.page):1;
  const keyword=typeof params.q==='string'?params.q.trim().slice(0,100):'';
  const province=typeof params.province==='string'&&provinceOptions.includes(params.province)?params.province:'';
  const status=['public','internal'].includes(params.status??'')?params.status:'';
  const quality=['review','ready','contact'].includes(params.quality??'')?params.quality:'';
  const size=['20','50','100'].includes(params.size??'')?Number(params.size):50;
  const hasContact=sql<boolean>`(coalesce(${companies.profile}->>'phone','')<>'' OR coalesce(${companies.profile}->>'hotline','')<>'' OR coalesce(${companies.profile}->>'email','')<>'' OR coalesce(${companies.profile}->>'zalo','')<>'')`;
  const review=sql<boolean>`(NOT ${hasContact} OR coalesce(${companies.profile}->>'ward','')='' OR coalesce(${companies.profile}->>'addressStatus','')='review')`;
  const pattern='%'+keyword.replace(/[\\%_]/g,'\\$&')+'%';
  const where=and(keyword?or(ilike(companies.name,pattern),ilike(companies.trade,pattern),ilike(companies.taxCode,pattern)):undefined,
    province?eq(companies.province,province):undefined,status==='public'?isNotNull(companies.publishedAt):status==='internal'?isNull(companies.publishedAt):undefined,
    quality==='review'?review:quality==='ready'?sql`NOT ${review}`:quality==='contact'?sql`NOT ${hasContact}`:undefined);
  const totals=await Promise.all([
    db.select({total:sql<number>`count(*)::int`,published:sql<number>`count(*) FILTER (WHERE ${companies.publishedAt} IS NOT NULL)::int`,
      review:sql<number>`count(*) FILTER (WHERE ${review})::int`}).from(companies),
    db.select({count:sql<number>`count(*)::int`}).from(companies).where(where),
  ]).catch(error=>{if(partnerSchemaUnavailable(error))return null;throw error;});
  if(!totals)return <main className="partner-page"><h1>Danh bạ doanh nghiệp</h1><p>Cần áp dụng SQL 0015 để mở danh bạ.</p></main>;
  const total=totals[0][0], matched=totals[1][0].count;
  const pages=Math.max(1,Math.ceil(matched/size)),page=Math.min(rawPage,pages);
  const rows=await db.select({id:companies.id,name:companies.name,trade:companies.trade,province:companies.province,
    ward:sql<string>`coalesce(${companies.profile}->>'ward','')`,addressStatus:sql<string>`coalesce(${companies.profile}->>'addressStatus','')`,
    hasContact,published:sql<boolean>`${companies.publishedAt} IS NOT NULL`}).from(companies).where(where)
    .orderBy(desc(companies.createdAt),desc(companies.id)).limit(size).offset((page-1)*size);
  const filters={q:keyword,province,status:status??'',quality:quality??'',size:String(size)};
  const pageHref=(next:number)=>'/admin/partner-directory?'+new URLSearchParams({...filters,page:String(next)});
  const returnTo=pageHref(page);
  const number=(n:number)=>n.toLocaleString('vi-VN');
  return <main className="partner-page directory-admin">
    <Link className="directory-back" href="/admin/partner-requests">← Nhu cầu tìm đối tác</Link>
    <header className="directory-admin-header"><div><p>QUẢN LÝ ĐỐI TÁC</p><h1>Danh bạ doanh nghiệp</h1>
      <span>Lọc đúng nhóm. Kiểm tra ngoại lệ. Công khai nhiều hồ sơ cùng lúc.</span></div><a className="button button-primary" href={returnTo+'&import=1#nhap-doanh-nghiep'}>+ Nhập doanh nghiệp</a></header>
    <div className="directory-stats">
      <Link href="/admin/partner-directory"><span>Tất cả doanh nghiệp</span><strong>{number(total.total)}</strong><small>Hồ sơ trong danh bạ</small></Link>
      <Link href="/admin/partner-directory?status=public"><span>Đang công khai</span><strong>{number(total.published)}</strong><small>Khách hàng có thể tìm thấy</small></Link>
      <Link href="/admin/partner-directory?status=internal"><span>Chưa công khai</span><strong>{number(total.total-total.published)}</strong><small>Hồ sơ nội bộ</small></Link>
      <Link className="needs-review" href="/admin/partner-directory?quality=review"><span>Cần kiểm tra thông tin</span><strong>{number(total.review)}</strong><small>Thiếu liên hệ hoặc địa chỉ chưa rõ</small></Link>
    </div>
    <details open={params.import==='1'} id="nhap-doanh-nghiep" className="directory-import-panel"><summary>Nhập doanh nghiệp <span>CSV hàng loạt hoặc một hồ sơ Trang Vàng</span></summary>
      <div className="directory-import-grid"><section><h2>Nhập danh sách từ CSV</h2><p>Tối đa 10 MB và 10.000 hồ sơ / tệp. Bỏ qua hồ sơ trùng, tự đối chiếu phường/xã. Hồ sơ mới được lưu nội bộ để bạn kiểm tra trước khi công khai.</p><PartnerDirectoryImport/></section>
        <section><h2>Lấy một hồ sơ Trang Vàng</h2><p>Dán liên kết hoặc dùng tệp HTML đã lưu. Chỉ nhập thông tin bạn được phép sử dụng.</p><YellowPagesImport/></section></div>
    </details>
    <section className="directory-management" aria-label="Danh sách doanh nghiệp">
      <form className="directory-filter-form" action="/admin/partner-directory">
        <label className="directory-keyword">Tìm doanh nghiệp<input name="q" defaultValue={keyword} maxLength={100} placeholder="Tên công ty, mã số thuế, chuyên môn…"/></label>
        <label>Tỉnh / thành<select name="province" defaultValue={province}><option value="">Tất cả địa bàn</option>{provinceOptions.map(p=><option key={p}>{p}</option>)}</select></label>
        <label>Hiển thị<select name="status" defaultValue={status}><option value="">Tất cả trạng thái</option><option value="internal">Nội bộ</option><option value="public">Công khai</option></select></label>
        <label>Thông tin cần xử lý<select name="quality" defaultValue={quality}><option value="">Tất cả hồ sơ</option><option value="review">Cần kiểm tra</option><option value="contact">Thiếu liên hệ</option><option value="ready">Đủ thông tin cơ bản</option></select></label>
        <label>Số dòng<select name="size" defaultValue={String(size)}>{[20,50,100].map(n=><option key={n} value={n}>{n} / trang</option>)}</select></label>
        <button className="button button-primary" type="submit">Lọc danh sách</button>
      </form>
      <div className="directory-list-heading"><div><h2>{number(matched)} doanh nghiệp{keyword||province||status||quality?' phù hợp':''}</h2><p>Chỉ cần mở hồ sơ khi có thông tin cần kiểm tra. Mỗi lần xử lý tối đa 100 hồ sơ đã chọn.</p></div>
        {(keyword||province||status||quality)&&<Link href="/admin/partner-directory">Xóa bộ lọc</Link>}</div>
      <CompanyDirectoryAdminTable key={returnTo} rows={rows} returnTo={returnTo}/>
      <nav className="directory-pagination" aria-label="Phân trang doanh nghiệp"><span>{matched?number((page-1)*size+1):0}–{number(Math.min(page*size,matched))} / {number(matched)} hồ sơ</span>
        <div>{page>1&&<Link href={pageHref(page-1)}>← Trang trước</Link>}<strong>Trang {page} / {pages}</strong>{page<pages&&<Link href={pageHref(page+1)}>Trang sau →</Link>}</div></nav>
    </section>
  </main>;
}
