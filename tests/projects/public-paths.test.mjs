import assert from 'node:assert/strict';import test from 'node:test';import {loadTs} from '../seller/load-typescript.mjs';
const {projectPath,companyPublicPath,isPublicSlug,publicQuery}=await import(await loadTs(new URL('../../lib/site/public-paths.ts',import.meta.url)));
const {legacyPublicResponse}=await import(await loadTs(new URL('../../lib/site/legacy-public-url.ts',import.meta.url)));
const {projectSeo,companySeo}=await import(await loadTs(new URL('../../lib/site/detail-seo.ts',import.meta.url)));
test('Public URLs use Vietnamese descriptive roots without leaking UUIDs',()=>{
 assert.equal(projectPath({id:'SECRET_UUID',publicSlug:'nha-xuong-bac-ninh'}),'/du-an/nha-xuong-bac-ninh');
 assert.equal(companyPublicPath('SECRET_UUID','xay-dung-truong-giang'),'/doanh-nghiep/xay-dung-truong-giang');
 assert.equal(projectPath({id:'legacy'}),'/projects/legacy');
 for(const bad of ['../admin','unsafe?x=1','https://other.example','Ten Co Dau','x'.repeat(221)])assert(!isPublicSlug(bad));
});
test('Legacy redirects preserve search state without introducing a second question mark',()=>{
 const q=publicQuery({q:'Cơ điện',province:'Đồng Nai',page:'2',tag:['a','b']});const parsed=new URL('http://localhost/doanh-nghiep/test'+q);
 assert.equal(parsed.searchParams.get('q'),'Cơ điện');assert.equal(parsed.searchParams.get('page'),'2');assert.deepEqual(parsed.searchParams.getAll('tag'),['a','b']);assert.equal(publicQuery(), '');
});
test('Canonical, social URLs and structured data all use the friendly URL',t=>{
 const old=process.env.SITE_URL;process.env.SITE_URL='https://ketnoixaydung.vn';t.after(()=>{if(old===undefined)delete process.env.SITE_URL;else process.env.SITE_URL=old;});
 const company=companySeo({id:'SECRET_UUID',publicSlug:'xay-dung-truong-giang',name:'Xây dựng Trường Giang',province:'Đồng Nai',trade:'Thi công'});
 assert.equal(company.metadata.alternates.canonical,'https://ketnoixaydung.vn/doanh-nghiep/xay-dung-truong-giang');assert(!company.json.includes('SECRET_UUID'));
 const project=projectSeo({id:'SECRET_UUID',publicSlug:'nha-xuong-bac-ninh',title:'Nhà xưởng Bắc Ninh',category:'industrial',provinceCode:'Bắc Ninh',publicSummary:'Mô tả công khai',publicData:{},publishedAt:null});
 assert.equal(project.metadata.openGraph.url,'https://ketnoixaydung.vn/du-an/nha-xuong-bac-ninh');assert(!project.json.includes('SECRET_UUID'));
});


test('Legacy handlers issue actual permanent HTTP redirects and private missing pages',async()=>{
 const redirect=legacyPublicResponse('/du-an/nha-xuong-bac-ninh','?q=co-dien','project');assert.equal(redirect.status,308);assert.equal(redirect.headers.get('Location'),'/du-an/nha-xuong-bac-ninh?q=co-dien');
 const missing=legacyPublicResponse(null,'','company');assert.equal(missing.status,404);assert.equal(missing.headers.get('X-Robots-Tag'),'noindex');assert((await missing.text()).includes('/find-partners'));
});
