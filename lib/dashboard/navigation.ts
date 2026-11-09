import { adminRoles, type Role } from '../auth/permissions';
export type DashboardMode = 'buyer' | 'seller' | 'admin';
export const dashboardNames: Record<DashboardMode, string> = { buyer: 'Tài khoản', seller: 'Tài khoản', admin: 'Quản trị viên' };
export type DashboardLink = { label: string; href: string; icon: string; disabled?: boolean; children?: { label: string; href: string; disabled?: boolean }[] };
export const dashboardBase = (mode: DashboardMode) => mode === 'buyer' ? '/account' : `/${mode}`;
export function defaultWorkspace(roles: readonly Role[]) {
  return roles.some(role => adminRoles.includes(role)) ? '/admin' : '/account';
}
export function dashboardNavigation(mode: DashboardMode, roles: readonly Role[], showProjectWatch=false, sellerEnabled=roles.includes('seller')): DashboardLink[] {
  const base = mode === 'admin' ? '/admin' : '/account';
  const common: DashboardLink[] = [
    { label: 'Thông báo', href: `${base}/notifications`, icon: 'bell' },
    { label: 'Hỗ trợ', href: `${base}/help`, icon: 'help' },
    { label: 'Thông tin tài khoản', href: `${base}/profile`, icon: 'settings' },
  ];
  if (mode === 'admin') {
    const moderator = roles.some(role => role === 'content_moderator' || role === 'super_admin');
    const finance = roles.some(role => role === 'finance_operator' || role === 'super_admin');
    const support = roles.some(role => role === 'support_operator' || role === 'super_admin');
    return [{ label: 'Tổng quan', href: '/admin', icon: 'dashboard' },
      ...(moderator ? [{ label: 'Quản lý dự án', href: '/admin/projects', icon: 'file', children: [
        { label: 'Dự án chờ duyệt', href: '/admin/projects' }, { label: 'Dự án đã công bố', href: '/admin/projects?status=published' },
        { label: 'Báo cáo vi phạm', href: '#project-reports', disabled: true }, { label: 'Danh mục & khu vực', href: '/admin#admin-regions' },
      ] }] : []),
      ...(roles.includes('super_admin') ? [{ label: 'Quản lý người dùng', href: '/admin/users', icon: 'users', children: [
        { label: 'Người mua', href: '/admin/users?role=buyer' }, { label: 'Người bán', href: '/admin/users?role=seller' },
        { label: 'Xác minh người bán', href: '/admin/sellers' }, { label: 'Quản lý vai trò', href: '/admin/users#grant-role' },
      ] }] : moderator ? [{ label: 'Xác minh người bán', href: '/admin/sellers', icon: 'users' }] : []),
      ...(finance ? [{ label: 'Giao dịch & thanh toán', href: '/admin/transactions', icon: 'wallet', children: [
        { label: 'Giám sát giao dịch', href: '/admin/transactions' }, {label:'Giải phóng thu nhập',href:'/admin/earnings'}, {label:'Hoàn POINT',href:'/admin/refunds'}, { label: 'Nạp điểm', href: '/admin/payments' },
        { label: 'Chi trả người bán', href: '/admin/withdrawals' }, {label:'Xác minh tài khoản nhận',href:'/admin/payout-accounts'}, { label: 'Tổng quan tài chính', href: '/admin/finance' }, {label:'Đối soát toàn vòng đời',href:'/admin/reconciliation'}, {label:'Vận hành tài chính',href:'/admin/finance/operations'},
      ] }] : []),
      ...(moderator ? [{ label: 'Quản lý nội dung', href: '/admin/pages', icon: 'book', children: [
        { label: 'Trang thông tin', href: '/admin/pages' }, { label: 'Tin tức', href: '/admin/news' },
        { label: 'Danh mục tin', href: '/admin/news/categories' },
        { label: 'Thư viện ảnh', href: '/admin/media' },
      ] }] : []),
      { label: 'Báo cáo & thống kê', href: finance ? '/admin#admin-finance' : moderator ? '/admin#admin-activity' : '/admin#admin-support', icon: 'dashboard', children: [
        ...(finance ? [{ label: 'Tổng quan tài chính', href: '/admin/finance' }] : []),
        ...(moderator ? [{ label: 'Hoạt động', href: '/admin#admin-activity' }, { label: 'Thống kê khu vực', href: '/admin#admin-regions' }] : []),
      ] },
      ...(support || finance ? [{ label: 'Hỗ trợ & khiếu nại', href: '/admin/disputes', icon: 'help', children: [
        { label: 'Hồ sơ tranh chấp', href: '/admin/disputes' }, { label: 'Tin nhắn hỗ trợ', href: '#support-messages', disabled: true },
        ...(support ? [{ label: 'Góp ý trải nghiệm', href: '/admin/feedback' }] : []),
      ] }] : []),
      ...(roles.includes('super_admin') ? [{label:'Cấu hình hệ thống',href:'/admin/settings',icon:'settings'}] : []),
      { label: 'Thông báo', href: '/admin/notifications', icon: 'bell' }, { label: 'Cài đặt tài khoản', href: '/admin/profile', icon: 'settings' }];
  }
  return [{ label: 'Tổng quan', href: '/account', icon: 'civil' },
    ...(showProjectWatch?[{label:'Theo dõi dự án',href:'/account/project-watch',icon:'bell'}]:[]),
    { label: 'Mua thông tin', href: '/account/purchases', icon: 'file', children: [
      { label: 'Dự án đã mua', href: '/account/purchases' }, { label: 'Dự án yêu thích', href: '#favorites', disabled: true },
      { label: 'Đang theo dõi', href: '#following', disabled: true }, { label: 'Lịch sử tìm kiếm', href: '#search-history', disabled: true },
    ] },
    { label: 'Báo cáo đơn mua', href: '/account/disputes', icon: 'shield' },
    { label: 'Hoàn POINT cho đơn mua', href: '/account/refunds', icon: 'wallet' },
    { label: 'Điểm của tôi', href: '/account/wallet', icon: 'wallet', children: [
      { label: 'Nạp điểm', href: '/account/wallet/top-up' }, { label: 'Lịch sử đơn mua', href: '/account/purchases' },
      { label: 'Lịch sử ví', href: '/account/wallet/transactions' },
      { label: 'Ưu đãi & khuyến mãi', href: '#promotions', disabled: true },
    ] },
    ...(sellerEnabled ? sellerLinks : [
      { label: 'Đăng ký hoặc theo dõi hồ sơ nhà cung cấp', href: '/become-seller', icon: 'commercial' },
    ]), { label: 'Góp ý trải nghiệm', href: '/feedback', icon: 'help' }, ...common];
}
const sellerLinks: DashboardLink[] = [
  { label: 'Tin đăng bán', href: '/seller/projects', icon: 'file', children: [
    { label: 'Tất cả tin đăng', href: '/seller/projects' }, { label: 'Tạo dự án mới', href: '/seller/projects/new' },
    { label: 'Đang duyệt', href: '/seller/projects?status=pending_review' }, { label: 'Đã công bố', href: '/seller/projects?status=published' },
    { label: 'Bị từ chối', href: '/seller/projects?status=rejected' },
  ] },
  { label: 'Thu nhập & rút tiền', href: '/seller/earnings', icon: 'wallet', children: [
    { label: 'Thu nhập bán', href: '/seller/earnings' }, { label: 'Lịch sử bán', href: '/seller/transactions' },
    { label: 'Yêu cầu rút tiền', href: '/seller/withdrawals' }, { label: 'Tài khoản nhận tiền', href: '/seller/payout-accounts' },
  ] },
  { label: 'Hỗ trợ đơn bán', href: '/seller/disputes', icon: 'shield', children: [
    { label: 'Báo cáo đơn bán', href: '/seller/disputes' }, { label: 'Hoàn POINT cho đơn bán', href: '/seller/refunds' },
  ] },
  { label: 'Hồ sơ nhà cung cấp', href: '/seller/application', icon: 'commercial' },
];

export function availableWorkspaces(roles: readonly Role[]) {
  return [{ label: 'Tài khoản mua & bán', href: '/account' },
    ...(roles.some(role => adminRoles.includes(role)) ? [{ label: 'Không gian quản trị', href: '/admin' }] : [])];
}
