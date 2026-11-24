'use client';

import {useState} from 'react';
import {provinceOptions} from '../lib/projects/locations';
import vietnamWards from '../lib/projects/vietnam-wards.json';
import ProjectWardPicker from './ProjectWardPicker';
import Icon from './MarketplaceIcon';

const wards:Readonly<Record<string,readonly string[]>>=vietnamWards;
export default function PartnerCompanySearch({keyword,province,ward}:{keyword:string;province:string;ward:string}) {
  const [selectedProvince,setProvince]=useState(province);
  const [selectedWard,setWard]=useState(ward);
  return <form action="/find-partners#ket-qua" className="partner-hub-search partner-company-search">
    <label>Chuyên môn hoặc tên công ty<input name="q" maxLength={100} defaultValue={keyword} placeholder="Ví dụ: PCCC, cơ điện, nhà xưởng"/></label>
    <label>Tỉnh / thành<select name="province" value={selectedProvince} onChange={event=>{setProvince(event.target.value);setWard('');}}>
      <option value="">Toàn quốc</option>{provinceOptions.map(name=><option key={name}>{name}</option>)}</select></label>
    <div className="company-search-ward"><ProjectWardPicker key={selectedProvince} label="Phường / xã" value={selectedWard}
      options={Object.hasOwn(wards,selectedProvince)?wards[selectedProvince]:[]} onChange={setWard}/>
      <input type="hidden" name="ward" value={selectedWard}/></div>
    <button className="button button-primary" type="submit"><Icon name="search" size={18}/> Tìm đối tác</button>
    {(keyword||province||ward)&&<a className="company-search-clear" href="/find-partners#ket-qua">Xóa bộ lọc</a>}
  </form>;
}
