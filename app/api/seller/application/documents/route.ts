import { sellerApi } from '../../../../../lib/seller/api';
import { privateJson, readBoundedBody } from '../../../../../lib/seller/http';
import { uploadLimits } from '../../../../../lib/seller/storage';
import { AccessError } from '../../../../../lib/auth/permissions';
import { uploadDocument } from '../../../../../services/seller-documents';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  return sellerApi(request, async (actor) => {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.startsWith('multipart/form-data;')) throw new AccessError(400, 'Vui lòng gửi tệp bằng biểu mẫu tải lên.');
    const body = await readBoundedBody(request, uploadLimits().maxBytes + 64 * 1024);
    let form: FormData;
    try { form = await new Request('http://localhost/upload', { method: 'POST', headers: { 'content-type': contentType }, body: body as BodyInit }).formData(); }
    catch { throw new AccessError(400, 'Biểu mẫu tải lên không hợp lệ.'); }
    const allowed = ['file', 'documentType', 'revision', 'replaceDocumentId'];
    const keys = [...form.keys()];
    if (keys.some((key) => !allowed.includes(key)) || new Set(keys).size !== keys.length) throw new AccessError(400, 'Biểu mẫu chứa trường không được phép hoặc bị trùng.');
    const file = form.get('file');
    if (!(file instanceof File)) throw new AccessError(400, 'Vui lòng chọn một tệp ảnh.');
    if (file.size > uploadLimits().maxBytes) throw new AccessError(413, 'Tệp vượt giới hạn dung lượng.');
    const replacement = form.get('replaceDocumentId');
    if (replacement !== null && typeof replacement !== 'string') throw new AccessError(400, 'Mã tài liệu thay thế không hợp lệ.');
    return privateJson(await uploadDocument(actor, file, form.get('documentType'), Number(form.get('revision')), replacement), 201);
  });
}
