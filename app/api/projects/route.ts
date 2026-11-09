
import { NextRequest } from 'next/server';
import { listPublicProjects } from '../../../services/public-projects';
import { accessErrorResponse } from '../../../lib/auth/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    return Response.json(await listPublicProjects(request.nextUrl.searchParams), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return accessErrorResponse(error); }
}
