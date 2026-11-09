import { requireApiActor,requireSameOrigin,accessErrorResponse } from '../../../../lib/auth/server';
import {readJson,privateJson} from '../../../../lib/seller/http';
import {purchaseInput,purchaseHistoryQuery} from '../../../../lib/finance/purchase';
import {purchaseProject} from '../../../../services/purchase';
import {listOwnPurchases} from '../../../../services/purchase-access';
export async function POST(request:Request){
 try{requireSameOrigin(request);const actor=await requireApiActor(request,['buyer']);const input=purchaseInput(await readJson(request));
 const result=await purchaseProject({buyerId:actor.id,...input});
 return privateJson({...result,pricePoints:result.pricePoints.toString(),feePoints:result.feePoints.toString(),sellerPoints:result.sellerPoints.toString()});}
 catch(error){return accessErrorResponse(error);}
}
export async function GET(request:Request){
 try{const actor=await requireApiActor(request,['buyer']);const query=purchaseHistoryQuery(new URL(request.url).searchParams);
 return privateJson(await listOwnPurchases(actor,query.page,query.q));}catch(error){return accessErrorResponse(error);}
}
