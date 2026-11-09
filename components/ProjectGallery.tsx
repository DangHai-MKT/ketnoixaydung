'use client';
import {useState} from 'react';
import Icon from './MarketplaceIcon';

type Image={id:string;url:string;label:string};
export default function ProjectGallery({images,title}:{images:Image[];title:string}) {
  const [selected,setSelected]=useState(0),[failed,setFailed]=useState<string|null>(null);
  const index=Math.min(selected,Math.max(0,images.length-1));
  const active=images[index];
  function select(next:number) {setSelected(next);setFailed(null);}
  return <div className="pd-gallery">
    <div className="pd-frame">
      {active&&failed!==active.url?<a href={active.url} target="_blank" rel="noopener noreferrer" aria-label={'Mở ảnh gốc: '+active.label}>
        <img key={active.id} src={active.url} alt={title+' — '+active.label} onError={()=>setFailed(active.url)} decoding="async"/>
        <span className="pd-zoom">Xem ảnh gốc ↗</span>
      </a>:<div className="pd-no-image"><Icon name="industrial" size={42}/><p>{active?'Không thể tải ảnh':'Dự án chưa có ảnh công khai'}</p></div>}
      {images.length>1&&<>
        <button type="button" className="pd-gallery-prev" aria-label="Ảnh trước" onClick={()=>select((index+images.length-1)%images.length)}>‹</button>
        <button type="button" className="pd-gallery-next" aria-label="Ảnh sau" onClick={()=>select((index+1)%images.length)}>›</button>
        <span className="pd-gallery-count" aria-live="polite">{index+1} / {images.length}</span>
      </>}
    </div>
    {images.length>1&&<div className="pd-thumbs" role="group" aria-label="Chọn ảnh dự án">
      {images.map((image,i)=><button type="button" key={image.id} aria-label={'Xem '+image.label} aria-pressed={index===i} onClick={()=>select(i)}>
        <img src={image.url} alt="" loading="lazy" decoding="async"/>
      </button>)}
    </div>}
  </div>;
}

