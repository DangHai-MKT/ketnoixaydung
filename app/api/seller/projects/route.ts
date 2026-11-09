import { ownerProjectApi, privateJson, readJson } from '../../../../lib/projects/http';
import {sellerProjectPage} from '../../../../services/project-search';
import { createProject, listOwnProjects } from '../../../../services/project-listings';
export async function GET(request: Request) { return ownerProjectApi(request, async (actor) => privateJson(await sellerProjectPage(actor,new URL(request.url).searchParams))); }
export async function POST(request: Request) { return ownerProjectApi(request, async (actor) => privateJson(await createProject(actor, await readJson(request)), 201)); }

