import {maskPublicContact} from './privacy';
// These allowlists are the ONLY public projection, also used by public preview.
export function publicProject(row: { id: string; slug: string; publishedAt: Date | string | null }, version: {
  id: string; versionNo: number; title: string; category: string; provinceCode: string | null; districtName: string | null; projectStage: string | null;
  sizeMinSqm: string | null; sizeMaxSqm: string | null; publicSummary: string; publicData: Record<string, unknown>; pricePoints: bigint | string;
}) {
  const clean=(value:string|null)=>value===null?null:maskPublicContact(value);
  return { id: row.id, slug: maskPublicContact(row.slug), publishedAt: row.publishedAt, versionId: version.id, versionNo: version.versionNo,
    title: maskPublicContact(version.title), category: maskPublicContact(version.category), provinceCode: clean(version.provinceCode), districtName: clean(version.districtName),
    projectStage: clean(version.projectStage), sizeMinSqm: version.sizeMinSqm, sizeMaxSqm: version.sizeMaxSqm,
    publicSummary: maskPublicContact(version.publicSummary), pricePoints: version.pricePoints.toString(),
    publicData: { constructionType: typeof version.publicData?.constructionType === 'string' ? maskPublicContact(version.publicData.constructionType) : '',
      technicalSummary: typeof version.publicData?.technicalSummary === 'string' ? maskPublicContact(version.publicData.technicalSummary) : '',
      scopeSummary: typeof version.publicData?.scopeSummary === 'string' ? maskPublicContact(version.publicData.scopeSummary) : '' }, sellerLabel: 'Nhà cung cấp đã xác minh' };
}
export type PublicProject = ReturnType<typeof publicProject> & { imageUrl?: string | null; files?: { id: string; url: string; label: string }[] };
