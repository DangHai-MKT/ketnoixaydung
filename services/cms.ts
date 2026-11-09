import 'server-only';
import {and, desc, eq, ilike, inArray, isNotNull, isNull, or, sql} from 'drizzle-orm';
import {db} from '../db/client';
import {auditLogs, users} from '../db/schema';
import {cmsCategories, cmsContents, cmsMedia, cmsRevisionMedia, cmsRevisions} from '../db/schema/cms';
import {AccessError, requireRoles, type Actor} from '../lib/auth/permissions';
import {cmsRoles, contentInput, field, mediaIds, slugInput, validatePublication, type CmsInput, type CmsKind} from '../lib/cms/content';
import {searchPattern} from '../lib/projects/query';

export const cmsEnabled = () => process.env.CMS_ENABLED === '1';
export function requireCms() {
  if (!cmsEnabled()) throw new AccessError(503, 'CMS chưa được bật trên môi trường này.');
}
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const publishedJoin = and(eq(cmsContents.id,cmsRevisions.contentId),eq(cmsContents.publishedRevision,cmsRevisions.revision),eq(cmsContents.isPolicy,false));
const snapshot = {id:cmsContents.id, kind:cmsContents.kind, slug:cmsContents.slug, content:cmsRevisions.snapshot,
  publishedAt:cmsRevisions.publishedAt, category:cmsCategories.name, categorySlug:cmsCategories.slug};

function boundedPage(page: number) {
  return Number.isSafeInteger(page) && page > 0 && page <= 10000 ? page : 1;
}

