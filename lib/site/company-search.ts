import {provinceOptions} from '../projects/locations';
import {canonicalWard} from '../projects/wards';
export const companySorts=[['newest','Mới công bố'],['oldest','Cũ nhất'],['established','Thành lập lâu năm'],['name_asc','Tên A–Z'],['name_desc','Tên Z–A']] as const;
export const companySpecialties=[
  ['construction','Thi công xây dựng','helmet','thi công;nhà thầu xây dựng'],
  ['design','Thiết kế','file','thiết kế;kiến trúc'],
  ['supervision','Tư vấn & giám sát','shield','giám sát;tư vấn xây dựng'],
  ['mep','Cơ điện','energy','cơ điện'],
  ['fire','PCCC','shield','PCCC;phòng cháy'],
  ['steel','Kết cấu thép','industrial','kết cấu thép;nhà thép'],
  ['interior','Nội thất','civil','nội thất'],
  ['materials','Vật liệu','commercial','vật liệu'],
] as const;
export type CompanySearchInput=Partial<Record<'q'|'province'|'ward'|'page'|'size'|'sort'|'request'|'specialty'|'minYear'|'maxYear',unknown>>;
export function companySearch(input:CompanySearchInput) {
  const province=typeof input.province==='string'&&provinceOptions.includes(input.province)?input.province:'';
  const year=(value:unknown)=>typeof value==='string'&&/^\d{4}$/.test(value)&&Number(value)>=1800&&Number(value)<=new Date().getFullYear()?value:'';
  const minYear=year(input.minYear),maxYear=year(input.maxYear);
  return {specialty:typeof input.specialty==='string'&&companySpecialties.some(([key])=>key===input.specialty)?input.specialty:'',minYear,maxYear,keyword:typeof input.q==='string'?input.q.trim().slice(0,100):'',province,
    ward:typeof input.ward==='string'?canonicalWard(province,input.ward):'',
    page:typeof input.page==='string'&&/^[1-9]\d{0,3}$/.test(input.page)?Number(input.page):1,
    size:typeof input.size==='string'&&['12','24','48'].includes(input.size)?Number(input.size):12,
    sort:typeof input.sort==='string'&&companySorts.some(([key])=>key===input.sort)?input.sort:'newest'};
}
