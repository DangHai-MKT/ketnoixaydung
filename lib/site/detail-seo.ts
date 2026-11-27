import {projectPath} from './public-paths';
import type {PublicProject} from '../projects/contracts';
import {maskPublicContact} from '../projects/privacy';
import {provinceLabel} from '../projects/locations';
import {categoryLabels} from '../projects/workflow';
import {companyPath,companySummary} from './company-display';
import {publicMetadata,publicOrigin,structuredData} from './seo';
import {siteIdentity} from './navigation';

const text=(value:string,max=160)=>companySummary(maskPublicContact(value).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(),max);
const date=(value:Date|string|null|undefined)=>{if(!value)return undefined;const d=new Date(value);return Number.isFinite(d.getTime())?d.toISOString():undefined;};
function pageGraph(path:string,name:string,description:string,published?:Date|string|null) {
  const origin=publicOrigin();if(!origin)return null;
  return {'@type':'WebPage','@id':origin+path+'#webpage',url:origin+path,name,description,inLanguage:'vi-VN',
    isPartOf:{'@type':'WebSite','@id':origin+'/#website',name:siteIdentity.name,url:origin+'/'},
    publisher:{'@type':'Organization','@id':origin+'/#organization',name:siteIdentity.name,url:origin+'/'},
    ...(date(published)?{datePublished:date(published)}:{})};
}
export function projectSeo(project:PublicProject) {
  const province=project.provinceCode?provinceLabel(project.provinceCode):'';
  const category=categoryLabels[project.category]??'';
  const name=text(project.title,85);
  const title=province&&!name.toLocaleLowerCase('vi').includes(province.toLocaleLowerCase('vi'))?name+' – '+province:name;
  const location=[project.districtName,province].filter(Boolean).join(', ');
  const facts=[project.publicData.constructionType||category,location,project.projectStage].filter(Boolean).join(' · ');
  const description=text([facts,project.publicSummary||project.title].filter(Boolean).join('. '));
  const path=projectPath(project);
  const metadata=publicMetadata(path,title,description,project.imageUrl??undefined);
  const graph=pageGraph(path,title,description,project.publishedAt);
  if(!graph)return {metadata,json:null};
  const origin=publicOrigin()!;
  const images=(project.files?.map(file=>file.url)??[project.imageUrl]).filter((url):url is string=>Boolean(url));
  const publicImages=images.filter(url=>url.startsWith('/api/projects/'+project.id+'/files/')).slice(0,5).map(url=>origin+url);
  return {metadata,json:structuredData({'@context':'https://schema.org',...graph,
    about:{'@type':'Place',name:text(project.title),...(location?{description:text(location)}:{})},
    ...(publicImages.length?{image:publicImages,primaryImageOfPage:{'@type':'ImageObject',url:publicImages[0]}}:{})})};
}
// Deliberately accept only public profile fields. Never spread a database row/profile into JSON-LD.
export type CompanySeoInput={id:string;publicSlug?:string|null;name:string;trade:string;province:string;year?:string;market?:string;website?:string|null;publishedAt?:Date|string|null};
export function companySeo(company:CompanySeoInput) {
  const name=text(company.name,110),province=text(company.province,60);
  const description=text([`${text(company.name,65)} tại ${province}`,text(company.trade,65),'Xem năng lực và dịch vụ xây dựng.'].filter(Boolean).join('. '));
  const title=name.toLocaleLowerCase('vi').includes(province.toLocaleLowerCase('vi'))?name:name+' – '+province;
  const path=companyPath(company.id,company.publicSlug),metadata=publicMetadata(path,title,description);
  const page=pageGraph(path,name,description,company.publishedAt);
  if(!page)return {metadata,json:null};
  const origin=publicOrigin()!;
  const organization:Record<string,unknown>={'@type':'Organization','@id':origin+path+'#company',name:text(company.name,200),
    url:origin+path,description:text(company.trade),mainEntityOfPage:{'@id':origin+path+'#webpage'}};
  if(company.market)organization.areaServed=text(company.market,200);
  if(company.year&&/^\d{4}$/.test(company.year)&&Number(company.year)>=1800&&Number(company.year)<=new Date().getFullYear())organization.foundingDate=company.year;
  return {metadata,json:structuredData({'@context':'https://schema.org','@graph':[{...page,mainEntity:{'@id':organization['@id']}},organization]})};
}
