import {redirect} from 'next/navigation';
import {eq} from 'drizzle-orm';
import {requirePageActor} from '../../lib/auth/server';
import {sellerEntryDestination} from '../../lib/seller/entry';
import {db} from '../../db/client';
import {sellerProfiles} from '../../db/schema';

export const dynamic='force-dynamic';
export default async function BecomeSellerPage(){
  const actor=await requirePageActor('/become-seller');
  const [profile]=await db.select({verificationStatus:sellerProfiles.verificationStatus,correctionRequestedAt:sellerProfiles.correctionRequestedAt}).from(sellerProfiles).where(eq(sellerProfiles.userId,actor.id)).limit(1);
  redirect(sellerEntryDestination(actor.roles,profile??null));
}
