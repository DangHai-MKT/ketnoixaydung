import FinanceDashboard from '../../../components/FinanceDashboard';
export default function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){return <FinanceDashboard searchParams={searchParams}/>;}
