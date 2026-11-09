import {FinanceMonitorDetail} from '../../../../components/FinanceMonitor';
export default function Page({params}:{params:Promise<{id:string}>}){return <FinanceMonitorDetail params={params}/>;}
