import {newsListQuery,newsPageSize} from '../../../lib/cms/news-list';
import {listPublishedNews} from '../../../services/cms';
import {accessErrorResponse} from '../../../lib/auth/server';

export async function GET(request:Request) {
  try {
    const {q,category,page}=newsListQuery(Object.fromEntries(new URL(request.url).searchParams));
    return Response.json({...await listPublishedNews(q,category,page,newsPageSize,true),page},
      {headers:{'Cache-Control':'no-store'}});
  } catch(error) {return accessErrorResponse(error);}
}
