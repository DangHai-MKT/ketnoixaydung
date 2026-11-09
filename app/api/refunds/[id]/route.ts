import {requireApiActor,requireSameOrigin,accessErrorResponse} from '../../../../lib/auth/server';
import {AccessError} from '../../../../lib/auth/permissions';
import {privateJson,readJson} from '../../../../lib/seller/http';
import {disputeRequest} from '../../../../lib/finance/dispute-http';
import {getRefund,processRefund} from '../../../../services/settlements';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{const {mode}=disputeRequest(request);return privateJson(await getRefund(await requireApiActor(request,mode==='admin'?['finance_operator','super_admin']:[mode]),(await params).id,mode));}catch(e){return accessErrorResponse(e);}}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{requireSameOrigin(request);const {mode}=disputeRequest(request);if(mode!=='admin')throw new AccessError(403,'Chỉ nhân sự tài chính được xử lý yêu cầu.');return privateJson(await processRefund(await requireApiActor(request,['finance_operator','super_admin']),(await params).id,await readJson(request)));}catch(e){return accessErrorResponse(e);}}
