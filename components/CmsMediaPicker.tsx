'use client';
import {useState} from 'react';
import {CmsImage} from './CmsContent';

type ImageChoice={id:string;filename:string;alt:string;width:number;height:number};
export default function CmsMediaPicker({label,selected,onSelect,onUploadBusy}:{label:string;selected:string|null;onSelect:(image:ImageChoice|null)=>void;onUploadBusy?:(busy:boolean)=>void}) {
  const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[page,setPage]=useState(1),[next,setNext]=useState(false);
  const [rows,setRows]=useState<ImageChoice[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [showUpload,setShowUpload]=useState(false),[file,setFile]=useState<File|null>(null),[alt,setAlt]=useState('');
  async function upload() {
    if(busy) return;
    if(!file||!alt.trim()) {setError(!file?'Chọn tệp ảnh từ thiết bị.':'Nhập mô tả ngắn cho ảnh.');return;}
    if(file.size>5*1024*1024) {setError('Chọn ảnh không quá 5 MB.');return;}
    const body=new FormData();body.set('file',file);body.set('alt',alt.trim());
    setBusy(true);setError('');onUploadBusy?.(true);
    try {
      const response=await fetch('/api/admin/cms/media',{method:'POST',body});
      const result=await response.json().catch(()=>null);
      if(!response.ok||!result?.id) throw new Error(result?.error||'Chưa tải được ảnh. Vui lòng thử lại.');
      onSelect(result);setOpen(false);setShowUpload(false);setFile(null);setAlt('');
    } catch(cause) {setError(cause instanceof Error?cause.message:'Chưa tải được ảnh.');}
    finally {setBusy(false);onUploadBusy?.(false);}
  }
  async function search(nextPage:number) {
    setBusy(true);setError('');
    try {
      const response=await fetch('/api/admin/cms/media?'+new URLSearchParams({q:query,page:String(nextPage)}));
      const result=await response.json().catch(()=>null);
      if(!response.ok||!Array.isArray(result?.rows)) throw new Error(result?.error||'Chưa tải được thư viện ảnh. Vui lòng thử lại.');
      setRows(result.rows);setNext(result.hasNext);setPage(nextPage);
    } catch(cause) {setError(cause instanceof Error?cause.message:'Chưa tải được thư viện ảnh.');}
    finally {setBusy(false);}
  }
  return <div className="cms-media-picker">
    {selected&&<div className="cms-selected"><CmsImage id={selected} alt="" preview/><button type="button" onClick={()=>onSelect(null)}>Bỏ ảnh đã chọn</button></div>}
    <div className="cms-row"><strong>{label}</strong>
      <button type="button" disabled={busy} aria-expanded={open&&!showUpload} onClick={()=>{setOpen(true);setShowUpload(false);void search(1);}}>Chọn từ thư viện</button>
      <button type="button" disabled={busy} aria-expanded={open&&showUpload} onClick={()=>{setOpen(true);setShowUpload(true);setError('');}}>Tải ảnh từ thiết bị</button>
      {open&&<button type="button" disabled={busy} onClick={()=>setOpen(false)}>Đóng</button>}
    </div>
    {open&&<div className="cms-picker-panel" aria-busy={busy}>
      {showUpload?<div className="cms-category-control">
        <label>Ảnh JPEG, PNG hoặc WebP, tối đa 5 MB<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0]??null)}/></label>
        <label>Mô tả ảnh<input maxLength={250} value={alt} onChange={e=>setAlt(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void upload();}}}/></label>
        <button type="button" disabled={busy} onClick={upload}>Tải lên và chọn</button>
      </div>:<>
      <div className="cms-row"><label>Tìm trong thư viện<input value={query} maxLength={100} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(!busy)void search(1);}}}/></label>
        <button type="button" disabled={busy} onClick={()=>search(1)}>Tìm ảnh</button></div>
      {!busy&&!error&&!rows.length&&<p>Chưa có ảnh phù hợp. Chọn “Tải ảnh từ thiết bị” để thêm ảnh mới.</p>}
      <div className="cms-media-grid">{rows.map(image=><button className="cms-image-option" type="button" key={image.id} onClick={()=>{onSelect(image);setOpen(false);}}>
        <CmsImage id={image.id} alt={image.alt} preview/><span>{image.filename}</span>
      </button>)}</div>
      <div className="cms-row">{page>1&&<button type="button" disabled={busy} onClick={()=>search(page-1)}>Trang trước</button>}
        {next&&<button type="button" disabled={busy} onClick={()=>search(page+1)}>Trang sau</button>}</div>
      </>}
      {error&&<p className="auth-error" role="alert">{error}</p>}{busy&&<p role="status">Đang tải ảnh…</p>}
    </div>}
  </div>;
}
