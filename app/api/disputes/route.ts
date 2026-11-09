import {disputeActor,disputeRequest} from '../../../lib/finance/dispute-http';
import {caseQuery} from '../../../lib/finance/disputes';
import {privateJson,readJson} from '../../../lib/seller/http';
import {accessErrorResponse,requireSameOrigin} from '../../../lib/auth/server';
import {AccessError} from '../../../lib/auth/permissions';
import {listDisputes,openDispute} from '../../../services/disputes';
export async function GET(request:Request){try{const {mode,params}=disputeRequest(request,['page','status']);return privateJson(await listDisputes(await disputeActor(request,mode),mode,caseQuery(params)));}catch(e){return accessErrorResponse(e);}}
export async function POST(request:Request){try{requireSameOrigin(request);const {mode}=disputeRequest(request);if(mode!=='buyer')throw new AccessError(403,'Chỉ người mua được mở hồ sơ cho giao dịch của mình.');return privateJson(await openDispute(await disputeActor(request,mode),await readJson(request)));}catch(e){return accessErrorResponse(e);}}
