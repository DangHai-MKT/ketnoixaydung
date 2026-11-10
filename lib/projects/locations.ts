// Frequently selected cities first, followed by the remaining entries of Decision 19/2025/QĐ-TTg.
export const provinceOptions = [
  'Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ', 'Huế',
  'Cao Bằng', 'Tuyên Quang', 'Điện Biên', 'Lai Châu', 'Sơn La',
  'Lào Cai', 'Thái Nguyên', 'Lạng Sơn', 'Quảng Ninh', 'Bắc Ninh', 'Phú Thọ',
  'Hưng Yên', 'Ninh Bình', 'Thanh Hóa', 'Nghệ An', 'Hà Tĩnh',
  'Quảng Trị', 'Quảng Ngãi', 'Gia Lai', 'Khánh Hòa',
  'Đắk Lắk', 'Lâm Đồng', 'Đồng Nai', 'Tây Ninh',
  'Đồng Tháp', 'Vĩnh Long', 'An Giang', 'Cà Mau',
];

// Historical values remain on listings and in existing links.
const groups=[['HN','Hà Nội','Ha Noi'],['HCM','TP. Hồ Chí Minh','TP Hồ Chí Minh','Hồ Chí Minh','TP. HCM','TP HCM'],['DN','Đà Nẵng','Da Nang'],['BD','Bình Dương','Binh Duong'],['BN','Bắc Ninh','Bac Ninh'],['ĐN','Đồng Nai','Dong Nai'],['HP','Hải Phòng','Hai Phong'],['TH','Thanh Hóa','Thanh Hoa'],['LA','Long An'],['NT','Ninh Thuận','Ninh Thuan']];
const fold=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replaceAll('đ','d').replaceAll('Đ','D').toLowerCase().replace(/[^a-z0-9]/g,'');
export function provinceAliases(value:string){if(value.trim().toUpperCase()==='ĐN')return ['ĐN','Đồng Nai','Dong Nai'];const key=fold(value.trim());return groups.find(group=>group.some(item=>fold(item)===key))??[value.trim()];}
export function provinceLabel(value:string){const aliases=provinceAliases(value);return aliases.length>1?aliases[1]:value;}

const formerProvinces: Record<string, string[]> = {
  'Tuyên Quang': ['Hà Giang'],
  'Lào Cai': ['Yên Bái'],
  'Thái Nguyên': ['Bắc Kạn'],
  'Bắc Ninh': ['Bắc Giang'],
  'Phú Thọ': ['Vĩnh Phúc', 'Hòa Bình'],
  'Hải Phòng': ['Hải Dương'],
  'Hưng Yên': ['Thái Bình'],
  'Ninh Bình': ['Hà Nam', 'Nam Định'],
  'Quảng Trị': ['Quảng Bình'],
  'Huế': ['Thừa Thiên Huế', 'Thừa Thiên - Huế'],
  'Đà Nẵng': ['Quảng Nam'],
  'Quảng Ngãi': ['Kon Tum'],
  'Gia Lai': ['Bình Định'],
  'Khánh Hòa': ['Ninh Thuận'],
  'Đắk Lắk': ['Phú Yên'],
  'Lâm Đồng': ['Đắk Nông', 'Bình Thuận'],
  'Đồng Nai': ['Bình Phước'],
  'TP. Hồ Chí Minh': ['Bình Dương', 'Bà Rịa - Vũng Tàu', 'Bà Rịa Vũng Tàu'],
  'Tây Ninh': ['Long An'],
  'Đồng Tháp': ['Tiền Giang'],
  'Vĩnh Long': ['Bến Tre', 'Trà Vinh'],
  'An Giang': ['Kiên Giang'],
  'Cần Thơ': ['Hậu Giang', 'Sóc Trăng'],
  'Cà Mau': ['Bạc Liêu'],
};

const unaccented = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replaceAll('đ', 'd').replaceAll('Đ', 'D');

export function projectProvinceFilterAliases(value: string): string[] {
  const label = provinceLabel(value);
  const current = provinceOptions.find((name) => fold(name) === fold(label));
  const names = current ? [current, ...(formerProvinces[current] ?? [])] : [value];
  return [...new Set(names.flatMap(provinceAliases).flatMap((name) => [name, name.length > 2 ? unaccented(name) : name]))];
}
