export const isPublicSlug=(value:string)=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)&&value.length<=220;
export function projectPath(project:{id:string;publicSlug?:string|null}) {
  return project.publicSlug&&isPublicSlug(project.publicSlug)?'/du-an/'+project.publicSlug:'/projects/'+project.id;
}
export function companyPublicPath(id:string,slug?:string|null) {
  return slug&&isPublicSlug(slug)?'/doanh-nghiep/'+slug:'/find-partners/companies/'+id;
}
export function publicQuery(input:Record<string,string|string[]|undefined>={}) {
  const query=new URLSearchParams();
  for(const [key,value] of Object.entries(input))if(typeof value==='string')query.set(key,value);else if(Array.isArray(value))for(const item of value)query.append(key,item);
  return query.size?'?'+query:'';
}
