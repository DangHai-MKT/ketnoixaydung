import { AccessError } from '../auth/permissions';
export function manualAccountApprovalInput(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AccessError(400,'Dữ liệu không hợp lệ.');
  const v=input as Record<string,unknown>;
  if(Object.keys(v).some(key=>!['role','reason','updatedAt','profileRevision','legalName','sellerType'].includes(key))
    || !['buyer','seller'].includes(String(v.role)) || typeof v.reason!=='string' || !v.reason.trim() || v.reason.length>1000
    || typeof v.updatedAt!=='string' || !Number.isFinite(Date.parse(v.updatedAt))
    || !Number.isSafeInteger(v.profileRevision) || Number(v.profileRevision)<0 || Number(v.profileRevision)>2000000000
    || (v.legalName!==undefined&&(typeof v.legalName!=='string'||!v.legalName.trim()||v.legalName.length>300))
    || (v.sellerType!==undefined&&!['individual','business'].includes(String(v.sellerType)))
    || (v.role==='buyer'&&(v.legalName!==undefined||v.sellerType!==undefined)))throw new AccessError(400,'Cần chọn người mua/người bán, lý do và phiên bản hợp lệ.');
  return {role:v.role as 'buyer'|'seller',reason:v.reason.trim(),updatedAt:new Date(v.updatedAt).toISOString(),profileRevision:Number(v.profileRevision),legalName:typeof v.legalName==='string'?v.legalName.trim():undefined,sellerType:v.sellerType as 'individual'|'business'|undefined};
}
export function profileInput(input: unknown) {
    if (!input || typeof input !== 'object' || Array.isArray(input))
        throw new AccessError(400, 'Thông tin không hợp lệ.');
    const value = input as Record<string, unknown>;
    if (Object.keys(value).some(key => !['displayName', 'phone', 'updatedAt'].includes(key)))
        throw new AccessError(400, 'Có trường không được phép cập nhật.');
    if (typeof value.displayName !== 'string' || !value.displayName.trim() || value.displayName.length > 200)
        throw new AccessError(400, 'Họ tên phải từ 1 đến 200 ký tự.');
    if (typeof value.phone !== 'string' || (value.phone.trim() && !/^\+?[0-9 ()-]{7,40}$/.test(value.phone)))
        throw new AccessError(400, 'Số điện thoại không hợp lệ.');
    if (typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt)))
        throw new AccessError(400, 'Phiên bản hồ sơ không hợp lệ.');
    return { displayName: value.displayName.trim(), phone: value.phone.trim() || null, updatedAt: value.updatedAt };
}
