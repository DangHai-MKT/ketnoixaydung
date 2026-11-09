import { requireApiActor, accessErrorResponse } from '../../../../../lib/auth/server';
import { getWalletTransactions } from '../../../../../services/wallet';
import { walletQuery } from '../../../../../lib/finance/validation';
import { privateJson } from '../../../../../lib/seller/http';
export async function GET(request: Request) {
 try { const actor = await requireApiActor(request, ['buyer']); return privateJson(await getWalletTransactions(actor, walletQuery(new URL(request.url).searchParams))); }
 catch (error) { return accessErrorResponse(error); }
}
