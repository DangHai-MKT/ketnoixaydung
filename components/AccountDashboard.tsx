import type { ReactNode } from 'react';
import type { Actor } from '../lib/auth/permissions';
import { getUnreadCount } from '../services/dashboard';
import { projectWatchEnabled } from '../services/project-watch';
import { verifiedSellerProfile } from '../lib/seller/server';
import DashboardShell from './DashboardShell';

export default async function AccountDashboard({ actor, children }: { actor: Actor; children: ReactNode }) {
  const [unread, profile] = await Promise.all([
    getUnreadCount(actor),
    verifiedSellerProfile(actor),
  ]);
  return <DashboardShell mode="buyer" name={actor.displayName} roles={actor.roles} unread={unread}
    sellerEnabled={Boolean(profile)} showProjectWatch={projectWatchEnabled()}>
    {children}
  </DashboardShell>;
}
