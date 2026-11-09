import { redirect } from 'next/navigation';
import { requirePageActor } from '../../lib/auth/server';
import { sellerEntryDestination } from '../../lib/seller/entry';
import { getOwnApplication } from '../../services/seller-applications';

export default async function SellerPage() {
  const actor = await requirePageActor('/seller');
  const application = await getOwnApplication(actor);
  redirect(sellerEntryDestination(actor.roles, application?.profile ?? null));
}
