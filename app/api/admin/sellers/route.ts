import { sellerApi } from '../../../../lib/seller/api';
import { privateJson } from '../../../../lib/seller/http';
import { sellerReviewRoles } from '../../../../lib/seller/workflow';
import { listApplications } from '../../../../services/seller-reviews';

export async function GET(request: Request) {
  return sellerApi(request, async (actor) => {
    const params = new URL(request.url).searchParams;
    return privateJson(await listApplications(actor, params.get('status') ?? 'pending', Number(params.get('page') ?? 1)));
  }, sellerReviewRoles);
}
