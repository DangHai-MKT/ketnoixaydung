import { provinceOptions,projectProvinceFilterAliases } from '../projects/locations';
import {companyPhones,validCompanyPhones} from './company-phones';

export const profileFields = [
  ['address','dia_chi','Địa chỉ',400], ['year','nam_thanh_lap','Năm thành lập',4],
  ['phone','dien_thoai','Điện thoại doanh nghiệp',500], ['email','email','Email doanh nghiệp',254],
  ['hotline','hotline','Hotline',500], ['market','khu_vuc_nhan_viec','Khu vực nhận việc',200],
  ['work','loai_cong_trinh','Loại công trình',5000], ['experience','kinh_nghiem','Kinh nghiệm hoặc công trình tiêu biểu',10000],
  ['contactPerson','nguoi_phu_trach','Người phụ trách',150],
  ['employees','so_luong_nhan_vien','Số lượng nhân viên',100],
  ['ward','phuong','Phường/xã',150],
  ['zalo','zalo','Liên kết Zalo',1000],
] as const;
const originalColumns = ['ten_cong_ty', 'chuyen_mon', 'tinh_thanh', 'ma_so_thue', 'website', 'nguon_url'] as const;
export const directoryColumns = [...originalColumns,...profileFields.map(([,column])=>column)];
export const directoryMaxBytes = 10 * 1024 * 1024;
export const directoryMaxRows = 10000;
const locationKey=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replaceAll('đ','d')
  .replace(/^(tinh|thanh pho|tp\.?)\s+/,'').replace(/[^a-z0-9]/g,'');
function currentProvince(value:string) {
  return provinceOptions.find(p=>locationKey(p)===locationKey(value))
    ?? provinceOptions.find(p=>projectProvinceFilterAliases(p).some(a=>locationKey(a)===locationKey(value))) ?? value;
}

function parseRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [], value = '', quoted = false, closed = false;
  const delimiter = text.split(/\r?\n/, 1)[0].includes(';') ? ';' : ',';
  function finishCell() { row.push(value.trim()); value = ''; closed = false; }
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char !== '"') value += char;
      else if (text[index + 1] === '"') { value += '"'; index++; }
      else { quoted = false; closed = true; }
      continue;
    }
    if (char === delimiter) finishCell();
    else if (char === '\r' || char === '\n') {
      finishCell();
      if (row.some(Boolean)) rows.push(row);
      row = [];
      if (char === '\r' && text[index + 1] === '\n') index++;
    } else if (char === '"' && !value && !closed) quoted = true;
    else if (char === '"' || closed) throw Error('Dấu ngoặc kép không hợp lệ trong CSV.');
    else value += char;
  }
  if (quoted) throw Error('CSV có ô chưa đóng dấu ngoặc kép.');
  finishCell();
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function webUrl(value: string) {
  if (value.length > 1000) return false;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password;
  } catch { return false; }
}

