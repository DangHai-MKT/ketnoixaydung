import { requireApiActor, requireSameOrigin, accessErrorResponse } from '../../../../../../lib/auth/server';
import { manageUser } from '../../../../../../services/admin-users';
import { readJson, privateJson } from '../../../../../../lib/seller/http';
import { uuidInput } from '../../../../../../lib/seller/validation';
export async function POST(request: Request, { params }: {
    params: Promise<{
        userId: string;
    }>;
}) { try {
    requireSameOrigin(request);
    const actor = await requireApiActor(request, ['super_admin']);
    const { userId } = await params;
    return privateJson(await manageUser(actor, uuidInput(userId), await readJson(request)));
}
catch (error) {
    return accessErrorResponse(error);
} }
