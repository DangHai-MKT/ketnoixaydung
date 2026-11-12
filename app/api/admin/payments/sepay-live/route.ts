import { accessErrorResponse, requireApiActor, requireSameOrigin } from '../../../../../lib/auth/server';
import { uuidInput } from '../../../../../lib/projects/validation';
import { privateJson, readJson } from '../../../../../lib/seller/http';
import { retrySepayLiveEvent } from '../../../../../services/sepay-live';

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const actor = await requireApiActor(request, ['finance_operator', 'super_admin']);
    const body = await readJson(request) as { id?: unknown };
    return privateJson(await retrySepayLiveEvent(actor, uuidInput(String(body?.id ?? ''))));
  } catch (error) {
    return accessErrorResponse(error);
  }
}
