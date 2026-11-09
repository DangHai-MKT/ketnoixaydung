'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {roles} from '../lib/auth/permissions';
import {roleLabels} from '../lib/account/labels';
import ConfirmActionDialog from './ConfirmActionDialog';
type Grant={userId:string;role:string;reason:string};
export default function RoleGrantForm({targetId}:{targetId?:string}={}){
 const router=useRouter();
 const [pending,setPending]=useState(false),[message,setMessage]=useState(''),[failed,setFailed]=useState(false),[review,setReview]=useState<Grant|null>(null);
 async function confirm(){
  if(!review||pending)return;
  setPending(true);setMessage('');setFailed(false);
  try{
   const response=await fetch(`/api/admin/users/${encodeURIComponent(review.userId)}/roles`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:review.role,reason:review.reason})});
   const result=await response.json();
   if(!response.ok){setFailed(true);setMessage(result.error||'Không thể cấp vai trò.');}
   else{setMessage(result.added?'Đã cấp vai trò và giữ quyền người mua.':'Tài khoản đã có vai trò này; quyền người mua được giữ lại.');router.refresh();}
  }catch{setFailed(true);setMessage('Không thể kết nối. Vui lòng thử lại.');}
  finally{setPending(false);setReview(null);}
 }
 return <><form className="auth-form" aria-busy={pending} onSubmit={event=>{event.preventDefault();if(pending)return;const data=new FormData(event.currentTarget);setReview({userId:String(data.get('userId')).trim(),role:String(data.get('role')),reason:String(data.get('reason'))});}}>
  <fieldset disabled={pending}><label>Mã người dùng<input name="userId" defaultValue={targetId} readOnly={Boolean(targetId)} required pattern="[0-9a-fA-F-]{36}" maxLength={36}/></label>
  <label>Vai trò<select name="role">{roles.map(role=><option key={role} value={role}>{roleLabels[role]} ({role})</option>)}</select></label>
  <label>Lý do<textarea name="reason" required maxLength={1000}/></label><button className="button button-primary">{pending?'Đang xử lý…':'Cấp thêm vai trò'}</button></fieldset>
  {message&&<p role={failed?'alert':'status'}>{message}</p>}
 </form><ConfirmActionDialog open={Boolean(review)} pending={pending} title="Xác nhận cấp thêm vai trò" onClose={()=>{if(!pending)setReview(null);}} onConfirm={confirm}><p>Tài khoản: {review?.userId}</p><p>Vai trò: {review&&roleLabels[review.role]}. Quyền người mua được giữ nguyên.</p><p>Lý do: {review?.reason}</p></ConfirmActionDialog></>;
}
