import PublicProjectDetail from './PublicProjectDetail';
import type { PublicProject } from '../lib/projects/contracts';
// Receives only the public DTO, never a seller/moderator response object.
export default function ProjectPublicPreview({ project }: { project: PublicProject }) { return <PublicProjectDetail project={project} preview />; }
