'use server';
import {revalidatePath} from 'next/cache';
import {requirePageActor} from '../auth/server';
import {AccessError} from '../auth/permissions';
import {buyCompanyContact} from '../../services/company-contacts';
import {companyPath} from './company-display';

export async function unlockCompanyContact(id:string,_state:string,_form:FormData) {
  const actor=await requirePageActor(companyPath(id),['buyer']);
  try {await buyCompanyContact(actor,id);}
  catch(error) {return error instanceof AccessError?error.message:'Chưa mở được liên hệ. Vui lòng thử lại.';}
  revalidatePath('/find-partners');
  revalidatePath(companyPath(id));
  return 'Đã mở liên hệ. Bạn có thể xem lại miễn phí.';
}
