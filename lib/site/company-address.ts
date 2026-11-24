import conversion from '../projects/vietnam-ward-conversion.json';
import {provinceOptions} from '../projects/locations';

const fold = (s:string) => s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replaceAll('đ','d')
  .replace(/[^a-z0-9]+/g,' ').trim();
const provinceKey = (s:string) => fold(s).replace(/^(tinh|thanh pho|tp) /,'');
const unitKey = (s:string) => fold(s).replace(/^(phuong|p|xa|x|thi tran|tt|dac khu|dk|quan|q|huyen|h|thanh pho|tp|thi xa|tx) /,'').replace(/^0+(\d)/,'$1');
const provinceLabel = (s:string) => provinceOptions.find(p=>provinceKey(p)===provinceKey(s)) ?? s;
const rows = conversion.rows;
const byProvince = new Map<string,string[][]>();
const provinceDestinations = new Map<string,Set<string>>();
for (const row of rows) {
  const key=provinceKey(row[3]);
  if (!byProvince.has(key)) byProvince.set(key,[]);
  byProvince.get(key)!.push(row);
  for (const name of [row[0],row[3]]) {
    const source=provinceKey(name);
    if (!provinceDestinations.has(source)) provinceDestinations.set(source,new Set());
    provinceDestinations.get(source)!.add(key);
  }
}

export type CompanyAddressResult = {
  status:'converted'|'current'|'review'; ward:string; wardCode:string;
  address:string; originalAddress:string; message:string;
};

/** No street-level guessing: partial boundary transfers must be reviewed. */
export function resolveCompanyAddress(address:string, province:string, suppliedWard=''):CompanyAddressResult {
  const base={ward:'',wardCode:'',address,originalAddress:address};
  const review=(message:string):CompanyAddressResult=>({...base,status:'review',message});
  const parts=address.split(/[,;\n]/).map(s=>s.trim()).filter(Boolean);
  const norm=parts.map(fold);
  const addressProvince=parts.findLast(p=>provinceDestinations.has(provinceKey(p)));
  if (addressProvince && !provinceDestinations.get(provinceKey(addressProvince))!.has(provinceKey(province))) {
    return review('Tỉnh/thành trong địa chỉ khác tỉnh/thành của hồ sơ.');
  }
  const wardIndexes=norm.flatMap((p,i)=>/^(phuong|p|xa|x|thi tran|tt|dac khu|dk)\b/.test(p)?[i]:[]);
  if (wardIndexes.length!==1) return review('Chưa xác định được một phường/xã trong địa chỉ.');
  const wi=wardIndexes[0], ward=unitKey(parts[wi]);
  const districts=parts.filter((p,i)=>i>wi && /^(quan|q|huyen|h|thanh pho|tp|thi xa|tx)\b/.test(fold(p))
    && provinceKey(p)!==provinceKey(province));
  const candidates=(byProvince.get(provinceKey(province))??[]).filter(r=>unitKey(r[2])===ward);
  // Explicit historical province disambiguates merged provinces (e.g. Bình Dương / HCM).
  const historical=candidates.filter(r=>parts.some(p=>provinceKey(p)===provinceKey(r[0])));
  let matches=historical.length ? historical : candidates;
  if (districts.length) matches=matches.filter(r=>districts.some(d=>unitKey(d)===unitKey(r[1])));
  const current=conversion.current.filter(r=>provinceKey(r[0])===provinceKey(province) && unitKey(r[1])===ward);
  const targets=new Set(matches.map(r=>r[5]));
  if (suppliedWard) {
    const selected=conversion.current.filter(r=>provinceKey(r[0])===provinceKey(province) && unitKey(r[1])===unitKey(suppliedWard));
    if (selected.length!==1) return review('Phường/xã trong CSV không thuộc tỉnh/thành đã chọn.');
    if (targets.size && !targets.has(selected[0][2])) return review('Phường/xã trong CSV khác kết quả đối chiếu địa chỉ.');
    // A manually supplied ward does not resolve a split boundary automatically.
    if (matches.some(r=>/split|ambiguous/.test(r[6])) || targets.size>1) return review('Địa giới cũ bị chia tách; cần kiểm tra vị trí cụ thể.');
  }
  if (!districts.length && current.length===1 && (!targets.size || (targets.size===1 && targets.has(current[0][2])))) {
    if (suppliedWard && unitKey(suppliedWard)!==unitKey(current[0][1])) return review('Phường/xã trong CSV không khớp địa chỉ.');
    return {...base,status:'current',ward:current[0][1],wardCode:current[0][2],message:'Địa chỉ đã dùng phường/xã hiện hành.'};
  }
  if (targets.size!==1 || matches.some(r=>/split|ambiguous/.test(r[6]))) {
    return review(matches.length ? 'Phường/xã cũ có nhiều địa giới mới; cần kiểm tra vị trí cụ thể.' : 'Chưa đủ thông tin tỉnh, quận/huyện và phường/xã để đối chiếu.');
  }
  // District is required for historical addresses to avoid confusing current and former names.
  if (!districts.length) return review('Cần quận/huyện cũ để phân biệt địa chỉ trước và sau sắp xếp.');
  const target=matches[0];
  const prefix=parts.slice(0,wi);
  return {...base,status:'converted',ward:target[4],wardCode:target[5],
    address:[...prefix,target[4],provinceLabel(target[3])].join(', '),message:'Đã đối chiếu phường/xã cũ và bỏ cấp quận/huyện.'};
}

export function enrichCompanyAddress<T extends {province:string;profile:Partial<Record<string,string>>}>(company:T):T {
  const result=resolveCompanyAddress(company.profile.address??'',company.province,company.profile.ward??'');
  return {...company,profile:{...company.profile,address:result.address,ward:result.ward,
    addressOriginal:result.originalAddress,wardCode:result.wardCode,addressStatus:result.status,
    addressNote:result.message,addressDataset:conversion.asOf}};
}
