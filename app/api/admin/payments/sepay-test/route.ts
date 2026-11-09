import {requireApiActor,requireSameOrigin,accessErrorResponse} from '../../../../../lib/auth/server';
import {privateJson,readJson} from '../../../../../lib/seller/http';
import {listSepayEvents,reconcileSepayEvent} from '../../../../../services/sepay';
import {uuidInput} from '../../../../../lib/seller/validation';
import {AccessError} from '../../../../../lib/auth/permissions';
export async function GET(request:Request){try{const p=new URL(request.url).searchParams;if([...p.keys()].some(k=>k!=='page')||p.getAll('page').length>1||!/^\d+$/.test(p.get('page')||'1'))throw new AccessError(400,'Bộ lọc không hợp lệ.');return privateJson(await listSepayEvents(await requireApiActor(request,['finance_operator','super_admin']),Number(p.get('page')||1)));}catch(e){return accessErrorResponse(e);}}
export async function POST(request:Request){try{requireSameOrigin(request);const actor=await requireApiActor(request,['finance_operator','super_admin']),v=await readJson(request) as Record<string,unknown>;if(!v||typeof v!=='object'||Object.keys(v).some(k=>k!=='id')||typeof v.id!=='string')throw new AccessError(400,'Yêu cầu không hợp lệ.');uuidInput(v.id);return privateJson(await reconcileSepayEvent(v.id,actor));}catch(e){return accessErrorResponse(e);}}
