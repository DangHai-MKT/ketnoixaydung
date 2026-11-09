import type { ReactNode } from 'react';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';

// Public route-group chrome. Protected workspaces use DashboardShell instead.
export default function SiteShell({ children }: { children: ReactNode }) {
  return <div className="site-shell">
    <a className="site-skip-link" href="#site-content">Chuyển đến nội dung chính</a>
    <SiteHeader />
    <div id="site-content" className="site-content" tabIndex={-1}>{children}</div>
    <SiteFooter />
  </div>;
}
