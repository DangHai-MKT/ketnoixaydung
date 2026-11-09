import { sellerApi } from '../../../../../lib/seller/api';
import { privateJson, readJson } from '../../../../../lib/seller/http';
import { objectInput } from '../../../../../lib/seller/validation';
import { AccessError } from '../../../../../lib/auth/permissions';
import { submitApplication } from '../../../../../services/seller-applications';

export async function POST(request: Request) {
  return sellerApi(request, async (actor) => {
    const body = objectInput(await readJson(request));
    if (Object.keys(body).some((key) => key !== 'revision')) throw new AccessError(400, 'Chỉ được gửi phiên bản hồ sơ của bạn.');
    const profile = await submitApplication(actor.id, body.revision);
    return privateJson({ id: profile.id, revision: profile.revision });
  });
}
