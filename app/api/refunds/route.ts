import {requireApiActor,requireSameOrigin,accessErrorResponse} from '../../../lib/auth/server';
import {AccessError} from '../../../lib/auth/permissions';
import {privateJson,readJson} from '../../../lib/seller/http';
import {disputeRequest} from '../../../lib/finance/dispute-http';
import {settlementQuery} from '../../../lib/finance/settlement';
import {listRefunds,requestRefund} from '../../../services/settlements';
export async function GET(request:Request){try{const {mode,params}=disputeRequest(request,['page','status']);return privateJson(await listRefunds(await requireApiActor(request,mode==='admin'?['finance_operator','super_admin']:[mode]),mode,settlementQuery(params,'refund')));}catch(e){return accessErrorResponse(e);}}
export async function POST(request:Request){try{requireSameOrigin(request);const {mode}=disputeRequest(request);if(mode!=='buyer')throw new AccessError(403,'Chỉ người mua được gửi yêu cầu cho giao dịch của mình.');return privateJson(await requestRefund(await requireApiActor(request,['buyer']),await readJson(request)));}catch(e){return accessErrorResponse(e);}}
