import { WalletHistory, type WalletSearchParams } from '../../../../components/WalletHistory';
export default function Page({ searchParams }: { searchParams: WalletSearchParams }) { return <WalletHistory searchParams={searchParams} seller/>; }
