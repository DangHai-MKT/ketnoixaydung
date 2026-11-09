'use client';
import SiteBrandMark from './SiteBrandMark';
import { useCallback, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import type { Role } from '../lib/auth/permissions';
import { availableWorkspaces, dashboardNames, dashboardNavigation, type DashboardMode } from '../lib/dashboard/navigation';
import { siteIdentity } from '../lib/site/navigation';
import Icon from './MarketplaceIcon';
import LogoutButton from './LogoutButton';
import NotificationBell from './NotificationBell';
import {notificationUpdateEvent} from '../lib/notifications/contracts';

export default function DashboardShell({ children, mode, name, roles, unread: initialUnread, showProjectWatch=false, sellerEnabled=false }: { children: ReactNode; mode: DashboardMode; name: string; roles: Role[]; unread: number;showProjectWatch?:boolean;sellerEnabled?:boolean }) {
  const pathname = usePathname(), params = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false), [accountOpen, setAccountOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(max-width:1100px)');
    const resize = () => { setNarrow(media.matches); setMenuOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenuOpen(false); setAccountOpen(false); } };
    resize(); media.addEventListener('change', resize); window.addEventListener('keydown', escape);
    return () => { media.removeEventListener('change', resize); window.removeEventListener('keydown', escape); };
  }, []);
  const [unreadOverride,setUnreadOverride]=useState<{source:number;value:number}|null>(null);
  const unread=unreadOverride?.source===initialUnread?unreadOverride.value:initialUnread;
  const updateUnread=useCallback((value:number)=>setUnreadOverride({source:initialUnread,value}),[initialUnread]);
  useEffect(()=>{
    const update=(event:Event)=>{
      if(event instanceof CustomEvent&&Number.isSafeInteger(event.detail)&&event.detail>=0)updateUnread(event.detail);
    };
    window.addEventListener(notificationUpdateEvent,update);
    return ()=>window.removeEventListener(notificationUpdateEvent,update);
  },[updateUnread]);
  const links = dashboardNavigation(mode, roles, showProjectWatch, sellerEnabled);
  const workspaceLabel = mode === 'buyer' && sellerEnabled ? 'Tài khoản mua & bán' : dashboardNames[mode];
  const base = mode === 'buyer' ? '/account' : `/${mode}`;
  const active = (href: string) => {
    if (href.includes('#')) return false;
    const [path, query] = href.split('?');
    if (query) return pathname === path && [...new URLSearchParams(query)].every(([key, value]) => params.get(key) === value);
    const root = mode === 'buyer' ? '/account' : `/${mode}`;
    return (pathname === path && !params.get('status') && !params.get('role')) || (path !== root && pathname.startsWith(`${path}/`));
  };
  return <div className={`dash-shell dash-${mode} ${menuOpen ? 'dash-menu-open' : ''}`}>
    <a className="site-skip-link" href="#dashboard-content">Chuyển đến nội dung chính</a>
    <header className="dash-topbar"><a className="dash-brand" href="/"><SiteBrandMark /><span><strong>{siteIdentity.name}</strong><small>{siteIdentity.tagline}</small></span></a><button className="dash-menu-toggle" onClick={() => setMenuOpen(!menuOpen)} type="button" aria-label="Mở hoặc thu gọn menu" aria-expanded={narrow ? menuOpen : !menuOpen} aria-controls="dashboard-sidebar"><Icon name="menu" size={23} /></button>{mode === 'buyer' && <a className="dash-marketplace-link" href="/projects" aria-label="Khám phá dự án trên sàn"><Icon name="search" size={20}/><span>Khám phá dự án</span></a>}{mode !== 'buyer' && (mode !== 'seller' || roles.includes('seller')) && <form action={mode === 'admin' ? '/admin' : mode === 'seller' ? '/seller/projects' : '/projects'} className="dash-search"><Icon name="search" size={20} /><input name="q" aria-label="Tìm dự án" defaultValue={mode === 'admin' ? params.get('q') || '' : ''} placeholder={mode === 'admin' ? 'Tìm trong báo cáo quản trị…' : mode === 'seller' ? 'Tìm trong dự án của tôi…' : 'Tìm dự án, địa điểm…'} maxLength={100} /></form>}<div className="dash-top-actions"><NotificationBell href={`${base}/notifications`} unread={unread} onUnread={updateUnread}/><a href={`${base}/help`} className="dash-help-icon" aria-label="Trợ giúp"><Icon name="help" size={23} /></a><div className="dash-user-menu"><button type="button" onClick={() => setAccountOpen(!accountOpen)} aria-expanded={accountOpen}><span className="dash-avatar">{Array.from(name.trim())[0]?.toUpperCase() || 'U'}</span><span><strong>{name}</strong><small>{workspaceLabel}</small></span><span aria-hidden="true">⌄</span></button>{accountOpen && <nav aria-label="Chuyển không gian làm việc">{availableWorkspaces(roles).map(item => <a href={item.href} key={item.href}>{item.label}</a>)}<a href={`${base}/profile`}>Hồ sơ cá nhân</a><a href={`${base}/security`}>Bảo mật tài khoản</a><a href={`${base}/activity`}>Hoạt động tài khoản</a><a href="/">Về trang hiển thị</a><LogoutButton /></nav>}</div></div></header>
    {menuOpen && <button type="button" className="dash-overlay" aria-label="Đóng menu" onClick={() => setMenuOpen(false)} />}
    <aside className="dash-sidebar" id="dashboard-sidebar"><nav aria-label={`Điều hướng ${workspaceLabel}`}>{links.map(link => <div key={`${link.href}-${link.label}`}><a href={link.href} className={active(link.href) && (mode !== 'admin' || link.label === 'Tổng quan') ? 'dash-nav-active' : active(link.href) && !link.href.includes('#') ? 'dash-nav-section-active' : ''} aria-current={active(link.href) ? 'page' : undefined} onClick={() => setMenuOpen(false)}><Icon name={link.icon} size={22} /><span>{link.label}</span>{link.children && <small className="dash-group-chevron" aria-hidden="true">⌃</small>}{link.label === 'Thông báo' && unread > 0 && <b className="dash-nav-badge">{unread > 99 ? '99+' : unread}</b>}</a>{link.children && <div className="dash-subnav">{link.children.map(child => child.disabled ? <span key={`${child.href}-${child.label}`} className="dash-nav-disabled" aria-disabled="true">{child.label}<small>Sắp có</small></span> : <a key={`${child.href}-${child.label}`} href={child.href} className={active(child.href) ? 'dash-child-active' : ''} onClick={() => setMenuOpen(false)}>{child.label}</a>)}</div>}</div>)}</nav><div className="dash-sidebar-bottom"><a href="/" className="dash-return"><Icon name="civil" size={20} /> Về trang hiển thị</a><div className="dash-support"><Icon name="help" size={24} /><div><strong>Bạn cần hỗ trợ?</strong><p>Hướng dẫn sử dụng và thông tin tài khoản.</p></div><a href={`${base}/help`}>Liên hệ hỗ trợ →</a></div></div></aside>
    <div className="dash-content" id="dashboard-content" tabIndex={-1}>{children}<footer className="dash-footer">© {new Date().getFullYear()} {siteIdentity.name}<a href="/">Về trang hiển thị ↗</a></footer></div>
  </div>;
}






