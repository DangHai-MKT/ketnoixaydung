import {accessErrorResponse} from '../../../lib/auth/server';
import {AccessError} from '../../../lib/auth/permissions';
import {privateJson} from '../../../lib/seller/http';
import {payoutWorkspace,payoutApiActor,payoutJson} from '../../../lib/finance/payout-http';
import {payoutQuery} from '../../../lib/finance/payout';
import {requestWithdrawal} from '../../../services/withdrawals';
import {listWithdrawals} from '../../../services/payout-read';
export async function GET(request:Request){try{const {admin,params}=payoutWorkspace(request,['page','status']);return privateJson(await listWithdrawals(await payoutApiActor(request,admin),admin,payoutQuery(params)));}catch(e){return accessErrorResponse(e);}}
export async function POST(request:Request){try{const {admin}=payoutWorkspace(request);if(admin)throw new AccessError(403,'Nhà cung cấp tự xác nhận yêu cầu rút.');const {actor,data}=await payoutJson(request,false);return privateJson(await requestWithdrawal(actor,data));}catch(e){return accessErrorResponse(e);}}
