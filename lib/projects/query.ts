import {AccessError} from '../auth/permissions';
export function projectQuery(params:URLSearchParams, allowedStatuses:readonly string[]=[]){
 const allowed=['q','status','sort','page','pageSize','category','province','stage','minPrice','maxPrice'];
 if([...params.keys()].some(key=>!allowed.includes(key)))throw new AccessError(400,'Bộ lọc dự án chứa trường không được hỗ trợ.');
 for(const key of ['q','status','sort','page','pageSize','category','province','stage','minPrice','maxPrice'])if(params.getAll(key).length>1)throw new AccessError(400,'Bộ lọc chứa tham số trùng.');
 const q=(params.get('q')||'').trim(),status=params.get('status')||'',sort=params.get('sort')||'newest';
 const pageRaw=params.get('page')||'1',sizeRaw=params.get('pageSize')||'20';
 if(!/^[1-9]\d*$/.test(pageRaw)||!/^[1-9]\d*$/.test(sizeRaw))throw new AccessError(400,'Phân trang phải là số nguyên dương.');
 const page=Number(pageRaw),pageSize=Number(sizeRaw);
 if(q.length>100||status&&!allowedStatuses.includes(status)||!['newest','oldest','updated','price_asc','price_desc'].includes(sort))throw new AccessError(400,'Bộ lọc hoặc cách sắp xếp không hợp lệ.');
 if(!Number.isSafeInteger(page)||page<1||page>10000||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>50)throw new AccessError(400,'Phân trang không hợp lệ.');
 const category=(params.get('category')||'').trim(),province=(params.get('province')||'').trim(),stage=(params.get('stage')||'').trim(),minPrice=params.get('minPrice')||'',maxPrice=params.get('maxPrice')||'';
 if(category.length>100||province.length>20||stage.length>80)throw new AccessError(400,'Giá trị bộ lọc quá dài.');
 for(const value of [minPrice,maxPrice])if(value&&(!/^\d{1,19}$/.test(value)||BigInt(value)>9223372036854775807n))throw new AccessError(400,'Khoảng giá phải là số POINT nguyên hợp lệ.');
 if(minPrice&&maxPrice&&BigInt(minPrice)>BigInt(maxPrice))throw new AccessError(400,'Giá tối đa phải lớn hơn hoặc bằng tối thiểu.');
 return {q,status,sort,page,pageSize,category,province,stage,minPrice,maxPrice};
}
export function projectPageParams(params:Record<string,string|string[]|undefined>){const query=new URLSearchParams();for(const [key,value] of Object.entries(params)){if(Array.isArray(value))value.forEach(item=>query.append(key,item));else if(value!==undefined)query.set(key,value);}return query;}
export function searchPattern(value:string){return `%${value.replace(/[\\%_]/g,'\\$&')}%`;}
