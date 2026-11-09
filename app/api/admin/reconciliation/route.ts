import {requireApiActor,accessErrorResponse} from '../../../../lib/auth/server';
import {privateJson} from '../../../../lib/seller/http';
import {lifecycleQuery} from '../../../../lib/finance/lifecycle';
import {lifecycleReport} from '../../../../services/lifecycle-reconciliation';
export async function GET(request:Request){try{const actor=await requireApiActor(request,['finance_operator','super_admin']);return privateJson(await lifecycleReport(actor,lifecycleQuery(new URL(request.url).searchParams)));}catch(e){return accessErrorResponse(e);}}
