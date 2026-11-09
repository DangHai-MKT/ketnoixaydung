import { requireApiActor, accessErrorResponse } from '../../../../lib/auth/server';
import { getWalletOverview } from '../../../../services/wallet';
import { privateJson } from '../../../../lib/seller/http';
export async function GET(request: Request) {
 try { return privateJson(await getWalletOverview(await requireApiActor(request, ['buyer']))); }
 catch (error) { return accessErrorResponse(error); }
}
