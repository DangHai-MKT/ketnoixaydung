'use client';
export default function ReviewError({ reset }: { reset: () => void }) {
  return <main className="account-page"><h1>Chưa thể tải danh sách</h1><p role="alert">Dịch vụ xét duyệt tạm thời chưa sẵn sàng. Vui lòng thử lại sau.</p><button className="button button-secondary" onClick={reset}>Thử lại</button></main>;
}
