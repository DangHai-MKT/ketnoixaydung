import {requireApiActor,accessErrorResponse} from '../../../../../lib/auth/server';
import {privateJson} from '../../../../../lib/seller/http';
import {getTopup} from '../../../../../services/payments';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{return privateJson(await getTopup(await requireApiActor(request,['finance_operator','super_admin']),(await params).id,true));}catch(error){return accessErrorResponse(error);}}
