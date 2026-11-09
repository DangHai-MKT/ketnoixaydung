import 'server-only';
import { and, asc, desc, eq, ilike, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { projectFiles, projects, projectVersions, sellerProfiles, users, userRoles } from '../db/schema';
import { publicProject } from '../lib/projects/contracts';
import {projectQuery,searchPattern} from '../lib/projects/query';
import { AccessError } from '../lib/auth/permissions';
import {safeProjectPublicContent} from './project-public-safety';
import {projectFieldFilters} from './project-filters';
import {provinceLabel} from '../lib/projects/locations';
const projection = {
  id: projects.id, slug: projects.slug, publishedAt: projects.publishedAt,
  versionId: projectVersions.id, versionNo: projectVersions.versionNo, title: projectVersions.title, category: projectVersions.category,
  provinceCode: projectVersions.provinceCode, districtName: projectVersions.districtName, projectStage: projectVersions.projectStage,
  sizeMinSqm: projectVersions.sizeMinSqm, sizeMaxSqm: projectVersions.sizeMaxSqm, publicSummary: projectVersions.publicSummary,
  publicData: projectVersions.publicData, pricePoints: projectVersions.pricePoints,
};
export function publishedConditions() {
  return and(eq(projects.status, 'published'), eq(projectVersions.versionNo, projects.currentVersion), sql`${projectVersions.approvedAt} IS NOT NULL`,
    safeProjectPublicContent(),
    eq(users.status, 'active'), eq(sellerProfiles.verificationStatus, 'verified'),
    sql`EXISTS (SELECT 1 FROM ${userRoles} WHERE ${userRoles.userId} = ${projects.sellerId} AND ${userRoles.role} = 'seller')`);
}
function queryPublic() {
  return db.select(projection).from(projects).innerJoin(projectVersions, eq(projectVersions.projectId, projects.id))
    .innerJoin(users, eq(users.id, projects.sellerId)).innerJoin(sellerProfiles, eq(sellerProfiles.userId, projects.sellerId));
}
function mapPublic(row: Awaited<ReturnType<typeof queryPublic>>[number]) {
  return publicProject(row, { ...row, id: row.versionId });
}
async function attachPublicFiles(rows: Awaited<ReturnType<typeof queryPublic>>) {
  if (!rows.length) return [];
  const files = await db.select({ id: projectFiles.id, projectVersionId: projectFiles.projectVersionId }).from(projectFiles)
    .where(and(inArray(projectFiles.projectVersionId, rows.map((row) => row.versionId)), eq(projectFiles.accessLevel, 'public_preview'), isNull(projectFiles.supersededAt)))
    .orderBy(asc(projectFiles.createdAt), asc(projectFiles.id));
  return rows.map((row) => {
    const publicFiles = files.filter((file) => file.projectVersionId === row.versionId).map((file, index) => ({ id: file.id, label: `Ảnh công khai ${index + 1}`, url: `/api/projects/${row.id}/files/${file.id}` }));
    return { ...mapPublic(row), imageUrl: publicFiles[0]?.url ?? null, files: publicFiles };
  });
}
export async function listPublicProjects(params: URLSearchParams) {
  const query = projectQuery(params); if(query.sort === 'updated') throw new AccessError(400,'Cách sắp xếp công khai không hợp lệ.');
  const page = params.has('page') ? Number(params.get('page')) : 1;
  const pageSize = params.has('pageSize') ? Number(params.get('pageSize')) : 12;
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 50) throw new AccessError(400, 'Phân trang không hợp lệ (tối đa 50 dự án mỗi trang).');
  const filters = [publishedConditions(),projectFieldFilters(query)];
  const keyword = params.get('q')?.trim();
  if (keyword && keyword.length > 100) throw new AccessError(400, 'Từ khóa tối đa 100 ký tự.');
  if (keyword) filters.push(sql`(${ilike(projectVersions.title, searchPattern(keyword))} OR ${ilike(projectVersions.publicSummary, searchPattern(keyword))})`);
  for (const [key, operator] of [['minPrice', '>='], ['maxPrice', '<=']] as const) {
    const value = params.get(key);
    if (!value) continue;
    if (!/^[0-9]{1,19}$/.test(value) || BigInt(value) > 9223372036854775807n) throw new AccessError(400, 'Khoảng giá phải là số điểm nguyên hợp lệ.');
    filters.push(operator === '>=' ? sql`${projectVersions.pricePoints} >= ${value}::bigint` : sql`${projectVersions.pricePoints} <= ${value}::bigint`);
  }
  if (params.get('minPrice') && params.get('maxPrice') && BigInt(params.get('minPrice')!) > BigInt(params.get('maxPrice')!)) throw new AccessError(400, 'Giá tối đa phải lớn hơn hoặc bằng tối thiểu.');
  const where = and(...filters);
  const [rows, count] = await Promise.all([
    queryPublic().where(where).orderBy(query.sort === 'price_asc' ? asc(projectVersions.pricePoints) : query.sort === 'price_desc' ? desc(projectVersions.pricePoints) : query.sort === 'oldest' ? asc(projects.publishedAt) : desc(projects.publishedAt), desc(projects.id)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(projects).innerJoin(projectVersions, eq(projectVersions.projectId, projects.id))
      .innerJoin(users, eq(users.id, projects.sellerId)).innerJoin(sellerProfiles, eq(sellerProfiles.userId, projects.sellerId)).where(where),
  ]);
  const total = count[0].total;
  return { data: await attachPublicFiles(rows), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}
export async function getPublicProject(id: string) {
  const rows = await queryPublic().where(and(publishedConditions(), eq(projects.id, id))).limit(1);
  return (await attachPublicFiles(rows))[0] ?? null;
}
export async function listLatestPublicProjects(limit: number) {
  const rows=await queryPublic().where(publishedConditions())
    .orderBy(desc(projects.publishedAt),desc(projects.id)).limit(limit);
  return attachPublicFiles(rows);
}

export async function listProjectSitemapEntries(limit: number) {
  return db.select({id: projects.id, approvedAt: projectVersions.approvedAt})
    .from(projects).innerJoin(projectVersions, eq(projectVersions.projectId, projects.id))
    .innerJoin(users, eq(users.id, projects.sellerId)).innerJoin(sellerProfiles, eq(sellerProfiles.userId, projects.sellerId))
    .where(publishedConditions()).orderBy(desc(projectVersions.approvedAt), desc(projects.id)).limit(limit);
}

// Only aggregate the same eligible, approved listings exposed by the public API.
export async function getPublicMarketplaceSummary() {
  const rows = await db.select({ category: projectVersions.category, province: projectVersions.provinceCode,
    count: sql<number>`count(*)::int`, sellers: sql<string[]>`array_agg(DISTINCT ${projects.sellerId})` })
    .from(projects).innerJoin(projectVersions, eq(projectVersions.projectId, projects.id))
    .innerJoin(users, eq(users.id, projects.sellerId)).innerJoin(sellerProfiles, eq(sellerProfiles.userId, projects.sellerId))
    .where(publishedConditions()).groupBy(projectVersions.category, projectVersions.provinceCode);
  const categories: Record<string, number> = Object.create(null), provinces: Record<string, number> = Object.create(null);
  const sellers = new Set<string>();
  let total = 0;
  for (const row of rows) {
    total += row.count;
    categories[row.category] = (categories[row.category] ?? 0) + row.count;
    if (row.province){const name=provinceLabel(row.province);provinces[name] = (provinces[name] ?? 0) + row.count;}
    for (const id of row.sellers) sellers.add(id);
  }
  // Seller identifiers never leave this server-only service.
  return { total, categories, provinces, sellers: sellers.size };
}


