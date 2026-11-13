
import { NextRequest } from 'next/server';
import { listPublicProjects } from '../../../services/public-projects';
import { accessErrorResponse } from '../../../lib/auth/server';
import { markPurchasedProjects } from '../../../services/purchase-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const listing = await listPublicProjects(request.nextUrl.searchParams);
    const data = await markPurchasedProjects(listing.data, request.headers);
    return Response.json({ ...listing, data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return accessErrorResponse(error); }
}
