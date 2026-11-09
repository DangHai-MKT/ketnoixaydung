import { siteIdentity } from '../../../lib/site/navigation';
import {privateRobots,publicMetadata} from '../../../lib/site/seo';
import {cmsEnabled,listPublishedCategories,listPublishedNews} from '../../../services/cms';
import NewsFeed from '../../../components/NewsFeed';
import {newsListQuery,newsPageSize} from '../../../lib/cms/news-list';
import Icon from '../../../components/MarketplaceIcon';

export const dynamic='force-dynamic';
type Props={searchParams:Promise<Record<string,string|string[]|undefined>>};

export async function generateMetadata({searchParams}:Props) {
  const metadata=publicMetadata('/news','Tin tức và thị trường xây dựng',`Bài viết và cập nhật đã xuất bản từ ${siteIdentity.name}.`);
  return !cmsEnabled()||Object.keys(await searchParams).length?{...metadata,robots:privateRobots}:metadata;
}

export default async function NewsPage({searchParams}:Props) {
  const {q,category,page}=newsListQuery(await searchParams);
  const [batch,categories]=await Promise.all([listPublishedNews(q,category,page,newsPageSize,true),listPublishedCategories()]);
  const rows=batch.rows;
  const filtered=Boolean(q||category);
  const href=(n:number,selected=category)=>{
    const query=new URLSearchParams();
    if(q)query.set('q',q);
    if(selected)query.set('category',selected);
    if(n>1)query.set('page',String(n));
    return '/news'+(query.size?'?'+query:'');
  };
  return <main className="news-page cms-public">
    <header className="news-hero"><div className="news-container">
      <nav aria-label="Đường dẫn"><ol className="editorial-crumbs"><li><a href="/">Trang chủ</a></li><li aria-current="page">Tin tức</li></ol></nav>
      <div className="news-hero-copy"><span className="news-eyebrow">{siteIdentity.name}</span>
        <h1>Tin tức &amp; thị trường</h1>
        <p>Cập nhật về ngành xây dựng và những thông tin mới từ nền tảng.</p>
      </div>
    </div></header>
    <div className="news-container news-feed">
      {cmsEnabled()&&<div className="news-toolbar">
        <form className="cms-filter news-filter">
          <label>Tìm bài viết<input type="search" name="q" maxLength={100} defaultValue={q} placeholder="Nhập từ khóa…"/></label>
          <label>Chuyên mục<select name="category" defaultValue={category}><option value="">Tất cả chuyên mục</option>
            {category&&!categories.some(row=>row.slug===category)&&<option value={category}>Chuyên mục không còn hiển thị</option>}
            {categories.map(row=><option value={row.slug} key={row.id}>{row.name}</option>)}
          </select></label><button className="button button-primary">Tìm kiếm</button>
        </form>
        {categories.length>0&&<nav className="news-topics" aria-label="Chuyên mục tin tức">
          <a href={href(1,'')} aria-current={!category?'page':undefined}>Tất cả</a>
          {categories.map(row=><a key={row.id} href={href(1,row.slug)} aria-current={category===row.slug?'page':undefined}>{row.name}</a>)}
        </nav>}
      </div>}
      <section aria-labelledby="news-feed-title">
        <div className="news-section-heading"><h2 id="news-feed-title">{filtered?'Kết quả tìm kiếm':'Bài viết mới nhất'}</h2>
          {filtered&&<a href="/news">Xóa bộ lọc</a>}</div>
        {!rows.length&&<div className="news-empty"><span aria-hidden="true"><Icon name="book" size={32}/></span>
          <h3>{filtered?'Không tìm thấy bài phù hợp':page>1?'Trang này chưa có bài viết':'Chưa có bài viết được xuất bản'}</h3>
          <p>{filtered?'Thử từ khóa khác hoặc chọn tất cả chuyên mục.':'Bạn có thể xem cẩm nang và tìm dự án đang công bố trên sàn.'}</p>
          <a className="button button-secondary" href={filtered||page>1?'/news':'/guides'}>{filtered||page>1?'Về danh sách tin':'Xem cẩm nang'}</a>
        </div>}
        {rows.length>0&&<NewsFeed key={JSON.stringify([q,category,page])} q={q} category={category}
          initial={{...batch,page,rows:rows.map(row=>({...row,publishedAt:row.publishedAt.toISOString()}))}}/>}
      </section>
    </div>
  </main>;
}
