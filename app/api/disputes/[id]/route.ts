import {disputeActor,disputeRequest} from '../../../../lib/finance/dispute-http';
import {privateJson,readJson} from '../../../../lib/seller/http';
import {accessErrorResponse,requireSameOrigin} from '../../../../lib/auth/server';
import {AccessError} from '../../../../lib/auth/permissions';
import {getDispute,updateDispute} from '../../../../services/disputes';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{const {mode,params:q}=disputeRequest(request,['page']);if(q.getAll('page').length>1||! /^[1-9]\d{0,3}$/.test(q.get('page')||'1'))throw new AccessError(400,'Trang lịch sử không hợp lệ.');return privateJson(await getDispute(await disputeActor(request,mode),(await params).id,mode,Number(q.get('page')||1)));}catch(e){return accessErrorResponse(e);}}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{requireSameOrigin(request);const {mode}=disputeRequest(request);return privateJson(await updateDispute(await disputeActor(request,mode),(await params).id,mode,await readJson(request)));}catch(e){return accessErrorResponse(e);}}
