import assert from 'node:assert/strict';
import test from 'node:test';
import {loadTs} from '../seller/load-typescript.mjs';

const {publicOrigin, publicMetadata, breadcrumbJson, homeStructuredData} = await import(await loadTs(new URL('../../lib/site/seo.ts', import.meta.url)));
const {editorialPages} = await import(await loadTs(new URL('../../lib/site/editorial.ts', import.meta.url)));

test('Canonical origin requires configured HTTPS and never uses an isolated test domain', () => {
  for (const value of ['', 'http://market.example.com', 'https://localhost', 'https://127.0.0.1',
    'https://market.test', 'https://name:secret@market.example.com', 'https://market.example.com/news']) {
    assert.equal(publicOrigin(value), undefined);
  }
  assert.equal(publicOrigin('https://market.example.com/'), 'https://market.example.com');
});

test('Editorial metadata and breadcrumbs use canonical URLs and escape script terminators', t => {
  const prior = process.env.SITE_URL;
  t.after(() => { if (prior === undefined) delete process.env.SITE_URL; else process.env.SITE_URL = prior; });
  process.env.SITE_URL = '';
  assert.equal(publicMetadata('/about', 'Giới thiệu', 'Mô tả').robots.index, false);
  assert.equal(breadcrumbJson([]), null);
  assert.equal(homeStructuredData(), null);
  process.env.SITE_URL = 'https://ketnoixaydung.vn';
  const titles = new Set();
  for (const [path, page] of Object.entries(editorialPages)) {
    const metadata = publicMetadata(path, page.title, page.description);
    assert.equal(metadata.alternates.canonical, 'https://ketnoixaydung.vn' + path);
    assert.equal(metadata.openGraph.url, metadata.alternates.canonical);
    assert.equal(metadata.openGraph.siteName, 'Kết Nối Xây Dựng');
    titles.add(metadata.title);
  }
  assert.equal(titles.size, 6);
  const graph = JSON.parse(homeStructuredData())['@graph'];
  assert.equal(graph[0]['@type'], 'Organization');
  assert.equal(graph[1].publisher['@id'], graph[0]['@id']);
  const fallback = publicMetadata('/projects', 'Dự án', ' ');
  assert.ok(fallback.description);
  assert.match(fallback.openGraph.images[0].url, /construction-hero-v2\.webp$/);
  const custom = publicMetadata('/projects', 'Dự án', 'a'.repeat(200), '/images/project.webp');
  assert.equal(custom.description.length, 160);
  assert.equal(custom.twitter.images[0].url, 'https://ketnoixaydung.vn/images/project.webp');
  const json = breadcrumbJson([{label:'</script>', path:'/projects'}]);
  assert.ok(!json.includes('<'));
  assert.equal(JSON.parse(json).itemListElement[0].name, '</script>');
});
