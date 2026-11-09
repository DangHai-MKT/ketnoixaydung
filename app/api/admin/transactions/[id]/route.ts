import {requireApiActor,accessErrorResponse} from '../../../../../lib/auth/server';
import {privateJson} from '../../../../../lib/seller/http';
import {financeMonitorRoles,getFinanceTransaction} from '../../../../../services/finance-monitor';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{return privateJson(await getFinanceTransaction(await requireApiActor(request,financeMonitorRoles),(await params).id));}catch(e){return accessErrorResponse(e);}}
