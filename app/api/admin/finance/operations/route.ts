import {requireApiActor,accessErrorResponse} from '../../../../../lib/auth/server';
import {AccessError} from '../../../../../lib/auth/permissions';
import {privateJson} from '../../../../../lib/seller/http';
import {financeOperations} from '../../../../../services/finance-operations';
export async function GET(request:Request){try{const actor=await requireApiActor(request,['finance_operator','super_admin']);if(new URL(request.url).search)throw new AccessError(400,'Trang vận hành không nhận bộ lọc tùy ý.');return privateJson(await financeOperations(actor));}catch(e){return accessErrorResponse(e);}}
