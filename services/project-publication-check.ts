import 'server-only';
import {eq} from 'drizzle-orm';
import {projectPrivateData} from '../db/schema';
import {AccessError} from '../lib/auth/permissions';
import {autoCheck,projectInput} from '../lib/projects/validation';
import {verifiedProjectFile} from '../lib/projects/storage';
import {activeProjectFiles,versionContent,type VersionRow} from './project-context';
import type {SellerTx} from './seller-context';
import {projectPrivacyIssues} from '../lib/projects/privacy';
export async function checkProjectPublication(tx:SellerTx,version:VersionRow,restoring=false){
 const [data]=await tx.select().from(projectPrivateData).where(eq(projectPrivateData.projectVersionId,version.id));
 const files=await activeProjectFiles(tx,version.id);
 // Restoring an existing approval must not reprice it using today's draft cap.
 const issues=restoring?projectPrivacyIssues(version,data?.privateData??{}):autoCheck(projectInput({...versionContent(version),pricePoints:version.pricePoints.toString(),privateData:data?.privateData??{},rightsConfirmed:!!data?.dataRightsConfirmedAt,rightsDeclaration:data?.dataRightsDeclaration??''}),files);
 if(issues.length)throw new AccessError(409,issues.join(' '));
 for(const file of files)await verifiedProjectFile(file);
}
