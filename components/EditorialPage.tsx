import {editorialPages, type EditorialPath} from '../lib/site/editorial';
import {breadcrumbJson, publicMetadata} from '../lib/site/seo';

export function editorialMetadata(path: EditorialPath) {
  const page = editorialPages[path];
  return publicMetadata(path, page.title, page.description);
}

export default function EditorialPage({path}: {path: EditorialPath}) {
  const page = editorialPages[path];
  const crumbs = [
    {label: 'Trang chủ', path: '/'},
    ...(path.startsWith('/guides/') ? [{label: 'Hướng dẫn', path: '/guides'}] : []),
    {label: page.title, path},
  ];
  const json = breadcrumbJson(crumbs);
  return <main className="editorial-page">
    {json && <script type="application/ld+json" dangerouslySetInnerHTML={{__html: json}} />}
    <nav aria-label="Đường dẫn"><ol className="editorial-crumbs">
      {crumbs.map((item, index) => <li key={item.path}>{index === crumbs.length - 1
        ? <span aria-current="page">{item.label}</span> : <a href={item.path}>{item.label}</a>}</li>)}
    </ol></nav>
    <header className="info-masthead"><span className="news-eyebrow">Thông tin nền tảng</span><h1>{page.title}</h1><p>{page.description}</p></header>
    <div className="editorial-grid">
      <nav aria-label="Mục lục" className="editorial-toc"><strong>Trên trang này</strong><ol>
        {page.sections.map((section, index) => <li key={section.title}><a href={'#muc-' + (index + 1)}>{section.title}</a></li>)}
      </ol></nav>
      <article>
        {page.sections.map((section, index) => <section key={section.title} id={'muc-' + (index + 1)}><h2>{section.title}</h2><p>{section.text}</p></section>)}
        <nav aria-label="Bước tiếp theo" className="editorial-actions">{page.links.map(link => <a key={link.href} href={link.href}>{link.label} →</a>)}</nav>
      </article>
    </div>
  </main>;
}
