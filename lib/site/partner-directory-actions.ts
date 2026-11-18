'use server';

import {and,eq,isNull} from 'drizzle-orm';
import {revalidatePath} from 'next/cache';
import {db} from '../../db/client';
import {partnerCompanies} from '../../db/schema';
import {requirePageActor} from '../auth/server';
import {uuidInput} from '../seller/validation';
import {partnerStaff} from '../../services/partner-requests';

export async function setCompanyPublication(id:string, published:boolean, form:FormData) {
  await requirePageActor('/admin/partner-directory',partnerStaff);
  if (published && form.get('reviewed')!=='on') return;
  await db.update(partnerCompanies).set({publishedAt:published ? new Date() : null})
    .where(and(eq(partnerCompanies.id,uuidInput(id)),published ? isNull(partnerCompanies.publishedAt) : undefined));
  revalidatePath('/admin/partner-directory');
  revalidatePath('/find-partners/companies');
}
