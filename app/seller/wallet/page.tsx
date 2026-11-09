import {WorkspaceWallet} from '../../../components/WorkspaceAccountPages';
import {requireVerifiedSeller} from '../../../lib/seller/server';
export default async function Page(){await requireVerifiedSeller();return <WorkspaceWallet mode="seller"/>;}
