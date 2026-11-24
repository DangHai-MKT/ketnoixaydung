import {accessErrorResponse, requireApiActor, requireSameOrigin} from '../../../../lib/auth/server';
import {AccessError} from '../../../../lib/auth/permissions';
import {readBoundedBody, privateJson} from '../../../../lib/seller/http';
import {directoryMaxBytes, parsePartnerDirectory} from '../../../../lib/site/partner-directory-csv';
import {partnerStaff} from '../../../../services/partner-requests';
import {db} from '../../../../db/client';
import {partnerCompanies} from '../../../../db/schema';
import {and,eq,isNull} from 'drizzle-orm';
import {enrichCompanyAddress} from '../../../../lib/site/company-address';

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const actor = await requireApiActor(request, partnerStaff);
    const bytes = await readBoundedBody(request, directoryMaxBytes);
    let rows;
    try { rows = parsePartnerDirectory(new TextDecoder('utf-8', {fatal:true}).decode(bytes)); }
    catch (error) { throw new AccessError(400, error instanceof TypeError ? 'Hãy lưu tệp dưới dạng CSV UTF-8.' : (error as Error).message); }
    rows=rows.map(row=>row.company ? {...row,company:enrichCompanyAddress(row.company)} : row);
    if (request.headers.get('x-preview-only')==='1') return privateJson({rows});
    const companies = rows.flatMap(row => row.company ? [{...row.company, importedBy:actor.id}] : []);
    if (companies.length !== rows.length) throw new AccessError(400, 'Sửa các dòng lỗi trước khi nhập.');
    const result=await db.transaction(async tx=>{
      // Bound SQL parameters for large files; the transaction keeps the file atomic.
      let insertedCount=0;
      for(let offset=0;offset<companies.length;offset+=250){
        const batch=await tx.insert(partnerCompanies).values(companies.slice(offset,offset+250)).onConflictDoNothing().returning({id:partnerCompanies.id});
        insertedCount+=batch.length;
      }
      let updated=0;
      if (!insertedCount && companies.length===1 && request.headers.get('x-refresh-company')==='1') {
        const company=companies[0];
        const matches=await tx.update(partnerCompanies).set({profile:company.profile,trade:company.trade,website:company.website})
          .where(and(eq(partnerCompanies.identityKey,company.identityKey),eq(partnerCompanies.sourceUrl,company.sourceUrl),
            isNull(partnerCompanies.publishedAt))).returning({id:partnerCompanies.id});
        updated=matches.length;
      }
      return {inserted:insertedCount,updated,skipped:rows.length-insertedCount-updated};
    });
    return privateJson(result);
  } catch (error) { return accessErrorResponse(error); }
}
