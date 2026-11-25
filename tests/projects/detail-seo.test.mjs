import assert from 'node:assert/strict';
import test from 'node:test';
import {loadTs} from '../seller/load-typescript.mjs';
const {projectSeo,companySeo}=await import(await loadTs(new URL('../../lib/site/detail-seo.ts',import.meta.url)));
const {publicMetadata}=await import(await loadTs(new URL('../../lib/site/seo.ts',import.meta.url)));
const project={id:'17ee60df-e4bd-4c86-a9ca-63dd85d37f2b',title:'Nhà máy vật liệu mới',category:'industrial',provinceCode:'HN',districtName:'Phường Ba Đình',projectStage:'Thiết kế',publicSummary:'Nhà máy có khu sản xuất và nhà điều hành.',publicData:{constructionType:'Nhà máy'},publishedAt:'2026-11-01T08:00:00Z',imageUrl:'/api/projects/17ee60df-e4bd-4c86-a9ca-63dd85d37f2b/files/public-image',files:[{url:'/api/projects/17ee60df-e4bd-4c86-a9ca-63dd85d37f2b/files/public-image'},{url:'/api/private/secret-image'}],privateData:{contactPhone:'0912345678',exactLocation:'PRIVATE_ADDRESS'},pricePoints:'1000'};
function origin(t){const old=process.env.SITE_URL;t.after(()=>{if(old===undefined)delete process.env.SITE_URL;else process.env.SITE_URL=old;});process.env.SITE_URL='https://ketnoixaydung.vn';}
test('Project metadata describes public location and links only approved public images',t=>{
  origin(t);const {metadata,json}=projectSeo(project);
  assert(metadata.title.includes('Hà Nội'));assert(metadata.description.includes('Thiết kế'));assert(metadata.description.includes('Phường Ba Đình'));
  assert.equal(metadata.alternates.canonical,'https://ketnoixaydung.vn/projects/'+project.id);assert.equal(metadata.openGraph.url,metadata.alternates.canonical);
  const graph=JSON.parse(json);assert.equal(graph['@type'],'WebPage');assert.equal(graph.datePublished,project.publishedAt.replace('Z','.000Z'));assert.equal(graph.image.length,1);
  for(const secret of ['0912345678','PRIVATE_ADDRESS','secret-image','priceCurrency','offers','rating'])assert(!json.includes(secret),secret);
});
test('Company schema only describes publicly visible organization information',t=>{
  origin(t);const input={id:'company',name:'Công ty Xây dựng An Bình',trade:'Thiết kế; Thi công',province:'Đồng Nai',year:'2012',market:'Miền Nam',website:'https://company.example.com',profile:{address:'PRIVATE_ADDRESS',phone:'0912345678',email:'secret@example.com',zalo:'https://zalo.me/private'},taxCode:'PRIVATE_TAX'};
  const {metadata,json}=companySeo(input);assert(metadata.title.includes('Đồng Nai'));assert(metadata.description.length<=160);
  const graph=JSON.parse(json)['@graph'];assert.equal(graph[1]['@type'],'Organization');assert.equal(graph[1].foundingDate,'2012');assert.equal(graph[1].areaServed,'Miền Nam');assert.equal(graph[0].mainEntity['@id'],graph[1]['@id']);
  for(const secret of ['PRIVATE_ADDRESS','0912345678','secret@example.com','zalo.me/private','PRIVATE_TAX','streetAddress','telephone','aggregateRating'])assert(!json.includes(secret),secret);
});
test('SEO ignores unsupported dates and URLs and escapes scripts',t=>{
  origin(t);const {json}=companySeo({id:'safe',name:'Doanh nghiệp </script><script>unsafe</script>',trade:'Thi công',province:'Hà Nội',year:'tomorrow',website:'javascript:alert(1)',publishedAt:'invalid'});
  assert(!json.includes('<'));const graph=JSON.parse(json)['@graph'];assert(!graph[0].datePublished);assert(!graph[1].foundingDate);assert(!graph[1].sameAs);
  assert.equal(publicMetadata('/projects','A','B','https://images.example.com/a.png').openGraph.images[0].url,'https://images.example.com/a.png');
  assert(publicMetadata('/projects','A','B','javascript:alert(1)').openGraph.images[0].url.endsWith('construction-hero-v2.webp'));
});
test('Local preview stays noindex with no production structured data',t=>{
  origin(t);process.env.SITE_URL='';assert.equal(projectSeo(project).metadata.robots.index,false);assert.equal(projectSeo(project).json,null);
  assert.equal(companySeo({id:'a',name:'A',trade:'B',province:'Hà Nội'}).json,null);
});
