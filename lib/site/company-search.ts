import {provinceOptions} from '../projects/locations';
import vietnamWards from '../projects/vietnam-wards.json';
const wards:Readonly<Record<string,readonly string[]>>=vietnamWards;
export const companySorts=[['newest','Mới công bố'],['name_asc','Tên A–Z'],['name_desc','Tên Z–A']] as const;
export type CompanySearchInput=Partial<Record<'q'|'province'|'ward'|'page'|'size'|'sort'|'request',unknown>>;
export function companySearch(input:CompanySearchInput) {
  const province=typeof input.province==='string'&&provinceOptions.includes(input.province)?input.province:'';
  return {keyword:typeof input.q==='string'?input.q.trim().slice(0,100):'',province,
    ward:typeof input.ward==='string'&&Object.hasOwn(wards,province)&&wards[province].includes(input.ward)?input.ward:'',
    page:typeof input.page==='string'&&/^[1-9]\d{0,3}$/.test(input.page)?Number(input.page):1,
    size:typeof input.size==='string'&&['12','24','48'].includes(input.size)?Number(input.size):12,
    sort:typeof input.sort==='string'&&companySorts.some(([key])=>key===input.sort)?input.sort:'newest'};
}
export function companyPageNumbers(page:number,pages:number) {
  return [...new Set([1,...Array.from({length:5},(_,i)=>page+i-2),pages])].filter(n=>n>=1&&n<=pages).sort((a,b)=>a-b);
}
