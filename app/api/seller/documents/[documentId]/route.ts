import { sellerApi } from '../../../../../lib/seller/api';
import { downloadDocument } from '../../../../../services/seller-documents';

export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ documentId: string }> }) {
  return sellerApi(request, async (actor) => downloadDocument(actor, (await context.params).documentId));
}
