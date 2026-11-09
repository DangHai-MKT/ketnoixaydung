import {requirePageActor} from '../../../lib/auth/server';
import {getWatchDashboard,projectWatchEnabled} from '../../../services/project-watch';
import ProjectWatchManager from '../../../components/ProjectWatchManager';
import {categoryLabels} from '../../../lib/projects/workflow';
import {watchPath} from '../../../lib/projects/watch';

export default async function Page({searchParams}:{searchParams:Promise<{category?:string}>}) {
  const actor=await requirePageActor(watchPath,['buyer']);
  if(!projectWatchEnabled())return <main className="identity-page"><h1>Theo dõi dự án</h1><p>Tính năng chưa được mở trên môi trường này.</p><a href="/projects">Khám phá dự án →</a></main>;
  const {category}=await searchParams;
  const selected=typeof category==='string'&&Object.hasOwn(categoryLabels,category)?category:'industrial';
  return <ProjectWatchManager initial={await getWatchDashboard(actor)} initialCategory={selected}/>;
}
