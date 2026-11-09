import { sellerApi } from '../../../../lib/seller/api';
import { privateJson } from '../../../../lib/seller/http';
import { requireVerifiedSeller } from '../../../../lib/seller/server';

export async function GET(request: Request) {
  return sellerApi(request, async () => {
    const { profile } = await requireVerifiedSeller(request);
    return privateJson({ verified: true, applicationId: profile!.id });
  });
}
