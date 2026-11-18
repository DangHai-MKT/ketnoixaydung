import {redirect} from 'next/navigation';

export default async function Page({searchParams}:{searchParams:Promise<{q?:string;province?:string;page?:string}>}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ['q','province','page'] as const) if (typeof params[key] === 'string') query.set(key,params[key]);
  redirect('/find-partners'+(query.size?'?'+query:'')+'#ket-qua');
}
