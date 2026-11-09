import {FinanceMonitorList} from '../../../components/FinanceMonitor';
export default function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){return <FinanceMonitorList searchParams={searchParams}/>;}
