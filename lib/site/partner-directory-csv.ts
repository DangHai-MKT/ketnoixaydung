import { provinceOptions } from '../projects/locations';

export const profileFields = [
  ['address','dia_chi','Địa chỉ',400], ['year','nam_thanh_lap','Năm thành lập',4],
  ['phone','dien_thoai','Điện thoại doanh nghiệp',40], ['email','email','Email doanh nghiệp',254],
  ['zalo','zalo','Liên kết Zalo',300], ['market','khu_vuc_nhan_viec','Khu vực nhận việc',200],
  ['work','loai_cong_trinh','Loại công trình',300], ['experience','kinh_nghiem','Kinh nghiệm hoặc công trình tiêu biểu',600],
  ['contactPerson','nguoi_phu_trach','Người phụ trách',150],
  ['employees','so_luong_nhan_vien','Số lượng nhân viên',100],
] as const;
const originalColumns = ['ten_cong_ty', 'chuyen_mon', 'tinh_thanh', 'ma_so_thue', 'website', 'nguon_url'] as const;
export const directoryColumns = [...originalColumns,...profileFields.map(([,column])=>column)];
export const directoryMaxBytes = 256 * 1024;
const maxRows = 500;

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
  if (new TextEncoder().encode(text).length > directoryMaxBytes) throw Error('Tệp vượt quá 256 KB.');
  const [header, ...rows] = parseRows(text.replace(/^\uFEFF/, ''));
  const columns = header?.length===originalColumns.length ? originalColumns :
    [14,15].includes(header?.length ?? 0) ? directoryColumns.slice(0,header.length) : directoryColumns;
  if (header?.length !== columns.length || columns.some((column,index)=>header[index]!==column)) {
    throw Error('Tiêu đề cột chưa đúng. Tải CSV mẫu và giữ nguyên thứ tự cột.');
  }
  if (!rows.length || rows.length > maxRows) throw Error('Mỗi tệp cần từ 1 đến 500 hồ sơ.');
  return rows.map((row, index) => {
    const [name, trade, province, taxCode, website, sourceUrl] = row;
    const profile = Object.fromEntries(profileFields.map(([key],offset)=>[key,row[offset+6] ?? '']).filter(([,value])=>value));
    const invalidProfile = profileFields.some(([key,,,max])=>(profile[key]?.length ?? 0)>max)
      || (profile.year && (!/^\d{4}$/.test(profile.year) || Number(profile.year)<1800 || Number(profile.year)>new Date().getFullYear()))
      || (profile.phone && !/^\+?[0-9][0-9 .()-]{5,39}$/.test(profile.phone))
      || (profile.email && !/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(profile.email))
      || (profile.zalo && !/^https:\/\/(?:zalo\.me|oa\.zalo\.me)\/[a-z0-9_./-]+$/i.test(profile.zalo));
    const invalid = row.length !== columns.length || !name || name.length > 200 || !trade || trade.length > 200
      || !provinceOptions.includes(province) || (taxCode && !/^\d{10}(-\d{3})?$/.test(taxCode))
      || (website && !webUrl(website)) || !webUrl(sourceUrl) || row.some(cell => /[\u0000-\u001f\u007f]/.test(cell));
    if (invalid || invalidProfile) return { row: index + 1, error: invalid ? 'Kiểm tra tên, chuyên môn, tỉnh/thành, mã số thuế và URL nguồn.' : 'Kiểm tra độ dài, năm thành lập hoặc thông tin liên hệ.' } as const;
    return { row: index + 1, company: {
      name, trade, province, taxCode: taxCode || null, website: website || null, sourceUrl, profile,
      identityKey: JSON.stringify([name.normalize('NFKC').toLocaleLowerCase('vi').replace(/\s+/g, ' '), province]),
    } } as const;
  });
}
