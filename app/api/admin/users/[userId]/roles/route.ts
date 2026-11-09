import { AccessError } from '../../../../../../lib/auth/permissions';
import { accessErrorResponse, requireApiActor, requireSameOrigin } from '../../../../../../lib/auth/server';
import { readJson } from '../../../../../../lib/seller/http';
import { grantUserRole } from '../../../../../../services/roles';

export async function POST(request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    requireSameOrigin(request);
    const actor = await requireApiActor(request, ['super_admin']);
    const { userId } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) throw new AccessError(400, 'Mã người dùng không hợp lệ.');
    let body: unknown;
    body = await readJson(request);
    if (!body || typeof body !== 'object' || !('role' in body) || !('reason' in body) || typeof body.reason !== 'string') throw new AccessError(400, 'Vui lòng cung cấp vai trò và lý do.');
    if(Object.keys(body).some(key=>!['role','reason'].includes(key))) throw new AccessError(400,'Dữ liệu có trường không được phép.');
    const result = await grantUserRole(actor.id, userId, body.role, body.reason);
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return accessErrorResponse(error); }
}

