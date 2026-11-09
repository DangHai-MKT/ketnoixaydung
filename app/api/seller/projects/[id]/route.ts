import { ownerProjectApi, privateJson, readJson } from '../../../../../lib/projects/http';
import { uuidInput } from '../../../../../lib/projects/validation';
import { projectDetail, updateDraft } from '../../../../../services/project-listings';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) { return ownerProjectApi(request, async (actor) => privateJson(await projectDetail(actor, uuidInput((await context.params).id), false, new URL(request.url).searchParams.has('version') ? uuidInput(new URL(request.url).searchParams.get('version')!) : undefined))); }
export async function PUT(request: Request, context: Context) { return ownerProjectApi(request, async (actor) => privateJson(await updateDraft(actor, uuidInput((await context.params).id), await readJson(request)))); }

