import { accessErrorResponse } from '../../../../lib/auth/server';
import { privateJson } from '../../../../lib/seller/http';
import { receiveSepayLiveWebhook } from '../../../../services/sepay-live';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    return privateJson(await receiveSepayLiveWebhook(request));
  } catch (error) {
    return accessErrorResponse(error);
  }
}
