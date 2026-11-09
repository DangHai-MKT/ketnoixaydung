import {disputeActor,disputeRequest} from '../../../../../../lib/finance/dispute-http';
import {accessErrorResponse} from '../../../../../../lib/auth/server';
import {downloadDisputeEvidence} from '../../../../../../services/disputes';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{id:string;evidenceId:string}>}){try{const {mode}=disputeRequest(request),p=await params;return await downloadDisputeEvidence(await disputeActor(request,mode),p.id,p.evidenceId,mode);}catch(e){return accessErrorResponse(e);}}
