import {maskPublicContact} from './privacy';
import {publicProjectDataKeys} from './facts';
// These allowlists are the ONLY public projection, also used by public preview.
export function publicProject(row: { id: string; slug: string; publishedAt: Date | string | null }, version: {
  id: string; versionNo: number; title: string; category: string; provinceCode: string | null; districtName: string | null; projectStage: string | null;
  sizeMinSqm: string | null; sizeMaxSqm: string | null; publicSummary: string; publicData: Record<string, unknown>; pricePoints: bigint | string;
}) {
  const clean=(value:string|null)=>value===null?null:maskPublicContact(value);
  const publicData=Object.fromEntries(publicProjectDataKeys.map(key=>{
    const value=version.publicData?.[key];
    return [key,typeof value==='string'?maskPublicContact(value):''];
  })) as Record<typeof publicProjectDataKeys[number],string>;
  return { id: row.id, slug: maskPublicContact(row.slug), publishedAt: row.publishedAt, versionId: version.id, versionNo: version.versionNo,
    title: maskPublicContact(version.title), category: maskPublicContact(version.category), provinceCode: clean(version.provinceCode), districtName: clean(version.districtName),
    projectStage: clean(version.projectStage), sizeMinSqm: version.sizeMinSqm, sizeMaxSqm: version.sizeMaxSqm,
    publicSummary: maskPublicContact(version.publicSummary), pricePoints: version.pricePoints.toString(),
    publicData, sellerLabel: 'Nhà cung cấp đã xác minh' };
}
export type PublicProject = ReturnType<typeof publicProject> & {
  purchased?: boolean;
  imageUrl?: string | null;
  files?: { id: string; url: string; label: string }[];
  packageContents?: { organizations: boolean; contacts: boolean; exactLocation: boolean; notes: boolean; documents: number };
};
