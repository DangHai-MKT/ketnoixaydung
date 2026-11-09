import {ownerProjectApi,privateJson,readJson} from '../../../../../../../lib/projects/http';
import {uuidInput,versionCommand} from '../../../../../../../lib/projects/validation';
import {removeProjectFile} from '../../../../../../../services/project-files';
export async function DELETE(request:Request,{params}:{params:Promise<{id:string;fileId:string}>}){return ownerProjectApi(request,async actor=>{const {id,fileId}=await params;const input=versionCommand(await readJson(request));return privateJson(await removeProjectFile(actor,uuidInput(id),uuidInput(fileId),input.versionId,input.revision));});}
