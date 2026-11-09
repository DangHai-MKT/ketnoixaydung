import { AccessError } from '../auth/permissions';
import { uuidInput } from '../seller/validation';
export function purchaseInput(value: unknown) {
  if(!value||typeof value!=='object'||Array.isArray(value)) throw new AccessError(400,'Yêu cầu mua không hợp lệ.');
  const body=value as Record<string,unknown>;
  if(Object.keys(body).some(key=>!['projectVersionId','idempotencyKey'].includes(key))
    ||typeof body.projectVersionId!=='string'||typeof body.idempotencyKey!=='string'
    ||!body.idempotencyKey.trim()||body.idempotencyKey.length>150||/[\u0000-\u001f]/.test(body.idempotencyKey))
    throw new AccessError(400,'Cần phiên bản dự án và mã yêu cầu mua hợp lệ; không được gửi giá hoặc danh tính người mua.');
  return {projectVersionId:uuidInput(body.projectVersionId),idempotencyKey:body.idempotencyKey};
}
export function purchasePolicy(settings:{key:string;value:Record<string,unknown>;version:number}[]){
  const fee=settings.filter(s=>s.key==='platform_fee'),hold=settings.filter(s=>s.key==='seller_hold_period');
  if(fee.length!==1||hold.length!==1||!Number.isSafeInteger(fee[0].value.feeBps)||Number(fee[0].value.feeBps)<0||Number(fee[0].value.feeBps)>9999||!Number.isSafeInteger(hold[0].value.days)||Number(hold[0].value.days)<0||Number(hold[0].value.days)>365)
    throw new AccessError(503,'Cấu hình phí hoặc thời hạn giữ chưa nhất quán. Vui lòng thử lại sau.');
  return {feeBps:Number(fee[0].value.feeBps),holdDays:Number(hold[0].value.days),feeVersion:fee[0].version,holdVersion:hold[0].version};
}
export function purchaseHistoryQuery(params:URLSearchParams){
  const page=params.get('page')||'1',q=(params.get('q')||'').trim();
  if([...params.keys()].some(k=>!['page','q'].includes(k))||params.getAll('page').length>1||params.getAll('q').length>1||!/^[1-9]\d{0,4}$/.test(page)||Number(page)>10000||q.length>100)
    throw new AccessError(400,'Bộ lọc đơn mua không hợp lệ.');
  return {page:Number(page),q};
}
