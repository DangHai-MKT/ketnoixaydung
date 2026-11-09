import { WalletDetail } from '../../../../../components/WalletHistory';
export default function Page({ params }: { params: Promise<{ id: string }> }) { return <WalletDetail params={params}/>; }
