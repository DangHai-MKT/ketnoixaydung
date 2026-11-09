import {accessErrorResponse} from '../../../lib/auth/server';
import {AccessError} from '../../../lib/auth/permissions';
import {privateJson} from '../../../lib/seller/http';
import {payoutWorkspace,payoutApiActor,payoutJson} from '../../../lib/finance/payout-http';
import {payoutQuery} from '../../../lib/finance/payout';
import {createPayoutAccount,listPayoutAccounts} from '../../../services/payout-accounts';
export async function GET(request:Request){try{const {admin,params}=payoutWorkspace(request,['page','status']);return privateJson(await listPayoutAccounts(await payoutApiActor(request,admin),admin,payoutQuery(params,true)));}catch(e){return accessErrorResponse(e);}}
export async function POST(request:Request){try{const {admin}=payoutWorkspace(request);if(admin)throw new AccessError(403,'Nhà cung cấp tự khai báo tài khoản nhận.');const {actor,data}=await payoutJson(request,false);return privateJson(await createPayoutAccount(actor,data));}catch(e){return accessErrorResponse(e);}}
