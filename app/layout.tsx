import type { Metadata } from "next";
import { siteIdentity } from '../lib/site/navigation';
import "./globals.css";
import "./marketplace.css";
import "./marketplace-home.css";
import "./marketplace-lower.css";
import "./site-shell.css";
import './dashboard.css';
import './admin-dashboard.css';
import './seller-dashboard.css';
import './buyer-dashboard.css';
import './identity.css';
import './project-marketplace.css';
import './auth-experience.css';
import './finance.css';
import './editorial.css';
import './cms.css';
import './notifications.css';
import './load-more.css';

export const metadata: Metadata = {
  robots: {index: false, follow: false},
  title: siteIdentity.name,
  applicationName: siteIdentity.name,
  icons: { icon: { url: siteIdentity.mark, type: 'image/svg+xml' } },
  description:
    "Nền tảng kết nối nhà cung cấp và người mua thông tin dự án xây dựng.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}





