import 'server-only';
import {wardFilterAliases} from '../lib/projects/wards';
import {and,asc,desc,eq,ilike,isNotNull,inArray,or,sql} from 'drizzle-orm';
import {db} from '../db/client';
import {companyContactAccess,partnerCompanies as companies} from '../db/schema';
import {companySearch,companySpecialties,type CompanySearchInput} from '../lib/site/company-search';
import {partnerSchemaUnavailable} from './partner-requests';
export async function listCompanyDirectory(input:CompanySearchInput,buyerId?:string) {
  const filters=companySearch(input);
  const year=sql`CASE WHEN ${companies.profile}->>'year' ~ '^[0-9]{4}$' THEN (${companies.profile}->>'year')::int ELSE 9999 END`;
  const terms=companySpecialties.find(([key])=>key===filters.specialty)?.[3].split(';')??[];
  const where=and(isNotNull(companies.publishedAt),
    terms.length?or(...terms.map(term=>sql`concat_ws(' ',${companies.trade},${companies.profile}->>'work') ILIKE ${'%'+term+'%'}`)):undefined,
    filters.minYear?sql`${year} >= ${Number(filters.minYear)}`:undefined,
    filters.maxYear?sql`${year} <= ${Number(filters.maxYear)}`:undefined,
    filters.minYear||filters.maxYear?sql`${year} <> 9999`:undefined,filters.province ? eq(companies.province,filters.province) : undefined,
      filters.ward ? inArray(sql<string>`${companies.profile}->>'ward'`,wardFilterAliases(filters.province,filters.ward)) : undefined,
      ...filters.keyword.split(/\s+/).filter(Boolean).slice(0,10).map(word=>{
        const pattern='%'+word.replace(/[\\%_]/g,'\\$&')+'%';
        return or(ilike(companies.name,pattern),ilike(companies.trade,pattern),
          sql`concat_ws(' ', ${companies.profile}->>'market', ${companies.profile}->>'work', ${companies.profile}->>'experience') ILIKE ${pattern}`);
      }));
  const [count]=await db.select({total:sql<number>`count(*)::int`}).from(companies).where(where)
    .catch(error=>{if(partnerSchemaUnavailable(error))return [{total:0}];throw error;});
  const total=count.total,pages=Math.max(1,Math.ceil(total/filters.size)),page=Math.min(filters.page,pages);
  const rows=await db.select({id:companies.id,name:companies.name,trade:companies.trade,province:companies.province,
    year:sql<string>`coalesce(${companies.profile}->>'year','')`,
    employees:sql<string>`coalesce(${companies.profile}->>'employees','')`,
    market:sql<string>`left(coalesce(${companies.profile}->>'market',''),120)`})
    .from(companies).where(where)
    .orderBy(...(filters.sort==='name_asc'?[asc(companies.name),asc(companies.id)]:filters.sort==='name_desc'?[desc(companies.name),asc(companies.id)]:filters.sort==='oldest'?[asc(companies.publishedAt),asc(companies.id)]:filters.sort==='established'?[asc(year),asc(companies.id)]:[desc(companies.publishedAt),desc(companies.id)])).limit(filters.size).offset((page-1)*filters.size)
    .catch(error=>{if(partnerSchemaUnavailable(error)) return [];throw error;});
  const access=buyerId&&rows.length?await db.select({id:companyContactAccess.companyId}).from(companyContactAccess)
    .where(and(eq(companyContactAccess.buyerId,buyerId),inArray(companyContactAccess.companyId,rows.map(row=>row.id))))
    .catch(error=>{if(partnerSchemaUnavailable(error))return [];throw error;}):[];
  const unlocked=new Set(access.map(row=>row.id));
  return {data:rows.map(row=>({...row,unlocked:unlocked.has(row.id)})),pagination:{page,pageSize:filters.size,total,totalPages:pages}};
}
export type CompanyDirectoryResult=Awaited<ReturnType<typeof listCompanyDirectory>>;
