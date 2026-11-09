import { ownerProjectApi, privateJson, readJson } from '../../../../../../lib/projects/http';
import { uuidInput, versionCommand } from '../../../../../../lib/projects/validation';
import { changeListingVisibility } from '../../../../../../services/project-listings';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return ownerProjectApi(request, async (actor) => { const command = versionCommand(await readJson(request)); return privateJson(await changeListingVisibility(actor, uuidInput((await context.params).id), command.revision, command.versionId, 'withdraw')); });
}
