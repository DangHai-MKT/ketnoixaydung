import CmsPublicPage,{cmsPublicMetadata} from '../../../../components/CmsPublicPage';
export const dynamic='force-dynamic';
type Props={params:Promise<{slug:string}>};
export async function generateMetadata({params}:Props) {return cmsPublicMetadata('news',(await params).slug);}
export default async function Page({params}:Props) {return <CmsPublicPage kind="news" slug={(await params).slug}/>;}
