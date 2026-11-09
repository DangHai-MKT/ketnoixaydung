import type { ApplicationInput } from './validation';
import type { ApplicationState } from './workflow';

export type ApplicationView = {
  profile: ApplicationInput & { id: string; userId: string; revision: number; verificationStatus: string;
    verificationSubmittedAt: string | null; reviewedAt: string | null; reviewReason: string | null; correctionRequestedAt: string | null };
  state: ApplicationState;
  missing: string[];
  documents: { id: string; documentType: string; originalFilename: string; sizeBytes: string; status: string }[];
  archivedDocuments: { id: string; documentType: string; originalFilename: string; sizeBytes: string; status: string }[];
  history: { id: string; action: string; createdAt: string; metadata: Record<string, unknown> }[];
  notifications: { id: string; title: string; body: string; createdAt: string }[];
};
