import {AccessError} from '../lib/auth/permissions';
import {topupQrImage} from '../lib/finance/qr-image';
import type {getTopup} from '../services/payments';
export default async function TopupQr({order,admin}:{order:Awaited<ReturnType<typeof getTopup>>;admin:boolean}){
 if(order.provider==='sepay_test')return <p className="fw-info">Đơn SePay Test: chỉ mô phỏng giao dịch trong Test mode bằng đúng mã đơn bên dưới. Không quét QR hoặc chuyển tiền thật.</p>;
 if(order.status!=='pending'||order.overdue||order.needsReview)return null;
 let image:Buffer;try{image=await topupQrImage(order);}catch(e){if(!(e instanceof AccessError))throw e;return <p className="fw-info">{order.bank?.testOnly?'Bản kiểm thử không tạo mã QR nhận tiền thật.':e.message}</p>;}
 return <div className="topup-qr"><div><h3>Quét mã bằng ứng dụng ngân hàng</h3><p>QR điền sẵn tài khoản nhận, số tiền và nội dung chuyển khoản của đơn.</p><p className="fw-note">Kiểm tra lại tên người nhận, số tiền và nội dung trên ứng dụng ngân hàng trước khi chuyển. Quét mã không có nghĩa đã thanh toán thành công.</p>{!admin&&<a className="dash-outline" href={'/api/account/wallet/top-ups/'+order.id+'/qr'} download="ma-nap-diem.png">Tải mã QR</a>}</div><img width={280} height={280} src={'data:image/png;base64,'+image.toString('base64')} alt="Mã VietQR cho đúng đơn nạp đang chờ"/></div>;
}
