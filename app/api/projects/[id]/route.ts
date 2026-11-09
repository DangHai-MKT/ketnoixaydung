import { getPublicProject } from '../../../../services/public-projects';
import { uuidInput } from '../../../../lib/projects/validation';
import { accessErrorResponse } from '../../../../lib/auth/server';
import { AccessError } from '../../../../lib/auth/permissions';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const project = await getPublicProject(uuidInput((await context.params).id));
    if (!project) throw new AccessError(404, 'Không tìm thấy dự án đang công bố.');
    return Response.json({ project }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return accessErrorResponse(error); }
}
