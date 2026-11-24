'use server';

import {and,eq,isNull,isNotNull,inArray} from 'drizzle-orm';
import {revalidatePath} from 'next/cache';
import {db} from '../../db/client';
import {partnerCompanies,auditLogs} from '../../db/schema';
import {requirePageActor} from '../auth/server';
import {uuidInput} from '../seller/validation';
import {partnerStaff} from '../../services/partner-requests';
import {directorySelection} from './directory-review';
import {companyPath} from './company-display';
import {companyEditVersion,parseCompanyEdit,mergeEditedProfile} from './company-edit';

export async function saveCompanyEdit(id:string,_state:{ok:boolean;message:string;version?:string},form:FormData):Promise<{ok:boolean;message:string;version?:string}> {
  const actor=await requirePageActor('/admin/partner-directory/'+id,partnerStaff);
  id=uuidInput(id);
  let edited:ReturnType<typeof parseCompanyEdit>;
  try{edited=parseCompanyEdit(form);}catch(error){return {ok:false,message:(error as Error).message};}
  try {
    const result=await db.transaction(async tx=>{
      const [previous]=await tx.select().from(partnerCompanies).where(eq(partnerCompanies.id,id)).for('update');
      if(!previous)return {ok:false,message:'Hồ sơ không còn tồn tại.'};
      if(form.get('version')!==companyEditVersion(previous))return {ok:false,message:'Hồ sơ vừa được cập nhật ở cửa sổ khác. Hãy tải lại trang trước khi lưu để tránh ghi đè.'};
      const profile=mergeEditedProfile(previous,edited);
      const next={...edited,profile};
      const fields=['name','trade','province','taxCode','website','sourceUrl'] as const;
      const changed=[...fields.filter(key=>previous[key]!==next[key]),...Object.keys(profile).filter(key=>previous.profile[key]!==profile[key]).map(key=>'profile.'+key)];
      if(!changed.length)return {ok:true,message:'Thông tin đã được lưu, không có thay đổi mới.',version:companyEditVersion(previous)};
      await tx.update(partnerCompanies).set(next).where(eq(partnerCompanies.id,id));
      await tx.insert(auditLogs).values({actorId:actor.id,entityType:'partner_company',entityId:id,action:'company.updated',
        reason:'Quản trị sửa hoặc bổ sung hồ sơ doanh nghiệp',metadata:{changedFields:changed}});
      return {ok:true,message:'Đã lưu thông tin doanh nghiệp.'+(previous.publishedAt?' Trang khách hàng đã được cập nhật.':''),version:companyEditVersion(next)};
    });
    if(result.ok){revalidatePath('/admin/partner-directory');revalidatePath('/admin/partner-directory/'+id);revalidatePath('/find-partners');revalidatePath(companyPath(id));}
    return result;
  }catch(error){const failure=error as {code?:string;cause?:{code?:string}};return {ok:false,message:(failure.cause?.code??failure.code)==='23505'
    ?'Tên doanh nghiệp trong tỉnh/thành này hoặc mã số thuế đã có trong danh bạ. Kiểm tra hồ sơ trùng trước khi lưu.'
    :'Chưa lưu được thông tin. Dữ liệu cũ được giữ nguyên; vui lòng thử lại.'};}
}

export async function bulkCompanyPublication(_state:{message:string;ok:boolean},form:FormData) {
  const actor=await requirePageActor('/admin/partner-directory',partnerStaff);
  const operation=form.get('operation');
  if(operation!=='publish'&&operation!=='hide')return {ok:false,message:'Chọn công khai hoặc ẩn hồ sơ.'};
  const published=operation==='publish';
  if(published&&form.get('reviewed')!=='on')return {ok:false,message:'Xác nhận quyền công khai nhóm hồ sơ trước khi tiếp tục.'};
  let ids:string[];
  try{ids=directorySelection(form.getAll('companyId'));}catch(error){return {ok:false,message:(error as Error).message};}
  let changed:{id:string}[];
  try {
    changed=await db.transaction(async tx=>{
      const result=await tx.update(partnerCompanies).set({publishedAt:published?new Date():null})
        .where(and(inArray(partnerCompanies.id,ids),published?isNull(partnerCompanies.publishedAt):isNotNull(partnerCompanies.publishedAt)))
        .returning({id:partnerCompanies.id});
      if(result.length)await tx.insert(auditLogs).values(result.map(row=>({actorId:actor.id,entityType:'partner_company',entityId:row.id,
        action:published?'company.published':'company.hidden',reason:'Quản lý danh bạ theo nhóm đã chọn',metadata:{batchSize:ids.length}})));
      return result;
    });
  }catch{return {ok:false,message:'Chưa cập nhật được hồ sơ. Không có thay đổi nào được lưu; vui lòng thử lại.'};}
  revalidatePath('/admin/partner-directory');revalidatePath('/find-partners');revalidatePath('/find-partners/companies');
  for(const row of changed){revalidatePath(companyPath(row.id));revalidatePath('/admin/partner-directory/'+row.id);}
  return {ok:true,message:`Đã ${published?'công khai':'ẩn'} ${changed.length} hồ sơ. ${ids.length-changed.length} hồ sơ không cần thay đổi hoặc không còn tồn tại.`};
}

export async function setCompanyPublication(id:string, published:boolean, form:FormData) {
  const request=new FormData();request.set('companyId',uuidInput(id));request.set('operation',published?'publish':'hide');
  if(form.get('reviewed')==='on')request.set('reviewed','on');
  await bulkCompanyPublication({message:'',ok:false},request);
}
