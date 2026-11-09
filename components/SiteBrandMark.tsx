import Image from 'next/image';
import { siteIdentity } from '../lib/site/navigation';

export default function SiteBrandMark() {
  return <Image className="site-brand-mark" src={siteIdentity.mark} alt="" width={38} height={38} unoptimized />;
}
