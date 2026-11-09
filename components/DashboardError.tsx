'use client';
export default function DashboardError({ retry }: { retry: () => void }) {
  return <main className="dash-panel dash-empty"><h1>Chưa thể tải không gian làm việc</h1><p role="alert">Dữ liệu tạm thời chưa sẵn sàng. Vui lòng thử lại.</p><button className="dash-outline" type="button" onClick={retry}>Thử lại</button></main>;
}
