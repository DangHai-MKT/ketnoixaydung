import Link from 'next/link';
import {companySeo} from '../../../../../lib/site/detail-seo';
import {notFound} from 'next/navigation';
import {and,eq} from 'drizzle-orm';
import {db} from '../../../../../db/client';
import {companyContactAccess} from '../../../../../db/schema';
import {getPublishedCompany,listRelatedCompanies} from '../../../../../services/public-companies';
import {getCurrentActor} from '../../../../../lib/auth/server';
import {companyPath,companySummary,companyResultsPath} from '../../../../../lib/site/company-display';
import {breadcrumbJson} from '../../../../../lib/site/seo';
import {unlockCompanyContact} from '../../../../../lib/site/company-contact-actions';
import {PartnerRequestForm} from '../../../../../components/PartnerRequestForm';
import Icon from '../../../../../components/MarketplaceIcon';
import {partnerSchemaUnavailable} from '../../../../../services/partner-requests';
import {companyPhones} from '../../../../../lib/site/company-phones';

export const dynamic='force-dynamic';
type Props={params:Promise<{id:string}>;searchParams:Promise<{q?:string;province?:string;ward?:string;page?:string;sort?:string;size?:string;specialty?:string;minYear?:string;maxYear?:string}>};
export async function generateMetadata({params}:Props) {
  const {id}=await params;
  const company=await getPublishedCompany(id);
  if(!company)notFound();
  return companySeo({id:company.id,name:company.name,trade:company.trade,province:company.province,year:company.profile.year,market:company.profile.market,website:company.website,publishedAt:company.publishedAt}).metadata;
}

