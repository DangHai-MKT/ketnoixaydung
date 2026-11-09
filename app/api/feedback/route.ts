import { accessErrorResponse, requireApiActor, requireSameOrigin } from '../../../lib/auth/server';
import { privateJson, readJson } from '../../../lib/seller/http';
import { submitFeedback } from '../../../services/feedback';

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    return privateJson(await submitFeedback(await requireApiActor(request), await readJson(request)), 201);
  } catch (error) {
    return accessErrorResponse(error);
  }
}
