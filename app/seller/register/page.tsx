import { siteIdentity } from '../../../lib/site/navigation';
import { requirePageActor } from '../../../lib/auth/server';
import SellerOnboardingFrame from '../../../components/SellerOnboardingFrame';


export const metadata = { title: `Đăng ký người bán | ${siteIdentity.name}` };
export default async function SellerRegisterPage() {
  await requirePageActor('/seller/register');
  return <SellerOnboardingFrame mode="edit"/>;
}
