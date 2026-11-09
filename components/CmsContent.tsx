import type {Block,CmsInput} from '../lib/cms/content';
import {safeHref} from '../lib/cms/content';
import type {ReactNode} from 'react';

export function CmsImage({id,alt,preview=false,priority=false}: {id:string;alt:string;preview?:boolean;priority?:boolean}) {
  return <img className="cms-image" src={(preview?'/api/admin/cms/media/':'/api/cms/media/')+id}
    alt={alt} loading={priority?'eager':'lazy'} fetchPriority={priority?'high':undefined} decoding="async"/>;
}

function Inline({text}:{text:string}) {
  return text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/).map((part,i)=>{
    if (part.startsWith('**') && part.endsWith('**') && part.length>4) return <strong key={i}>{part.slice(2,-2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*') && part.length>2) return <em key={i}>{part.slice(1,-1)}</em>;
    return part;
  });
}
function ContentBlock({block,preview,headingId}:{block:Block;preview:boolean;headingId?:string}) {
  switch(block.type) {
    case 'heading': return <h2 id={headingId}>{block.text}</h2>;
    case 'paragraph': return <p className="cms-paragraph"><Inline text={block.text}/></p>;
    case 'quote': return <blockquote><Inline text={block.text}/></blockquote>;
    case 'list': return <ul>{block.text.split('\n').filter(line=>line.trim()).map((line,i)=><li key={i}><Inline text={line}/></li>)}</ul>;
    case 'link': {
      let href: string;
      try {href=safeHref(block.href);} catch {return preview&&block.text?<p>{block.text}</p>:null;}
      return <p><a href={href} rel={href.startsWith('/')?undefined:'noopener noreferrer'}>{block.text}</a></p>;
    }
    case 'image': return block.mediaId?<figure><CmsImage id={block.mediaId} alt={block.alt} preview={preview}/>{block.caption&&<figcaption>{block.caption}</figcaption>}</figure>:null;
  }
}
export default function CmsContent({content,preview=false,byline,outline=false}:{content:CmsInput;preview?:boolean;byline?:ReactNode;outline?:boolean}) {
  const headings=outline?content.blocks.flatMap((block,index)=>block.type==='heading'?[{text:block.text,id:'muc-'+(index+1)}]:[]):[];
  return <article className="cms-article">
    <header className="cms-article-intro">
    {byline}
    <h1>{content.title}</h1>
    {content.summary&&<p className="cms-lead">{content.summary}</p>}
    </header>
    {content.featuredMediaId&&<CmsImage id={content.featuredMediaId} alt={content.featuredAlt} preview={preview} priority/>}
    <div className={headings.length?'info-reading-grid':undefined}>
      {headings.length>0&&<nav className="info-outline" aria-label="Mục lục trang"><strong>Trên trang này</strong><ul>
        {headings.map(heading=><li key={heading.id}><a href={'#'+heading.id}>{heading.text}</a></li>)}
      </ul></nav>}
      <div className="cms-article-body">{content.blocks.map((block,i)=><ContentBlock key={i} block={block} preview={preview} headingId={outline?'muc-'+(i+1):undefined}/>)}</div>
    </div>
  </article>;
}
