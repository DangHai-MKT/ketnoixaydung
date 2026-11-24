'use client';

import {useActionState,useState} from 'react';
import Link from 'next/link';
import {saveCompanyEdit} from '../lib/site/partner-directory-actions';
import {provinceOptions} from '../lib/projects/locations';
import vietnamWards from '../lib/projects/vietnam-wards.json';
import {profileFields} from '../lib/site/partner-directory-csv';
import ProjectWardPicker from './ProjectWardPicker';

type Initial={name:string;trade:string;province:string;taxCode:string|null;website:string|null;sourceUrl:string;profile:Partial<Record<string,string>>};
const wards:Readonly<Record<string,readonly string[]>>=vietnamWards;
export default function CompanyDirectoryEditor({id,initial,version,published,back}:{id:string;initial:Initial;version:string;published:boolean;back:string}) {
  const [fields,setFields]=useState<Record<string,string>>({...Object.fromEntries(profileFields.map(([key])=>[key,initial.profile[key]??''])),
    name:initial.name,trade:initial.trade,province:initial.province,taxCode:initial.taxCode??'',website:initial.website??'',sourceUrl:initial.sourceUrl});
  const [result,submit,pending]=useActionState(saveCompanyEdit.bind(null,id),{ok:false,message:'',version:undefined as string|undefined});
  const change=(key:string,value:string)=>setFields(old=>({...old,[key]:value}));
  const input=(key:string,label:string,max:number,type='text',required=false)=><label key={key}>{label}{required?' *':''}
    <input name={key} type={type} value={fields[key]??''} maxLength={max} required={required} onChange={e=>change(key,e.target.value)}/></label>;
  const profileInput=(key:string)=>{const field=profileFields.find(f=>f[0]===key)!;return input(key,field[2],field[3],key==='email'?'email':['phone','hotline'].includes(key)?'tel':'text');};
  return <form action={submit} className="directory-edit-form partner-form" id="sua-ho-so">
    <input type="hidden" name="version" value={result.version??version}/>
    <fieldset disabled={pending}>
      <section className="partner-card directory-edit-section"><p className="company-section-number">01 · THÔNG TIN CHÍNH</p><h2>Sửa hồ sơ doanh nghiệp</h2>
        <p className="directory-edit-intro">Bổ sung thông tin bạn đã đối chiếu. Các mục có dấu * là bắt buộc.</p>
        {input('name','Tên doanh nghiệp',200,'text',true)}
        <label>Chuyên môn *<textarea name="trade" rows={3} value={fields.trade} maxLength={1000} required onChange={e=>change('trade',e.target.value)}/></label>
        <div className="directory-edit-grid">{input('taxCode','Mã số thuế',14)}{input('website','Website doanh nghiệp',1000,'url')}</div>
      </section>
      <section className="partner-card directory-edit-section"><p className="company-section-number">02 · ĐỊA BÀN</p><h2>Địa chỉ doanh nghiệp</h2>
        <div className="directory-edit-grid"><label>Tỉnh / thành *<select name="province" value={fields.province} required
          onChange={e=>setFields(old=>({...old,province:e.target.value,ward:''}))}>{provinceOptions.map(p=><option key={p}>{p}</option>)}</select></label>
          <div><ProjectWardPicker key={fields.province} label="Phường / xã" value={fields.ward}
            options={Object.hasOwn(wards,fields.province)?wards[fields.province]:[]} onChange={value=>change('ward',value)}/><input type="hidden" name="ward" value={fields.ward}/></div></div>
        {profileInput('address')}
        <p className="directory-edit-hint">Chọn phường/xã hiện hành sau khi đối chiếu vị trí doanh nghiệp. Địa chỉ gốc vẫn được lưu để tra cứu.</p>
      </section>
      <section className="partner-card directory-edit-section"><p className="company-section-number">03 · LIÊN HỆ</p><h2>Đầu mối liên hệ</h2>
        <div className="directory-edit-grid">{['contactPerson','phone','hotline','email'].map(profileInput)}</div>
        <p className="directory-edit-hint">Có thể nhập nhiều số điện thoại hoặc Hotline, cách nhau bằng dấu chấm phẩy. Ví dụ: 02438759567; 02439743556.</p>
        {profileInput('zalo')}<p className="directory-edit-hint">Dùng liên kết https://zalo.me/…; nhiều liên kết cách nhau bằng dấu chấm phẩy. Khách chỉ xem liên hệ sau khi mở quyền.</p>
      </section>
      <section className="partner-card directory-edit-section"><p className="company-section-number">04 · NĂNG LỰC</p><h2>Thông tin để khách đánh giá</h2>
        <div className="directory-edit-grid">{['year','employees'].map(profileInput)}</div>{profileInput('market')}
        {(['work','experience'] as const).map(key=>{const field=profileFields.find(f=>f[0]===key)!;return <label key={key}>{field[2]}
          <textarea name={key} rows={key==='experience'?7:5} value={fields[key]} maxLength={field[3]} onChange={e=>change(key,e.target.value)}/></label>;})}
        {input('sourceUrl','Liên kết nguồn hồ sơ',1000,'url',true)}
      </section>
      <div className="directory-edit-save"><div><strong>{published?'Hồ sơ đang công khai':'Hồ sơ nội bộ'}</strong><small>{published?'Thông tin đã lưu sẽ cập nhật trên trang khách hàng.':'Việc sửa thông tin không tự công khai hồ sơ.'}</small></div>
        <button className="button button-primary" type="submit">{pending?'Đang lưu…':'Lưu thay đổi'}</button><Link href={back}>Quay lại danh sách</Link></div>
    </fieldset>
    {result.message&&<p role={result.ok?'status':'alert'} className={'directory-result '+(result.ok?'is-success':'is-error')}>{result.message}</p>}
  </form>;
}
