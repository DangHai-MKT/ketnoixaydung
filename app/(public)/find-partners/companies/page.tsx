import {redirect} from 'next/navigation';

export default async function Page({searchParams}:{searchParams:Promise<{q?:string;province?:string;ward?:string;page?:string;sort?:string;size?:string}>}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ['q','province','ward','page','sort','size'] as const) if (typeof params[key] === 'string') query.set(key,params[key]);
  redirect('/find-partners'+(query.size?'?'+query:'')+'#ket-qua');
}
