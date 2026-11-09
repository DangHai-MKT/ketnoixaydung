'use client';
import {useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import ConfirmActionDialog from './ConfirmActionDialog';
import {pointText} from '../lib/finance/labels';
import {purchasedProjectPath} from '../lib/projects/purchased-path';
export type PurchaseQuote={projectId:string;versionId:string;title:string;versionNo:number;sellerLabel:string;pricePoints:string;availablePoints:string};
export default function PurchaseConfirmation({quote}:{quote:PurchaseQuote}){
 const router=useRouter(),key=useRef<string|null>(null),busy=useRef(false);
 const [open,setOpen]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState('');
 async function confirm(){if(busy.current)return;busy.current=true;setPending(true);setError('');let failure='Mất kết nối. Hãy kiểm tra đơn đã mua rồi thử lại; hệ thống kiểm tra đơn đã có trước khi trừ điểm.';
 try{key.current??=crypto.randomUUID();const response=await fetch('/api/account/purchases',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectVersionId:quote.versionId,idempotencyKey:key.current})});
 const data=await response.json().catch(()=>null);if(!response.ok){failure=typeof data?.error==='string'?data.error:'Chưa thể hoàn tất giao dịch. Hãy kiểm tra đơn đã mua trước khi thử lại.';throw new Error('purchase-response');}if(typeof data?.purchaseId!=='string'||!/^[-0-9a-f]{36}$/i.test(data.purchaseId)){failure='Chưa nhận được kết quả xác nhận hợp lệ. Hãy kiểm tra Dự án đã mua trước khi thử lại.';throw new Error('purchase-result');}
 router.replace(purchasedProjectPath(quote.projectId,data.purchaseId)+'#thong-tin-da-mua');setOpen(false);
 }catch{setOpen(false);setError(failure);}
 finally{busy.current=false;setPending(false);}}
 const enough=BigInt(quote.availablePoints)>=BigInt(quote.pricePoints);
 return <><dl className="fw-details"><dt>Phiên bản</dt><dd>{quote.versionNo}</dd><dt>Điểm khả dụng</dt><dd>{pointText(quote.availablePoints)}</dd></dl>
 {!enough&&<p className="fw-info">Số dư chưa đủ để mua thông tin này. <a href="/account/wallet/top-up">Mở trang nạp POINT →</a></p>}
 <button className="button button-primary" disabled={!enough||pending} onClick={()=>{setError('');setOpen(true);}}>Mua và mở thông tin</button>
 <p className="p2-note">Chỉ trừ điểm khi giao dịch hoàn tất. Bạn được xem đúng phiên bản đã mua; không tự mở các phiên bản khác.</p>
 {error&&<div role="alert" className="auth-error">{error}<p><a href="/account/purchases">Kiểm tra đơn đã mua</a> · <a href={'/projects/'+quote.projectId}>Tải lại dự án</a></p></div>}
 <ConfirmActionDialog open={open} pending={pending} title="Xác nhận mua thông tin" confirmLabel={'Xác nhận mua · '+pointText(quote.pricePoints)} onClose={()=>{if(!pending)setOpen(false);}} onConfirm={confirm}>
 <p><strong>{quote.title}</strong></p><p>{quote.sellerLabel} · Phiên bản {quote.versionNo}</p><p>Giá: <strong>{pointText(quote.pricePoints)}</strong></p><p>Khả dụng khi tải trang: {pointText(quote.availablePoints)}</p><p>Bạn mở thông tin liên hệ, vị trí và tài liệu được cấp quyền của phiên bản này. Số dư và điều kiện bán được kiểm tra lại khi xác nhận.</p></ConfirmActionDialog></>;
}
