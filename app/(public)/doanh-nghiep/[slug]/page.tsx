import Link from 'next/link';
import {companySeo} from '../../../../lib/site/detail-seo';
import {notFound} from 'next/navigation';
import {getPublishedCompanyBySlug,listRelatedCompanies} from '../../../../services/public-companies';
import {companyPath,companySummary,companyResultsPath} from '../../../../lib/site/company-display';
import {breadcrumbJson} from '../../../../lib/site/seo';
import Icon from '../../../../components/MarketplaceIcon';
import {companyPhones} from '../../../../lib/site/company-phones';

export const dynamic='force-dynamic';
type Props={params:Promise<{slug:string}>;searchParams:Promise<{q?:string;province?:string;ward?:string;page?:string;sort?:string;size?:string;specialty?:string;minYear?:string;maxYear?:string}>};
export async function generateMetadata({params}:Props) {
  const {slug}=await params;
  const company=await getPublishedCompanyBySlug(slug);
  if(!company)notFound();
  return companySeo({id:company.id,publicSlug:company.publicSlug,name:company.name,trade:company.trade,province:company.province,year:company.profile.year,market:company.profile.market,publishedAt:company.publishedAt}).metadata;
}

export default async function Page({params,searchParams}:Props) {
  const [{slug},query]=await Promise.all([params,searchParams]);
  const company=await getPublishedCompanyBySlug(slug);
  if(!company)notFound();
  const {id,name,trade,province,profile,website,publicSlug}=company;
  const path=companyPath(id,publicSlug);
  const seo=companySeo({id,publicSlug,name,trade,province,year:profile.year,market:profile.market,publishedAt:company.publishedAt});
  const related=await listRelatedCompanies(id,province);
  const hasContact=[profile.contactPerson,profile.address,profile.phone,profile.hotline,profile.email,profile.zalo,website].some(Boolean);
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
    </div><aside className="company-profile-sidebar" aria-label="Kết nối doanh nghiệp">
      <section className="partner-card company-contact-panel" data-nosnippet><div className="company-contact-icon" aria-hidden="true"><Icon name="users" size={26}/></div>
        <h2>Liên hệ nhà cung cấp</h2>
        {hasContact ? <><p className="company-access-badge">Thông tin liên hệ miễn phí</p>
          <dl className="company-contact-facts">{[['Người phụ trách',profile.contactPerson],['Địa chỉ',profile.address],['Điện thoại',profile.phone],['Hotline',profile.hotline],['Email',profile.email]].map(([label,value])=>value&&<div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          <div className="company-contact-buttons">
            {companyPhones(profile.phone).map(phone=><a key={phone} className="button button-primary" href={'tel:'+phone.replace(/[^+0-9]/g,'')}>Gọi {phone}</a>)}
            {companyPhones(profile.hotline).map(phone=><a key={phone} className="button button-secondary" href={'tel:'+phone.replace(/[^+0-9]/g,'')}>Hotline {phone}</a>)}
            {profile.zalo?.split(';').map(s=>s.trim()).filter(Boolean).map((link,i)=><a className="button button-secondary" key={link} href={link} target="_blank" rel="noreferrer">Nhắn Zalo{profile.zalo!.includes(';')?' '+(i+1):''}</a>)}
            {profile.email&&<a className="button button-secondary" href={'mailto:'+encodeURIComponent(profile.email)}>Gửi email</a>}
            {website&&<a className="button button-secondary" href={website} target="_blank" rel="noreferrer">Website doanh nghiệp ↗</a>}
          </div>
        </> : <p>Hồ sơ đang bổ sung thông tin liên hệ. Bạn có thể nhờ sàn giới thiệu đơn vị phù hợp.</p>}
      </section>
      <section className="company-profile-help"><h2>Cần thêm lựa chọn?</h2><p>Gửi công việc và địa bàn bạn đang cần để được hỗ trợ tìm đối tác.</p>
        <Link href={'/find-partners?'+new URLSearchParams({province,request:'1'})+'#dang-nhu-cau'}>Nhờ sàn giới thiệu →</Link></section>
    </aside></div>
    {related.length>0&&<section className="partner-card company-profile-section company-related"><h2>Doanh nghiệp cùng địa bàn {province}</h2><p>Tham khảo thêm các hồ sơ công khai để chọn đơn vị phù hợp.</p>
      <ul className="partner-items">{related.map(row=><li key={row.id}><Link href={companyPath(row.id,row.publicSlug)}>{row.name}</Link><small>{companySummary(row.trade)}</small></li>)}</ul>
      <Link href={'/find-partners?'+new URLSearchParams({province})+'#ket-qua'}>Xem doanh nghiệp tại {province} →</Link></section>}
  </main>;
}
