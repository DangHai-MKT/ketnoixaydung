import type { PublicProject } from './contracts';
import type { OverlapFinding } from './overlap';
import type { ProjectParticipant } from './participants';
export type ProjectDetail = {
  project: { id: string; sellerId: string; slug: string; status: string; currentVersion: number; workingVersion: number | null; revision: number; publishedAt: string | null };
  sellerInfo: { id: string; displayName: string; email: string; verificationStatus: string | null } | null;
  version: { id: string; versionNo: number; title: string; category: string; provinceCode: string | null; districtName: string | null; projectStage: string | null;
    sizeMinSqm: string | null; sizeMaxSqm: string | null; publicSummary: string; publicData: Record<string, unknown>; pricePoints: string;
    submissionStatus: string | null; submittedAt: string | null; approvedAt: string | null };
  privateData: Record<string, string>; rightsConfirmed: boolean; rightsDeclaration: string;
  participants: ProjectParticipant[];
  versions: { id: string; versionNo: number; status: string; approvedAt: string | null }[];
  files: { id: string; originalFilename: string; accessLevel: string; url: string; sizeBytes: string }[];
  reviews: { id: string; projectVersionId: string; decision: string; reason: string | null; createdAt: string; automatedChecks: { errors?: string[]; passed?: boolean } }[];
  preview: PublicProject; currentPreview: PublicProject | null; currentVersionId: string | null;
  overlapWarning: boolean;
  overlap: { limited: boolean; matches: {
    projectId: string; versionId: string; versionNo: number; title: string;
    stage: string | null; scope: string; finding: OverlapFinding; signals: string[];
  }[] } | null;
};
