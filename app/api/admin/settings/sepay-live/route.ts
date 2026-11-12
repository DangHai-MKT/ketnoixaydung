import { accessErrorResponse, requireApiActor, requireSameOrigin } from '../../../../../lib/auth/server';
import { privateJson, readJson } from '../../../../../lib/seller/http';
import { saveSepaySettings } from '../../../../../services/sepay-settings';

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const actor = await requireApiActor(request, ['super_admin']);
    return privateJson(await saveSepaySettings(actor, await readJson(request), 'live'));
  } catch (error) {
    return accessErrorResponse(error);
  }
}
