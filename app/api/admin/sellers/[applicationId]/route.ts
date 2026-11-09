import { sellerApi } from '../../../../../lib/seller/api';
import { privateJson } from '../../../../../lib/seller/http';
import { sellerReviewRoles } from '../../../../../lib/seller/workflow';
import { uuidInput } from '../../../../../lib/seller/validation';
import { applicationDetail } from '../../../../../services/seller-applications';

export async function GET(request: Request, context: { params: Promise<{ applicationId: string }> }) {
  return sellerApi(request, async (actor) => privateJson({ application: await applicationDetail(uuidInput((await context.params).applicationId), actor, true) }), sellerReviewRoles);
}
