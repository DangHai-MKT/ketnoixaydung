import {caseMode,caseReadRoles,type CaseMode} from './disputes';
import {requireApiActor} from '../auth/server';
import {AccessError} from '../auth/permissions';
export function disputeRequest(request:Request,extra:string[]=[]){const p=new URL(request.url).searchParams;if(p.getAll('workspace').length!==1||[...p.keys()].some(k=>!['workspace',...extra].includes(k)))throw new AccessError(400,'Không gian hồ sơ hoặc bộ lọc không hợp lệ.');const mode=caseMode(p.get('workspace'));p.delete('workspace');return {mode,params:p};}
export function disputeActor(request:Request,mode:CaseMode){return requireApiActor(request,mode==='admin'?caseReadRoles:[mode]);}
