// Shared brand and destinations for the site header/footer.
export const siteIdentity = {
  name: 'Kết Nối Xây Dựng',
  tagline: 'Thông tin dự án xây dựng',
  mark: '/brand/ket-noi-xay-dung.svg',
} as const;

export const primaryNavigation: readonly { label: string; href: string; icon?: string }[] = [
  { label: 'Trang chủ', href: '/' },
  { label: 'Dự án', href: '/projects', icon: 'file' },
  { label: 'Hướng dẫn', href: '/guides', icon: 'book' },
  { label: 'Liên hệ', href: '/contact' },
];

export const footerNavigation = [
  { label: 'Trang chủ', href: '/' },
  { label: 'Dự án', href: '/projects' },
  { label: 'Nhà cung cấp', href: '/#trusted-suppliers' },
  { label: 'Cẩm nang thực hành', href: '/#market-updates' },
  { label: 'Hướng dẫn', href: '/guides' },
  { label: 'Câu hỏi thường gặp', href: '/faq' },
  { label: 'Góp ý trải nghiệm', href: '/feedback' },
  { label: 'Liên hệ', href: '/contact' },
] as const;
