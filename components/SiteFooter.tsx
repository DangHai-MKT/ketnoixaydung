import MarketplaceFooter from './MarketplaceFooter';
import { getPublicSiteSettings } from '../services/settings';

/** Shared footer for every page; the homepage design is the canonical version. */
export default async function SiteFooter() {
  const { lines, zaloUrl, analyticsId } = await getPublicSiteSettings();
  return <>
    <MarketplaceFooter supportLines={lines} analyticsId={analyticsId} />
    {zaloUrl && <details className="site-zalo">
      <summary aria-label="Hỗ trợ qua Zalo" title="Hỗ trợ qua Zalo">
        <svg aria-hidden="true" width="42" height="42" viewBox="0 0 42 42">
          <path fill="white" d="M10 5h22a7 7 0 0 1 7 7v16a7 7 0 0 1-7 7H16l-8 4v-4a7 7 0 0 1-5-7V12a7 7 0 0 1 7-7Z"/>
          <text x="21" y="25" textAnchor="middle" fill="#0068ff" fontFamily="Arial, sans-serif" fontSize="14" fontWeight="700">Zalo</text>
        </svg>
      </summary>
      <div className="site-zalo-panel">
        <strong>Kết Nối Xây Dựng</strong>
        <div className="site-zalo-content">
          <p>Xin chào! Bạn cần hỗ trợ gì? Hãy nhắn tin cho chúng tôi qua Zalo.</p>
          <a href={zaloUrl} target="_blank" rel="noopener noreferrer">Chat nhanh <span aria-hidden="true">↗</span></a>
        </div>
      </div>
    </details>}
  </>;
}
