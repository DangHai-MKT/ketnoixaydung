import { ownerProjectApi, privateJson, readJson } from '../../../../../../lib/projects/http';
import { uuidInput, versionCommand } from '../../../../../../lib/projects/validation';
import { changeListingVisibility } from '../../../../../../services/project-listings';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return ownerProjectApi(request, async (actor) => {
    const { revision, versionId } = versionCommand(await readJson(request));
    const { id } = await context.params;
    return privateJson(await changeListingVisibility(actor, uuidInput(id), revision, versionId, 'republish'));
  });
}
