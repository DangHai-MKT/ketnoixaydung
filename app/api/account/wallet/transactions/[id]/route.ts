import { requireApiActor, accessErrorResponse } from '../../../../../../lib/auth/server';
import { getWalletTransaction } from '../../../../../../services/wallet';
import { privateJson } from '../../../../../../lib/seller/http';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
 try { const actor = await requireApiActor(request, ['buyer']); return privateJson(await getWalletTransaction(actor, (await params).id)); }
 catch (error) { return accessErrorResponse(error); }
}
