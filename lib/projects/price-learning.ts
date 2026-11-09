import {AccessError} from '../auth/permissions';
import {categoryLabels} from './workflow';
import {provinceLabel} from './locations';
import {contactPattern} from './privacy';
export type PriceContext={category:string;provinceCode:string;projectStage:string;constructionType:string;sizeMinSqm:string;sizeMaxSqm:string};
export type PriceSample=PriceContext&{projectId:string;sellerId:string;points:string;completedAt:number};
export function priceContextInput(input:unknown):PriceContext{
 const keys=['category','provinceCode','projectStage','constructionType','sizeMinSqm','sizeMaxSqm'];if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!keys.includes(k)))throw new AccessError(400,'Chỉ gửi danh mục, khu vực, loại công trình, giai đoạn và quy mô để gợi ý giá.');const d=input as Record<string,unknown>,result={} as PriceContext;
 for(const key of keys as (keyof PriceContext)[]){const value=d[key]??'';if(typeof value!=='string'||value.length>({category:100,provinceCode:20,projectStage:80,constructionType:120,sizeMinSqm:15,sizeMaxSqm:15}[key])||/[\u0000-\u001f\u007f]/.test(value)||(!key.startsWith('size')&&new RegExp(contactPattern,'i').test(value)))throw new AccessError(400,'Thông tin gợi ý giá chưa hợp lệ. Không gửi thông tin liên hệ hoặc nội dung bảo vệ.');result[key]=value.trim();}
 if(!Object.hasOwn(categoryLabels,result.category))throw new AccessError(400,'Chọn danh mục trước khi phân tích giá.');for(const v of [result.sizeMinSqm,result.sizeMaxSqm])if(v&&!/^\d{1,12}(\.\d{1,2})?$/.test(v))throw new AccessError(400,'Quy mô dự án chưa hợp lệ.');if(result.sizeMinSqm&&result.sizeMaxSqm&&Number(result.sizeMinSqm)>Number(result.sizeMaxSqm))throw new AccessError(400,'Quy mô tối đa phải lớn hơn hoặc bằng tối thiểu.');return result;
}
const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/[^a-z0-9]/g,'');
const area=(v:PriceContext)=>Math.log1p(Number(v.sizeMaxSqm||v.sizeMinSqm||0));
const recency=(v:PriceSample,now:number)=>Math.exp(-(now-v.completedAt)/86400000/90);
function quantile(values:{value:number;weight:number}[],q:number){const sorted=[...values].sort((a,b)=>a.value-b.value),total=sorted.reduce((n,v)=>n+v.weight,0);let current=0;for(const item of sorted){current+=item.weight;if(current>=total*q)return item.value;}return sorted.at(-1)?.value??0;}
function reference(samples:PriceSample[],now:number,q=.5){return quantile(samples.map(s=>({value:Math.log(Number(s.points)),weight:recency(s,now)})),q);}
type Setting={k:number;weights:number[]};
const settings:Setting[]=[{k:5,weights:[1,1,1,.5]},{k:9,weights:[1,1,1,.5]},{k:9,weights:[.4,1,1,1]},{k:15,weights:[1,.5,1,1]}];
function distance(a:PriceContext,b:PriceContext,w:number[]){return w[0]*(norm(provinceLabel(a.provinceCode))===norm(provinceLabel(b.provinceCode))?0:1)+w[1]*(norm(a.projectStage)===norm(b.projectStage)?0:1)+w[2]*(norm(a.constructionType)===norm(b.constructionType)?0:1)+w[3]*(area(a)&&area(b)?Math.min(2,Math.abs(area(a)-area(b))/2):area(a)===area(b)?0:1);}
function predict(data:PriceSample[],target:PriceContext,setting:Setting,now:number){const neighbors=data.map(s=>({s,d:distance(s,target,setting.weights)})).sort((a,b)=>a.d-b.d||b.s.completedAt-a.s.completedAt||a.s.projectId.localeCompare(b.s.projectId)).slice(0,setting.k);return quantile(neighbors.map(({s,d})=>({value:Math.log(Number(s.points)),weight:recency(s,now)/(0.2+d)})),.5);}
export type PriceSuggestion={status:'insufficient'|'available';method:'none'|'comparables'|'learned';suggestedPoints:string|null;lowerPoints:string|null;upperPoints:string|null;confidence:'insufficient'|'limited'|'moderate';sampleCount:number;sellerCount:number;message:string;learning:{version:string;validated:boolean};asOf:string};
export function learnProjectPrice(raw:PriceSample[],target:PriceContext,options:{now?:number;maxPoints?:string}={}):PriceSuggestion{
 const now=options.now??Date.now(),cap=BigInt(options.maxPoints||'1000000000');if(cap<1n)throw new AccessError(503,'Giới hạn giá chưa sẵn sàng.');const max=Number(cap<1000000000n?cap:1000000000n),window=180*86400000,seen=new Set<string>(),perSeller=new Map<string,number>();
 let data=raw.filter(s=>s.category===target.category&&/^[1-9]\d{0,9}$/.test(s.points)&&Number(s.points)<=max&&s.completedAt<=now&&s.completedAt>=now-window).sort((a,b)=>b.completedAt-a.completedAt||a.projectId.localeCompare(b.projectId)).filter(s=>{if(seen.has(s.projectId))return false;seen.add(s.projectId);return true;});
 if(data.length){const lo=reference(data,now,.25),hi=reference(data,now,.75),spread=Math.max(Math.log(2),1.5*(hi-lo));data=data.filter(s=>Math.log(Number(s.points))>=lo-spread&&Math.log(Number(s.points))<=hi+spread);}
 data=data.filter(s=>{const n=perSeller.get(s.sellerId)||0;if(n>=10)return false;perSeller.set(s.sellerId,n+1);return true;}).slice(0,120);
 const sellers=[...new Set(data.map(s=>s.sellerId))].sort(),base={sampleCount:data.length,sellerCount:sellers.length,asOf:new Date(now).toISOString()};
 if(data.length<12||sellers.length<3)return {...base,sampleCount:0,sellerCount:0,status:'insufficient',method:'none',suggestedPoints:null,lowerPoints:null,upperPoints:null,confidence:'insufficient',learning:{version:'project-knn-v1',validated:false},message:'Chưa đủ giao dịch hợp lệ từ nhiều nhà cung cấp để đề xuất giá. Bạn có thể chọn nhanh hoặc tự nhập giá POINT.'};
 let best:Setting|undefined,bestError=Infinity,baselineError=Infinity,residuals:number[]=[];
 if(data.length>=24&&sellers.length>=5){for(const candidate of settings){let error=0,baseline=0,weight=0;const errors:number[]=[];for(let fold=0;fold<Math.min(5,sellers.length);fold++){const train=data.filter(s=>sellers.indexOf(s.sellerId)%5!==fold),validation=data.filter(s=>sellers.indexOf(s.sellerId)%5===fold);if(train.length<8)continue;const median=reference(train,now);for(const sample of validation){const w=recency(sample,now),actual=Math.log(Number(sample.points)),e=Math.abs(predict(train,sample,candidate,now)-actual);error+=w*e;baseline+=w*Math.abs(median-actual);weight+=w;errors.push(e);}}if(weight&&error/weight<bestError){bestError=error/weight;baselineError=baseline/weight;best=candidate;residuals=errors;}}}
 const localPeers=data.filter(sample=>
   norm(provinceLabel(sample.provinceCode))===norm(provinceLabel(target.provinceCode))&&
   norm(sample.projectStage)===norm(target.projectStage)&&
   norm(sample.constructionType)===norm(target.constructionType));
 const contextSupported=!!target.provinceCode&&!!target.projectStage&&!!target.constructionType&&
   new Set(localPeers.map(sample=>sample.sellerId)).size>=3;
 const learned=!!best&&contextSupported&&baselineError>0.01&&bestError<baselineError*.95&&bestError<.7;
 const estimate=learned?predict(data,target,best!,now):reference(data,now),spread=learned?Math.max(Math.log(1.2),quantile(residuals.map(value=>({value,weight:1})),.8)):0;
 const round=(log:number)=>{const value=Math.exp(log),increment=value<100?1:10;return String(Math.min(max,Math.max(1,Math.round(value/increment)*increment)));};
 const suggested=round(estimate),lower=round(learned?estimate-spread:reference(data,now,.25)),upper=round(learned?estimate+spread:reference(data,now,.75));
 return {...base,status:'available',method:learned?'learned':'comparables',suggestedPoints:suggested,lowerPoints:BigInt(lower)>BigInt(suggested)?suggested:lower,upperPoints:BigInt(upper)<BigInt(suggested)?suggested:upper,confidence:learned&&data.length>=50&&sellers.length>=8&&bestError<.35?'moderate':'limited',learning:{version:'project-knn-v1',validated:learned},message:learned?'Mức tham khảo được học từ giá giao dịch và đặc điểm các dự án tương tự. Bạn vẫn tự quyết định giá bán.':'Đang tham khảo khoảng giá giao dịch cùng danh mục; chưa đủ tín hiệu để cá nhân hóa đáng tin cậy cho dự án này.'};
}
