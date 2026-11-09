import {requirePageActor} from '../lib/auth/server';
import {adminRoles} from '../lib/auth/permissions';
import {dashboardBase,type DashboardMode} from '../lib/dashboard/navigation';
import {verifiedSellerProfile} from '../lib/seller/server';
import {DashboardPanel} from './DashboardPanels';

export default async function WorkspaceHelp({mode}:{mode:DashboardMode}) {
  const base=dashboardBase(mode);
  const actor=await requirePageActor(`${base}/help`,mode==='admin'?adminRoles:undefined);
  const sellerEnabled=mode==='admin'?false:Boolean(await verifiedSellerProfile(actor));
  const review=actor.roles.some(role=>role==='super_admin'||role==='content_moderator');
  const finance=actor.roles.some(role=>role==='super_admin'||role==='finance_operator');
  const support=actor.roles.some(role=>role==='super_admin'||role==='support_operator');
  return <main><div className="dash-page-heading"><h1>Hỗ trợ &amp; hướng dẫn</h1><p>{mode==='admin'?'Hướng dẫn quản trị hệ thống.':'Hướng dẫn sử dụng tài khoản mua và bán thông tin.'}</p></div>
    {mode==='buyer'&&<DashboardPanel title="Tìm và xem thông tin dự án" icon="search"><p>Tìm nguồn tin công khai theo từ khóa, địa điểm, danh mục và giá POINT. Lịch sử đơn mua và ví chỉ hiển thị dữ liệu của bạn. Bạn có thể mua bằng POINT khả dụng trên trang dự án; thông tin đã mua được lưu theo đúng phiên bản trong Dự án đã mua.</p><a className="dash-outline" href="/projects">Khám phá dự án →</a><a className="dash-outline" href="/account/purchases">Đơn mua của tôi →</a><a className="dash-outline" href="/seller/help">Hướng dẫn bán thông tin →</a></DashboardPanel>}
    {mode==='seller'&&<DashboardPanel title="Đăng và quản lý nguồn tin" icon="helmet"><p>Hoàn thiện hồ sơ xác minh trước khi quản lý tin dự án. Bản đã gửi bị khóa; sửa bằng phiên bản đề xuất mới. Tin và giá công khai cũ được giữ nguyên trong thời gian xét duyệt.</p><a className="dash-outline" href="/seller/application">Hồ sơ nhà cung cấp →</a>{sellerEnabled&&<a className="dash-outline" href="/seller/projects">Dự án của tôi →</a>}</DashboardPanel>}
    {mode==='admin'&&<>
      {review&&<DashboardPanel title="Kiểm duyệt và xác minh" icon="shield"><p>Đối chiếu đúng phiên bản, quyền cung cấp, giá và tài liệu trước khi quyết định. Không tự duyệt tin của mình, không sao chép thông tin bảo vệ vào nội dung công khai.</p><a className="dash-outline" href="/admin/projects">Hàng chờ dự án →</a><a className="dash-outline" href="/admin/sellers">Xác minh nhà cung cấp →</a></DashboardPanel>}
      {actor.roles.includes('super_admin')&&<DashboardPanel title="Quản trị người dùng" icon="users"><p>Quản lý trạng thái và cấp thêm vai trò theo thẩm quyền. Không tự cấp quyền; giữ vai trò người mua và bảo vệ quản trị viên cuối cùng.</p><a className="dash-outline" href="/admin/users">Quản lý người dùng →</a></DashboardPanel>}
      {finance&&<DashboardPanel title="Báo cáo giao dịch" icon="wallet"><p>Xem báo cáo và phí trên đơn hoàn tất. Các thao tác xử lý nạp điểm, hoàn tiền và rút tiền chưa được mở trong khu vực này.</p><a className="dash-outline" href="/admin#admin-finance">Báo cáo tài chính →</a></DashboardPanel>}
      {support&&<DashboardPanel title="Hỗ trợ và khiếu nại" icon="help"><p>Xem tổng hợp khiếu nại trong phạm vi được cấp. Chức năng xử lý và nhắn tin hỗ trợ chưa được triển khai.</p><a className="dash-outline" href="/admin#admin-support">Tổng hợp khiếu nại →</a></DashboardPanel>}
    </>}
    <section id="dashboard-pricing"><DashboardPanel title="Giá và phí nền tảng" icon="wallet"><p>100.000 VND tương ứng 1.000 POINT. Phí nền tảng và thời gian giữ thu nhập được chốt theo chính sách tại thời điểm mua, hiển thị trên từng giao dịch. Rút tiền cần được quản trị viên xét duyệt; đến hạn không tự động chuyển tiền.</p><p className="dash-muted">Đây là thông tin chính sách; trang hướng dẫn không thực hiện giao dịch.</p></DashboardPanel></section>
    <DashboardPanel title="Bảo vệ tài khoản" icon="help"><p>Không chia sẻ mật khẩu hoặc hồ sơ xác minh qua kênh công khai. Các quyền mua và bán được áp dụng theo trạng thái tài khoản và hồ sơ xác minh.</p><a className="dash-outline" href={`${mode==='seller'?'/account':base}/profile`}>Thông tin tài khoản →</a><a className="dash-outline" href={`${mode==='seller'?'/account':base}/security`}>Bảo mật tài khoản →</a></DashboardPanel>
  </main>;
}
