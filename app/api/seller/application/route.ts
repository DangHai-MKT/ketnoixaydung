import { sellerApi } from '../../../../lib/seller/api';
import { privateJson, readJson } from '../../../../lib/seller/http';
import { objectInput } from '../../../../lib/seller/validation';
import { getOwnApplication, saveApplication } from '../../../../services/seller-applications';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return sellerApi(request, async (actor) => privateJson({ application: await getOwnApplication(actor) }));
}
export async function PUT(request: Request) {
  return sellerApi(request, async (actor) => {
    const input = objectInput(await readJson(request));
    const profile = await saveApplication(actor.id, input, input.revision);
    return privateJson({ id: profile.id, revision: profile.revision });
  });
}
