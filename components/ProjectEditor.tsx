'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import type {ProjectDetail} from '../lib/projects/types';
import {categoryLabels,privateLabels,projectLabels,formatPoints} from '../lib/projects/workflow';
import ProjectParticipantCards from './ProjectParticipantCards';
import ProjectParticipantEditor from './ProjectParticipantEditor';
import type {ProjectParticipant} from '../lib/projects/participants';
import ProjectPublicPreview from './ProjectPublicPreview';
import ProjectFileUpload,{accessLabels} from './ProjectFileUpload';
import ProjectEditorSteps from './ProjectEditorSteps';
import ProjectVersionHistory from './ProjectVersionHistory';
import ProjectStatusBadge from './ProjectStatusBadge';
import {projectPrivacyIssues} from '../lib/projects/privacy';
import ConfirmActionDialog from './ConfirmActionDialog';
import ProjectPriceSuggestion from './ProjectPriceSuggestion';
import {constructionOptions,fillEmptyProjectFields,provinceOptions,quickPrices,quickProjectTemplate,suggestedProjectPrice,rightsOptions,stageOptions,templateIssues} from '../lib/projects/quick-create';
import { provinceLabel } from '../lib/projects/locations';
import { emptyProjectFacts, formatInvestmentInput, parseInvestmentInput, projectFactFields, publicProjectDataKeys } from '../lib/projects/facts';
// Snapshot of the 2025 register from https://provinces.open-api.vn/api/v2/?depth=2.
import vietnamWards from '../lib/projects/vietnam-wards.json';
const wardsByProvince: Readonly<Record<string, readonly string[]>> = vietnamWards;
const empty={title:'',category:'industrial',provinceCode:'',districtName:'',projectStage:'',sizeMinSqm:'',sizeMaxSqm:'',publicSummary:'',constructionType:'',technicalSummary:'',scopeSummary:'',pricePoints:suggestedProjectPrice,rightsDeclaration:'',...emptyProjectFacts};
const publicKeys = new Set<string>(publicProjectDataKeys);
type Command={name:string;title:string;description:string;fileId?:string;href?:string};
export default function ProjectEditor({id,mode='edit',versionId,initialStep=1}:{id?:string;mode?:'edit'|'status';versionId?:string;initialStep?:number}){
 const router=useRouter(),creationKey=useRef('');
 const [detail,setDetail]=useState<ProjectDetail|null>(null),[fields,setFields]=useState(empty),[privateData,setPrivateData]=useState<Record<string,string>>({}),[rights,setRights]=useState(false);
 const [participants,setParticipants]=useState<ProjectParticipant[]>([]);
 const [step,setStep]=useState(initialStep),[loading,setLoading]=useState(Boolean(id)),[pending,setPending]=useState(false),[fileBusy,setFileBusy]=useState(false),[dirty,setDirty]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[preview,setPreview]=useState(false),[command,setCommand]=useState<Command|null>(null);
 const load=useCallback(async(signal?:AbortSignal)=>{
  if(!id)return;
  const response=await fetch(`/api/seller/projects/${id}${versionId?`?version=${encodeURIComponent(versionId)}`:''}`,{cache:'no-store',signal});const body=await response.json();if(!response.ok)throw new Error(body.error||'Không thể tải dự án.');
  const value=body as ProjectDetail,next={...empty};
  for(const key of Object.keys(next) as (keyof typeof empty)[]){const scalar=key in value.version?(value.version as unknown as Record<string,unknown>)[key]:value.version.publicData[key];next[key]=key==='rightsDeclaration'?value.rightsDeclaration:typeof scalar==='string'?scalar:'';}
  setDetail(value);setFields(next);setPrivateData(value.privateData);setParticipants(value.participants);setRights(value.rightsConfirmed);setDirty(false);
 },[id,versionId]);
 useEffect(()=>{const controller=new AbortController();load(controller.signal).catch(cause=>{if(!controller.signal.aborted)setError(cause.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[load]);
 useEffect(()=>{
  if(!dirty&&!fileBusy&&!pending)return;
  const before=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
  const click=(event:MouseEvent)=>{if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey)return;const anchor=(event.target as Element).closest?.('a[href]') as HTMLAnchorElement|null;if(!anchor||anchor.target==='_blank'||anchor.hasAttribute('download')||anchor.origin!==window.location.origin||anchor.href===window.location.href||anchor.getAttribute('href')?.startsWith('#'))return;event.preventDefault();setCommand({name:'leave',title:'Rời trang khi chưa lưu?',description:'Các thay đổi chưa lưu sẽ không được giữ lại.',href:anchor.href});};
  window.addEventListener('beforeunload',before);document.addEventListener('click',click,true);return()=>{window.removeEventListener('beforeunload',before);document.removeEventListener('click',click,true);};
 },[dirty,fileBusy,pending]);
 const canEdit=!versionId&&(!detail||(detail.project.status!=='archived'&&detail.version.submissionStatus==='draft'&&!detail.version.submittedAt&&!detail.version.approvedAt));
 const editing=mode==='edit'&&canEdit,disabled=pending||fileBusy;
 function updateFields(values:Partial<typeof empty>){setFields(current=>({...current,...values}));setDirty(true);}
 const {category,provinceCode,projectStage,constructionType,sizeMinSqm,sizeMaxSqm}=fields;
 const priceContext={category,provinceCode,projectStage,constructionType,sizeMinSqm,sizeMaxSqm};
 const choices:Partial<Record<keyof typeof empty,string[]>>={projectStage:stageOptions,constructionType:constructionOptions[category]};
 const currentProvince = provinceLabel(provinceCode);
 const wardOptions = Object.hasOwn(wardsByProvince, currentProvince) ? wardsByProvince[currentProvince] : [];
 const publicData=Object.fromEntries(publicProjectDataKeys.map(key=>[key,key==='investmentAmount'?fields[key].replace(/\.$/,''):fields[key]]));
 const privacyIssues=projectPrivacyIssues({...fields,publicData},{...privateData,participants});
 const issues=[...privacyIssues,...templateIssues([fields.title,fields.publicSummary,fields.constructionType,fields.technicalSummary,fields.scopeSummary]),...(fields.title.trim().length<5?['Tên dự án cần tối thiểu 5 ký tự.']:[]),...(!fields.provinceCode?['Bổ sung tỉnh/thành.']:[]),...(!fields.projectStage?['Bổ sung giai đoạn.']:[]),...(!participants.length&&!Object.entries(privateData).some(([key,value])=>key!=='projectReference'&&key!=='packageScope'&&value.trim())?['Bổ sung thông tin bảo vệ có giá trị.']:[]),...(!rights||!fields.rightsDeclaration.trim()?['Xác nhận và khai báo quyền cung cấp thông tin.']:[]),...(!/^[1-9][0-9]{0,18}$/.test(fields.pricePoints)||BigInt(fields.pricePoints||'0')>9223372036854775807n?['Giá POINT phải là số nguyên dương hợp lệ.']:[])];
 async function save(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(disabled)return;const advance=((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null)?.value==='continue';if(!id&&!fields.title.trim()){setStep(1);setError('Nhập tên dự án trước khi lưu bản nháp.');return;}const nextStep=Math.min(5,step+1);if(id&&advance&&!dirty){setStep(nextStep);return;}
  if(detail && detail.version.versionNo > 1 && !rights){
   setStep(3);setError('Hãy xác nhận quyền cung cấp thông tin và tài liệu trước khi lưu bản sửa.');return;
  }
  setPending(true);setError('');setNotice('');
  if(!creationKey.current)creationKey.current=crypto.randomUUID();
  const scalars=Object.fromEntries(Object.entries(fields).filter(([key])=>!publicKeys.has(key)));
  try{const response=await fetch(id?`/api/seller/projects/${id}`:'/api/seller/projects',{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...scalars,publicData,privateData:{...privateData,participants},rightsConfirmed:rights,...(id?{revision:detail?.project.revision,versionId:detail?.version.id}:{requestId:creationKey.current})})});const body=await response.json();if(!response.ok)throw new Error(body.error||'Không thể lưu.');setDirty(false);if(!id){router.replace(`/seller/projects/${body.id}/edit?step=${advance?nextStep:2}`);return;}await load();if(advance)setStep(nextStep);setNotice('Đã lưu bản nháp.');}catch(cause){setError(cause instanceof Error?cause.message:'Không thể kết nối.');}finally{setPending(false);}
 }
 async function execute(){
  if(!command||disabled)return;if(command.name==='leave'){setDirty(false);setCommand(null);router.push(command.href!);return;}if(!detail)return;
  setPending(true);setError('');setNotice('');
  try{const response=await fetch(command.fileId?`/api/seller/projects/${id}/files/${command.fileId}`:`/api/seller/projects/${id}/${command.name}`,{method:command.fileId?'DELETE':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:detail.project.revision,versionId:command.name==='republish'?detail.currentVersionId:detail.version.id})});const body=await response.json();if(!response.ok)throw new Error(body.error||'Không thể thực hiện thao tác.');await load();setNotice(body.errors?.length?body.errors.join(' '):'Đã cập nhật dự án và lưu lịch sử.');if(command.name==='revision')router.push(`/seller/projects/${id}/edit`);}catch(cause){setError(cause instanceof Error?cause.message:'Không thể kết nối.');}finally{setPending(false);setCommand(null);}
 }
 function field(key:keyof typeof empty,label:string,rows?:number){
  if (key === 'provinceCode') return <label key={key}>{label}
   <select value={provinceCode} onChange={event=>updateFields({provinceCode:event.target.value,districtName:''})}>
    <option value="">Chọn tỉnh / thành</option>
    {provinceCode && !provinceOptions.includes(provinceCode) && <option value={provinceCode}>{provinceLabel(provinceCode)} (đã lưu)</option>}
    {provinceOptions.map(name=><option key={name} value={name}>{name}</option>)}
   </select>
  </label>;
  if (key === 'districtName') return <label key={key}>{label}
   <select value={fields.districtName} disabled={!wardOptions.length && !fields.districtName}
    onChange={event=>updateFields({districtName:event.target.value})}>
    <option value="">{wardOptions.length ? 'Chọn phường / xã / đặc khu (nếu biết)' : 'Chọn tỉnh / thành hiện hành trước'}</option>
    {fields.districtName && !wardOptions.includes(fields.districtName) && <option value={fields.districtName}>{fields.districtName} (đã lưu)</option>}
    {wardOptions.map(name=><option key={name} value={name}>{name}</option>)}
   </select>
  </label>;
  return <label key={key}>{label}{rows?<textarea value={fields[key]} rows={rows} maxLength={key==='publicSummary'?5000:key==='technicalSummary'?3000:key==='scopeSummary'?240:1000} onChange={event=>{setFields({...fields,[key]:event.target.value});setDirty(true);}}/>:<input list={choices[key]?`project-options-${key}`:undefined} value={fields[key]} required={key==='title'} inputMode={key==='pricePoints'?'numeric':key.startsWith('size')?'decimal':undefined} maxLength={key==='title'?300:key==='pricePoints'?19:key==='projectStage'?80:120} onChange={event=>{setFields({...fields,[key]:event.target.value});setDirty(true);}}/>}{choices[key]&&<datalist id={`project-options-${key}`}>{choices[key]?.map(value=><option key={value} value={value}/>)}</datalist>}</label>;
 }
 function factField(key: keyof typeof projectFactFields, label?: string) {
  const definition = projectFactFields[key];
  if (key === 'investmentAmount') return <label key={key}>{label ?? definition.label}
   <input value={formatInvestmentInput(fields[key])} inputMode="decimal" placeholder="VD: 16.000.000" onChange={event=>{
    const value=parseInvestmentInput(event.target.value);
    if(value!==null)updateFields({investmentAmount:value});
   }}/>
   <small>Dấu chấm phân cách hàng nghìn. Dùng dấu phẩy nếu có phần thập phân.</small>
  </label>;
  return <label key={key}>{label ?? definition.label}
   {'options' in definition ? <select value={fields[key]} onChange={event=>updateFields({[key]:event.target.value})}>
    <option value="">Chưa có thông tin</option>
    {Object.entries(definition.options).map(([value,label])=><option key={value} value={value}>{label}</option>)}
   </select> : <input value={fields[key]} maxLength={definition.max}
    type={key==='factsCheckedOn'?'date':'text'}
    inputMode={key==='landAreaSqm'||key==='floorAreaSqm'?'decimal':undefined}
    placeholder={key==='expectedStart'?'VD: Quý I/2027 hoặc sau khi bàn giao mặt bằng':key==='scaleSummary'?'VD: 3 tầng, công suất 80.000 sản phẩm/năm':undefined}
    onChange={event=>updateFields({[key]:event.target.value})}/>}
  </label>;
 }
 if(loading)return <div className="p2-skeleton" role="status">Đang tải phiên bản dự án…</div>;
 if(id&&!detail)return <div className="p2-empty" role="alert"><p>{error||'Không tìm thấy dự án.'}</p><button className="button button-secondary" onClick={()=>{setLoading(true);load().catch(cause=>setError(cause.message)).finally(()=>setLoading(false));}}>Thử lại</button></div>;
 return <div className="project-workspace p2-editor">
 {detail&&!editing&&privacyIssues.length>0&&<p className="auth-error" role="alert">Phiên bản đang xem có dấu hiệu chứa thông tin liên hệ hoặc dữ liệu bảo vệ trong phần công khai. Nội dung này chưa đủ điều kiện hiển thị công khai. Tạo bản sửa để tách lại thông tin rồi gửi duyệt.</p>}
 {detail&&<section className="project-editor-section"><div className="p2-page-top"><div><h2>{detail.version.title}</h2><p>Phiên bản v{detail.version.versionNo} · {formatPoints(detail.version.pricePoints)} POINT</p></div><ProjectStatusBadge status={detail.project.status} submissionStatus={detail.version.submissionStatus}/></div>{detail.currentPreview&&<p className="p2-note">Bản hiện hành đã duyệt: v{detail.currentPreview.versionNo} · {formatPoints(detail.currentPreview.pricePoints)} POINT. Bản đề xuất không thay đổi nội dung hoặc giá này trước khi duyệt.</p>}{versionId?<p className="p2-preview-notice">Đang xem lịch sử, chỉ đọc. <a href={`/seller/projects/${id}`}>Về phiên bản đang quản lý →</a></p>:<nav className="p2-editor-actions">{canEdit&&mode==='status'&&<a href={`/seller/projects/${id}/edit`}>Tiếp tục soạn tin →</a>}<button type="button" disabled={dirty||disabled} onClick={()=>setPreview(!preview)}>{preview?'Đóng xem trước':'Xem trước công khai'}</button>{!canEdit&&detail.project.status!=='archived'&&detail.version.submissionStatus!=='pending_review'&&<button type="button" disabled={disabled} onClick={()=>setCommand({name:'revision',title:'Tạo phiên bản đề xuất?',description:'Tạo bản nháp từ phiên bản này. Nếu có tệp bị thiếu, bạn có thể tải lại trong bản nháp. Hãy xác nhận lại quyền cung cấp trước khi gửi duyệt.'})}>Tạo bản sửa</button>}{detail.project.status==='published'&&<button type="button" disabled={dirty||disabled} onClick={()=>setCommand({name:'withdraw',title:'Ngừng công bố dự án?',description:'Dự án sẽ tạm ẩn. Bạn có thể công bố lại bản đã duyệt từ trang này.'})}>Ngừng công bố</button>}{detail.canRepublish&&<button type="button" className="button button-primary" disabled={dirty||disabled} onClick={()=>setCommand({name:'republish',title:'Công bố lại dự án?',description:'Phiên bản đã duyệt gần nhất sẽ xuất hiện lại trên sàn.'})}>Công bố lại bản đã duyệt</button>}{detail.project.status!=='archived'&&<button type="button" disabled={dirty||disabled} onClick={()=>setCommand({name:'archive',title:'Lưu trữ dự án?',description:'Tin sẽ ngừng công khai và không mở lại trong giai đoạn hiện tại. Lịch sử được giữ nguyên.'})}>Lưu trữ</button>}</nav>}</section>}
 {detail?.overlapWarning&&<p className="p2-preview-notice">Tin được chuyển kiểm duyệt với lưu ý có nội dung tương đồng. Nếu đây là gói riêng, hãy làm rõ giai đoạn, hạng mục và tài liệu bạn cung cấp khi cần bổ sung.</p>}
 {detail && detail.missingFileCount > 0 && <p className="p2-preview-notice">
  Khi tạo bản sửa, {detail.missingFileCount} tệp của phiên bản nguồn không có trong kho lưu trữ. Kiểm tra mục <strong>Ảnh và tệp</strong> và bổ sung các tệp cần thiết trước khi gửi duyệt.
 </p>}
 {editing&&<ProjectEditorSteps step={step} onChange={setStep} disabled={disabled}/>}
 {editing&&<form className="project-form" onSubmit={save} aria-busy={disabled}><fieldset disabled={disabled}>
 {step===1&&<section className="project-editor-section">
  <h2>1. Nội dung công khai</h2>
  <p className="p2-note">Không nhập thông tin liên hệ hoặc vị trí chính xác vào phần công khai.</p>
  <div className="p2-quick-panel p2-quick-heading"><div><h3>Bắt đầu từ mẫu</h3><p>Gợi ý tên và loại công trình theo danh mục đã chọn.</p></div>
   <button type="button" className="button button-secondary" onClick={()=>{setFields(current=>fillEmptyProjectFields(current,quickProjectTemplate(current.category)));setDirty(true);}}>Dùng mẫu theo danh mục</button>
  </div>
  <div className="project-form-grid">
   {field('title','Tên dự án')}
   <label>Danh mục<select value={fields.category} onChange={event=>updateFields({category:event.target.value})}>{Object.entries(categoryLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   {field('constructionType','Loại công trình')}{field('provinceCode','Tỉnh / thành')}{field('districtName','Phường / xã')}{field('projectStage','Giai đoạn dự án')}
   {factField('landAreaSqm','Diện tích thực địa (m²)')}{factField('scaleSummary','Quy mô dự án')}
   {factField('investmentAmount','Vốn đầu tư')}{factField('investmentCurrency')}
   {factField('expectedStart','Dự kiến khởi công')}
  </div>
  {field('publicSummary','Mô tả công khai (không bắt buộc)',5)}{field('technicalSummary','Thông số được phép công khai',3)}
 </section>}
 {step===2&&!detail&&<section className="project-editor-section"><h2>2. Ảnh và tệp</h2><p>Bấm <strong>Lưu bản nháp</strong> bên dưới để bắt đầu thêm ảnh và tài liệu.</p></section>}
 {step===3&&<section className="project-editor-section project-protected-section"><h2>3. Nội dung bảo vệ</h2><p>Chỉ bạn và kiểm duyệt viên được cấp quyền xem. Người mua chỉ được xem nội dung bảo vệ khi đã mua đúng phiên bản; tài liệu chỉ kiểm duyệt không được bán kèm. Nếu công trình có nhiều gói, hãy ghi rõ hạng mục, phạm vi và mã công trình nếu biết.</p><div className="project-form-grid">{Object.entries(privateLabels).filter(([key])=>key!=='procurementNotes').map(([key,label])=><label key={key}>{label}<textarea rows={key.endsWith('Notes')?3:2} maxLength={key.endsWith('Notes')?5000:500} value={privateData[key]||''} onChange={event=>{setPrivateData({...privateData,[key]:event.target.value});setDirty(true);}}/></label>)}</div><ProjectParticipantEditor rows={participants} onChange={rows=>{setParticipants(rows);setDirty(true);}}/><label className="project-check"><input type="checkbox" checked={rights} onChange={event=>{setRights(event.target.checked);setDirty(true);}}/>Tôi có quyền cung cấp các thông tin và tài liệu này.</label><label>Mẫu khai báo quyền cung cấp<select value="" onChange={event=>{if(event.target.value)updateFields({rightsDeclaration:event.target.value});}}><option value="">Chọn mẫu phù hợp với nguồn tin của bạn</option>{rightsOptions.map(option=><option key={option}>{option}</option>)}</select></label>{field('rightsDeclaration','Khai báo nguồn / quyền cung cấp',3)}</section>}
 {step===4&&<section className="project-editor-section"><h2>4. Giá bán thông tin</h2><p>Đặt giá cho quyền xem thông tin dự án bằng POINT.</p><ProjectPriceSuggestion key={JSON.stringify(priceContext)} context={priceContext} disabled={disabled} onApply={pricePoints=>updateFields({pricePoints})}/>{field('pricePoints','Giá bán (POINT)')}<div className="p2-quick-chips" role="group" aria-label="Chọn nhanh mức giá"><span>Chọn nhanh</span>{quickPrices.map(price=><button key={price} type="button" aria-pressed={fields.pricePoints===price} onClick={()=>updateFields({pricePoints:price})}>{formatPoints(price)} POINT</button>)}</div><p className="p2-note">Giá là số nguyên dương. Người mua dùng POINT để mua quyền truy cập nội dung của đúng phiên bản đã duyệt. Giá của tin đã công bố chỉ đổi sau khi bản đề xuất được duyệt.</p></section>}
 {step===5&&<section className="project-editor-section"><h2>5. Kiểm tra trước khi gửi</h2>{issues.length?<div className="p2-validation"><strong>Cần hoàn thiện {issues.length} mục</strong><ul>{issues.map(issue=><li key={issue}>{issue}</li>)}</ul></div>:<p className="identity-success">Thông tin cơ bản đã đầy đủ. Kiểm tra lại nội dung và tệp trước khi gửi.</p>}<p>{dirty?'Bạn đang có thay đổi chưa lưu.':'Bản nháp đã lưu có thể được xem trước và gửi xét duyệt.'}</p><details><summary>Rà soát thông tin bảo vệ của riêng bạn</summary><dl className="identity-details">{Object.entries(privateLabels).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{privateData[key]||'Chưa cung cấp'}</dd></div>)}</dl></details></section>}
 <div className="p2-save-bar"><span>{dirty?'● Có thay đổi chưa lưu':detail?'✓ Đã đồng bộ bản nháp':'Bắt đầu bản nháp mới'}</span><button className={`button ${step<5?'button-secondary':'button-primary'}`} type="submit">{pending?'Đang lưu…':'Lưu bản nháp'}</button>{step<5&&<button type="submit" value="continue" className="button button-primary">{id&&!dirty?'Tiếp tục':'Lưu và tiếp tục'} →</button>}</div>
 </fieldset></form>}
 {editing&&step===2&&detail&&<ProjectFileUpload detail={detail} disabled={dirty||pending} onBusy={setFileBusy} onSaved={async()=>{await load();setNotice('Đã lưu tệp.');}}/>}
 {detail&&((editing&&step===2)||!editing)&&<section className="project-editor-section"><h2>Tệp của phiên bản v{detail.version.versionNo}</h2><div className="p2-file-grid">{detail.files.map(file=><article key={file.id}><a href={file.url} target="_blank" rel="noopener noreferrer">{file.mimeType==='image/png'?<img src={file.url} alt={file.originalFilename} loading="lazy"/>:'Tải tài liệu'}</a><strong>{file.originalFilename}</strong><span>{accessLabels[file.accessLevel]} · {String(BigInt(file.sizeBytes)/1024n)} KB</span>{editing&&<button type="button" disabled={disabled||dirty} onClick={()=>setCommand({name:'remove-file',fileId:file.id,title:'Gỡ tệp khỏi bản nháp?',description:'Tệp sẽ không còn trong bản nháp đang gửi duyệt. Lịch sử và dữ liệu lưu giữ không bị xóa.'})}>Gỡ khỏi bản nháp</button>}</article>)}</div>{!detail.files.length&&<p className="p2-note">Chưa có tệp trong phiên bản này.</p>}</section>}
 {detail&&(preview||(editing&&step===5&&!dirty))&&<section className="project-editor-section"><ProjectPublicPreview project={detail.preview}/></section>}
 {!editing&&detail&&<section className="project-editor-section project-protected-section"><h2>Nội dung bảo vệ của phiên bản</h2><ProjectParticipantCards participants={detail.participants}/><dl className="identity-details">{Object.entries(privateLabels).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{detail.privateData[key]||'Chưa cung cấp'}</dd></div>)}</dl></section>}
 {detail&&canEdit&&(!editing||step===5)&&<section className="project-editor-section"><h2>Gửi dự án xét duyệt</h2><p>Hệ thống kiểm tra ban đầu rồi chuyển cho kiểm duyệt viên. Nội dung đã gửi bị khóa; nếu cần sửa sẽ tạo phiên bản mới.</p><button type="button" className="button button-primary" disabled={disabled||dirty||issues.length>0} onClick={()=>setCommand({name:'submit',title:`Gửi phiên bản v${detail.version.versionNo} xét duyệt?`,description:'Kiểm tra kỹ phần công khai, bảo vệ, tệp và giá. Sau khi gửi, không chỉnh sửa trực tiếp phiên bản này.'})}>Gửi dự án xét duyệt</button>{issues.length>0&&<p className="p2-note">Mở trình soạn để hoàn thiện các mục còn thiếu.</p>}</section>}
 {detail&&<ProjectVersionHistory detail={detail} base={`/seller/projects/${id}`}/>}
 {error&&<div className="auth-error p2-feedback" role="alert">{error}</div>}{notice&&<p role="status" className="identity-success">{notice}</p>}
 <ConfirmActionDialog open={Boolean(command)} pending={pending} title={command?.title||'Xác nhận thao tác'} onClose={()=>{if(!pending)setCommand(null);}} onConfirm={execute}><p>{command?.description}</p>{detail&&command?.name!=='leave'&&<p className="p2-note">{detail.version.title} · v{detail.version.versionNo} · {formatPoints(detail.version.pricePoints)} POINT</p>}</ConfirmActionDialog>
 </div>;
}

