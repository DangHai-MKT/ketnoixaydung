import type { CSSProperties } from 'react';

const paths: Record<string, React.ReactNode> = {
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  dashboard: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 8h18M8 8v13m4-9h5m-5 4h5" /></>,
  bell: <><path d="M5 17h14l-2-4V8a5 5 0 0 0-10 0v5l-2 4Zm5 3h4M12 1v2" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9 9a3 3 0 1 1 4 3c-1 1-1 2-1 2m0 3h.01" /></>,
  settings: <><path d="m9 3 1-2h4l1 2 3 1 2 2-1 3 2 1v4l-2 1 1 3-2 2-3-1-1 2h-4l-1-2-3 1-2-2 1-3-2-1v-4l2-1-1-3 2-2 3 1Z" /><circle cx="12" cy="11" r="3" /></>,
  wallet: <><path d="M21 7H4a2 2 0 0 1 0-4h15v4M3 5v15h18V7M21 11h-7v5h7m-4-2.5h.1" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  pin: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  all: <><path d="M4 21V5l8-3 8 3v16H4Zm8-18v18M7 8h2m6 0h2M7 12h2m6 0h2M7 16h2m6 0h2" /></>,
  civil: <><path d="m2 11 10-8 10 8M5 9v12h14V9M10 21v-7h4v7M16 4V2h3v5" /></>,
  industrial: <><path d="M3 21V3h4v11l6-4v4l8-4v11H3Zm3-4h2m3 0h2m3 0h2" /></>,
  infrastructure: <><path d="M3 21 9 3h6l6 18M8 21l2-8m4 0 2 8M12 3v4m0 3v3m0 4v4M7 3h10" /></>,
  energy: <path d="m13 2-9 12h7l-1 8 10-13h-8l1-7Z" />,
  commercial: <><rect x="3" y="3" width="12" height="18" rx="1" /><path d="M15 10h6v11M7 7h1m3 0h1M7 11h1m3 0h1M7 15h1m3 0h1M8 21v-3h3v3M18 14h1m-1 3h1" /></>,
  agriculture: <><path d="M12 21V11M12 17C2 17 3 9 3 5c8 0 9 5 9 8M12 14c0-8 4-11 10-11 0 8-2 13-10 13M6 9l6 8m5-9-5 6" /></>,
  healthcare: <><path d="M8 21v-5H4a8 8 0 1 1 16 0h-4v5M10 7h4v3h3v4h-3v3h-4v-3H7v-4h3V7Z" /></>,
  education: <><path d="m2 8 10-5 10 5-10 5L2 8Zm4 3v7c4 3 8 3 12 0v-7M22 8v9" /></>,
  other: <><circle cx="4" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="20" cy="12" r="1.5" /></>,
  shield: <><path d="m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6l9-4Z" /><path d="m8 12 3 3 5-6" /></>,
  users: <><circle cx="9" cy="7" r="4" /><path d="M1 22v-4a7 7 0 0 1 14 0v4M17 4a4 4 0 0 1 0 8m2 3a6 6 0 0 1 4 6" /></>,
  file: <><path d="M5 2h9l5 5v15H5V2Zm9 0v6h5M8 12h8M8 16h8M8 19h5" /></>,
  unlock: <><rect x="4" y="11" width="16" height="11" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.8-1.2M12 15v3" /></>,
  flag: <path d="M5 22V3m0 1c5-4 9 4 15 0v11c-6 4-10-4-15 0" />,
  handshake: <><path d="m2 8 5-5 5 2 5-2 5 5-3 9-5 5-4-1-7-5-1-8Z" /><path d="m7 3 5 2-5 6 3 2 5-5 6 8M7 17l3 4m0-7 5 6" /></>,
  helmet: <><path d="M3 14a9 9 0 0 1 18 0M2 14h20v4H2v-4ZM10 13V3h4v10M5 21h14" /></>,
  star: <path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></>,
  book: <><path d="M12 5C9 2 4 3 2 4v16c3-2 7-2 10 0 3-2 7-2 10 0V4c-3-2-7-2-10 1Zm0 0v15M5 8h4m-4 4h4m6-4h4m-4 4h4" /></>,
};

export default function MarketplaceIcon({ name, size = 24, style }: { name: string; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>{paths[name] ?? paths.all}</svg>;
}
