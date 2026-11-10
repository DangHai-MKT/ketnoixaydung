'use client';
import SiteBrandMark from './SiteBrandMark';
import { usePathname } from 'next/navigation';
import AccountNavigation from './AccountNavigation';
import Icon from './MarketplaceIcon';
import { primaryNavigation, siteIdentity } from '../lib/site/navigation';

export default function SiteHeader() {
  const pathname = usePathname();
  const links = primaryNavigation.map((item) => {
    const active = item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`);
    return <a key={item.href} className={active ? 'nav-active' : ''} aria-current={active ? 'page' : undefined} href={item.href}>{item.icon && <Icon name={item.icon} size={14} />}{item.label}</a>;
  });
  return (
    <header className="site-header">
      <a className="brand" href="/">
        <SiteBrandMark />
        <span>
          <strong>{siteIdentity.name}</strong>
          <small>{siteIdentity.tagline}</small>
        </span>
      </a>

      <nav className="header-nav" aria-label="Điều hướng chính">
        {links}
      </nav>
      <div className="header-account"><a className="header-search" href="/projects" aria-label="Tìm kiếm dự án"><Icon name="search" size={21} /></a><AccountNavigation /><span className="header-language" aria-label="Ngôn ngữ: Tiếng Việt"><span>★</span> VI</span></div>
    </header>
  );
}
