export type DirectoryAdminRow={id:string;name:string;trade:string;province:string;ward:string;hasContact:boolean;addressStatus:string;needsSupplement?:boolean;published:boolean};
export function directoryIssues(row:Pick<DirectoryAdminRow,'ward'|'hasContact'|'addressStatus'|'needsSupplement'>) {
  return [...(row.needsSupplement?['Cần bổ sung']:[]),...(!row.hasContact?['Thiếu liên hệ']:[]),...(!row.ward||row.addressStatus==='review'?['Kiểm tra địa chỉ']:[])];
}
export function directorySelection(values:FormDataEntryValue[]) {
  const ids=[...new Set(values)];
  if(!ids.length || ids.length>100 || ids.some(id=>typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
    throw Error('Chọn từ 1 đến 100 hồ sơ hợp lệ trong danh sách.');
  }
  return ids as string[];
}
