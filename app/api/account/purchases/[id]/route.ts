import {requireApiActor,accessErrorResponse} from '../../../../../lib/auth/server';
import {privateJson} from '../../../../../lib/seller/http';
import {getOwnPurchase} from '../../../../../services/purchase-access';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 try{return privateJson(await getOwnPurchase(await requireApiActor(request,['buyer']),(await params).id));}catch(error){return accessErrorResponse(error);}
}
