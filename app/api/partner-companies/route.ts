import {getCurrentActor,accessErrorResponse} from '../../../lib/auth/server';
import {listCompanyDirectory} from '../../../services/company-directory';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  try {
    const actor=await getCurrentActor(request.headers);
    const result=await listCompanyDirectory(Object.fromEntries(new URL(request.url).searchParams),actor?.status==='active'?actor.id:undefined);
    return Response.json(result,{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return accessErrorResponse(error);}
}