export function parsePartnerDirectory(text: string) {
  if (new TextEncoder().encode(text).length > directoryMaxBytes) throw Error('Tệp vượt quá 10 MB.');
  const [rawHeader, ...rawRows] = parseRows(text.replace(/^\uFEFF/, ''));
  if (!rawHeader) throw Error('Tệp chưa có tiêu đề cột.');
  const emptyColumns=rawHeader.flatMap((name,i)=>name ? [] : [i]);
  if (rawRows.some(row=>emptyColumns.some(i=>row[i]))) throw Error('Có cột chưa đặt tên nhưng chứa dữ liệu. Hãy bổ sung tiêu đề cột đó.');
  if (rawRows.some(row=>row.length>rawHeader.length && row.slice(rawHeader.length).some(Boolean))) throw Error('Có dữ liệu nằm ngoài các cột đã đặt tên.');
  const keep=rawHeader.flatMap((name,i)=>name ? [i] : []);
  const header=keep.map(i=>rawHeader[i]);
  const rows=rawRows.map(row=>keep.map(i=>row[i]??''));
  if (!header || new Set(header).size!==header.length || originalColumns.some(column=>!header.includes(column))
      || header.some(column=>!new Set<string>(directoryColumns).has(column))) {
    throw Error('Tiêu đề cột chưa đúng hoặc bị trùng. Giữ các cột bắt buộc và dùng tên cột trong CSV mẫu.');
  }
  if (!rows.length || rows.length > directoryMaxRows) throw Error('Mỗi tệp cần từ 1 đến 10.000 hồ sơ.');
  return rows.map((row, index) => {
    const cell=(column:string)=>row[header.indexOf(column)] ?? '';
    const [name, trade, rawProvince, taxCode, website, sourceUrl] = originalColumns.map(cell);
    const province=currentProvince(rawProvince);
    const profile = Object.fromEntries(profileFields.map(([key,column])=>[key,cell(column)]).filter(([,value])=>value));
    const errors:string[]=[];
    if(!name)errors.push('Tên công ty đang để trống.');else if(name.length>200)errors.push('Tên công ty vượt quá 200 ký tự.');
    if(!trade)errors.push('Chuyên môn đang để trống.');else if(trade.length>1000)errors.push('Chuyên môn vượt quá 1.000 ký tự.');
    if(!provinceOptions.includes(province))errors.push('Tỉnh/thành chưa hợp lệ.');
    if(taxCode&&!/^\d{10}(-\d{3})?$/.test(taxCode))errors.push(/^\d{9}$/.test(taxCode)
      ?'Mã số thuế chỉ có 9 chữ số, có thể đã mất số 0 đầu khi lưu bằng Excel. Đối chiếu nguồn và lưu cột mã số thuế dạng văn bản.'
      :'Mã số thuế cần đủ 10 chữ số hoặc dạng 10 chữ số-3 chữ số chi nhánh.');
    if(website&&!webUrl(website))errors.push('Website cần là liên kết http:// hoặc https:// hợp lệ.');
    if(!webUrl(sourceUrl))errors.push('URL nguồn đang trống hoặc chưa hợp lệ.');
    if(row.length!==header.length)errors.push('Số cột chưa khớp với tiêu đề.');
    if(row.some(cell=>/[\u0000-\u001f\u007f]/.test(cell)))errors.push('Có ký tự điều khiển không hợp lệ trong dữ liệu.');
    for(const [key,,label,max] of profileFields)if((profile[key]?.length??0)>max)errors.push(`${label} vượt quá ${max.toLocaleString('vi-VN')} ký tự.`);
    if(profile.year&&(!/^\d{4}$/.test(profile.year)||Number(profile.year)<1800||Number(profile.year)>new Date().getFullYear()))errors.push('Năm thành lập chưa hợp lệ.');
    for(const [key,label] of [['phone','Điện thoại doanh nghiệp'],['hotline','Hotline']] as const) {
      if(profile[key]&&!validCompanyPhones(profile[key]))errors.push(`${label} có số chưa hợp lệ. Dùng dấu chấm phẩy để phân tách các số (tối đa 20 số).`);
      else if(profile[key])profile[key]=companyPhones(profile[key]).join('; ');
    }
    if(profile.email&&!/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(profile.email))errors.push('Email doanh nghiệp chưa hợp lệ.');
    if(profile.zalo&&profile.zalo.split(';').some((link:string)=>!/^https:\/\/(?:zalo\.me|oa\.zalo\.me)\/[a-z0-9_./-]+$/i.test(link.trim())))errors.push('Liên kết Zalo chưa hợp lệ. Dùng https://zalo.me/… và phân tách nhiều liên kết bằng dấu chấm phẩy.');
    if(errors.length)return {row:index+1,error:errors.join(' ')} as const;
    return { row: index + 1, company: {
      name, trade, province, taxCode: taxCode || null, website: website || null, sourceUrl, profile,
      identityKey: JSON.stringify([name.normalize('NFKC').toLocaleLowerCase('vi').replace(/\s+/g, ' '), province]),
    } } as const;
  });
}
