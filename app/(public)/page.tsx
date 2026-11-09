import { siteIdentity } from '../../lib/site/navigation';
import MarketplaceHome from "../../components/MarketplaceHome";
import {publicMetadata} from '../../lib/site/seo';
export const metadata = publicMetadata('/', siteIdentity.name, 'Tìm và đăng thông tin dự án xây dựng đã qua kiểm duyệt tại Việt Nam.');
export const dynamic = "force-dynamic";
export default function HomePage() { return <MarketplaceHome />; }
