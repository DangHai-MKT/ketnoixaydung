import {getCurrentActor} from '../lib/auth/server';
import {listCompanyDirectory} from '../services/company-directory';
import PartnerCompanyList from './PartnerCompanyList';
import type {CompanySearchInput} from '../lib/site/company-search';
export default async function PartnerCompanyResults({keyword,province,ward,page,sort='newest',size=12,specialty='',minYear='',maxYear=''}:{keyword:string;province:string;ward:string;page:number;showRequest:boolean;sort?:string;size?:number;specialty?:string;minYear?:string;maxYear?:string}) {
  const actor=await getCurrentActor();
  const filters={q:keyword,province,ward,sort,size:String(size),page:String(page),specialty,minYear,maxYear} satisfies CompanySearchInput;
  const result=await listCompanyDirectory(filters,actor?.status==='active'?actor.id:undefined);
  const queryString=new URLSearchParams(filters).toString();
  const requestHref='?'+new URLSearchParams({...filters,request:'1'})+'#dang-nhu-cau';
  return <section id="ket-qua" className="partner-results"><header className="partner-results-heading">
    <div><h2>{keyword||specialty?'Kết quả tìm đối tác':'Doanh nghiệp để bạn tìm hiểu'}</h2>{(keyword||province)&&<p>{[keyword,province,ward].filter(Boolean).join(' · ')}</p>}</div>
    <a className="button button-secondary" href={requestHref}>Nhờ sàn giới thiệu</a></header>
    <p className="company-list-guide"><strong>{result.pagination.total.toLocaleString('vi-VN')} doanh nghiệp phù hợp</strong> · Chọn doanh nghiệp để xem năng lực, dịch vụ và thông tin liên hệ.</p>
    <PartnerCompanyList key={queryString} initial={result} queryString={queryString} requestHref={requestHref}/>
  </section>;
}
