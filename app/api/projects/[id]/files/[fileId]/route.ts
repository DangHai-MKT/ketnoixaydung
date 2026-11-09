import { getCurrentActor, accessErrorResponse } from '../../../../../../lib/auth/server';
import { uuidInput } from '../../../../../../lib/projects/validation';
import { downloadProjectFile } from '../../../../../../services/project-files';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string; fileId: string }> }) {
  try {
    const { id, fileId } = await context.params;
    return await downloadProjectFile(await getCurrentActor(request.headers), uuidInput(id), uuidInput(fileId));
  } catch (error) { return accessErrorResponse(error); }
}