export async function listAdminContent(kind: CmsKind, q: string, state: string, page: number, category = '') {
  requireCms();
  const rows = await db.select({id:cmsContents.id,title:cmsContents.title,slug:cmsContents.slug,
    revision:cmsContents.revision,publishedRevision:cmsContents.publishedRevision,updatedAt:cmsContents.updatedAt,
    updatedBy:users.displayName,publishedAt:cmsRevisions.publishedAt, category:cmsCategories.name,
    imageId:cmsContents.featuredMediaId, hasHistory:sql<boolean>`exists(select 1 from ${cmsRevisions} where ${cmsRevisions.contentId}=${cmsContents.id})`})
    .from(cmsContents).innerJoin(users,eq(users.id,cmsContents.updatedBy))
    .leftJoin(cmsRevisions,and(eq(cmsContents.id,cmsRevisions.contentId),eq(cmsContents.publishedRevision,cmsRevisions.revision)))
    .leftJoin(cmsCategories,eq(cmsContents.categoryId,cmsCategories.id))
    .where(and(eq(cmsContents.kind,kind),q ? or(ilike(cmsContents.title,searchPattern(q)),ilike(cmsContents.slug,searchPattern(q))) : undefined,
      kind==='news'&&category?eq(cmsCategories.slug,category):undefined,
      state === 'published' ? isNotNull(cmsContents.publishedRevision) : state === 'draft' ? isNull(cmsContents.publishedRevision) : undefined))
    .orderBy(desc(cmsContents.updatedAt),desc(cmsContents.id)).limit(21).offset((boundedPage(page)-1)*20);
  return {rows:rows.slice(0,20), hasNext:rows.length>20};
}
export async function getAdminContent(kind: CmsKind, id: string) {
  requireCms();
  const [row] = await db.select().from(cmsContents).where(and(eq(cmsContents.kind,kind),eq(cmsContents.id,id)));
  return row ?? null;
}
export async function publicationHistory(id: string) {
  requireCms();
  return db.select({revision:cmsRevisions.revision,date:cmsRevisions.publishedAt,actor:users.displayName})
    .from(cmsRevisions).innerJoin(users,eq(users.id,cmsRevisions.publishedBy))
    .where(eq(cmsRevisions.contentId,id)).orderBy(desc(cmsRevisions.revision)).limit(10);
}
export async function getPublicationSnapshot(id: string, revision: number) {
  requireCms();
  const [row]=await db.select({content:cmsRevisions.snapshot,date:cmsRevisions.publishedAt})
    .from(cmsRevisions).where(and(eq(cmsRevisions.contentId,id),eq(cmsRevisions.revision,revision)));
  return row ?? null;
}
export async function listCategories() {
  if (!cmsEnabled()) return [];
  return db.select().from(cmsCategories).orderBy(cmsCategories.name).limit(100);
}
export async function listPublishedCategories() {
  if (!cmsEnabled()) return [];
  return db.selectDistinct({id:cmsCategories.id,name:cmsCategories.name,slug:cmsCategories.slug})
    .from(cmsContents).innerJoin(cmsRevisions,publishedJoin)
    .innerJoin(cmsCategories,eq(cmsRevisions.categoryId,cmsCategories.id))
    .where(eq(cmsContents.kind,'news')).orderBy(cmsCategories.name).limit(100);
}
async function withConflict<T>(work: () => Promise<T>) {
  try { return await work(); }
  catch (error) {
    let cause: unknown = error;
    for (let i=0; i<5 && cause && typeof cause==='object'; i++) {
      const detail = cause as {code?:string;cause?:unknown};
      if (detail.code==='23505') throw new AccessError(409, 'Slug đã tồn tại hoặc thao tác vừa được thực hiện.');
      cause = detail.cause;
    }
    throw error;
  }
}
export async function saveCategory(actor: Actor, raw: Record<string,unknown>) {
  requireCms();
  requireRoles(actor,cmsRoles);
  const slug=slugInput(raw.slug), name=field(raw.name,120,true);
  return withConflict(() => db.transaction(async tx => {
    await tx.execute(sql`lock table ${cmsCategories} in share row exclusive mode`);
    const [count] = await tx.select({n:sql<number>`count(*)::int`}).from(cmsCategories);
    if (count.n >= 100) throw new AccessError(409,'Đã đạt giới hạn 100 danh mục.');
    const [row] = await tx.insert(cmsCategories).values({slug,name}).returning({id:cmsCategories.id});
    await tx.insert(auditLogs).values({actorId:actor.id, action:'cms.category.create',entityType:'cms_category',entityId:row.id});
    return row;
  }));
}
export async function renameCategory(actor: Actor, id: string, name: string) {
  requireCms();
  requireRoles(actor,cmsRoles);
  return db.transaction(async tx=>{
    const [row]=await tx.update(cmsCategories).set({name}).where(eq(cmsCategories.id,id)).returning({id:cmsCategories.id});
    if(!row) throw new AccessError(404,'Không tìm thấy danh mục.');
    await tx.insert(auditLogs).values({actorId:actor.id,action:'cms.category.rename',entityType:'cms_category',entityId:id});
    return row;
  });
}
async function references(tx: Tx, input: CmsInput) {
  if (input.categoryId) {
    const [category] = await tx.select({id:cmsCategories.id}).from(cmsCategories).where(eq(cmsCategories.id,input.categoryId));
    if (!category) throw new AccessError(400, 'Danh mục tin không tồn tại.');
  }
  const ids=mediaIds(input);
  if (ids.length) {
    const rows=await tx.select({id:cmsMedia.id}).from(cmsMedia).where(inArray(cmsMedia.id,ids)).orderBy(cmsMedia.id).for('key share');
    if (rows.length!==ids.length) throw new AccessError(400, 'Có ảnh không tồn tại trong thư viện CMS.');
  }
  return ids;
}
async function getLocked(tx: Tx, kind: CmsKind, id: string, expected: number) {
  const [row]=await tx.select().from(cmsContents).where(and(eq(cmsContents.kind,kind),eq(cmsContents.id,id))).for('update');
  if (!row) throw new AccessError(404,'Không tìm thấy nội dung.');
  if (row.revision!==expected) throw new AccessError(409,'Nội dung đã thay đổi. Hãy tải bản mới để tránh ghi đè.');
  return row;
}
export async function saveContent(actor: Actor, kind: CmsKind, input: CmsInput, edit?: {id:string;revision:number}, publish=false) {
  requireCms();
  requireRoles(actor,publish?['super_admin']:cmsRoles);
  if (publish) validatePublication(input,kind);
  return withConflict(() => db.transaction(async tx => {
    const prior = edit ? await getLocked(tx,kind,edit.id,edit.revision) : null;
    if (prior && (prior.slug!==input.slug || prior.isPolicy!==input.isPolicy)) {
      const [published]=await tx.select({revision:cmsRevisions.revision}).from(cmsRevisions).where(eq(cmsRevisions.contentId,prior.id)).limit(1);
      if (published) throw new AccessError(409,'Giữ slug và loại trang sau lần xuất bản đầu tiên.');
    }
    if (prior?.isPolicy && !input.isPolicy) throw new AccessError(409,'Không chuyển bản nháp chính sách thành trang thường.');
    const ids=await references(tx,input);
    const values = {...input, updatedBy:actor.id, updatedAt:new Date()};
    const result = {id:cmsContents.id,revision:cmsContents.revision};
    const [row] = prior
      ? await tx.update(cmsContents).set({...values,revision:prior.revision+1}).where(eq(cmsContents.id,prior.id)).returning(result)
      : await tx.insert(cmsContents).values({...values,kind,createdBy:actor.id}).returning(result);
    await tx.insert(auditLogs).values({actorId:actor.id,action:'cms.draft.save',entityType:'cms_content',entityId:row.id,metadata:{revision:row.revision}});
    if (!publish) return row;
    const revision=row.revision+1;
    await publishSnapshot(tx,actor,row.id,revision,input,ids);
    return {id:row.id,revision};
  }));
}
async function publishSnapshot(tx:Tx,actor:Actor,id:string,revision:number,input:CmsInput,ids:string[]) {
  await tx.insert(cmsRevisions).values({contentId:id,revision,snapshot:input,categoryId:input.categoryId,publishedBy:actor.id});
  if (ids.length) await tx.insert(cmsRevisionMedia).values(ids.map(mediaId=>({contentId:id,revision,mediaId})));
  await tx.update(cmsContents).set({revision,publishedRevision:revision,updatedAt:new Date(),updatedBy:actor.id}).where(eq(cmsContents.id,id));
  await tx.insert(auditLogs).values({actorId:actor.id,action:'cms.publish',entityType:'cms_content',entityId:id,metadata:{revision}});
}
export async function setPublication(actor: Actor, kind: CmsKind, id: string, expected: number, publish: boolean) {
  requireCms();
  requireRoles(actor,['super_admin']);
  return db.transaction(async tx => {
    const row=await getLocked(tx,kind,id,expected);
    if (!publish && row.publishedRevision===null) return {revision:row.revision};
    const revision=row.revision+1;
    if (publish) {
      const input=contentInput(row,kind);
      validatePublication(input,kind);
      const ids=await references(tx,input);
      await publishSnapshot(tx,actor,id,revision,input,ids);
      return {revision};
    }
    await tx.update(cmsContents).set({revision,publishedRevision:null,updatedAt:new Date(),updatedBy:actor.id}).where(eq(cmsContents.id,id));
    await tx.insert(auditLogs).values({actorId:actor.id,action:'cms.unpublish',entityType:'cms_content',entityId:id,metadata:{revision}});
    return {revision};
  });
}
export async function getPublishedContent(kind: CmsKind, slug: string) {
  if (!cmsEnabled()) return null;
  const [row]=await db.select(snapshot).from(cmsContents).innerJoin(cmsRevisions,publishedJoin)
    .leftJoin(cmsCategories,eq(cmsRevisions.categoryId,cmsCategories.id))
    .where(and(eq(cmsContents.kind,kind),eq(cmsContents.slug,slug))).limit(1);
  return row ?? null;
}
export async function listPublishedNews(q='', category='', page=1, size=12, count=false) {
  if (!cmsEnabled()) return {rows:[],hasNext:false,total:0};
  const rows=await db.select({slug:cmsContents.slug,publishedAt:cmsRevisions.publishedAt,category:cmsCategories.name,
    title:sql<string>`${cmsRevisions.snapshot}->>'title'`, summary:sql<string>`${cmsRevisions.snapshot}->>'summary'`,
    imageId:sql<string|null>`${cmsRevisions.snapshot}->>'featuredMediaId'`,alt:sql<string>`${cmsRevisions.snapshot}->>'featuredAlt'`,
    total:count?sql<number>`count(*) over()::int`:sql<number>`0`})
    .from(cmsContents).innerJoin(cmsRevisions,publishedJoin).leftJoin(cmsCategories,eq(cmsRevisions.categoryId,cmsCategories.id))
    .where(and(eq(cmsContents.kind,'news'),category?eq(cmsCategories.slug,category):undefined,q?sql`(${cmsRevisions.snapshot}->>'title' ILIKE ${searchPattern(q)} OR ${cmsRevisions.snapshot}->>'summary' ILIKE ${searchPattern(q)})`:undefined))
    .orderBy(desc(cmsRevisions.publishedAt),desc(cmsContents.id)).limit(size+1).offset((boundedPage(page)-1)*size);
  return {rows:rows.slice(0,size).map(({total:_,...row})=>row),hasNext:rows.length>size,total:rows[0]?.total??0};
}
export async function listCmsSitemapEntries(limit: number) {
  if (!cmsEnabled() || limit<=0) return [];
  return db.select({kind:cmsContents.kind,slug:cmsContents.slug,publishedAt:cmsRevisions.publishedAt})
    .from(cmsContents).innerJoin(cmsRevisions,publishedJoin)
    .orderBy(desc(cmsRevisions.publishedAt),desc(cmsContents.id)).limit(limit);
}
