export const newsPageSize = 12;
export function newsListQuery(params: {q?:unknown;category?:unknown;page?:unknown}) {
  const n=typeof params.page==='string'&&/^[1-9]\d{0,4}$/.test(params.page)?Number(params.page):1;
  return {
    page:n<=10000?n:1,
    q:typeof params.q==='string'?params.q.trim().slice(0,100):'',
    category:typeof params.category==='string'?params.category.slice(0,100):'',
  };
}
export type NewsListItem={slug:string;publishedAt:string;category:string|null;title:string;summary:string;imageId:string|null;alt:string};
export type NewsBatch={rows:NewsListItem[];hasNext:boolean;total:number;page:number};
