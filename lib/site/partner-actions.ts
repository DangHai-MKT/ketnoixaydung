'use server';

import {redirect} from 'next/navigation';
import {AccessError} from '../auth/permissions';
import {requirePageActor} from '../auth/server';
import {createPartnerRequest, closePartnerRequest, introducePartner, partnerStaff, respondToPartnerRequest} from '../../services/partner-requests';

async function attempt(run:()=>Promise<string>) {
  let href:string;
  try { href = await run(); }
  catch (error) {
    if (error instanceof AccessError) return error.message;
    console.error('[partner-requests] Không thể lưu thao tác.');
    return 'Chưa lưu được. Vui lòng thử lại.';
  }
  redirect(href);
}

export async function createPartnerAction(_state:string, form:FormData) {
  const actor = await requirePageActor('/find-partners');
  return attempt(async()=>'/find-partners/'+await createPartnerRequest(actor,form));
}

export async function respondPartnerAction(id:string, kind:string, _state:string, _form:FormData) {
  const href = '/find-partners/'+id;
  const actor = await requirePageActor(href);
  return attempt(async()=>{await respondToPartnerRequest(actor,id,kind);return href;});
}

export async function closePartnerAction(id:string, _state:string, _form:FormData) {
  const href = '/find-partners/'+id;
  const actor = await requirePageActor(href);
  return attempt(async()=>{await closePartnerRequest(actor,id);return '/find-partners';});
}

export async function introducePartnerAction(id:string, _state:string, form:FormData) {
  const href = '/admin/partner-requests/'+id;
  const actor = await requirePageActor(href,partnerStaff);
  return attempt(async()=>{await introducePartner(actor,id,form);return href;});
}
