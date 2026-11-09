import {requireApiActor,accessErrorResponse} from '../../../../lib/auth/server';
import {privateJson} from '../../../../lib/seller/http';
import {listTopups} from '../../../../services/payments';
import {paymentQuery} from '../../../../lib/finance/topup';
export async function GET(request:Request){try{return privateJson(await listTopups(await requireApiActor(request,['finance_operator','super_admin']),paymentQuery(new URL(request.url).searchParams),true));}catch(error){return accessErrorResponse(error);}}
