import SellerEarnings from '../../../components/SellerEarnings';
export default function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){return <SellerEarnings searchParams={searchParams} sales/>;}
