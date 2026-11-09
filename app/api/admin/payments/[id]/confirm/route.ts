import {requireApiActor,requireSameOrigin,accessErrorResponse} from '../../../../../../lib/auth/server';
import {privateJson,readJson} from '../../../../../../lib/seller/http';
import {confirmTopup} from '../../../../../../services/payments';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{requireSameOrigin(request);return privateJson(await confirmTopup(await requireApiActor(request,['finance_operator','super_admin']),(await params).id,await readJson(request)));}catch(error){return accessErrorResponse(error);}}
