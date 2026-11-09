import { accessErrorResponse, requireApiActor } from '../../../lib/auth/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const actor = await requireApiActor(request);
    return Response.json({ user: actor }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return accessErrorResponse(error); }
}
