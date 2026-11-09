import {requireApiActor,accessErrorResponse} from '../../../../lib/auth/server';
import {privateJson} from '../../../../lib/seller/http';
import {financeWindow} from '../../../../lib/finance/reporting';
import {getFinanceDashboard} from '../../../../services/finance-dashboard';
export async function GET(request:Request){try{return privateJson(await getFinanceDashboard(await requireApiActor(request,['finance_operator','super_admin']),financeWindow(new URL(request.url).searchParams)));}catch(e){return accessErrorResponse(e);}}
