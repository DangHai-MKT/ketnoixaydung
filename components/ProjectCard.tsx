import type { PublicProject } from '../lib/projects/contracts';
import { categoryLabels, formatPoints } from '../lib/projects/workflow';
import { projectThumbnailUrl } from '../lib/projects/thumbnail';
export default function ProjectCard({ project, priority = false }: { project: PublicProject; priority?: boolean }) {
  return <article className="market-project-card"><a className="market-project-image" href={`/projects/${project.id}`} aria-label={`Xem ${project.title}`}>
    {project.imageUrl ? <img src={projectThumbnailUrl(project.imageUrl, 'card')}
      srcSet={`${projectThumbnailUrl(project.imageUrl, 'card')} 1x, ${projectThumbnailUrl(project.imageUrl, 'large')} 2x`}
      alt={project.title} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined} decoding="async" /> : <span className={`project-image-placeholder project-photo-placeholder project-photo-${Object.hasOwn(categoryLabels, project.category) ? project.category : 'other'}`} aria-hidden="true"><small>Ảnh minh họa</small></span>}
    <span className="market-image-badge">Đã kiểm duyệt</span></a>
    <div className="market-project-body"><span className="market-category">{Object.hasOwn(categoryLabels, project.category) ? categoryLabels[project.category] : project.category}</span>
      <h3><a href={`/projects/${project.id}`}>{project.title}</a></h3><p className="market-location">⌖ {[project.districtName, project.provinceCode].filter(Boolean).join(', ') || 'Đang cập nhật địa điểm'}</p>
      <p className="market-summary">{project.publicSummary}</p><div className="market-card-price"><strong>{formatPoints(project.pricePoints)} POINT</strong><span>{project.projectStage || 'Chưa cập nhật giai đoạn'}</span></div>
      <p className="market-updated">{project.publishedAt ? `Công bố: ${new Date(String(project.publishedAt)).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}` : 'Thông tin công khai'}</p></div>
  </article>;
}
