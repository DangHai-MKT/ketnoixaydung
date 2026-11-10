import {accessErrorResponse, requireApiActor, requireSameOrigin} from '../../../../../lib/auth/server';
import {privateJson, readJson} from '../../../../../lib/seller/http';
import {activateTopupRate} from '../../../../../services/payments';

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const actor = await requireApiActor(request, ['super_admin']);
    return privateJson(await activateTopupRate(actor, await readJson(request)));
  } catch (error) {
    return accessErrorResponse(error);
  }
}
