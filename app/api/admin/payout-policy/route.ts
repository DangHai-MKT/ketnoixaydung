import {requireApiActor,accessErrorResponse} from '../../../../lib/auth/server';
import {privateJson} from '../../../../lib/seller/http';
import {payoutJson} from '../../../../lib/finance/payout-http';
import {getPayoutConfiguration,savePayoutConfiguration} from '../../../../services/payout-base';
export async function GET(request:Request){try{return privateJson(await getPayoutConfiguration(await requireApiActor(request,['super_admin'])));}catch(e){return accessErrorResponse(e);}}
export async function POST(request:Request){try{const {actor,data}=await payoutJson(request,true,true);return privateJson(await savePayoutConfiguration(actor,data));}catch(e){return accessErrorResponse(e);}}
