'use client';
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {cmsAdminPath,cmsPublicPath,suggestedSlug,validatePublication,type Block,type CmsInput,type CmsKind} from '../lib/cms/content';
import CmsContent from './CmsContent';
import CmsMediaPicker from './CmsMediaPicker';

const blockLabels={paragraph:'Đoạn văn',heading:'Tiêu đề',list:'Danh sách',quote:'Trích dẫn',link:'Liên kết',image:'Hình ảnh'};
const blank:CmsInput={title:'',slug:'',summary:'',seoTitle:'',seoDescription:'',categoryId:null,featuredMediaId:null,featuredAlt:'',isPolicy:false,blocks:[]};
function blankBlock(type:Block['type']):Block {
  if (type==='image') return {type,mediaId:'',alt:'',caption:''};
  if (type==='link') return {type,text:'',href:''};
  return {type,text:''};
}

export default function CmsEditor({kind,initial,categories,canPublish,hasHistory=false}: {
  kind:CmsKind; initial?:CmsInput & {id:string;revision:number;publishedRevision:number|null};
  categories:{id:string;name:string}[]; canPublish:boolean; hasHistory?:boolean;
}) {
  const router=useRouter(), base=cmsAdminPath(kind), root=useRef<HTMLDivElement>(null);
  const [draft,setDraft]=useState<CmsInput>(initial??blank);
  const [dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const [preview,setPreview]=useState(false),[type,setType]=useState<Block['type']>('paragraph');
  const [published,setPublished]=useState(initial?.publishedRevision??null),[revision,setRevision]=useState(initial?.revision??0);
  const [addedCategories,setAddedCategories]=useState<{id:string;name:string}[]>([]);
  const [addingCategory,setAddingCategory]=useState(false),[categoryName,setCategoryName]=useState('');
  const [categoryBusy,setCategoryBusy]=useState(false),[categoryError,setCategoryError]=useState('');
  const [mediaBusy,setMediaBusy]=useState(false);
  const categoryOptions=[...categories,...addedCategories.filter(item=>!categories.some(category=>category.id===item.id))];
  let publicationIssue='';
  try {validatePublication(draft,kind);} catch(cause) {publicationIssue=cause instanceof Error?cause.message:'Cần hoàn thiện nội dung.';}
  useEffect(()=>{
    if(!dirty) return;
    const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    const leave=(event:MouseEvent)=>{
      if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey) return;
      const link=(event.target as Element).closest?.('a[href]') as HTMLAnchorElement|null;
      if(link&&link.target!=='_blank'&&!link.getAttribute('href')?.startsWith('#')&&!window.confirm('Rời trang và bỏ các thay đổi chưa lưu?')) event.preventDefault();
    };
    window.addEventListener('beforeunload',warn);
    document.addEventListener('click',leave,true);
    return ()=>{window.removeEventListener('beforeunload',warn);document.removeEventListener('click',leave,true);};
  },[dirty]);

  function update(values:Partial<CmsInput>) {
    setDraft(previous=>({...previous,...values}));setDirty(true);setMessage('');
  }
  function replace(index:number,value:Block) {
    update({blocks:draft.blocks.map((block,i)=>i===index?value:block)});
  }
  function move(index:number,direction:number) {
    const blocks=[...draft.blocks], next=index+direction;
    [blocks[index],blocks[next]]=[blocks[next],blocks[index]];
    update({blocks});
  }
  async function addCategory() {
    const name=categoryName.trim(),slug=suggestedSlug(name);
    if(categoryBusy||busy) return;
    if(!slug) {setCategoryError('Nhập tên danh mục có chữ hoặc số.');return;}
    setCategoryBusy(true);setCategoryError('');
    try {
      const response=await fetch('/api/admin/cms/categories',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,slug})});
      const result=await response.json();
      if(!response.ok) throw new Error(result.error||'Chưa thể tạo danh mục.');
      setAddedCategories(previous=>[...previous,{id:result.id,name}]);
      update({categoryId:result.id});setAddingCategory(false);setCategoryName('');setMessage('Đã tạo và chọn danh mục '+name+'.');
    } catch(cause) {setCategoryError(cause instanceof Error?cause.message:'Chưa thể kết nối.');}
    finally {setCategoryBusy(false);}
  }
  async function send(action:'create'|'save'|'publish'|'save-publish'|'unpublish') {
    if(busy||mediaBusy||categoryBusy) return;
    const publishing=action==='publish'||action==='save-publish';
    if(publishing&&publicationIssue) {setError(publicationIssue);return;}
    if((publishing||action==='unpublish')&&!window.confirm(publishing?'Đưa nội dung này lên website?':'Ngừng công bố nội dung này?')) return;
    setBusy(true);setError('');setMessage('');
    try {
      const response=await fetch('/api/admin/cms/content',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...((action==='create'||action==='save'||action==='save-publish')?{...draft,slug:draft.slug||suggestedSlug(draft.title)}:{}),kind,id:initial?.id,revision,action})});
      const result=await response.json().catch(()=>null);
      if(!response.ok||typeof result?.revision!=='number') throw new Error(result?.error||'Chưa thể cập nhật nội dung. Vui lòng thử lại.');
      setDirty(false);setRevision(result.revision);
      if(!initial&&(action==='create'||publishing)) {router.replace(base+'/'+result.id+'/edit#cms-publish');return;}
      if(publishing) setPublished(result.revision);
      if(action==='unpublish') setPublished(null);
      setMessage(publishing?'Đã xuất bản.':action==='unpublish'?'Đã ngừng công bố.':'Đã lưu bản nháp.');
      router.refresh();
    } catch(cause) {setError(cause instanceof Error?cause.message:'Chưa thể kết nối.');}
    finally {setBusy(false);}
  }
  function format(index:number,mark:string) {
    const block=draft.blocks[index];
    if(!('text' in block)) return;
    const input=root.current?.querySelector<HTMLTextAreaElement>('#cms-block-'+index);
    if(!input) return;
    const start=input.selectionStart,end=input.selectionEnd;
    const text=block.text.slice(0,start)+mark+(block.text.slice(start,end)||'nội dung')+mark+block.text.slice(end);
    if(text.length>4000) return;
    replace(index,{...block,text});
    requestAnimationFrame(()=>{input.focus();input.setSelectionRange(start+mark.length,start+mark.length+(end-start||8));});
  }
  const textField=(key:'title'|'slug'|'summary'|'seoTitle'|'seoDescription',label:string,max:number,rows?:number)=><label>{label}
    {rows?<textarea rows={rows} maxLength={max} value={draft[key]} onChange={e=>update({[key]:e.target.value})}/>:
      <input required={key==='title'} readOnly={key==='slug'&&(hasHistory||published!==null)} maxLength={max} value={draft[key]} onChange={e=>update({[key]:e.target.value})}/>}
  </label>;
  return <div ref={root}>
    <nav className="cms-editor-nav cms-row" aria-label="Các phần biên tập">
      <a href="#cms-info">1. Thông tin</a><a href="#cms-writing">2. Nội dung</a><a href="#cms-publish">3. Kiểm tra và xuất bản</a>
    </nav>
    <form className="cms-form" onSubmit={e=>{e.preventDefault();if(!categoryBusy)void send(initial?'save':'create');}}>
      <fieldset disabled={busy||mediaBusy} id="cms-info">
        <legend>1. Thông tin</legend>
        {textField('title','Tiêu đề',180)}
        <details className="cms-advanced"><summary>Đường dẫn công khai</summary>{textField('slug','Tên đường dẫn',100)}
          <small>{draft.slug?'':'Tự tạo từ tiêu đề khi lưu. '}{hasHistory?'Đường dẫn đã cố định sau khi xuất bản.':'Bạn có thể chỉnh trước lần xuất bản đầu tiên.'}</small>
        </details>
        {textField('summary','Tóm tắt',500,3)}
        {kind==='news'?<div className="cms-category-control">
          <div className="cms-row"><label>Danh mục tin<select value={draft.categoryId??''} onChange={e=>update({categoryId:e.target.value||null})}>
            <option value="">Chọn danh mục</option>{categoryOptions.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}
          </select></label><button type="button" aria-expanded={addingCategory} disabled={categoryBusy} onClick={()=>setAddingCategory(!addingCategory)}>{addingCategory?'Đóng':'+ Tạo danh mục'}</button></div>
          {!categoryOptions.length&&!addingCategory&&<p>Chưa có danh mục. Bạn có thể tạo ngay tại đây.</p>}
          {addingCategory&&<div className="cms-row"><label>Tên danh mục mới<input maxLength={120} value={categoryName} onChange={e=>setCategoryName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void addCategory();}}}/></label>
            <button type="button" disabled={categoryBusy||!categoryName.trim()} onClick={addCategory}>{categoryBusy?'Đang tạo…':'Tạo và chọn'}</button></div>}
          {categoryError&&addingCategory&&<p className="auth-error" role="alert">{categoryError}</p>}
          {message.startsWith('Đã tạo và chọn danh mục')&&<p role="status">{message}</p>}
        </div>:<label className="cms-check"><input type="checkbox" checked={draft.isPolicy} disabled={initial?.isPolicy||hasHistory||published!==null} onChange={e=>update({isPolicy:e.target.checked})}/> Bản nháp chính sách, chờ duyệt riêng</label>}
        <CmsMediaPicker label="Chọn ảnh đại diện" selected={draft.featuredMediaId} onUploadBusy={setMediaBusy} onSelect={image=>update({featuredMediaId:image?.id??null,featuredAlt:image?.alt??''})}/>
        {draft.featuredMediaId&&<label>Mô tả ảnh đại diện<input maxLength={250} value={draft.featuredAlt} onChange={e=>update({featuredAlt:e.target.value})}/></label>}
      </fieldset>
      <fieldset disabled={busy||mediaBusy} id="cms-writing">
        <legend>2. Soạn nội dung</legend>
        <p>Dùng các khối để sắp xếp nội dung. Với danh sách, nhập mỗi mục trên một dòng.</p>
        {draft.blocks.map((block,i)=><section className="cms-editor-block" key={i} aria-label={`Khối ${i+1}: ${blockLabels[block.type]}`}>
          <div className="cms-row"><strong>{i+1}. {blockLabels[block.type]}</strong>
            <button type="button" disabled={i===0} onClick={()=>move(i,-1)} aria-label={`Đưa khối ${i+1} lên`}>↑</button>
            <button type="button" disabled={i===draft.blocks.length-1} onClick={()=>move(i,1)} aria-label={`Đưa khối ${i+1} xuống`}>↓</button>
            <button type="button" onClick={()=>update({blocks:draft.blocks.filter((_,index)=>i!==index)})}>Bỏ khối</button>
          </div>
          {block.type==='image'?<>
            <CmsMediaPicker label="Chọn ảnh nội dung" selected={block.mediaId||null} onUploadBusy={setMediaBusy} onSelect={image=>replace(i,{...block,mediaId:image?.id??'',alt:image?.alt??''})}/>
            <label>Mô tả ảnh<input maxLength={250} value={block.alt} onChange={e=>replace(i,{...block,alt:e.target.value})}/></label>
            <label>Chú thích<input maxLength={250} value={block.caption} onChange={e=>replace(i,{...block,caption:e.target.value})}/></label>
          </>:<>
            {(block.type==='paragraph'||block.type==='quote'||block.type==='list')&&<div className="cms-row">
              <button type="button" onClick={()=>format(i,'**')}>Đậm</button><button type="button" onClick={()=>format(i,'*')}>Nghiêng</button>
            </div>}
            <label>{block.type==='link'?'Văn bản liên kết':'Nội dung'}<textarea id={'cms-block-'+i} rows={block.type==='heading'||block.type==='link'?2:4}
              maxLength={block.type==='heading'||block.type==='link'?180:4000} value={block.text} onChange={e=>replace(i,{...block,text:e.target.value})}/></label>
            {block.type==='link'&&<label>Địa chỉ liên kết<input maxLength={500} value={block.href} onChange={e=>replace(i,{...block,href:e.target.value})}/></label>}
          </>}
        </section>)}
        <div className="cms-row"><label>Loại khối<select value={type} onChange={e=>setType(e.target.value as Block['type'])}>
          {Object.entries(blockLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
          <button type="button" className="button button-secondary" disabled={draft.blocks.length>=40} onClick={()=>update({blocks:[...draft.blocks,blankBlock(type)]})}>Thêm khối</button>
          {type!=='image'&&<button type="button" className="button button-secondary" disabled={draft.blocks.length>=40}
            onClick={()=>update({blocks:[...draft.blocks,blankBlock('image')]})}>Thêm hình ảnh</button>}</div>
      </fieldset>
      <details className="cms-advanced"><summary>Hiển thị trên công cụ tìm kiếm (tùy chọn)</summary>{textField('seoTitle','Tiêu đề SEO',100)}{textField('seoDescription','Mô tả SEO',200,2)}</details>
      <section className="cms-publish-panel" id="cms-publish" aria-label="Kiểm tra và xuất bản">
        <h2>3. Kiểm tra và xuất bản</h2>
        <p>{published!==null?'Đang công bố':initial?'Bản nháp đã lưu':'Bản nháp mới'}{dirty?' · Có thay đổi chưa lưu':''}</p>
        <p>{!canPublish?'Bạn có thể lưu và xem trước. Tài khoản quản trị cấp cao thực hiện xuất bản.':publicationIssue||
          (!dirty&&published===revision?'Phiên bản này đang hiển thị trên website.':dirty||!initial?'Chọn Lưu và xuất bản để đưa nội dung hiện tại lên website.':'Bản đã lưu sẵn sàng xuất bản.')}</p>
        <div className="cms-row">
        <button type="submit" className="button button-primary" disabled={busy||categoryBusy||mediaBusy}>{busy?'Đang xử lý…':mediaBusy?'Đang tải ảnh…':'Lưu bản nháp'}</button>
        <button type="button" className="button button-secondary" aria-expanded={preview} onClick={()=>setPreview(!preview)}>Xem trước tại đây</button>
        {initial&&!dirty&&<a href={`/admin/content/preview/${initial.id}?kind=${kind}`} target="_blank" rel="noreferrer">Mở bản xem trước ↗</a>}
        {canPublish&&<button type="button" className="button button-secondary" disabled={busy||mediaBusy||categoryBusy||(!dirty&&published===revision)}
          onClick={()=>send(dirty||!initial?'save-publish':'publish')}>{dirty||!initial?'Lưu và xuất bản':'Xuất bản bản đã lưu'}</button>}
        {canPublish&&published!==null&&<button type="button" disabled={dirty||busy} onClick={()=>send('unpublish')}>Ngừng công bố</button>}
        {published!==null&&<a href={cmsPublicPath(kind,initial?.slug??draft.slug)} target="_blank" rel="noreferrer">Trang đang công khai ↗</a>}
      </div>
      {error&&<p role="alert" className="auth-error">{error}</p>}{message&&!message.startsWith('Đã tạo và chọn danh mục')&&<p role="status">{message}</p>}
      </section>
    </form>
    {preview&&<section className="cms-preview"><p>Xem trước nội dung đang soạn</p><CmsContent content={{...draft,blocks:draft.blocks.filter(block=>block.type!=='image'||Boolean(block.mediaId))}} preview/></section>}
  </div>;
}
