'use client';
import {useEffect,useRef,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import ProjectCard from './ProjectCard';
import Icon from './MarketplaceIcon';
import {categoryLabels} from '../lib/projects/workflow';
import type {PublicProject} from '../lib/projects/contracts';
import ProjectFilterDialog,{projectSorts} from './ProjectFilterDialog';
import LoadMoreButton from './LoadMoreButton';
type Result={data:PublicProject[];pagination:{page:number;pageSize:number;total:number;totalPages:number}};
async function fetchProjects(query:URLSearchParams,signal:AbortSignal):Promise<Result> {
 query.set('pageSize','12');
 const response=await fetch(`/api/projects?${query}`,{cache:'no-store',signal});
 const body=await response.json();
 if(!response.ok)throw new Error(body.error||'Không thể tải danh sách dự án.');
 return body;
}
const filterLabels:Record<string,string>={q:'Từ khóa',category:'Danh mục',province:'Khu vực',stage:'Giai đoạn',minPrice:'Giá từ',maxPrice:'Giá đến'};
export default function ProjectsExplorer({showProjectWatch=false}:{showProjectWatch?:boolean}){
 const router=useRouter(),params=useSearchParams(),queryString=params.toString();
 const category=params.get('category');
 const appliedKeyword=params.get('q')??'';
 const [keyword,setKeyword]=useState(appliedKeyword),[result,setResult]=useState<Result|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0),[filtersOpen,setFiltersOpen]=useState(false);
 const dialogRef=useRef<HTMLDialogElement>(null);
 const filterCount=['category','province','stage'].filter(key=>params.get(key)).length+Number(Boolean(params.get('minPrice')||params.get('maxPrice')));
 useEffect(()=>setKeyword(appliedKeyword),[appliedKeyword]);
 const moreRequest=useRef<AbortController|null>(null);
 const [moreBusy,setMoreBusy]=useState(false),[moreError,setMoreError]=useState('');
 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);setResult(null);setError('');setMoreError('');setMoreBusy(false);
  fetchProjects(new URLSearchParams(queryString),controller.signal).then(body=>{
    if(!controller.signal.aborted)setResult(body);
  }).catch(cause=>{
    if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Không thể kết nối.');
  }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>{controller.abort();moreRequest.current?.abort();moreRequest.current=null;};
 },[queryString,retry]);
 async function loadMore() {
  if(!result||moreRequest.current)return;
  const controller=new AbortController();
  moreRequest.current=controller;setMoreBusy(true);setMoreError('');
  try {
   const query=new URLSearchParams(queryString);
   query.set('page',String(result.pagination.page+1));
   const next=await fetchProjects(query,controller.signal);
   if(controller.signal.aborted)return;
   const seen=new Set(result.data.map(row=>row.id));
   setResult({...next,data:[...result.data,...next.data.filter(row=>!seen.has(row.id))]});
  } catch(cause) {
   if(!controller.signal.aborted)setMoreError(cause instanceof Error?cause.message:'Không thể tải thêm dự án.');
  } finally {
   if(moreRequest.current===controller){moreRequest.current=null;setMoreBusy(false);}
  }
 }
 function change(key:string,value:string){const query=new URLSearchParams(queryString);if(value)query.set(key,value);else query.delete(key);query.delete('page');navigate(query);}
 function navigate(query:URLSearchParams){router.push(query.size?`/projects?${query}`:'/projects');}
 function remove(key:string){const query=new URLSearchParams(queryString);query.delete(key);query.delete('page');navigate(query);}
 return <main className="p2-market"><div className="p2-market-intro"><nav aria-label="Đường dẫn"><a href="/">Trang chủ</a><span> / Dự án</span></nav><div><span className="identity-eyebrow">THÔNG TIN DỰ ÁN XÂY DỰNG</span><h1>Tìm đúng dự án. Kết nối đúng cơ hội.</h1><p>Khám phá nguồn tin đã kiểm duyệt. Xem thông tin công khai và giá POINT trước khi quyết định.</p></div></div>
 <div className="p2-discovery-form">
   <form className="p2-discovery-search" onSubmit={event=>{event.preventDefault();change('q',keyword.trim());}}>
     <label><Icon name="search" size={21}/><span className="p2-sr">Từ khóa</span><input type="search" value={keyword} onChange={event=>setKeyword(event.target.value)} placeholder="Tìm tên dự án hoặc nội dung công khai…" maxLength={100}/></label>
     <button type="submit" className="button button-primary">Tìm dự án</button>
   </form>
   <div className="p2-filter-toolbar">
     <button className="p2-filter-trigger" type="button" aria-haspopup="dialog" aria-expanded={filtersOpen} aria-controls="project-filter-panel"
       onClick={()=>{dialogRef.current?.showModal();setFiltersOpen(true);}}>
       <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="M3 4h18l-7 8v6l-4 2v-8L3 4Z"/></svg>
       Lọc{filterCount>0&&<span aria-label={filterCount+' tiêu chí đang áp dụng'}>{filterCount}</span>}
     </button>
     <div className="p2-filter-quick" role="group" aria-label="Chọn nhanh danh mục dự án">
       <button type="button" aria-pressed={!category} onClick={()=>change('category','')}><Icon name="all" size={20}/>Tất cả</button>
       {Object.entries(categoryLabels).map(([key,label])=><button type="button" key={key} aria-pressed={category===key}
         onClick={()=>change('category',category===key?'':key)}><Icon name={key} size={20}/>{label}</button>)}
     </div>
   </div>
   <div className="p2-filter-sortbar" role="group" aria-label="Sắp xếp dự án"><strong>Sắp xếp theo</strong>
     {projectSorts.map(([key,label])=><button type="button" key={key} aria-pressed={(params.get('sort')||'newest')===key}
       onClick={()=>change('sort',key==='newest'?'':key)}>{label}</button>)}
   </div>
 </div>
 <ProjectFilterDialog dialogRef={dialogRef} queryString={queryString} onClose={()=>setFiltersOpen(false)} onApply={query=>{
   if(appliedKeyword)query.set('q',appliedKeyword);
   navigate(query);
 }}/>
 <div className="p2-active-filters" aria-label="Bộ lọc đang áp dụng">{Object.entries(filterLabels).filter(([key])=>params.get(key)).map(([key,label])=><button type="button" key={key} onClick={()=>remove(key)} aria-label={`Xóa lọc ${label}`}>{label}: {key==='category'?categoryLabels[params.get(key)!]||params.get(key):params.get(key)} ×</button>)}{Object.keys(filterLabels).some(key=>params.get(key))&&<a href="/projects">Xóa tất cả</a>}</div>
 {showProjectWatch&&category&&Object.hasOwn(categoryLabels,category)&&<div className="watch-panel"><strong>Nhận tin dự án mới trong lĩnh vực {categoryLabels[category]}</strong> <a href={'/account/project-watch?category='+encodeURIComponent(category)}>Theo dõi lĩnh vực →</a></div>}
 <section className="p2-market-results" aria-labelledby="project-results-title"><div className="p2-result-heading"><div><h2 id="project-results-title">Dự án đang công bố</h2><p>{loading?'Đang tìm dự án…':result?`${result.pagination.total.toLocaleString('vi-VN')} dự án phù hợp`:'Chưa tải được kết quả'}</p></div><a href="/become-seller">Bạn có nguồn tin? Trở thành nhà cung cấp →</a></div>
 {loading&&<div className="p2-card-grid" role="status" aria-label="Đang tải dự án">{[1,2,3,4,5,6].map(value=><div className="p2-card-skeleton" key={value}><i/><span/><span/></div>)}</div>}
 {!loading&&error&&<div className="p2-empty" role="alert"><h3>Chưa thể hiển thị dự án</h3><p>{error}</p><button type="button" className="button button-secondary" onClick={()=>setRetry(retry+1)}>Thử lại</button><a href="/projects">Xóa bộ lọc</a></div>}
 {!loading&&!error&&result&&<>{result.data.length?<div className="p2-card-grid">{result.data.map(project=><ProjectCard project={project} key={project.id}/>)}</div>:<div className="p2-empty"><Icon name="search" size={35}/><h3>Chưa có dự án phù hợp</h3><p>Thử mở rộng khu vực, danh mục hoặc khoảng giá.</p><a href="/projects">Xem tất cả dự án</a></div>}{result.pagination.page<Math.min(10000,result.pagination.totalPages)&&<LoadMoreButton label="dự án"
   remaining={result.pagination.total-result.pagination.page*result.pagination.pageSize} busy={moreBusy} error={moreError} onClick={loadMore}/>}
   </>}
 </section><p className="p2-market-safety"><Icon name="shield" size={18}/>Thông tin liên hệ và tài liệu thương mại được bảo vệ. Mở chi tiết dự án để xem giá và xác nhận mua bằng POINT.</p></main>;
}