export default async function Page({params,searchParams}:Props) {
  const [{id},query,actor]=await Promise.all([params,searchParams,getCurrentActor()]);
  const company=await getPublishedCompany(id);
  if(!company)notFound();
  const {name,trade,province,profile,website,sourceUrl}=company;
  const path=companyPath(id);
  const seo=companySeo({id,name,trade,province,year:profile.year,market:profile.market,website,publishedAt:company.publishedAt});
  const related=await listRelatedCompanies(id,province);
  const contactAccess=actor?.status==='active' ? await db.select({id:companyContactAccess.companyId}).from(companyContactAccess)
    .where(and(eq(companyContactAccess.companyId,id),eq(companyContactAccess.buyerId,actor.id))).limit(1)
    .catch(error=>{if(partnerSchemaUnavailable(error))return null;throw error;}) : [];
  const access=contactAccess?.[0];
  const hasContact=[profile.phone,profile.hotline,profile.email,profile.zalo].some(Boolean);
  const services=(profile.work??'').split(/;|\n/).map(t=>t.trim().replace(/^[✓✔]\s*/, '')).filter(Boolean);
  const back=companyResultsPath(query);
  const breadcrumb=breadcrumbJson([{label:'Trang chủ',path:'/'},{label:'Tìm đối tác',path:'/find-partners'},{label:name,path}]);
  return <main className="partner-page company-profile-page">
    {seo.json&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:seo.json}}/>}
    {breadcrumb&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:breadcrumb}}/>}
    <nav className="partner-breadcrumb" aria-label="Đường dẫn"><Link href="/">Trang chủ</Link><span>/</span>
      <Link href={back}>Tìm đối tác</Link><span>/</span><span aria-current="page">Hồ sơ doanh nghiệp</span></nav>
    <Link className="company-back" href={back}>← Quay lại danh sách</Link>
    <header className="company-profile-header">
      <div className="company-profile-heading"><span className="company-profile-avatar" aria-hidden="true"><Icon name="industrial" size={40}/></span>
        <div><p className="company-profile-eyebrow">HỒ SƠ DOANH NGHIỆP · {province}</p><h1>{name}</h1></div></div>
      <div className="company-profile-highlights">
        <span><strong>Địa bàn</strong>{province}</span>
        {profile.year&&<span><strong>Thành lập</strong>{profile.year}</span>}
        {profile.employees&&<span><strong>Quy mô nhân sự</strong>{profile.employees}</span>}
      </div>
    </header>
    <div className="company-profile-layout"><div className="company-profile-content">
      <section className="partner-card company-profile-section"><p className="company-section-number">01 · CHUYÊN MÔN</p><h2>Lĩnh vực hoạt động</h2>
        <div className="company-profile-specialties">{trade.split(';').map(t=>t.trim()).filter(Boolean).map((t,i)=><span key={i}>{t}</span>)}</div>
        {profile.market&&<div className="company-profile-market"><strong>Khu vực nhận việc</strong><p>{profile.market}</p></div>}
      </section>
      {services.length>0&&<section className="partner-card company-profile-section"><p className="company-section-number">02 · DỊCH VỤ</p>
        <h2>Hạng mục &amp; loại công trình</h2><ul className="company-services">{services.slice(0,10).map((t,i)=><li key={i}>{t}</li>)}</ul>
        {services.length>10&&<details className="company-more-services"><summary>Xem thêm {services.length-10} hạng mục</summary>
          <ul className="company-services">{services.slice(10).map((t,i)=><li key={i}>{t}</li>)}</ul></details>}
      </section>}
      {profile.experience&&<section className="partner-card company-profile-section"><p className="company-section-number">03 · NĂNG LỰC</p>
        <h2>Giới thiệu &amp; kinh nghiệm</h2><p className="company-profile-prose">{profile.experience}</p></section>}
      <section className="partner-card company-profile-section company-source-note"><h2>Thông tin hồ sơ</h2>
        <p>Thông tin tổng hợp từ hồ sơ nguồn. Bạn nên trao đổi trực tiếp và kiểm tra năng lực trước khi quyết định hợp tác.</p>
        <div className="fw-actions">{website&&<a href={website} target="_blank" rel="noreferrer">Website doanh nghiệp ↗</a>}
          <a href={sourceUrl} target="_blank" rel="noreferrer">Đối chiếu nguồn hồ sơ ↗</a></div>
      </section>
    </div><aside className="company-profile-sidebar" aria-label="Kết nối doanh nghiệp">
      <section className="partner-card company-contact-panel" data-nosnippet><div className="company-contact-icon" aria-hidden="true"><Icon name="users" size={26}/></div>
        <h2>Liên hệ nhà cung cấp</h2>
        {access ? <><p className="company-access-badge">Bạn đã mở liên hệ · Xem lại miễn phí</p>
          <dl className="company-contact-facts">{[['Người phụ trách',profile.contactPerson],['Địa chỉ',profile.address],['Điện thoại',profile.phone],['Hotline',profile.hotline],['Email',profile.email]].map(([label,value])=>value&&<div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          <div className="company-contact-buttons">
            {companyPhones(profile.phone).map(phone=><a key={phone} className="button button-primary" href={'tel:'+phone.replace(/[^+0-9]/g,'')}>Gọi {phone}</a>)}
            {companyPhones(profile.hotline).map(phone=><a key={phone} className="button button-secondary" href={'tel:'+phone.replace(/[^+0-9]/g,'')}>Hotline {phone}</a>)}
            {profile.zalo?.split(';').map(s=>s.trim()).filter(Boolean).map((link,i)=><a className="button button-secondary" key={link} href={link} target="_blank" rel="noreferrer">Nhắn Zalo{profile.zalo!.includes(';')?' '+(i+1):''}</a>)}
            {profile.email&&<a className="button button-secondary" href={'mailto:'+encodeURIComponent(profile.email)}>Gửi email</a>}
          </div>
        </> : contactAccess===null ? <p role="status">Tính năng mở liên hệ đang được thiết lập. Bạn vẫn có thể xem năng lực và dịch vụ của doanh nghiệp.</p>
        : hasContact ? <><p>Mở đầu mối để trao đổi công việc trực tiếp với doanh nghiệp này.</p>
          <ul className="company-contact-includes"><li>Người phụ trách và cách liên hệ</li><li>Điện thoại, email, Zalo nếu hồ sơ có</li><li>Địa chỉ doanh nghiệp</li></ul>
          <div className="company-contact-price"><strong>50 <span>POINT</span></strong><small>Trả một lần · Xem lại miễn phí</small></div>
          {actor?.status==='active' ? <details className="company-unlock-confirm"><summary>Mở thông tin liên hệ →</summary>
            <p>Trừ 50 POINT trong ví khi bạn xác nhận. Quyền xem áp dụng cho doanh nghiệp này.</p>
            <PartnerRequestForm action={unlockCompanyContact.bind(null,id)} label="Xác nhận mở · 50 POINT"/>
          </details> : <Link className="button button-primary" href={'/login?next='+encodeURIComponent(path)}>Đăng nhập để mở liên hệ</Link>}
        </> : <p>Hồ sơ đang bổ sung thông tin liên hệ. Bạn có thể nhờ sàn giới thiệu đơn vị phù hợp.</p>}
      </section>
      <section className="company-profile-help"><h2>Cần thêm lựa chọn?</h2><p>Gửi công việc và địa bàn bạn đang cần để được hỗ trợ tìm đối tác.</p>
        <Link href={'/find-partners?'+new URLSearchParams({province,request:'1'})+'#dang-nhu-cau'}>Nhờ sàn giới thiệu →</Link></section>
    </aside></div>
    {related.length>0&&<section className="partner-card company-profile-section company-related"><h2>Doanh nghiệp cùng địa bàn {province}</h2><p>Tham khảo thêm các hồ sơ công khai để chọn đơn vị phù hợp.</p>
      <ul className="partner-items">{related.map(row=><li key={row.id}><Link href={companyPath(row.id)}>{row.name}</Link><small>{companySummary(row.trade)}</small></li>)}</ul>
      <Link href={'/find-partners?'+new URLSearchParams({province})+'#ket-qua'}>Xem doanh nghiệp tại {province} →</Link></section>}
  </main>;
}
