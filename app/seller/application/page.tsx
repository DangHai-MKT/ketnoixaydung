import { siteIdentity } from '../../../lib/site/navigation';
import { requirePageActor } from '../../../lib/auth/server';
import SellerOnboardingFrame from '../../../components/SellerOnboardingFrame';


export const metadata = { title: `Hồ sơ người bán | ${siteIdentity.name}` };
export default async function SellerApplicationPage() {
  await requirePageActor('/seller/application');
  return <SellerOnboardingFrame mode="status"/>;
}
