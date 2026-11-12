'use client';
import BankPicker from './BankPicker';
import {useEffect,useRef,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import ConfirmActionDialog from './ConfirmActionDialog';
import {approvedTopupPolicy,topupPoints,type TopupPolicy} from '../lib/finance/money';
import {pointText} from '../lib/finance/labels';
export function PaymentRefresh({watch=false}:{watch?:boolean}={}){
 const router=useRouter(),[pending,start]=useTransition();
 useEffect(()=>{
   if(!watch)return;
   const interval=window.setInterval(()=>{
     if(document.visibilityState==='visible')router.refresh();
   },10_000);
   const timeout=window.setTimeout(()=>window.clearInterval(interval),120_000);
   return ()=>{window.clearInterval(interval);window.clearTimeout(timeout);};
 },[router,watch]);
 return <button type="button" className="dash-outline" disabled={pending} onClick={()=>start(()=>router.refresh())}>{pending?'Đang kiểm tra…':'Kiểm tra trạng thái'}</button>;
}
export default function TopUpForm({rate,policy,testEnvironment}:{rate:{amountVnd:string;points:string;version:number};policy:TopupPolicy;testEnvironment:boolean}){
 const router=useRouter(),key=useRef<string|null>(null),busy=useRef(false);const [amount,setAmount]=useState('100000'),[open,setOpen]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState('');
 let points='',validation='';try{points=topupPoints(amount,rate,policy).points;}catch{validation=`Nhập số tiền từ 100.000 đến 10.000.000 VND, là bội số ${Number(policy.stepVnd).toLocaleString('vi-VN')} VND.`;}
 async function confirm(){if(busy.current)return;busy.current=true;setPending(true);setError('');let failure='Mất kết nối. Hãy kiểm tra lịch sử đơn nạp trước khi thử lại.';
 try{key.current??=crypto.randomUUID();const response=await fetch('/api/account/wallet/top-ups',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amountVnd:amount,idempotencyKey:key.current,expectedRateVersion:rate.version})});const data=await response.json().catch(()=>null);if(!response.ok||typeof data?.id!=='string'||!/^[-0-9a-f]{36}$/i.test(data.id)){failure=typeof data?.error==='string'?data.error:'Chưa nhận được mã đơn hợp lệ. Hãy kiểm tra lịch sử đơn nạp.';throw new Error('response');}router.push('/account/wallet/top-ups/'+data.id);router.refresh();setOpen(false);
 }catch{setOpen(false);setError(failure);}finally{busy.current=false;setPending(false);}}
 return <form className="identity-form fw-topup-form" onSubmit={e=>{e.preventDefault();if(points&&!pending){setError('');setOpen(true);}}}>{testEnvironment&&<p className="fw-info">Môi trường kiểm thử — không chuyển tiền thật.</p>}<fieldset disabled={pending}><legend>Chọn số tiền nạp</legend><div className="fw-presets">{['100000','500000','1000000','5000000'].map(value=><button type="button" key={value} aria-pressed={amount===value} onClick={()=>{setAmount(value);key.current=null;}}>{BigInt(value).toLocaleString('vi-VN')} VND</button>)}</div>
 <label>Số tiền VND<input name="amountVnd" inputMode="numeric" value={amount} onChange={e=>{setAmount(e.target.value);key.current=null;}} required maxLength={8} aria-describedby="topup-conversion"/></label>
 <p id="topup-conversion" className="fw-info">{points?<><strong>Dự kiến nhận: {pointText(points)}</strong><br/>Tỷ giá: {BigInt(rate.amountVnd).toLocaleString('vi-VN')} VND = {pointText(rate.points)} · phiên bản {rate.version}</>:validation}</p>
 <p>Đơn có hiệu lực {policy.expiresHours} giờ. Tạo đơn không cộng điểm. Chỉ sau khi nhân sự tài chính đối chiếu khoản tiền thực nhận mới ghi điểm vào ví.</p><p className="fw-note">Tài khoản nhận đã xác minh và mã chuyển khoản riêng sẽ hiển thị trên đơn. Nạp điểm không chịu phí giao dịch bán thông tin.</p>
 <button className="dash-primary" type="submit" disabled={!points||pending}>Xem lại đơn nạp</button></fieldset>{error&&<p role="alert" className="auth-error">{error} <a href="/account/wallet/top-ups">Xem lịch sử đơn nạp</a></p>}
 <ConfirmActionDialog open={open} pending={pending} title="Tạo đơn nạp điểm" confirmLabel="Tạo đơn chờ thanh toán" onClose={()=>{if(!pending)setOpen(false);}} onConfirm={confirm}><p>Số tiền: <strong>{/^\d+$/.test(amount)?BigInt(amount).toLocaleString('vi-VN'):amount} VND</strong></p><p>Dự kiến nhận: {points?pointText(points):'—'}</p><p>Không cộng điểm tại bước này. Hãy dùng đúng nội dung chuyển khoản trên đơn được tạo.</p></ConfirmActionDialog></form>;
}
export function ConfirmTopupForm({id,amountVnd,points,accountNumber}:{id:string;amountVnd:string;points:string;accountNumber:string}){
 const router=useRouter(),busy=useRef(false);const [open,setOpen]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[payload,setPayload]=useState<Record<string,unknown>>({});
 async function confirm(){if(busy.current)return;busy.current=true;setPending(true);setError('');let failure='Mất kết nối. Hãy kiểm tra trạng thái đơn trước khi thử lại.';
 try{const r=await fetch('/api/admin/payments/'+id+'/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),data=await r.json().catch(()=>null);if(!r.ok||data?.id!==id){failure=data?.error||'Chưa thể xác nhận đơn.';throw new Error('response');}setNotice(data.reused?'Đơn đã được ghi nhận trước đó; không cộng thêm điểm.':'Đã xác nhận và ghi sổ cộng điểm một lần.');setOpen(false);router.refresh();}catch{setOpen(false);setError(failure);}finally{busy.current=false;setPending(false);}}
 return <><form className="identity-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);const time=String(f.get('receivedAt')||'');if(!time){setError('Cần nhập thời gian tiền vào.');return;}const parsed=new Date((time.length===16?time+':00':time)+'+07:00');if(!Number.isFinite(parsed.getTime())){setError('Thời gian tiền vào không hợp lệ.');return;}setPayload({amountVnd:f.get('amountVnd'),bankReference:f.get('bankReference'),receivedAt:parsed.toISOString(),bankAccountLast4:f.get('bankAccountLast4'),reason:f.get('reason'),verifiedReceipt:f.get('verifiedReceipt')==='on'});setError('');setOpen(true);}}><fieldset disabled={pending}><legend>Đối chiếu tiền thực nhận</legend><p className="fw-note">Theo đơn: {BigInt(amountVnd).toLocaleString('vi-VN')} VND. Tài khoản nhận đã chốt: {accountNumber}. Nhập theo sao kê đã kiểm chứng; ảnh do người dùng gửi không đủ để cộng điểm.</p>
 <label>Số tiền thực nhận (VND)<input name="amountVnd" inputMode="numeric" required pattern="[0-9]+" maxLength={18}/></label><label>Mã giao dịch ngân hàng<input name="bankReference" required minLength={4} maxLength={100}/></label>
 <label>Thời gian tiền vào — giờ Việt Nam (UTC+7)<input name="receivedAt" type="datetime-local" step={1} required/></label><label>4 ký tự cuối tài khoản nhận<input name="bankAccountLast4" required minLength={4} maxLength={4}/></label>
 <label>Căn cứ đối chiếu<textarea name="reason" required minLength={10} maxLength={2000}/></label><label className="fw-checkbox"><input name="verifiedReceipt" type="checkbox" required/>Tôi đã đối chiếu sao kê thật, đúng số tiền, tài khoản nhận và nội dung chuyển khoản của đơn.</label><button className="dash-primary" type="submit">Xem lại xác nhận</button></fieldset></form>
 {error&&<p role="alert" className="auth-error">{error}</p>}{notice&&<p role="status" className="identity-success">{notice}</p>}
 <ConfirmActionDialog open={open} pending={pending} title="Xác nhận tiền đã vào tài khoản?" confirmLabel={"Xác nhận +"+pointText(points)} onClose={()=>{if(!pending)setOpen(false);}} onConfirm={confirm}><p>Đơn: {id}</p><p>Thực nhận: {String(payload.amountVnd||'')} VND</p><p>POINT sẽ được ghi: <strong>{pointText(points)}</strong></p><p>Mã ngân hàng: {String(payload.bankReference||'')}</p><p>Thao tác này ghi sổ cộng điểm. Không thể sửa bút toán đã ghi sổ trực tiếp; đơn hết hạn hoặc sai tiền cần đối soát riêng.</p></ConfirmActionDialog></>;
}
export function BankConfigurationForm({bank,testEnvironment,version,stepVnd}:{version?:number;bank:Record<string,unknown>|null;testEnvironment:boolean;stepVnd:string}){
 const router=useRouter();const [enabled,setEnabled]=useState(bank?.enabled===true),[open,setOpen]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[payload,setPayload]=useState<Record<string,unknown>>({});
 async function confirm(){if(pending)return;setPending(true);setError('');let failure='Mất kết nối. Vui lòng kiểm tra cấu hình trước khi thử lại.';try{const r=await fetch('/api/admin/payments/configuration',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),data=await r.json().catch(()=>null);if(!r.ok||data?.ok!==true){failure=data?.error||'Không lưu được cấu hình.';throw new Error('response');}setOpen(false);setNotice('Đã lưu phiên bản cấu hình và nhật ký quản trị. Các đơn cũ giữ nguyên hướng dẫn và tỷ giá đã chốt.');router.refresh();}catch{setOpen(false);setError(failure);}finally{setPending(false);}}
 return <>{testEnvironment&&<p className="fw-info">Đây là cấu hình trên DB kiểm thử, không cho phép nhận chuyển khoản thật qua bản xem thử này.</p>}<form className="identity-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);setPayload({enabled,...(version!==undefined?{expectedVersion:version}:{}),bankBin:String(f.get('bankBin')||''),verified:f.get('verified')==='on',bankName:String(f.get('bankName')||''),accountName:String(f.get('accountName')||''),accountNumber:String(f.get('accountNumber')||''),reason:f.get('reason')});setOpen(true);}}>
 <fieldset disabled={pending}><label className="fw-checkbox"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>Cho phép tạo đơn nạp mới</label><fieldset disabled={!enabled}><BankPicker bank={bank} enabled={enabled}/><label>Chủ tài khoản nhận<input name="accountName" defaultValue={String(bank?.accountName||'')} required={enabled} maxLength={200}/></label><label>Số tài khoản nhận<input name="accountNumber" inputMode="numeric" defaultValue={bank?.testOnly?'':String(bank?.accountNumber||'')} required={enabled} pattern="[0-9]{6,34}" maxLength={34}/></label><label className="fw-checkbox"><input name="verified" type="checkbox" required={enabled}/>Tôi đã xác minh ngân hàng và tài khoản nhận này thuộc cấu hình được chủ sở hữu chấp thuận.</label></fieldset><label>Lý do thay đổi<textarea name="reason" required minLength={10} maxLength={2000}/></label>
 <p className="fw-note">Mỗi đơn từ 100.000 đến 10.000.000 VND, theo bội số {Number(stepVnd).toLocaleString('vi-VN')} VND và có hạn 24 giờ.</p><button className="dash-primary" type="submit">Xem lại cấu hình</button></fieldset></form>
 {error&&<p role="alert" className="auth-error">{error}</p>}{notice&&<p role="status" className="identity-success">{notice}</p>}
 <ConfirmActionDialog open={open} pending={pending} title="Lưu cấu hình nhận tiền?" confirmLabel="Lưu phiên bản cấu hình" onClose={()=>{if(!pending)setOpen(false);}} onConfirm={confirm}><p>{enabled?'Cho phép tạo đơn nạp mới với ngân hàng đã xác minh.':'Tạm ngừng tạo đơn nạp mới; không xóa các đơn hoặc số dư đã có.'}</p>{enabled&&<p>{String(payload.bankName||'')} · {String(payload.accountName||'')} · {String(payload.accountNumber||'')}</p>}<p>Cần đối chiếu cẩn thận trước khi xác nhận.</p></ConfirmActionDialog></>;
}

export function TopupRateActivation({active}:{active:boolean}){
 const router=useRouter(),busy=useRef(false);
 const [reason,setReason]=useState(''),[open,setOpen]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState('');
 if(active)return <p className="fw-info">Tỷ giá đang áp dụng: 100.000 VND = 100 POINT.</p>;
 async function activate(){
  if(busy.current)return;
  busy.current=true;setPending(true);setError('');
  try{
   const response=await fetch('/api/admin/payments/topup-rate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason})});
   const result=await response.json().catch(()=>null);
   if(!response.ok||result?.ok!==true)throw new Error(result?.error||'Chưa cập nhật được tỷ giá.');
   setOpen(false);router.refresh();
  }catch(cause){setOpen(false);setError(cause instanceof Error?cause.message:'Chưa cập nhật được tỷ giá.');}
  finally{busy.current=false;setPending(false);}
 }
 return <><form className="identity-form" onSubmit={event=>{event.preventDefault();setOpen(true);}}>
  <p>Đơn nạp mới sẽ áp dụng 100.000 VND = 100 POINT. Đơn đã tạo giữ tỷ giá đã chốt.</p>
  <label>Lý do đổi tỷ giá<textarea required minLength={10} maxLength={2000} value={reason} onChange={event=>setReason(event.target.value)}/></label>
  <button className="dash-primary" type="submit" disabled={pending}>Xem lại thay đổi</button>
 </form>{error&&<p role="alert" className="auth-error">{error}</p>}
 <ConfirmActionDialog open={open} pending={pending} title="Áp dụng tỷ giá nạp mới?" confirmLabel="Áp dụng tỷ giá mới"
  onClose={()=>{if(!pending)setOpen(false);}} onConfirm={activate}>
  <p>100.000 VND = 100 POINT. Số tiền nạp phải là bội số {Number(approvedTopupPolicy.stepVnd).toLocaleString('vi-VN')} VND.</p>
 </ConfirmActionDialog></>;
}
