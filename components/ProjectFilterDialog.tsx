'use client';

import {useState,type RefObject} from 'react';
import Icon from './MarketplaceIcon';
import {categoryLabels} from '../lib/projects/workflow';
import {provinceOptions,stageOptions} from '../lib/projects/quick-create';
import {projectQuery} from '../lib/projects/query';

export const projectSorts=[['newest','Mới công bố'],['oldest','Cũ nhất'],['price_asc','Giá tăng dần'],['price_desc','Giá giảm dần']] as const;
const presets=[
  {label:'Đến 1.000',min:'',max:'1000'},
  {label:'1.000–2.500',min:'1000',max:'2500'},
  {label:'2.500–5.000',min:'2500',max:'5000'},
  {label:'Từ 5.000',min:'5000',max:''},
];
const fields=['category','province','stage','minPrice','maxPrice','sort'] as const;
type Filters=Record<typeof fields[number],string>;
const defaults:Filters={category:'',province:'',stage:'',minPrice:'',maxPrice:'',sort:'newest'};
function readFilters(query:string) {
  const params=new URLSearchParams(query);
  return {...defaults,...Object.fromEntries(fields.map(key=>[key,params.get(key)??defaults[key]]))};
}

export default function ProjectFilterDialog({dialogRef,queryString,onApply,onClose}:{
  dialogRef:RefObject<HTMLDialogElement|null>;queryString:string;onApply:(values:URLSearchParams)=>void;onClose:()=>void;
}) {
  const [values,setValues]=useState<Filters|null>(null),[error,setError]=useState('');
  const filters=values??readFilters(queryString);
  const update=(change:Partial<Filters>)=>{setValues({...filters,...change});setError('');};
  return <dialog ref={dialogRef} id="project-filter-panel" className="p2-filter-dialog" aria-labelledby="project-filter-title"
    onClose={()=>{setValues(null);setError('');onClose();}}
    onClick={event=>{if(event.target===event.currentTarget)dialogRef.current?.close();}}>
    <form className="p2-filter-panel" noValidate onSubmit={event=>{
      event.preventDefault();
      const query=new URLSearchParams();
      for(const key of fields){const value=filters[key].trim();if(value&&(key!=='sort'||value!=='newest'))query.set(key,value);}
      try {
        const parsed=projectQuery(query);
        if(parsed.sort==='updated')throw new Error('Chọn cách sắp xếp hợp lệ.');
      } catch(cause) {
        setError(cause instanceof Error?cause.message:'Vui lòng kiểm tra bộ lọc.');
        return;
      }
      onApply(query);dialogRef.current?.close();
    }}>
      <header className="p2-filter-header"><div><p>Tìm dự án</p><h2 id="project-filter-title">Tất cả bộ lọc</h2></div>
        <button type="button" className="p2-filter-close" onClick={()=>dialogRef.current?.close()}>× Đóng</button></header>
      <div className="p2-filter-body">
        <fieldset><legend>Danh mục dự án</legend>
          <div className="p2-filter-categories" role="group" aria-label="Danh mục dự án">
            <button type="button" aria-pressed={!filters.category} onClick={()=>update({category:''})}><Icon name="all" size={19}/>Tất cả</button>
            {Object.entries(categoryLabels).map(([key,label])=><button key={key} type="button" aria-pressed={filters.category===key}
              onClick={()=>update({category:key})}><Icon name={key} size={19}/>{label}</button>)}
          </div>
        </fieldset>
        <fieldset className="p2-filter-fields"><legend>Khu vực và giai đoạn</legend>
          <label>Tỉnh / thành<select value={filters.province} onChange={event=>update({province:event.target.value})}>
            <option value="">Toàn quốc</option>
            {filters.province && !provinceOptions.includes(filters.province) && <option value={filters.province}>{filters.province}</option>}
            {provinceOptions.map(value=><option key={value} value={value}>{value}</option>)}
          </select></label>
          <label>Giai đoạn<input value={filters.stage} list="project-filter-stages" maxLength={80} placeholder="Chọn hoặc nhập giai đoạn" onChange={event=>update({stage:event.target.value})}/>
            <datalist id="project-filter-stages">{stageOptions.map(value=><option key={value} value={value}/>)}</datalist></label>
        </fieldset>
        <fieldset><legend>Khoảng giá (POINT)</legend>
          <div className="p2-filter-presets" role="group" aria-label="Khoảng giá có sẵn">
            {presets.map(({label,min,max})=><button key={label} type="button" aria-pressed={filters.minPrice===min&&filters.maxPrice===max}
              onClick={()=>update({minPrice:min,maxPrice:max})}>{label}</button>)}
          </div>
          <div className="p2-filter-fields">
            <label>Giá từ<input inputMode="numeric" maxLength={19} placeholder="Không giới hạn" value={filters.minPrice} onChange={event=>update({minPrice:event.target.value})}/></label>
            <label>Giá đến<input inputMode="numeric" maxLength={19} placeholder="Không giới hạn" value={filters.maxPrice} onChange={event=>update({maxPrice:event.target.value})}/></label>
          </div>
        </fieldset>
        <label className="p2-filter-sort">Sắp xếp<select value={filters.sort} onChange={event=>update({sort:event.target.value})}>
          {projectSorts.map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </select></label>
      </div>
      <footer className="p2-filter-footer">
        {error&&<p role="alert" className="auth-error">{error}</p>}
        <button type="button" className="button button-secondary" onClick={()=>{setValues(defaults);setError('');}}>Đặt lại</button>
        <button type="submit" className="button button-primary">Áp dụng bộ lọc</button>
      </footer>
    </form>
  </dialog>;
}
