import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const read=p=>readFile(new URL('../../'+p,import.meta.url),'utf8');
const url=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const compile=code=>url(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
const data=await read('lib/projects/vietnam-ward-conversion.json');
const locations=compile(await read('lib/projects/locations.ts'));
const {resolveCompanyAddress,enrichCompanyAddress}=await import(compile((await read('lib/site/company-address.ts'))
  .replace('../projects/vietnam-ward-conversion.json',url('export default '+data))
  .replace('../projects/locations',locations)));

test('Converts a complete old address and preserves the original street and source',()=>{
  const original='12 đường A, P. Quán Thánh, Q. Ba Đình, Hà Nội';
  const result=resolveCompanyAddress(original,'Hà Nội');
  assert.equal(result.status,'converted');
  assert.equal(result.ward,'Phường Ba Đình');
  assert.equal(result.wardCode,'00004');
  assert.equal(result.originalAddress,original);
  assert.equal(result.address,'12 đường A, Phường Ba Đình, Hà Nội');
  const c=enrichCompanyAddress({province:'Hà Nội',profile:{address:original,phone:'0901234567'}});
  assert.equal(c.profile.ward,result.ward);
  assert.equal(c.profile.phone,'0901234567');
  assert.equal(c.profile.addressOriginal,original);
});

test('District distinguishes identically numbered old wards',()=>{
  const a=resolveCompanyAddress('12 đường A, Phường 12, Quận Gò Vấp, TP. Hồ Chí Minh','TP. Hồ Chí Minh');
  const b=resolveCompanyAddress('12 đường A, Phường 12, Quận Bình Thạnh, TP. Hồ Chí Minh','TP. Hồ Chí Minh');
  assert.equal(a.ward,'Phường An Hội Tây');
  assert.equal(b.ward,'Phường Bình Thạnh');
  assert.notEqual(a.wardCode,b.wardCode);
});

test('Recognizes a current address and never treats street names as wards',()=>{
  assert.equal(resolveCompanyAddress('12 đường A, Phường Ba Đình, Hà Nội','Hà Nội').status,'current');
  assert.equal(resolveCompanyAddress('12 đường Ba Đình, Hà Nội','Hà Nội').status,'review');
  assert.equal(resolveCompanyAddress('12 đường A, Phường 12, TP. Hồ Chí Minh','TP. Hồ Chí Minh').status,'review');
});

test('Partial boundary transfers and incorrect CSV ward require review',()=>{
  const result=resolveCompanyAddress('12 đường A, Phường Ngọc Hà, Quận Ba Đình, Hà Nội','Hà Nội');
  assert.equal(result.status,'review');
  assert.equal(result.ward,'');
  assert.equal(resolveCompanyAddress('12 đường A, Phường Quán Thánh, Quận Ba Đình, Hà Nội','Hà Nội','Phường An Hội Tây').status,'review');
  assert.equal(resolveCompanyAddress('12 đường A, Phường Quán Thánh, Quận Ba Đình, Hà Nội','Hà Nội','Phường Ngọc Hà').status,'review');
});

test('Two separate addresses cannot silently become a single ward',()=>{
  const address='12 A, Phường Quán Thánh, Quận Ba Đình; 14 B, Phường Cửa Nam, Quận Hoàn Kiếm, Hà Nội';
  const r=resolveCompanyAddress(address,'Hà Nội');
  assert.equal(r.status,'review');assert.equal(r.address,address);
});

test('A conflicting province never receives an automatically converted ward',()=>{
  const r=resolveCompanyAddress('12 A, Phường Quán Thánh, Quận Ba Đình, TP. Hồ Chí Minh','Hà Nội');
  assert.equal(r.status,'review');assert.equal(r.ward,'');
});
