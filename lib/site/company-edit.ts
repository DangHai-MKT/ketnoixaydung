import {createHash} from 'node:crypto';
import {directoryColumns,parsePartnerDirectory,profileFields} from './partner-directory-csv';
import {canonicalWard} from '../projects/wards';
import {enrichCompanyAddress} from './company-address';

export type CompanyEditData={name:string;trade:string;province:string;taxCode:string|null;website:string|null;sourceUrl:string;profile:Partial<Record<string,string>>};
export function companyEditVersion(row:CompanyEditData) {
  return createHash('sha256').update(JSON.stringify([row.name,row.trade,row.province,row.taxCode,row.website,row.sourceUrl,
    Object.entries(row.profile).sort(([a],[b])=>a.localeCompare(b))])).digest('hex');
}
export function parseCompanyEdit(form:FormData) {
  const read=(key:string)=>{const value=form.get(key);if(typeof value!=='string')throw Error('Biểu mẫu chưa đầy đủ. Hãy tải lại trang và thử lại.');return value.trim();};
  const core=['name','trade','province','taxCode','website','sourceUrl'].map(read);
  const profile:Record<string,string>=Object.fromEntries(profileFields.map(([key])=>[key,read(key)]));
  const values=[...core,...profileFields.map(([key])=>profile[key])];
  const cleaned=values.map((v,i)=>i>=6&&['work','experience'].includes(profileFields[i-6][0])?v.replace(/\r?\n/g,' '):v);
  const csv=directoryColumns.join(',')+'\n'+cleaned.map(value=>'"'+value.replaceAll('"','""')+'"').join(',');
  const [row]=parsePartnerDirectory(csv);
  if(!row.company)throw Error(row.error);
  const province=row.company.province;
  if(profile.ward){const selected=canonicalWard(province,profile.ward);if(!selected)throw Error('Chọn phường/xã thuộc tỉnh/thành của doanh nghiệp.');profile.ward=selected;}
  profile.phone=row.company.profile.phone??'';profile.hotline=row.company.profile.hotline??'';
  return {...row.company,profile};
}
export function mergeEditedProfile(previous:CompanyEditData,edited:ReturnType<typeof parseCompanyEdit>) {
  const locationChanged=previous.province!==edited.province||previous.profile.address!==edited.profile.address||previous.profile.ward!==edited.profile.ward;
  const profile={...previous.profile,...edited.profile};
  delete profile.importStatus;delete profile.importWarnings;
  if(!locationChanged)return profile;
  profile.addressOriginal=previous.profile.addressOriginal||previous.profile.address||edited.profile.address||'';
  if(edited.profile.ward) {
    profile.wardCode='';profile.addressStatus='manual';profile.addressNote='Phường/xã đã được quản trị đối chiếu và cập nhật.';
    return profile;
  }
  if(previous.profile.address!==edited.profile.address||previous.province!==edited.province) {
    return {...enrichCompanyAddress({...edited,profile}).profile,addressOriginal:profile.addressOriginal};
  }
  return {...profile,wardCode:'',addressStatus:'review',addressNote:'Chưa xác định phường/xã. Cần kiểm tra địa chỉ.'};
}
