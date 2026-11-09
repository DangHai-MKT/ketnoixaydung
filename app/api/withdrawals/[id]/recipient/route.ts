import {accessErrorResponse} from '../../../../../lib/auth/server';
import {AccessError} from '../../../../../lib/auth/permissions';
import {privateJson} from '../../../../../lib/seller/http';
import {payoutWorkspace,payoutJson} from '../../../../../lib/finance/payout-http';
import {revealWithdrawalRecipient} from '../../../../../services/payout-read';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{const {admin}=payoutWorkspace(request);if(!admin)throw new AccessError(403,'Chỉ nhân sự tài chính xem người nhận đã chốt.');const {actor,data}=await payoutJson(request,true);return privateJson(await revealWithdrawalRecipient(actor,(await params).id,data));}catch(e){return accessErrorResponse(e);}}
