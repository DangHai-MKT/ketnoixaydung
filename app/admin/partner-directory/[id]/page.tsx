import Link from 'next/link';
import {notFound} from 'next/navigation';
import {eq} from 'drizzle-orm';
import {db} from '../../../../db/client';
import {partnerCompanies} from '../../../../db/schema';
import {requirePageActor} from '../../../../lib/auth/server';
import {partnerStaff} from '../../../../services/partner-requests';
import {setCompanyPublication} from '../../../../lib/site/partner-directory-actions';
import {companyPath} from '../../../../lib/site/company-display';
import {companyEditVersion} from '../../../../lib/site/company-edit';
import CompanyDirectoryEditor from '../../../../components/CompanyDirectoryEditor';

export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{returnTo?:string}>}) {
  const {id}=await params;
  await requirePageActor('/admin/partner-directory/'+id,partnerStaff);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound();
  const [row]=await db.select().from(partnerCompanies).where(eq(partnerCompanies.id,id)).limit(1);
  if(!row)notFound();
  const {returnTo}=await searchParams;
  const back=typeof returnTo==='string'&&/^\/admin\/partner-directory(?:\?[^#]*)?$/.test(returnTo)?returnTo:'/admin/partner-directory';
  return <main className="partner-page directory-admin"><Link className="directory-back" href={back}>← Quay lại danh sách đã lọc</Link>
    <header className="directory-admin-header"><div><p>SỬA & BỔ SUNG HỒ SƠ</p><h1>{row.name}</h1><span>{row.province} · {row.publishedAt?'Đang công khai':'Nội bộ'}</span></div></header>
    <div className="directory-detail-layout"><CompanyDirectoryEditor id={row.id} initial={{name:row.name,trade:row.trade,province:row.province,taxCode:row.taxCode,website:row.website,sourceUrl:row.sourceUrl,profile:row.profile}}
      version={companyEditVersion(row)} published={Boolean(row.publishedAt)} back={back}/>
    <aside className="partner-card"><h2>Hiển thị với khách hàng</h2><p>{row.publishedAt?'Hồ sơ đang xuất hiện trong danh bạ công khai.':'Hồ sơ chỉ hiển thị trong quản trị.'}</p>
      <form action={setCompanyPublication.bind(null,row.id,!row.publishedAt)} className="partner-form"><fieldset>
        {!row.publishedAt&&<label><input type="checkbox" name="reviewed" required/> Tôi đã kiểm tra và có quyền công khai hồ sơ này.</label>}
        <button className="button button-primary">{row.publishedAt?'Ẩn hồ sơ':'Công khai hồ sơ'}</button></fieldset></form>
      <div className="directory-detail-links"><a href={row.sourceUrl} target="_blank" rel="noreferrer">Đối chiếu nguồn ↗</a>
        {row.website&&<a href={row.website} target="_blank" rel="noreferrer">Website doanh nghiệp ↗</a>}
        {row.publishedAt&&<Link href={companyPath(row.id)}>Xem trang khách hàng →</Link>}</div>
      {row.profile.addressOriginal&&<p className="directory-edit-hint"><strong>Địa chỉ gốc</strong><br/>{row.profile.addressOriginal}</p>}
    </aside></div>
  </main>;
}
