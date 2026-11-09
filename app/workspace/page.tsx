import {redirect} from 'next/navigation';
import {requirePageActor} from '../../lib/auth/server';
import {defaultWorkspace} from '../../lib/dashboard/navigation';
export const dynamic='force-dynamic';
export default async function WorkspacePage(){const actor=await requirePageActor('/workspace');redirect(defaultWorkspace(actor.roles));}
