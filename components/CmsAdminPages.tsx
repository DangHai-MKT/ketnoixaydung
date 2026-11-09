import {notFound} from 'next/navigation';
import {requirePageActor} from '../lib/auth/server';
import {cmsAdminPath,cmsPublicPath,cmsRoles,contentInput,type CmsKind} from '../lib/cms/content';
import {cmsEnabled,getAdminContent,getPublicationSnapshot,listAdminContent,listCategories,publicationHistory} from '../services/cms';
import {listMedia} from '../services/cms-media';
import CmsEditor from './CmsEditor';
import CmsContent,{CmsImage} from './CmsContent';
import CmsManagementForm from './CmsManagementForm';
import Icon from './MarketplaceIcon';

type Search = Promise<Record<string,string|string[]|undefined>>;
const date = (value:Date) => value.toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});
const isId = (id:string) => /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id);
const sections = [
  ['/admin/news','Tin tức'], ['/admin/news/categories','Danh mục tin'],
  ['/admin/pages','Trang thông tin'], ['/admin/media','Thư viện ảnh'],
] as const;
function CmsHeader({active,title,description,action}:{active:string;title:string;description:string;action?:{href:string;label:string}}) {
  return <>
    <nav className="cms-editor-nav cms-row" aria-label="Quản lý nội dung">{sections.map(([href,label])=>
      <a key={href} href={href} aria-current={href===active?'page':undefined}>{label}</a>)}</nav>
    <header className="cms-admin-heading"><div><span className="news-eyebrow">Không gian biên tập</span><h1>{title}</h1><p>{description}</p></div>
      {action&&<a href={action.href} className="button button-primary">{action.label}</a>}
    </header>
  </>;
}
function query(params:Awaited<Search>) {
  const n=Number(params.page);
  return {q:typeof params.q==='string'?params.q.trim().slice(0,100):'',page:Number.isSafeInteger(n)&&n>0&&n<=10000?n:1,
    state:params.state==='published'||params.state==='draft'?params.state:''};
}
export function CmsPagination({page,next,filters}:{page:number;next:boolean;filters:Record<string,string>}) {
  const href=(n:number)=>'?'+new URLSearchParams({...filters,page:String(n)});
  return <nav className="cms-row" aria-label="Phân trang">{page>1&&<a href={href(page-1)}>← Trang trước</a>}
    <span>Trang {page}</span>{next&&<a href={href(page+1)}>Trang sau →</a>}</nav>;
}
function Disabled() {return <main className="cms-work"><h1>Quản lý nội dung</h1><p>CMS chưa được bật trên môi trường này.</p></main>;}

