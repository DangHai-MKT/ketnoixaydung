import 'server-only';
import {cache} from 'react';
import {and,eq,isNotNull,asc} from 'drizzle-orm';
import {db} from '../db/client';
import {partnerCompanies} from '../db/schema';
import {partnerSchemaUnavailable} from './partner-requests';

export const getPublishedCompany=cache(async(id:string)=>{
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const [row]=await db.select().from(partnerCompanies).where(and(eq(partnerCompanies.id,id),isNotNull(partnerCompanies.publishedAt)))
    .limit(1).catch(error=>{if(partnerSchemaUnavailable(error))return [];throw error;});
  return row??null;
});

export async function listCompanySitemapEntries(limit:number) {
  if(limit<=0)return [];
  return db.select({id:partnerCompanies.id,publishedAt:partnerCompanies.publishedAt}).from(partnerCompanies)
    .where(isNotNull(partnerCompanies.publishedAt)).orderBy(asc(partnerCompanies.id)).limit(limit)
    .catch(error=>{if(partnerSchemaUnavailable(error))return [];throw error;});
}
