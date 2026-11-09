import { requireApiActor, requireSameOrigin, accessErrorResponse } from '../../../../lib/auth/server';
import { getOwnProfile, updateOwnProfile } from '../../../../services/account-profile';
import { readJson, privateJson } from '../../../../lib/seller/http';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) { try {
    return privateJson({ profile: await getOwnProfile(await requireApiActor(request)) });
}
catch (error) {
    return accessErrorResponse(error);
} }
export async function PATCH(request: Request) { try {
    requireSameOrigin(request);
    const actor = await requireApiActor(request);
    return privateJson({ profile: await updateOwnProfile(actor, await readJson(request)) });
}
catch (error) {
    return accessErrorResponse(error);
} }
