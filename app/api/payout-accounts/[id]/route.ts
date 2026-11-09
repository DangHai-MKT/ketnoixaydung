import {accessErrorResponse} from '../../../../lib/auth/server';
import {privateJson} from '../../../../lib/seller/http';
import {payoutWorkspace,payoutApiActor,payoutJson} from '../../../../lib/finance/payout-http';
import {actPayoutAccount,getPayoutAccount} from '../../../../services/payout-accounts';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{const {admin}=payoutWorkspace(request);return privateJson(await getPayoutAccount(await payoutApiActor(request,admin),(await params).id,admin));}catch(e){return accessErrorResponse(e);}}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{const {admin}=payoutWorkspace(request),{actor,data}=await payoutJson(request,admin);return privateJson(await actPayoutAccount(actor,(await params).id,admin,data));}catch(e){return accessErrorResponse(e);}}