export async function CmsAdminList({kind,searchParams}:{kind:CmsKind;searchParams:Search}) {
  const base=cmsAdminPath(kind);
  await requirePageActor(base,cmsRoles);
  if (!cmsEnabled()) return <Disabled/>;
  const params=await searchParams,{q,page,state}=query(params);
  const category=kind==='news'&&typeof params.category==='string'?params.category.slice(0,100):'';
  const [{rows,hasNext},categories]=await Promise.all([listAdminContent(kind,q,state,page,category),kind==='news'?listCategories():[]]);
  const filtered=Boolean(q||state||category);
  return <main className="cms-work"><CmsHeader active={base} title={kind==='news'?'Quản lý tin tức':'Quản lý trang thông tin'}
    description={kind==='news'?'Soạn bài, sắp xếp theo danh mục và theo dõi nội dung đang công bố.':'Soạn và quản lý các trang thông tin công khai.'}
    action={{href:base+'/new',label:kind==='news'?'+ Tạo bài viết':'+ Tạo trang'}}/>
    <section className="cms-desk" aria-labelledby="cms-list-title">
    <div className="cms-desk-title"><h2 id="cms-list-title">{kind==='news'?'Bài viết':'Trang thông tin'}</h2>{kind==='news'&&<a href="/news" target="_blank" rel="noreferrer">Xem trang tin công khai ↗</a>}</div>
    <form className="cms-row cms-filter cms-desk-filter"><label>Tìm nội dung<input type="search" name="q" maxLength={100} defaultValue={q} placeholder="Tiêu đề hoặc đường dẫn…"/></label>
      <label>Trạng thái<select name="state" defaultValue={state}><option value="">Tất cả</option><option value="draft">Chưa công bố</option><option value="published">Đang công bố</option></select></label>
      {kind==='news'&&<label>Danh mục tin<select name="category" defaultValue={category}><option value="">Tất cả</option>
        {category&&!categories.some(item=>item.slug===category)&&<option value={category}>Danh mục không còn hiển thị</option>}
        {categories.map(item=><option key={item.id} value={item.slug}>{item.name}</option>)}</select></label>}
      <button className="button button-primary">Áp dụng</button>{filtered&&<a href={base}>Xóa bộ lọc</a>}
    </form>
    {!rows.length?<div className="news-empty"><span aria-hidden="true"><Icon name="file" size={30}/></span>
      <h3>{filtered?'Không có kết quả phù hợp':'Chưa có nội dung ở trang này'}</h3>
      <p>{filtered?'Thử thay đổi từ khóa, trạng thái hoặc danh mục.':'Tạo bản nháp để bắt đầu, sau đó xem trước và gửi xuất bản khi nội dung sẵn sàng.'}</p>
      <a className="button button-secondary" href={filtered||page>1?base:base+'/new'}>{filtered?'Xóa bộ lọc':page>1?'Về danh sách':kind==='news'?'Tạo bài viết':'Tạo trang'}</a>
    </div>:<div className="cms-desk-table" tabIndex={0} role="region" aria-label="Bảng nội dung">
      <table><caption className="ml-sr-only">Danh sách nội dung biên tập</caption><thead><tr>
        <th scope="col">Tiêu đề</th>{kind==='news'&&<th scope="col">Danh mục</th>}<th scope="col">Trạng thái</th><th scope="col">Cập nhật</th><th scope="col">Thao tác</th>
      </tr></thead><tbody>{rows.map(row=>{
        const edit=base+'/'+row.id+'/edit';
        return <tr key={row.id}>
          <td><div className="cms-desk-item">{row.imageId?<CmsImage id={row.imageId} alt="" preview/>:<span aria-hidden="true"><Icon name="file" size={20}/></span>}
            <div><a href={edit}>{row.title}</a><small>/{row.slug}</small></div></div></td>
          {kind==='news'&&<td>{row.category||'Chưa phân loại'}</td>}
          <td><span className={'cms-status '+(row.publishedRevision?'cms-status-live':row.hasHistory?'cms-status-off':'cms-status-draft')}>
            {row.publishedRevision?'Đang công bố':row.hasHistory?'Đã ngừng công bố':'Bản nháp'}</span>
            {row.publishedRevision&&row.revision!==row.publishedRevision&&<small>Có bản nháp mới</small>}
            {row.publishedAt&&<small>Công bố {date(row.publishedAt)}</small>}
          </td>
          <td><time dateTime={row.updatedAt.toISOString()}>{date(row.updatedAt)}</time><small>{row.updatedBy}</small></td>
          <td><div className="cms-desk-actions"><a href={edit} aria-label={'Sửa '+row.title}>Chỉnh sửa</a>
            <a href={`/admin/content/preview/${row.id}?kind=${kind}`} aria-label={'Xem trước '+row.title}>Xem trước</a>
            {row.publishedRevision&&<a href={cmsPublicPath(kind,row.slug)} target="_blank" rel="noreferrer">Xem công khai ↗</a>}
          </div></td>
        </tr>;
      })}</tbody></table>
    </div>}
    </section>
    <CmsPagination page={page} next={hasNext} filters={{q,state,...(kind==='news'?{category}:{})}}/>
  </main>;
}

