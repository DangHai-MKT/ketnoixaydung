'use client';
import {useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {provinceOptions} from '../lib/projects/locations';
import vietnamWards from '../lib/projects/vietnam-wards.json';
import {companySorts,companySpecialties} from '../lib/site/company-search';
import ProjectWardPicker from './ProjectWardPicker';
import Icon from './MarketplaceIcon';
const wards:Readonly<Record<string,readonly string[]>>=vietnamWards;
export default function PartnerCompanySearch({keyword,province,ward,sort='newest',size=12,specialty='',minYear='',maxYear=''}:{keyword:string;province:string;ward:string;sort?:string;size?:number;specialty?:string;minYear?:string;maxYear?:string}) {
  const router=useRouter(),dialog=useRef<HTMLDialogElement>(null);
  const [open,setOpen]=useState(false),[draft,setDraft]=useState({province,ward,sort,size:String(size),specialty,minYear,maxYear});
  const filters={q:keyword,province,ward,sort,size:String(size),specialty,minYear,maxYear};
  const [error,setError]=useState('');
  function navigate(change:Record<string,string>) {
    const query=new URLSearchParams({...filters,...change});
    for(const [key,value] of [...query])if(!value||(key==='sort'&&value==='newest')||(key==='size'&&value==='12'))query.delete(key);
    router.push('/find-partners'+(query.size?'?'+query:'')+'#ket-qua');
  }
  const count=Number(!!province)+Number(!!ward)+Number(!!specialty)+Number(!!(minYear||maxYear));
  return <div className="company-discovery">
    <form className="company-keyword-search" onSubmit={event=>{event.preventDefault();navigate({q:String(new FormData(event.currentTarget).get('q')??'')});}}>
      <label htmlFor="company-keyword">Chuyên môn hoặc tên doanh nghiệp</label>
      <div><input id="company-keyword" name="q" type="search" maxLength={100} defaultValue={keyword} placeholder="Ví dụ: PCCC, cơ điện, thi công nhà xưởng"/>
        <button className="button button-primary" type="submit"><Icon name="search" size={18}/>Tìm đối tác</button></div>
    </form>
    <div className="p2-filter-toolbar"><button className="p2-filter-trigger" type="button" aria-haspopup="dialog" aria-expanded={open} aria-controls="company-filter-panel"
      onClick={()=>{setError('');setDraft({province,ward,sort,size:String(size),specialty,minYear,maxYear});dialog.current?.showModal();setOpen(true);}}><svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 4h18l-7 8v6l-4 2v-8L3 4Z"/></svg>Lọc{count>0&&<span>{count}</span>}</button>
      <div className="p2-filter-quick" role="group" aria-label="Chọn nhanh chuyên môn">{[['','Tất cả','all'],...companySpecialties.map(([key,label,icon])=>[key,label,icon])].map(([key,label,icon])=>
        <button type="button" key={key} aria-pressed={specialty===key} onClick={()=>navigate({specialty:key})}><Icon name={icon} size={20}/>{label}</button>)}</div></div>
    <div className="p2-filter-sortbar" role="group" aria-label="Sắp xếp doanh nghiệp"><strong>Sắp xếp theo</strong>{companySorts.map(([key,label])=>
      <button type="button" key={key} aria-pressed={sort===key} onClick={()=>navigate({sort:key})}>{label}</button>)}</div>
    {(keyword||province||ward||specialty||minYear||maxYear)&&<div className="company-active-filters" aria-label="Bộ lọc đang áp dụng">
      {specialty&&<button onClick={()=>navigate({specialty:''})} aria-label="Xóa chuyên môn">{companySpecialties.find(([key])=>key===specialty)?.[1]} ×</button>}
      {(minYear||maxYear)&&<button onClick={()=>navigate({minYear:'',maxYear:''})} aria-label="Xóa năm thành lập">Thành lập: {minYear||'Trước'}–{maxYear||'nay'} ×</button>}
      {keyword&&<button onClick={()=>navigate({q:''})} aria-label="Xóa từ khóa">{keyword} ×</button>}
      {province&&<button onClick={()=>navigate({province:'',ward:''})} aria-label="Xóa tỉnh thành">{province} ×</button>}
      {ward&&<button onClick={()=>navigate({ward:''})} aria-label="Xóa phường xã">{ward} ×</button>}
      <a href="/find-partners#ket-qua">Xóa tất cả</a></div>}
    <dialog ref={dialog} id="company-filter-panel" className="p2-filter-dialog" aria-labelledby="company-filter-title" onClose={()=>setOpen(false)}
      onClick={event=>{if(event.target===event.currentTarget)dialog.current?.close();}}>
      <form className="p2-filter-panel" onSubmit={event=>{event.preventDefault();if(draft.minYear&&draft.maxYear&&Number(draft.minYear)>Number(draft.maxYear)){setError('Năm bắt đầu cần nhỏ hơn hoặc bằng năm kết thúc.');return;}navigate(draft);dialog.current?.close();}}>
        <header className="p2-filter-header"><div><p>Tìm đối tác xây dựng</p><h2 id="company-filter-title">Tất cả bộ lọc</h2></div><button className="p2-filter-close" type="button" onClick={()=>dialog.current?.close()}>× Đóng</button></header>
        <div className="p2-filter-body"><fieldset><legend>Chuyên môn cần tìm</legend><div className="p2-filter-categories">
          {[['','Tất cả','all'],...companySpecialties.map(([key,label,icon])=>[key,label,icon])].map(([key,label,icon])=><button key={key} type="button" aria-pressed={draft.specialty===key} onClick={()=>setDraft({...draft,specialty:key})}><Icon name={icon} size={19}/>{label}</button>)}</div></fieldset><fieldset><legend>Khu vực doanh nghiệp</legend><div className="p2-filter-fields">
          <label>Tỉnh / thành<select value={draft.province} onChange={event=>setDraft({...draft,province:event.target.value,ward:''})}><option value="">Toàn quốc</option>{provinceOptions.map(name=><option key={name}>{name}</option>)}</select></label>
          <ProjectWardPicker key={draft.province} label="Phường / xã" value={draft.ward} options={wards[draft.province]??[]} onChange={ward=>setDraft({...draft,ward})}/></div></fieldset>
          <div className="p2-filter-fields"><label>Sắp xếp<select value={draft.sort} onChange={event=>setDraft({...draft,sort:event.target.value})}>{companySorts.map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label>
          <label>Số doanh nghiệp mỗi lần tải<select value={draft.size} onChange={event=>setDraft({...draft,size:event.target.value})}>{[12,24,48].map(n=><option key={n} value={n}>{n} doanh nghiệp</option>)}</select></label></div>
          <fieldset><legend>Năm thành lập</legend><p className="company-filter-hint">Lọc doanh nghiệp có năm thành lập trong khoảng bạn chọn.</p><div className="p2-filter-fields">
            <label>Từ năm<input type="number" min="1800" max={new Date().getFullYear()} placeholder="Không giới hạn" value={draft.minYear} onChange={event=>setDraft({...draft,minYear:event.target.value})}/></label>
            <label>Đến năm<input type="number" min="1800" max={new Date().getFullYear()} placeholder="Không giới hạn" value={draft.maxYear} onChange={event=>setDraft({...draft,maxYear:event.target.value})}/></label></div></fieldset>
        </div><footer className="p2-filter-footer">{error&&<p role="alert" className="auth-error">{error}</p>}<button className="button button-secondary" type="button" onClick={()=>{setDraft({province:'',ward:'',sort:'newest',size:'12',specialty:'',minYear:'',maxYear:''});setError('');}}>Đặt lại</button><button className="button button-primary" type="submit">Áp dụng bộ lọc</button></footer>
      </form>
    </dialog>
  </div>;
}
