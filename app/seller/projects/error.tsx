'use client';
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="account-page"><h1>Chưa thể tải dự án</h1><p role="alert">Vui lòng thử lại sau.</p><button className="button button-secondary" onClick={reset}>Thử lại</button></main>; }
