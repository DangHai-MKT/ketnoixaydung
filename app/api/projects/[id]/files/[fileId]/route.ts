import { getCurrentActor, accessErrorResponse } from '../../../../../../lib/auth/server';
import { uuidInput } from '../../../../../../lib/projects/validation';
import { downloadProjectFile } from '../../../../../../services/project-files';
import { projectThumbnailWidth } from '../../../../../../lib/projects/thumbnail';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string; fileId: string }> }) {
  try {
    const { id, fileId } = await context.params;
    const thumbnail = projectThumbnailWidth(new URL(request.url).searchParams.get('thumbnail'));
    const actor = thumbnail ? null : await getCurrentActor(request.headers);
    return await downloadProjectFile(actor, uuidInput(id), uuidInput(fileId), thumbnail, request.headers.get('if-none-match'));
  } catch (error) { return accessErrorResponse(error); }
}
