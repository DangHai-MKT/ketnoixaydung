import {protectedParticipantKeys,readProjectParticipants} from './participants';
import {publicProjectDataKeys} from './facts';

// Identical source is used by JavaScript checks and PostgreSQL public visibility.
// Avoid regex lookarounds so PostgreSQL and JavaScript interpret it consistently.
export const contactPattern='[A-Z0-9._%+-]+@[A-Z0-9.-]+[.][A-Z]{2,}|(^|[^0-9])((0[35789])([ .()-]*[0-9]){8}|(0[2])([ .()-]*[0-9]){9}|([+]84|0084)[ .()-]*[235789]([ .()-]*[0-9]){8,9})([^0-9]|$)';
export const sensitiveProjectKeys=['investorName','projectReference','contactPerson','contactPhone','contactEmail','exactLocation','procurementNotes','technicalNotes'] as const;
type PublicContent={title:string;category?:string;provinceCode?:string|null;districtName?:string|null;projectStage?:string|null;publicSummary:string;publicData:Record<string,unknown>};
export function publicContentText(v:PublicContent){return [v.title,v.category,v.provinceCode,v.districtName,v.projectStage,v.publicSummary,...publicProjectDataKeys.map(key=>v.publicData?.[key])].filter(x=>typeof x==='string').join('\n');}
export function projectPrivacyIssues(v:PublicContent,privateData:Record<string,unknown>={}){
 const text=publicContentText(v),issues:string[]=[];
 if(new RegExp(contactPattern,'i').test(text))issues.push('Phần công khai có số điện thoại hoặc email. Chuyển thông tin liên hệ sang phần được bảo vệ.');
 const protectedValues = [...sensitiveProjectKeys.map(key=>privateData[key]),
  ...readProjectParticipants(privateData.participants).flatMap(row=>protectedParticipantKeys.map(key=>row[key]))];
 if(protectedValues.some(value=>typeof value==='string'&&value.trim().length>=8&&text.toLocaleLowerCase('vi-VN').includes(value.trim().toLocaleLowerCase('vi-VN')))){
  issues.push('Có dữ liệu từ phần được bảo vệ xuất hiện trong nội dung công khai. Kiểm tra và tách lại hai phần.');
 }
 return issues;
}
export function maskPublicContact(value:string){
 let text=value;for(let i=0;i<1000&&new RegExp(contactPattern,'i').test(text);i++)text=text.replace(new RegExp(contactPattern,'gi'),(...args:unknown[])=>(typeof args[1]==='string'?args[1]:'')+'[Thông tin liên hệ được bảo vệ]'+(typeof args.at(-3)==='string'?args.at(-3):''));return text;
}