export async function CmsAdminEdit({kind,id}:{kind:CmsKind;id?:string}) {
  const base=cmsAdminPath(kind);
  const actor=await requirePageActor(id?base+'/'+id+'/edit':base+'/new',cmsRoles);
  if (!cmsEnabled()) return <Disabled/>;
  if (id&&!isId(id)) notFound();
  const [row,categories,history]=await Promise.all([id?getAdminContent(kind,id):null,kind==='news'?listCategories():[],id?publicationHistory(id):[]]);
  if(id&&!row) notFound();
  const initial=row?{...contentInput(row,kind),id:row.id,revision:row.revision,publishedRevision:row.publishedRevision}:undefined;
  return <main className="cms-work"><CmsHeader active={base}
    title={kind==='news'?(row?'Chỉnh sửa bài viết':'Tạo bài viết'):(row?'Chỉnh sửa trang thông tin':'Tạo trang thông tin')}
    description="Điền thông tin, soạn nội dung rồi lưu bản nháp để xem trước."/>
    <CmsEditor key={id??'new'} kind={kind} initial={initial} categories={categories.map(({id,name})=>({id,name}))} canPublish={actor.roles.includes('super_admin')} hasHistory={Boolean(history.length)}/>
    {history.length>0&&<section className="cms-preview"><h2>Lịch sử xuất bản gần đây</h2><ul>
      {history.map(item=><li key={item.revision}><a href={`/admin/content/preview/${id}?kind=${kind}&revision=${item.revision}`}>Phiên bản {item.revision}</a> · {item.actor} · {date(item.date)}</li>)}
    </ul></section>}
  </main>;
}

export async function CmsAdminPreview({id,searchParams}:{id:string;searchParams:Search}) {
  await requirePageActor('/admin/content/preview/'+id,cmsRoles);
  if (!cmsEnabled()) return <Disabled/>;
  const {kind,revision}=await searchParams;
  if(!isId(id)||(kind!=='page'&&kind!=='news')) notFound();
  const row=await getAdminContent(kind,id);
  if(!row) notFound();
  const version=typeof revision==='string'&&/^[1-9]\d{0,9}$/.test(revision)?Number(revision):0;
  if(revision!==undefined&&(!version||version>2147483647)) notFound();
  const history=version?await getPublicationSnapshot(row.id,version):null;
  if(version&&!history) notFound();
  return <main className="cms-work"><p className="cms-preview">{history?'Lịch sử xuất bản · '+date(history.date):'Bản xem trước riêng tư'} · phiên bản {version||row.revision}</p>
    <a href={cmsAdminPath(kind)+'/'+id+'/edit'}>← Về trình biên tập</a><CmsContent content={history?.content??contentInput(row,kind)} preview/>
  </main>;
}

export async function CmsAdminCategories() {
  await requirePageActor('/admin/news/categories',cmsRoles);
  if (!cmsEnabled()) return <Disabled/>;
  const categories=await listCategories();
  return <main className="cms-work"><CmsHeader active="/admin/news/categories" title="Danh mục tin"
    description="Tạo nhóm chủ đề để bạn đọc dễ tìm bài. Tên đường dẫn được tạo tự động từ tên danh mục."/>
    <CmsManagementForm mode="category"/>
    {categories.length?<ul>{categories.map(category=><li key={category.id}><strong>{category.name}</strong> · {category.slug}
      <details><summary>Đổi tên</summary><CmsManagementForm mode="category" id={category.id} initial={category.name}/></details></li>)}</ul>:<p>Chưa có danh mục tin. Thêm danh mục đầu tiên để dùng khi soạn bài.</p>}
  </main>;
}

export async function CmsAdminMedia({searchParams}:{searchParams:Search}) {
  const actor=await requirePageActor('/admin/media',cmsRoles);
  if (!cmsEnabled()) return <Disabled/>;
  const {q,page}=query(await searchParams), {rows,hasNext}=await listMedia(q,page);
  return <main className="cms-work"><CmsHeader active="/admin/media" title="Thư viện ảnh"
    description="Tải và quản lý ảnh dùng chung cho bài viết và trang thông tin."/>
    <CmsManagementForm mode="media"/>
    <form className="cms-row cms-filter"><label>Tìm ảnh<input name="q" maxLength={100} defaultValue={q}/></label>
      <button className="button button-secondary">Tìm</button></form>
    {!rows.length&&<p>Chưa có ảnh phù hợp.</p>}
    <div className="cms-media-grid">{rows.map(row=><article className="cms-card" key={row.id}>
      <a href={'/api/admin/cms/media/'+row.id} target="_blank" rel="noreferrer"><CmsImage id={row.id} alt={row.alt} preview/></a>
      <div><h2>{row.filename}</h2><p>{row.width} × {row.height} px · {Math.ceil(row.size/1024)} KB</p>
        <CmsManagementForm mode="alt" id={row.id} initial={row.alt} filename={row.filename} canDelete={actor.roles.includes('super_admin')}/></div>
    </article>)}</div><CmsPagination page={page} next={hasNext} filters={{q}}/>
  </main>;
}
