import { sellerApi } from '../../../../../../lib/seller/api';
import { privateJson, readJson } from '../../../../../../lib/projects/http';
import { projectReviewerRoles } from '../../../../../../lib/projects/workflow';
import { uuidInput } from '../../../../../../lib/projects/validation';
import { moderateProject } from '../../../../../../services/project-moderation';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { return sellerApi(request, async (actor) => privateJson(await moderateProject(actor, uuidInput((await context.params).id), await readJson(request))), projectReviewerRoles); }
