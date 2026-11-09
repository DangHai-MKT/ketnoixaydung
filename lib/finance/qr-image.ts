import 'server-only';
import QRCode from 'qrcode';
import {AccessError} from '../auth/permissions';
import {vietqrPayload} from './vietqr';
type Order={status:string;overdue:boolean;needsReview:boolean;amountVnd:string;reference:string;bank:{bankBin?:string;accountNumber:string;testOnly?:boolean}|null};
export async function topupQrImage(order:Order){
 if(order.status!=='pending'||order.overdue||order.needsReview||!order.bank||order.bank.testOnly||!order.bank.bankBin)throw new AccessError(409,'QR chưa khả dụng cho đơn này. Kiểm tra hướng dẫn và trạng thái đơn.');
 let payload:string;try{payload=vietqrPayload({bankBin:order.bank.bankBin,accountNumber:order.bank.accountNumber,amountVnd:order.amountVnd,reference:order.reference});}catch{throw new AccessError(409,'Đơn cũ hoặc thông tin ngân hàng chưa đáp ứng định dạng QR. Không tự thay đổi nội dung chuyển khoản đã chốt.');}
 return QRCode.toBuffer(payload,{type:'png',width:360,margin:4,errorCorrectionLevel:'M'});
}
