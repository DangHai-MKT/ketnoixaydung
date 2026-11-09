import {WorkspaceNotifications} from '../../../components/WorkspaceAccountPages';
export default function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  return <WorkspaceNotifications mode="buyer" searchParams={searchParams}/>;
}
