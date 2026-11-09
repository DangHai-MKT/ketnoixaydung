import 'server-only';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db } from '../../db/client';
import { sellerProfiles } from '../../db/schema';
import { requirePageActor, requireApiActor } from '../auth/server';
import { AccessError } from '../auth/permissions';
import { isVerifiedSeller } from './workflow';
import { cache } from 'react';
import type { Actor } from '../auth/permissions';

const sellerProfile = cache(async (userId: string) => {
  const [profile] = await db.select().from(sellerProfiles).where(eq(sellerProfiles.userId, userId));
  return profile ?? null;
});

export async function verifiedSellerProfile(actor: Actor) {
  const profile = actor.roles.includes('seller') ? await sellerProfile(actor.id) : null;
  return isVerifiedSeller(actor, profile) ? profile : null;
}

export async function requireVerifiedSeller(request?: Request) {
  const actor = request ? await requireApiActor(request, ['seller']) : await requirePageActor('/seller', ['seller']);
  const [profile] = await db.select().from(sellerProfiles).where(eq(sellerProfiles.userId, actor.id));
  if (!isVerifiedSeller(actor, profile ?? null)) {
    if (!request) redirect('/seller/application');
    throw new AccessError(403, 'Bạn cần có hồ sơ người bán đã được xác minh.');
  }
  return { actor, profile };
}
