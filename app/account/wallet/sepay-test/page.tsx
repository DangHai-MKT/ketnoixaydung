import {requirePageActor} from '../../../../lib/auth/server';
import {requireSepayEnvironment,sepayConfiguration} from '../../../../services/sepay-settings';
import {AccessError} from '../../../../lib/auth/permissions';
import {SepayCreate} from '../../../../components/SepayForms';
import {IdentityHeader} from '../../../../components/PhaseOneUI';
import {DashboardPanel} from '../../../../components/DashboardPanels';
import {getTopupRate} from '../../../../services/payments';
export default async function Page(){await requirePageActor('/account/wallet/sepay-test',['buyer']);let error='',pricing:Awaited<ReturnType<typeof getTopupRate>>|null=null;try{requireSepayEnvironment();await sepayConfiguration();pricing=await getTopupRate();}catch(e){if(!(e instanceof AccessError))throw e;error=e.message;}return <main className="fw-page"><IdentityHeader rootHref="/account/wallet" rootLabel="Ví điểm" title="Nạp POINT · SePay Test" description="Kiểm thử quy trình nạp và ghi nhận giao dịch, không dùng tiền thật."/><DashboardPanel title="Tạo đơn thử nghiệm" icon="wallet">{error?<p role="status">{error}</p>:pricing&&<SepayCreate pricing={pricing}/>}<a href="/account/wallet/top-ups">Lịch sử đơn nạp →</a></DashboardPanel></main>;}
