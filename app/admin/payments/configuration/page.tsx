import {redirect} from 'next/navigation';
import {requirePageActor} from '../../../../lib/auth/server';
export default async function Page(){await requirePageActor('/admin/payments/configuration',['super_admin']);redirect('/admin/settings#bank');}
