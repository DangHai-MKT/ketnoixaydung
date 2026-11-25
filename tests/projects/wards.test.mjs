import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const read=p=>readFile(new URL('../../'+p,import.meta.url),'utf8');
const json=async p=>JSON.parse(await read(p));
const wards=await json('lib/projects/vietnam-wards.json'),aliases=await json('lib/projects/vietnam-ward-aliases.json');
const conversion=await json('lib/projects/vietnam-ward-conversion.json');
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const helper=(await read('lib/projects/wards.ts')).replace('./vietnam-wards.json',url('export default '+JSON.stringify(wards))).replace('./vietnam-ward-aliases.json',url('export default '+JSON.stringify(aliases)));
const {canonicalWard,wardFilterAliases}=await import(url(ts.transpileModule(helper,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText));
test('All 3321 current coded units match the catalogue, with no duplicate choices',()=>{
  assert.equal(Object.keys(wards).length,34);assert.equal(Object.values(wards).flat().length,3321);assert.equal(conversion.current.length,3321);
  const province=s=>s==='Thành phố Hồ Chí Minh'?'TP. Hồ Chí Minh':s.replace(/^(Thành phố |Tỉnh )/,'');
  for(const [p,values] of Object.entries(wards)){assert.equal(new Set(values).size,values.length,p);assert(values.every(v=>/^(Phường|Xã|Đặc khu) /.test(v)),p);}
  for(const [p,name] of conversion.current)assert(wards[province(p)].includes(name),p+' / '+name);
  const names=new Map(conversion.current.map(([,name,code])=>[code,name]));
  for(const row of conversion.rows)assert.equal(row[4],names.get(row[5]));
});
test('Effective 2026 amendments add all 10 Dong Nai and 12 Bac Ninh wards',()=>{
  const changes={ 'Đồng Nai':['Lộc Ninh','Tân Khai','Đồng Phú','Tân Phú','Trị An','Trảng Bom','Dầu Giây','Long Thành','Xuân Lộc','Nhơn Trạch'],
    'Bắc Ninh':['Bố Hạ','Lạng Giang','Kép','Lục Nam','Hiệp Hoà','Yên Phong','Phù Lãng','Chi Lăng','Tiên Du','Gia Bình','Nhân Thắng','Lương Tài']};
  for(const [p,values] of Object.entries(changes))for(const name of values){assert(wards[p].includes('Phường '+name));assert(!wards[p].includes('Xã '+name));assert.equal(canonicalWard(p,'Xã '+name),'Phường '+name);assert.deepEqual(wardFilterAliases(p,'Phường '+name),['Phường '+name,'Xã '+name]);}
});
test('Historical spellings stay searchable only inside their own province',()=>{
  assert.equal(canonicalWard('Đắk Lắk','Xã Cư M’gar'),"Xã Cư M'gar");
  assert.equal(canonicalWard('Đồng Nai','xa loc ninh'),'Phường Lộc Ninh');
  assert.equal(canonicalWard('Hà Nội','Xã Lộc Ninh'),'');
  assert.equal(canonicalWard('__proto__','Phường Ba Đình'),'');
  for(const [p,values] of Object.entries(aliases))for(const [old,current] of Object.entries(values))assert.equal(canonicalWard(p,old),current);
});
test('Official Ea Kly name overrides the upstream misspelling and incorrect unit type',()=>{
  assert(wards['Đắk Lắk'].includes('Xã Ea Kly'));assert(!wards['Đắk Lắk'].includes('Phường Xa Ea Kly'));
  assert.equal(conversion.current.find(([,name,code])=>code==='24496')[1],'Xã Ea Kly');
});
