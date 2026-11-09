import { ownerProjectApi, privateJson, readBoundedBody } from '../../../../../../lib/projects/http';
import { uuidInput, revisionInput } from '../../../../../../lib/projects/validation';
import { uploadLimits } from '../../../../../../lib/projects/storage';
import { AccessError } from '../../../../../../lib/auth/permissions';
import { uploadProjectFile } from '../../../../../../services/project-files';
export const runtime = 'nodejs';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return ownerProjectApi(request, async (actor) => {
    const type = request.headers.get('content-type') || '';
    if (!type.startsWith('multipart/form-data;')) throw new AccessError(400, 'Cần biểu mẫu tải tệp.');
    const bytes = await readBoundedBody(request, uploadLimits().maxBytes + 64 * 1024);
    let form: FormData;
    try { form = await new Request('http://localhost/upload', { method: 'POST', headers: { 'content-type': type }, body: bytes as BodyInit }).formData(); }
    catch { throw new AccessError(400, 'Biểu mẫu tệp không hợp lệ.'); }
    const keys = [...form.keys()];
    if (new Set(keys).size !== keys.length || keys.some((key) => !['revision', 'versionId', 'accessLevel', 'replaceId', 'file'].includes(key))) throw new AccessError(400, 'Biểu mẫu có trường không được phép hoặc bị trùng.');
    const file = form.get('file');
    if (!(file instanceof File) || file.size > uploadLimits().maxBytes) throw new AccessError(413, 'Tệp thiếu hoặc vượt giới hạn dung lượng.');
    return privateJson(await uploadProjectFile(actor, uuidInput((await context.params).id), uuidInput(String(form.get('versionId'))), revisionInput(Number(form.get('revision'))), file,
      String(form.get('accessLevel')), form.get('replaceId') ? uuidInput(String(form.get('replaceId'))) : null), 201);
  });
}
