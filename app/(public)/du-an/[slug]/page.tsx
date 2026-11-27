import {projectPath,isPublicSlug} from '../../../../lib/site/public-paths';
import {notFound} from 'next/navigation';
import {cache} from 'react';
import {breadcrumbJson} from '../../../../lib/site/seo';
import {getPublicProjectBySlug,listPublicProjects} from '../../../../services/public-projects';
import PublicProjectDetail from '../../../../components/PublicProjectDetail';
import ProjectCard from '../../../../components/ProjectCard';
import PurchasePanel from '../../../../components/PurchasePanel';
import {projectSeo} from '../../../../lib/site/detail-seo';
export const dynamic='force-dynamic';
const getProject = cache(async (id: string) => {
  if(!isPublicSlug(id))return null;
  const project = await getPublicProjectBySlug(id);
  return project;
});

export async function generateMetadata({params}: {params: Promise<{slug: string}>}) {
  const project = await getProject((await params).slug);
  if(!project)notFound();
  return projectSeo(project).metadata;
}
export default async function ProjectPage({params}:{params:Promise<{slug:string}>}){
 const project=await getProject((await params).slug);
 if(!project)notFound();
 const id=project.id;
 const seo=projectSeo(project);
 const json=breadcrumbJson([{label:'Trang chủ',path:'/'},{label:'Dự án',path:'/projects'},{label:project.title,path:projectPath(project)}]);
 const related=(await listPublicProjects(new URLSearchParams({category:project.category,pageSize:'5'}))).data.filter(row=>row.id!==id).slice(0,4);
 return <main className="p2-market p2-public-detail">{seo.json&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:seo.json}}/>}{json&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:json}}/>}<nav className="p2-breadcrumb" aria-label="Đường dẫn"><a href="/">Trang chủ</a><span>/</span><a href="/projects">Dự án</a><span aria-current="page">/ Thông tin công khai</span></nav><PublicProjectDetail project={project} purchasePanel={<PurchasePanel project={project}/>}/>{related.length>0&&<section className="p2-related"><div className="p2-result-heading"><h2>Dự án cùng lĩnh vực</h2><a href={`/projects?category=${encodeURIComponent(project.category)}`}>Xem tất cả →</a></div><div className="p2-card-grid">{related.map(row=><ProjectCard key={row.id} project={row}/>)}</div></section>}</main>;
}
