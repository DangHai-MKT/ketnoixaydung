import {AccessError} from '../auth/permissions';
import {positiveInteger} from './money';
function object(value:unknown,keys:string[]){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key)))throw new AccessError(400,'Dữ liệu chứa trường không hợp lệ.');return value as Record<string,unknown>;}
function text(value:unknown,min:number,max:number){if(typeof value!=='string'||value.trim().length<min||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw new AccessError(400,'Thông tin nhập chưa hợp lệ hoặc vượt giới hạn độ dài.');return value.trim();}
export function topupInput(value:unknown){const v=object(value,['amountVnd','idempotencyKey','expectedRateVersion']);if(typeof v.amountVnd!=='string'||typeof v.idempotencyKey!=='string'||/[\u0000-\u001f]/.test(v.idempotencyKey)||v.expectedRateVersion!==undefined&&(!Number.isSafeInteger(v.expectedRateVersion)||Number(v.expectedRateVersion)<1))throw new AccessError(400,'Số tiền, mã yêu cầu hoặc phiên bản tỷ giá không hợp lệ.');return {amountVnd:positiveInteger(v.amountVnd).toString(),idempotencyKey:text(v.idempotencyKey,1,150),expectedRateVersion:v.expectedRateVersion as number|undefined};}
export type BankInstructions={enabled:boolean;verified:boolean;bankName:string;accountName:string;accountNumber:string;testOnly?:boolean;bankBin?:string};
export function bankInstructions(value:unknown,allowTest=false):BankInstructions{
 const v=object(value,['enabled','verified','bankName','accountName','accountNumber','testOnly','verifiedAt','bankBin']);
 if(v.enabled!==true||v.verified!==true)throw new AccessError(503,'Nạp điểm chưa được mở. Cấu hình ngân hàng cần được quản trị viên xác minh.');
 const bankName=text(v.bankName,2,200),accountName=text(v.accountName,2,200),accountNumber=text(v.accountNumber,6,34);
 if(/[\r\n\t]/.test(bankName+accountName+accountNumber))throw new AccessError(400,'Thông tin tài khoản nhận phải nằm trên một dòng.');
 if(v.testOnly===true){if(!allowTest||accountNumber!=='TEST-ONLY-NOT-A-BANK-ACCOUNT')throw new AccessError(503,'Cấu hình giả lập chỉ được dùng trong môi trường kiểm thử cô lập.');}
 else if(v.testOnly!==undefined&&v.testOnly!==false||!/^\d{6,34}$/.test(accountNumber))throw new AccessError(400,'Số tài khoản nhận không hợp lệ.');
 if(v.bankBin!==undefined&&v.bankBin!==''&&(typeof v.bankBin!=='string'||!/^\d{6}$/.test(v.bankBin)||!/^\d{6,19}$/.test(accountNumber)))throw new AccessError(400,'Mã BIN phải có 6 chữ số; tài khoản dùng cho QR phải có từ 6 đến 19 chữ số.');
 return {enabled:true,verified:true,...(v.bankBin?{bankBin:String(v.bankBin)}:{}),bankName,accountName,accountNumber,...(v.testOnly===true?{testOnly:true}:{})};
}
export function bankConfigurationInput(value:unknown){const v=object(value,['enabled','verified','bankName','accountName','accountNumber','bankBin','reason','expectedVersion']);if(typeof v.enabled!=='boolean'||typeof v.verified!=='boolean')throw new AccessError(400,'Cần chọn trạng thái và xác nhận ngân hàng.');const reason=text(v.reason,10,2000);
 const bank=v.enabled?bankInstructions(vForBank(v)): {enabled:false,verified:false,bankName:'',accountName:'',accountNumber:''};if(v.expectedVersion!==undefined&&(!Number.isSafeInteger(v.expectedVersion)||Number(v.expectedVersion)<0))throw new AccessError(400,'Phiên bản cấu hình không hợp lệ.');return {bank,reason,expectedVersion:v.expectedVersion as number|undefined};}
function vForBank(v:Record<string,unknown>){return {enabled:v.enabled,verified:v.verified,bankName:v.bankName,accountName:v.accountName,accountNumber:v.accountNumber,...(v.bankBin?{bankBin:v.bankBin}:{})};}
export function confirmationInput(value:unknown){const v=object(value,['amountVnd','bankReference','receivedAt','bankAccountLast4','reason','verifiedReceipt']);
 if(typeof v.amountVnd!=='string'||v.verifiedReceipt!==true)throw new AccessError(400,'Cần đối chiếu tiền thực nhận và xác nhận bằng chứng thanh toán.');
 const bankReference=text(v.bankReference,4,100).toUpperCase();if(!/^[A-Z0-9][A-Z0-9._/-]{3,99}$/.test(bankReference))throw new AccessError(400,'Mã giao dịch ngân hàng không hợp lệ.');
 if(typeof v.receivedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v.receivedAt)||!Number.isFinite(Date.parse(v.receivedAt)))throw new AccessError(400,'Thời gian tiền vào cần có múi giờ hợp lệ.');
 const day=v.receivedAt.slice(0,10);if(!Number.isFinite(Date.parse(day+'T00:00:00Z'))||new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day)throw new AccessError(400,'Ngày tiền vào không hợp lệ.');
 return {amountVnd:positiveInteger(v.amountVnd).toString(),bankReference,receivedAt:new Date(v.receivedAt).toISOString(),bankAccountLast4:text(v.bankAccountLast4,4,4),reason:text(v.reason,10,2000),verifiedReceipt:true};
}
export function paymentQuery(params:URLSearchParams){const keys=['page','status','q','start','end'];for(const key of params.keys())if(!keys.includes(key)||params.getAll(key).length!==1)throw new AccessError(400,'Bộ lọc đơn nạp không hợp lệ.');const page=params.get('page')||'1',status=params.get('status')||'',q=(params.get('q')||'').trim();
 if(!/^[1-9]\d{0,4}$/.test(page)||Number(page)>10000||q.length>100||status&&!['pending','paid','failed','expired','partially_refunded','refunded'].includes(status))throw new AccessError(400,'Bộ lọc đơn nạp không hợp lệ.');
 const start=params.get('start')||'',end=params.get('end')||'';for(const day of [start,end])if(day&&(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day+'T00:00:00Z'))||new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day||day<'2000-01-01'||day>'9999-12-30'))throw new AccessError(400,'Ngày lọc đơn nạp không hợp lệ.');if(start&&end&&start>end)throw new AccessError(400,'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.');
 return {page:Number(page),status,q,start,end,from:start?new Date(start+'T00:00:00+07:00'):undefined,until:end?new Date(new Date(end+'T00:00:00+07:00').getTime()+86400000):undefined};
}
export const paymentLabels:Record<string,string>={pending:'Chờ xác nhận',paid:'Đã cộng điểm',failed:'Thất bại',expired:'Hết hạn',partially_refunded:'Hoàn tiền một phần',refunded:'Đã hoàn tiền'};
