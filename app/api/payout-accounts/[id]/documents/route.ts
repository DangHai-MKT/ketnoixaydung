import {accessErrorResponse} from '../../../../../lib/auth/server';
import {privateJson} from '../../../../../lib/seller/http';
import {payoutWorkspace,payoutUpload} from '../../../../../lib/finance/payout-http';
import {uploadPayoutDocument} from '../../../../../services/payout-documents';
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{const {admin}=payoutWorkspace(request),{actor,data}=await payoutUpload(request,admin);return privateJson(await uploadPayoutDocument(actor,{accountId:(await params).id},admin,data));}catch(e){return accessErrorResponse(e);}}
