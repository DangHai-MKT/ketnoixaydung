import {requireApiActor,accessErrorResponse} from '../../../../lib/auth/server';
import {privateJson} from '../../../../lib/seller/http';
import {walletQuery} from '../../../../lib/finance/validation';
import {financeMonitorRoles,listFinanceTransactions} from '../../../../services/finance-monitor';
export async function GET(request:Request){try{return privateJson(await listFinanceTransactions(await requireApiActor(request,financeMonitorRoles),walletQuery(new URL(request.url).searchParams)));}catch(e){return accessErrorResponse(e);}}
