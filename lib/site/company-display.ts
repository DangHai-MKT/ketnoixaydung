export const companyPath=(id:string)=>'/find-partners/companies/'+id;
export function companySummary(value:string, max=150) {
  const text=value.replace(/\s+/g,' ').trim();
  if (text.length<=max) return text;
  const cut=text.slice(0,max);
  return cut.slice(0,cut.lastIndexOf(' ')>max/2?cut.lastIndexOf(' '):max).trimEnd()+'…';
}
export function companyResultsPath(query:{q?:string;province?:string;ward?:string;page?:string;sort?:string;size?:string}) {
  const p=new URLSearchParams();
  if (query.q) p.set('q',query.q.slice(0,100));
  if (query.province) p.set('province',query.province.slice(0,100));
  if (query.ward && query.province) p.set('ward',query.ward.slice(0,150));
  if (query.page && /^[1-9]\d{0,3}$/.test(query.page)) p.set('page',query.page);
  if(query.sort&&['newest','name_asc','name_desc'].includes(query.sort))p.set('sort',query.sort);
  if(query.size&&['12','24','48'].includes(query.size))p.set('size',query.size);
  return '/find-partners'+(p.size?'?'+p:'')+'#ket-qua';
}
