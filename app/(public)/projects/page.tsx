
import { Suspense } from 'react';
import ProjectsExplorer from '../../../components/ProjectsExplorer';
import {privateRobots, publicMetadata} from '../../../lib/site/seo';
import {projectWatchEnabled} from '../../../services/project-watch';
import './project-filters.css';

export async function generateMetadata({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const metadata = publicMetadata('/projects', 'Tìm dự án xây dựng', 'Tìm kiếm thông tin dự án xây dựng theo danh mục, địa điểm và giai đoạn.');
  return Object.keys(await searchParams).length ? {...metadata, robots: privateRobots} : metadata;
}

export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <main className="projects-page">
          <section className="projects-results section-wrap">
            <p role="status">Đang chuẩn bị danh sách dự án...</p>
          </section>
        </main>
      }
    >
      <ProjectsExplorer showProjectWatch={projectWatchEnabled()} />
    </Suspense>
  );
}
