import { sellerApi } from '../../../../../lib/seller/api';
import { privateJson } from '../../../../../lib/projects/http';
import { projectReviewerRoles } from '../../../../../lib/projects/workflow';
import { uuidInput } from '../../../../../lib/projects/validation';
import { projectDetail } from '../../../../../services/project-listings';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) { return sellerApi(request, async (actor) => privateJson(await projectDetail(actor, uuidInput((await context.params).id), true, new URL(request.url).searchParams.has('version') ? uuidInput(new URL(request.url).searchParams.get('version')!) : undefined)), projectReviewerRoles); }

