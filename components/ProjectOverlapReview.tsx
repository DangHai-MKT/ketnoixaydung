import type { ProjectDetail } from '../lib/projects/types';
import type { OverlapFinding } from '../lib/projects/overlap';

const labels: Record<OverlapFinding, string> = {
  likely_duplicate: 'Nghi bán trùng nội dung',
  review_scope: 'Cần đối chiếu phạm vi và nguồn tin',
  related_package: 'Có thể cùng công trình, khác gói thông tin',
};

export default function ProjectOverlapReview({ detail }: { detail: ProjectDetail }) {
  if (!detail.overlap) return null;
  const { matches, limited } = detail.overlap;
  return (
    <section className="project-editor-section">
      <h2>Đối chiếu tin từ nhà cung cấp khác</h2>
      <p className="p2-note">Đây là gợi ý kiểm duyệt. Tin khác giai đoạn hoặc hạng mục có thể được duyệt riêng sau khi xác minh phạm vi và quyền cung cấp.</p>
      <p>Gói đang xem: {detail.version.projectStage || 'Chưa khai giai đoạn'} · {detail.privateData.packageScope || 'Chưa khai phạm vi'}</p>
      {matches.length > 0 ? <ul>{matches.map(match => (
        <li key={match.versionId}>
          <strong>{labels[match.finding]}</strong>
          <p><a href={`/admin/projects/${match.projectId}?version=${match.versionId}`} target="_blank" rel="noopener noreferrer">
            {match.title} · v{match.versionNo} ↗
          </a></p>
          <p>{match.stage || 'Chưa khai giai đoạn'} · {match.scope || 'Chưa khai phạm vi'}</p>
          <p className="p2-note">{match.signals.join(' · ')}</p>
        </li>
      ))}</ul> : <p>Chưa thấy tin tương đồng trong phạm vi đối chiếu.</p>}
      {limited && <p className="p2-note">Đã giới hạn số tin đối chiếu hoặc hiển thị. Có thể kiểm tra thêm trong danh sách dự án.</p>}
    </section>
  );
}
