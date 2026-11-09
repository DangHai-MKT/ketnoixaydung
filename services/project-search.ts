import 'server-only';
import {and,asc,desc,eq,ilike,or,sql} from 'drizzle-orm';
import {db} from '../db/client';
import {projects,projectVersions,sellerProfiles} from '../db/schema';
import {requireActive,requireRoles,AccessError,type Actor} from '../lib/auth/permissions';
import {projectLabels} from '../lib/projects/workflow';
import {projectQuery,searchPattern} from '../lib/projects/query';
import {projectFieldFilters} from './project-filters';
export async function sellerProjectPage(actor:Actor,params:URLSearchParams){
 requireActive(actor);requireRoles(actor,['seller']);
 const [profile]=await db.select({status:sellerProfiles.verificationStatus}).from(sellerProfiles).where(eq(sellerProfiles.userId,actor.id));
 if(profile?.status!=='verified')throw new AccessError(403,'Bạn cần hoàn tất xác minh người bán.');
 const query=projectQuery(params,Object.keys(projectLabels));
 const join=and(eq(projectVersions.projectId,projects.id),sql`${projectVersions.versionNo}=COALESCE(${projects.workingVersion},${projects.currentVersion})`);
 const owner=eq(projects.sellerId,actor.id);
 const status=query.status as typeof projects.$inferSelect.status;
 const state=!status?undefined:['published','paused','archived'].includes(status)?eq(projects.status,status):and(sql`${projects.status}<>'archived'`,or(eq(projectVersions.submissionStatus,status),eq(projects.status,status)));
 const where=and(owner,state,projectFieldFilters(query),query.q?ilike(projectVersions.title,searchPattern(query.q)):undefined);
 const order=query.sort==='price_asc'?asc(projectVersions.pricePoints):query.sort==='price_desc'?desc(projectVersions.pricePoints):query.sort==='oldest'?asc(projects.createdAt):query.sort==='updated'?desc(projects.updatedAt):desc(projects.createdAt);
 const [rows,totals,counts]=await Promise.all([
  db.select({id:projects.id,title:sql<string>`COALESCE(${projectVersions.title},${projects.title})`,category:projectVersions.category,province:projectVersions.provinceCode,pricePoints:sql<string>`COALESCE(${projectVersions.pricePoints},${projects.pricePoints})::text`,status:projects.status,submissionStatus:projectVersions.submissionStatus,versionNo:projectVersions.versionNo,createdAt:projects.createdAt,updatedAt:projects.updatedAt,feedback:sql<string|null>`(SELECT reason FROM moderation_reviews WHERE project_id=${projects.id} ORDER BY created_at DESC,id DESC LIMIT 1)`}).from(projects).leftJoin(projectVersions,join).where(where).orderBy(order,desc(projects.id)).limit(query.pageSize).offset((query.page-1)*query.pageSize),
  db.select({total:sql<number>`count(*)::int`}).from(projects).leftJoin(projectVersions,join).where(where),
  db.select({total:sql<number>`count(*)::int`,draft:sql<number>`count(*) FILTER(WHERE ${projectVersions.submissionStatus}='draft' AND ${projects.status}<>'archived')::int`,pending:sql<number>`count(*) FILTER(WHERE ${projectVersions.submissionStatus}='pending_review' AND ${projects.status}<>'archived')::int`,published:sql<number>`count(*) FILTER(WHERE ${projects.status}='published')::int`,corrections:sql<number>`count(*) FILTER(WHERE ${projectVersions.submissionStatus} IN ('rejected','needs_correction') AND ${projects.status}<>'archived')::int`}).from(projects).leftJoin(projectVersions,join).where(owner)
 ]);
 return{data:rows,counts:counts[0],query,pagination:{page:query.page,pageSize:query.pageSize,total:totals[0].total,totalPages:Math.ceil(totals[0].total/query.pageSize)}};
}
