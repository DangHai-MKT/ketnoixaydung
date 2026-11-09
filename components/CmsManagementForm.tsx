'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {suggestedSlug} from '../lib/cms/content';

export default function CmsManagementForm({mode,id,initial,canDelete=false,filename}:{mode:'category'|'media'|'alt';id?:string;initial?:string;canDelete?:boolean;filename?:string}) {
  const router=useRouter();
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  async function remove() {
    if(busy||!id||!canDelete||!window.confirm(`Xóa ảnh “${filename}” khỏi thư viện? Ảnh đã xóa không thể khôi phục.`)) return;
    setBusy(true);setError('');setNotice('');
    try {
      const response=await fetch('/api/admin/cms/media/'+id,{method:'DELETE'});
      const result=await response.json().catch(()=>null);
      if(!response.ok) throw new Error(result?.error||'Chưa thể xóa ảnh. Vui lòng thử lại.');
      setNotice('Đã xóa ảnh.');router.refresh();
    } catch(cause) {setError(cause instanceof Error?cause.message:'Chưa thể kết nối.');}
    finally {setBusy(false);}
  }
  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(busy) return;
    const form=event.currentTarget, data=new FormData(form);
    const path=mode==='category'?'/api/admin/cms/categories':'/api/admin/cms/media'+(id?'/'+id:'');
    setBusy(true);setError('');setNotice('');
    try {
      const response=await fetch(path,{method:id?'PATCH':'POST',headers:mode==='media'?undefined:{'Content-Type':'application/json'},
        body:mode==='media'?data:JSON.stringify({...Object.fromEntries(data),id,
          ...(mode==='category'&&!id?{slug:suggestedSlug(String(data.get('name')??''))}:{})})});
      const result=await response.json().catch(()=>null);
      if(!response.ok||!result?.id) throw new Error(result?.error||(mode==='media'?'Chưa tải được ảnh. Vui lòng thử lại.':'Chưa thể lưu.'));
      if(!id)form.reset();
      setNotice(mode==='media'?'Đã tải ảnh vào thư viện.':'Đã lưu.');router.refresh();
    } catch(cause) {setError(cause instanceof Error?cause.message:'Chưa thể kết nối.');}
    finally {setBusy(false);}
  }
  return <form className="cms-form cms-compact" onSubmit={submit}>
    <fieldset disabled={busy}><legend>{mode==='category'?(id?'Đổi tên danh mục':'Thêm danh mục'):mode==='media'?'Tải ảnh mới':'Mô tả ảnh trong thư viện'}</legend>
      <div className="cms-row">
        {mode==='category'?<>
          <label>Tên danh mục<input name="name" required maxLength={120} defaultValue={initial}/></label>
        </>:<>
          {mode==='media'&&<label>Ảnh JPEG, PNG hoặc WebP, tối đa 5 MB<input name="file" type="file" required accept="image/jpeg,image/png,image/webp"/></label>}
          <label>Văn bản thay thế<input name="alt" required maxLength={250} defaultValue={initial}/></label>
        </>}
        <button className="button button-primary" disabled={busy}>{busy?(mode==='media'?'Đang tải ảnh…':'Đang lưu…'):mode==='media'?'Tải ảnh lên':'Lưu'}</button>
        {mode==='alt'&&canDelete&&<button type="button" className="button button-secondary cms-delete-image" disabled={busy} onClick={remove}>Xóa ảnh</button>}
      </div>
    </fieldset>
    {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  </form>;
}
