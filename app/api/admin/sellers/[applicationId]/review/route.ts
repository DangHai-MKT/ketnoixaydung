import { sellerApi } from '../../../../../../lib/seller/api';
import { privateJson, readJson } from '../../../../../../lib/seller/http';
import { sellerReviewRoles } from '../../../../../../lib/seller/workflow';
import { uuidInput } from '../../../../../../lib/seller/validation';
import { reviewApplication } from '../../../../../../services/seller-reviews';

export async function POST(request: Request, context: { params: Promise<{ applicationId: string }> }) {
  return sellerApi(request, async (actor) => {
    const profile = await reviewApplication(actor, uuidInput((await context.params).applicationId), await readJson(request));
    return privateJson({ id: profile.id, revision: profile.revision });
  }, sellerReviewRoles);
}
