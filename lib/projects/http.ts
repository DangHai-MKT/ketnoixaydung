import 'server-only';
import type { Actor } from '../auth/permissions';
import { sellerApi } from '../seller/api';
import { requireVerifiedSeller } from '../seller/server';
export { privateJson, readBoundedBody, readJson } from '../seller/http';
export async function ownerProjectApi(request: Request, work: (actor: Actor) => Promise<Response>) {
  return sellerApi(request, async () => { const { actor } = await requireVerifiedSeller(request); return work(actor); });
}
