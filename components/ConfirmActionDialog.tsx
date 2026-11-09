'use client';
import {useEffect,useRef,type ReactNode} from 'react';
export default function ConfirmActionDialog({open,pending,title,children,onClose,onConfirm,confirmLabel='Xác nhận thay đổi'}:{open:boolean;pending:boolean;title:string;children:ReactNode;onClose:()=>void;onConfirm:()=>void;confirmLabel?:string}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(open&&!dialog.current?.open)dialog.current?.showModal();else if(!open&&dialog.current?.open)dialog.current?.close();},[open]);
 return <dialog ref={dialog} className="identity-dialog" aria-label={title} onCancel={event=>{if(pending)event.preventDefault();else onClose();}} onClose={onClose}>
  <h2>{title}</h2>{children}<div className="identity-actions"><button type="button" autoFocus disabled={pending} onClick={onClose}>Quay lại</button><button type="button" disabled={pending} onClick={onConfirm}>{pending?'Đang xử lý…':confirmLabel}</button></div>
 </dialog>;
}
