import {accessErrorResponse} from '../../../../../lib/auth/server';
import {AccessError} from '../../../../../lib/auth/permissions';
import {privateJson} from '../../../../../lib/seller/http';
import {payoutWorkspace,payoutUpload} from '../../../../../lib/finance/payout-http';
import {uploadPayoutDocument} from '../../../../../services/payout-documents';
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{const {admin}=payoutWorkspace(request);if(!admin)throw new AccessError(403,'Chỉ nhân sự tài chính nộp chứng từ chi trả.');const {actor,data}=await payoutUpload(request,true);return privateJson(await uploadPayoutDocument(actor,{withdrawalId:(await params).id},true,data));}catch(e){return accessErrorResponse(e);}}
