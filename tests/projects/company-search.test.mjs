import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const read=p=>readFile(new URL('../../'+p,import.meta.url),'utf8');
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const compile=s=>url(ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
const locations=compile(await read('lib/projects/locations.ts'));
const wards=url('export default '+await read('lib/projects/vietnam-wards.json'));
const wardAliases=url('export default '+await read('lib/projects/vietnam-ward-aliases.json'));
const wardHelpers=compile((await read('lib/projects/wards.ts')).replace('./vietnam-wards.json',wards).replace('./vietnam-ward-aliases.json',wardAliases));
const {companySearch}=await import(compile((await read('lib/site/company-search.ts')).replace('../projects/locations',locations).replace('../projects/wards',wardHelpers)));
const publicPaths=compile(await read('lib/site/public-paths.ts'));
const {companyResultsPath}=await import(compile((await read('lib/site/company-display.ts')).replace('./public-paths',publicPaths)));
test('Invalid search parameters use bounded defaults and mismatched wards are discarded',()=>{
  const result=companySearch({q:['bad'],province:'unknown',ward:'Phường Ba Đình',size:'100000',page:'-1',sort:'random'});
  assert.deepEqual(result,{specialty:'',minYear:'',maxYear:'',keyword:'',province:'',ward:'',size:12,page:1,sort:'newest'});
  assert.equal(companySearch({page:'10000000000'}).page,1);
  assert.equal(companySearch({province:'Hà Nội',ward:'Phường Ba Đình'}).ward,'Phường Ba Đình');
});
test('Search preserves valid sort and size while bounding long keywords',()=>{
  const result=companySearch({q:'a'.repeat(200),size:'48',page:'9999',sort:'name_desc'});
  assert.equal(result.keyword.length,100);assert.equal(result.size,48);assert.equal(result.page,9999);assert.equal(result.sort,'name_desc');
});
test('Returning from a company profile preserves the search, ordering and page size',()=>{
  const result=new URL(companyResultsPath({q:'Cơ điện',province:'Hà Nội',page:'2',size:'24',sort:'name_asc'}),'http://localhost');
  for(const [key,value] of Object.entries({q:'Cơ điện',province:'Hà Nội',page:'2',size:'24',sort:'name_asc'}))assert.equal(result.searchParams.get(key),value);
  assert.equal(result.hash,'#ket-qua');
});


test('Company specialties, founding year and extended sorts are validated',()=>{
  const result=companySearch({specialty:'mep',minYear:'2000',maxYear:'2020',sort:'established'});
  assert.equal(result.specialty,'mep');assert.equal(result.minYear,'2000');assert.equal(result.maxYear,'2020');assert.equal(result.sort,'established');
  const bad=companySearch({specialty:'sql',minYear:'1799',maxYear:'9999'});
  assert.equal(bad.specialty,'');assert.equal(bad.minYear,'');assert.equal(bad.maxYear,'');
});
test('Profile return links preserve detailed company filters',()=>{
  const link=new URL(companyResultsPath({specialty:'steel',minYear:'2000',maxYear:'2020',sort:'oldest'}),'http://localhost');
  assert.equal(link.searchParams.get('specialty'),'steel');assert.equal(link.searchParams.get('minYear'),'2000');assert.equal(link.searchParams.get('sort'),'oldest');
});
