import PurchaseChat from '../../../../../components/PurchaseChat';

export default async function Page({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const [{ id }, { page }] = await Promise.all([params, searchParams]);
  return <PurchaseChat id={id} side="buyer" page={page} />;
}
