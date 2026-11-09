import { requireVerifiedSeller } from '../../../lib/seller/server';
export default async function ProjectLayout({ children }: { children: React.ReactNode }) { await requireVerifiedSeller(); return children; }
