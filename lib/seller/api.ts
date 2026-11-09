import 'server-only';
import type { Actor, Role } from '../auth/permissions';
import { accessErrorResponse, requireApiActor, requireSameOrigin } from '../auth/server';

export async function sellerApi(request: Request, work: (actor: Actor) => Promise<Response>, allowed?: readonly Role[]) {
  try {
    if (request.method !== 'GET' && request.method !== 'HEAD') requireSameOrigin(request);
    const actor = await requireApiActor(request, allowed);
    return await work(actor);
  } catch (error) { return accessErrorResponse(error); }
}
