import 'server-only';
import { and, desc, eq, exists, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { projectFiles, projectPrivateData, projectVersions, projects } from '../db/schema';
import { compareListingEvidence, type ListingEvidence } from '../lib/projects/overlap';
import { provinceAliases } from '../lib/projects/locations';
import type { SellerTx } from './seller-context';

const scanLimit = 200;
const resultLimit = 12;
const activeSaleFiles = and(eq(projectFiles.accessLevel, 'purchased_only'), isNull(projectFiles.supersededAt));

export async function findProjectOverlap(
  query: typeof db | SellerTx,
  version: typeof projectVersions.$inferSelect,
  sellerId: string,
  privateData: Record<string, unknown>,
) {
  const ownFiles = await query.select({ hash: projectFiles.checksumSha256 }).from(projectFiles)
    .where(and(eq(projectFiles.projectVersionId, version.id), activeSaleFiles));
  const checksums = ownFiles.flatMap(file => file.hash ? [file.hash] : []);
  const reference = typeof privateData.projectReference === 'string' ? privateData.projectReference.trim() : '';
  const sharedFile = checksums.length ? exists(query.select({ id: projectFiles.id }).from(projectFiles)
    .where(and(eq(projectFiles.projectVersionId, projectVersions.id), activeSaleFiles, inArray(projectFiles.checksumSha256, checksums)))) : undefined;
  const sameReference = reference
    ? sql<boolean>`lower(trim(${projectPrivateData.privateData}->>'projectReference')) = lower(${reference})` : undefined;
  const sameProvince = version.provinceCode
    ? inArray(sql<string>`lower(trim(${projectVersions.provinceCode}))`, provinceAliases(version.provinceCode).map(alias => alias.toLowerCase())) : undefined;
  if (!sharedFile && !sameReference && !sameProvince) return { matches: [], limited: false };

  const rows = await query.select({
    projectId: projects.id, versionId: projectVersions.id, versionNo: projectVersions.versionNo,
    title: projectVersions.title, provinceCode: projectVersions.provinceCode, districtName: projectVersions.districtName,
    projectStage: projectVersions.projectStage, publicSummary: projectVersions.publicSummary,
    privateData: projectPrivateData.privateData,
  }).from(projectVersions)
    .innerJoin(projects, eq(projectVersions.projectId, projects.id))
    .leftJoin(projectPrivateData, eq(projectPrivateData.projectVersionId, projectVersions.id))
    .where(and(ne(projects.id, version.projectId), ne(projects.sellerId, sellerId), ne(projects.status, 'archived'), or(
      and(eq(projectVersions.versionNo, projects.currentVersion), inArray(projects.status, ['published', 'paused'])),
      and(eq(projectVersions.versionNo, projects.workingVersion), eq(projectVersions.submissionStatus, 'pending_review')),
    ), or(sameReference, sharedFile, sameProvince)))
    .orderBy(desc(sql`CASE WHEN ${or(sameReference, sharedFile) ?? sql`false`} THEN 1 ELSE 0 END`),
      desc(projects.updatedAt), desc(projectVersions.id)).limit(scanLimit + 1);

  const candidates = rows.slice(0, scanLimit);
  const candidateFiles = checksums.length && candidates.length ? await query.select({
    versionId: projectFiles.projectVersionId, hash: projectFiles.checksumSha256,
  }).from(projectFiles).where(and(activeSaleFiles, inArray(projectFiles.projectVersionId, candidates.map(row => row.versionId)))) : [];
  const hashesByVersion = new Map<string, string[]>();
  for (const file of candidateFiles) {
    if (file.hash) hashesByVersion.set(file.versionId, [...(hashesByVersion.get(file.versionId) ?? []), file.hash]);
  }
  const source: ListingEvidence = { ...version, privateData, checksums };
  const matches = candidates.flatMap(row => {
    const overlap = compareListingEvidence(source, { ...row, privateData: row.privateData ?? {}, checksums: hashesByVersion.get(row.versionId) ?? [] });
    return overlap ? [{ ...overlap, projectId: row.projectId, versionId: row.versionId, versionNo: row.versionNo,
      title: row.title, stage: row.projectStage, scope: typeof row.privateData?.packageScope === 'string' ? row.privateData.packageScope : '' }] : [];
  });
  const priority = { likely_duplicate: 0, review_scope: 1, related_package: 2 };
  matches.sort((a, b) => priority[a.finding] - priority[b.finding]);
  return { matches: matches.slice(0, resultLimit), limited: rows.length > scanLimit || matches.length > resultLimit };
}
