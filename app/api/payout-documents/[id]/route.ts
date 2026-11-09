import {accessErrorResponse} from '../../../../lib/auth/server';
import {AccessError} from '../../../../lib/auth/permissions';
import {payoutWorkspace,payoutJson} from '../../../../lib/finance/payout-http';
import {readPayoutDocument} from '../../../../services/payout-documents';
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{const {admin}=payoutWorkspace(request),{actor,data}=await payoutJson(request,admin);if(Object.keys(data).length)throw new AccessError(400,'Chỉ gửi mật khẩu xác nhận xem chứng từ.');return await readPayoutDocument(actor,(await params).id,admin);}catch(e){return accessErrorResponse(e);}}
