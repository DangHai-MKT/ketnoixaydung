import CmsPublicPage,{cmsPublicMetadata} from '../../../../components/CmsPublicPage';
export const dynamic='force-dynamic';
type Props={params:Promise<{slug:string}>};
export async function generateMetadata({params}:Props) {return cmsPublicMetadata('page',(await params).slug);}
export default async function Page({params}:Props) {return <CmsPublicPage kind="page" slug={(await params).slug}/>;}
