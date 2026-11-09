import {requireApiActor,requireSameOrigin,accessErrorResponse} from '../../../../../lib/auth/server';
import {privateJson,readJson} from '../../../../../lib/seller/http';
import {createTopup,listTopups} from '../../../../../services/payments';
import {paymentQuery} from '../../../../../lib/finance/topup';
export async function GET(request:Request){try{return privateJson(await listTopups(await requireApiActor(request,['buyer']),paymentQuery(new URL(request.url).searchParams)));}catch(error){return accessErrorResponse(error);}}
export async function POST(request:Request){try{requireSameOrigin(request);return privateJson(await createTopup(await requireApiActor(request,['buyer']),await readJson(request)));}catch(error){return accessErrorResponse(error);}}
