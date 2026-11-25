'use client';
import {useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {provinceOptions} from '../lib/projects/locations';
import vietnamWards from '../lib/projects/vietnam-wards.json';
import {companySorts} from '../lib/site/company-search';
import ProjectWardPicker from './ProjectWardPicker';
import Icon from './MarketplaceIcon';
const wards:Readonly<Record<string,readonly string[]>>=vietnamWards;
export default function PartnerCompanySearch({keyword,province,ward,sort='newest',size=12}:{keyword:string;province:string;ward:string;sort?:string;size?:number}) {
  const router=useRouter(),dialog=useRef<HTMLDialogElement>(null);
  const [open,setOpen]=useState(false),[draft,setDraft]=useState({province,ward,sort,size:String(size)});
  const filters={q:keyword,province,ward,sort,size:String(size)};
  function navigate(change:Record<string,string>) {
    const query=new URLSearchParams({...filters,...change});
    for(const [key,value] of [...query])if(!value||(key==='sort'&&value==='newest')||(key==='size'&&value==='12'))query.delete(key);
    router.push('/find-partners'+(query.size?'?'+query:'')+'#ket-qua');
  }
  const count=Number(!!province)+Number(!!ward);
  return <div className="company-discovery">
    <form className="company-keyword-search" onSubmit={event=>{event.preventDefault();navigate({q:String(new FormData(event.currentTarget).get('q')??'')});}}>
      <label htmlFor="company-keyword">Chuyên môn hoặc tên doanh nghiệp</label>
      <div><input id="company-keyword" name="q" type="search" maxLength={100} defaultValue={keyword} placeholder="Ví dụ: PCCC, cơ điện, thi công nhà xưởng"/>
        <button className="button button-primary" type="submit"><Icon name="search" size={18}/>Tìm đối tác</button></div>
    </form>
    <div className="p2-filter-toolbar"><button className="p2-filter-trigger" type="button" aria-haspopup="dialog" aria-expanded={open} aria-controls="company-filter-panel"
      onClick={()=>{setDraft({province,ward,sort,size:String(size)});dialog.current?.showModal();setOpen(true);}}><Icon name="search" size={18}/>Bộ lọc{count>0&&<span>{count}</span>}</button>
      <div className="p2-filter-quick" role="group" aria-label="Chọn nhanh chuyên môn">{['','Thi công nhà xưởng','PCCC','Cơ điện','Thiết kế','Kết cấu thép'].map(trade=>
        <button type="button" key={trade} aria-pressed={keyword===trade} onClick={()=>navigate({q:trade})}>{trade||'Tất cả'}</button>)}</div></div>
    <div className="p2-filter-sortbar" role="group" aria-label="Sắp xếp doanh nghiệp"><strong>Sắp xếp theo</strong>{companySorts.map(([key,label])=>
      <button type="button" key={key} aria-pressed={sort===key} onClick={()=>navigate({sort:key})}>{label}</button>)}</div>
    {(keyword||province||ward)&&<div className="company-active-filters" aria-label="Bộ lọc đang áp dụng">
      {keyword&&<button onClick={()=>navigate({q:''})} aria-label="Xóa từ khóa">{keyword} ×</button>}
      {province&&<button onClick={()=>navigate({province:'',ward:''})} aria-label="Xóa tỉnh thành">{province} ×</button>}
      {ward&&<button onClick={()=>navigate({ward:''})} aria-label="Xóa phường xã">{ward} ×</button>}
      <a href="/find-partners#ket-qua">Xóa tất cả</a></div>}
    <dialog ref={dialog} id="company-filter-panel" className="p2-filter-dialog" aria-labelledby="company-filter-title" onClose={()=>setOpen(false)}
      onClick={event=>{if(event.target===event.currentTarget)dialog.current?.close();}}>
      <form className="p2-filter-panel" onSubmit={event=>{event.preventDefault();navigate(draft);dialog.current?.close();}}>
        <header className="p2-filter-header"><div><p>Tìm đối tác xây dựng</p><h2 id="company-filter-title">Tất cả bộ lọc</h2></div><button className="p2-filter-close" type="button" onClick={()=>dialog.current?.close()}>× Đóng</button></header>
        <div className="p2-filter-body"><fieldset><legend>Khu vực doanh nghiệp</legend><div className="p2-filter-fields">
          <label>Tỉnh / thành<select value={draft.province} onChange={event=>setDraft({...draft,province:event.target.value,ward:''})}><option value="">Toàn quốc</option>{provinceOptions.map(name=><option key={name}>{name}</option>)}</select></label>
          <ProjectWardPicker key={draft.province} label="Phường / xã" value={draft.ward} options={wards[draft.province]??[]} onChange={ward=>setDraft({...draft,ward})}/></div></fieldset>
          <div className="p2-filter-fields"><label>Sắp xếp<select value={draft.sort} onChange={event=>setDraft({...draft,sort:event.target.value})}>{companySorts.map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label>
          <label>Số doanh nghiệp mỗi trang<select value={draft.size} onChange={event=>setDraft({...draft,size:event.target.value})}>{[12,24,48].map(n=><option key={n} value={n}>{n} doanh nghiệp</option>)}</select></label></div>
        </div><footer className="p2-filter-footer"><button className="button button-secondary" type="button" onClick={()=>setDraft({province:'',ward:'',sort:'newest',size:'12'})}>Đặt lại</button><button className="button button-primary" type="submit">Áp dụng bộ lọc</button></footer>
      </form>
    </dialog>
  </div>;
}
