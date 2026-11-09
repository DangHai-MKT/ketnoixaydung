// Search aliases for the existing marketplace dataset, not an administrative registry.
const groups=[['HN','Hà Nội','Ha Noi'],['HCM','TP. Hồ Chí Minh','TP Hồ Chí Minh','Hồ Chí Minh','TP. HCM','TP HCM'],['DN','Đà Nẵng','Da Nang'],['BD','Bình Dương','Binh Duong'],['BN','Bắc Ninh','Bac Ninh'],['ĐN','Đồng Nai','Dong Nai'],['HP','Hải Phòng','Hai Phong'],['TH','Thanh Hóa','Thanh Hoa'],['LA','Long An'],['NT','Ninh Thuận','Ninh Thuan']];
const fold=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replaceAll('đ','d').replaceAll('Đ','D').toLowerCase().replace(/[^a-z0-9]/g,'');
export function provinceAliases(value:string){if(value.trim().toUpperCase()==='ĐN')return ['ĐN','Đồng Nai','Dong Nai'];const key=fold(value.trim());return groups.find(group=>group.some(item=>fold(item)===key))??[value.trim()];}
export function provinceLabel(value:string){const aliases=provinceAliases(value);return aliases.length>1?aliases[1]:value;}
