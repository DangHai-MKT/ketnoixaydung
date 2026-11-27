import {getPublishedCompany} from '../../../../../services/public-companies';
import {companyPublicPath} from '../../../../../lib/site/public-paths';
import {legacyPublicResponse} from '../../../../../lib/site/legacy-public-url';
import {accessErrorResponse} from '../../../../../lib/auth/server';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    const company=await getPublishedCompany((await params).id);
    return legacyPublicResponse(company?.publicSlug?companyPublicPath(company.id,company.publicSlug):null,new URL(request.url).search,'company');
  }catch(error){return accessErrorResponse(error);}
}
