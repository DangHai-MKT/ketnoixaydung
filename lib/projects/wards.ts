import catalogue from './vietnam-wards.json';
import historicalNames from './vietnam-ward-aliases.json';
const wards:Readonly<Record<string,readonly string[]>>=catalogue;
const aliases:Readonly<Record<string,Readonly<Record<string,string>>>>=historicalNames;
const key=(value:string)=>value.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replaceAll('đ','d').replace(/[^a-z0-9]/g,'');
/** Only documented one-to-one name/type changes; never infer a split boundary. */
export function canonicalWard(province:string,value:string):string {
  if(!Object.hasOwn(wards,province)||!value.trim())return '';
  const current=wards[province],names=Object.hasOwn(aliases,province)?aliases[province]:{};
  if(current.includes(value))return value;
  const matches=new Set([...current.filter(name=>key(name)===key(value)),...Object.entries(names).filter(([name])=>key(name)===key(value)).map(([,name])=>name)]);
  return matches.size===1?[...matches][0]:'';
}
export function wardFilterAliases(province:string,value:string):string[] {
  const current=canonicalWard(province,value);
  if(!current)return [];
  const names=Object.hasOwn(aliases,province)?aliases[province]:{};
  return [...new Set([current,...Object.entries(names).filter(([,name])=>name===current).map(([name])=>name)])];
}
