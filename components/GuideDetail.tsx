import Icon from './MarketplaceIcon';
import {editorialPages} from '../lib/site/editorial';
import {breadcrumbJson} from '../lib/site/seo';
import {guideRoles,guideTopics} from '../lib/site/guide-topics';

const playbooks={
  buyer:{
    goal:'Tìm dự án phù hợp, kiểm tra giá và mở lại thông tin đã mua.',
    steps:[
      {icon:'search',tasks:['Mở trang Dự án và nhập tên hoặc từ khóa bạn quan tâm.','Bấm Lọc để chọn lĩnh vực, khu vực, giai đoạn hoặc khoảng giá.','Mở một dự án để xem ảnh, mô tả công khai và giá POINT.'],
        tip:'Nếu có ít kết quả, thử bỏ một tiêu chí lọc hoặc dùng từ khóa ngắn hơn.',links:[{href:'/projects',label:'Tìm dự án'}]},
      {icon:'wallet',tasks:['Đăng nhập và kiểm tra số POINT khả dụng trong ví.','Nếu thiếu điểm, mở trang Nạp POINT và làm theo hướng dẫn trên đơn nạp.','Quay lại dự án, kiểm tra giá và phiên bản rồi xác nhận mua.'],
        tip:'POINT dùng để mua quyền xem thông tin của phiên bản được hiển thị khi xác nhận.',links:[{href:'/account/wallet',label:'Kiểm tra ví POINT'},{href:'/account/wallet/top-up',label:'Nạp POINT'}]},
      {icon:'file',tasks:['Vào Tài khoản → Dự án đã mua.','Chọn đúng đơn để xem thông tin và tài liệu đã được cấp quyền.','Nếu có vấn đề với giao dịch, xem các lựa chọn xử lý trong chi tiết đơn.'],
        tip:'Bạn có thể mở lại nội dung từ đơn mua mà không cần tìm lại tin công khai.',links:[{href:'/account/purchases',label:'Mở Dự án đã mua'}]},
    ],
    question:'Tôi xem được gì trước khi mua?',
    answer:'Bạn có thể xem ảnh công khai, mô tả, khu vực và giá POINT. Thông tin liên hệ, vị trí chi tiết và tài liệu bảo vệ được hiển thị theo quyền của từng đơn mua.',
  },
  seller:{
    goal:'Hoàn thiện hồ sơ, tạo tin và theo dõi từ lúc gửi duyệt đến công bố.',
    steps:[
      {icon:'shield',tasks:['Đăng nhập và mở khu vực nhà cung cấp.','Điền thông tin hồ sơ, tải tài liệu theo yêu cầu rồi gửi xác minh.','Theo dõi trạng thái hồ sơ và bổ sung nếu có phản hồi.'],
        tip:'Bạn có thể tạo tin dự án sau khi hồ sơ nhà cung cấp được xác minh.',links:[{href:'/become-seller',label:'Mở hồ sơ nhà cung cấp'}]},
      {icon:'file',tasks:['Chọn Tạo dự án mới. Dùng mẫu theo danh mục nếu muốn điền nhanh.','Nhập mô tả công khai, thêm ảnh và đưa thông tin liên hệ, vị trí chính xác vào phần được bảo vệ.','Đặt giá bằng POINT, sau đó lưu bản nháp.'],
        tip:'Ở bước giá, bạn có thể tự nhập hoặc tham khảo mức đề xuất khi có đủ dữ liệu.',links:[{href:'/seller/projects/new',label:'Tạo dự án mới'}]},
      {icon:'clock',tasks:['Xem trước phần công khai và kiểm tra ảnh, mô tả, giá.','Xác nhận quyền cung cấp thông tin và gửi duyệt.','Theo dõi phản hồi trong Dự án của tôi. Nếu cần sửa, tạo bản đề xuất mới theo hướng dẫn.'],
        tip:'Nếu tin đã công bố, bản hiện hành và giá vẫn giữ nguyên trong lúc bản sửa chờ duyệt.',links:[{href:'/seller/projects',label:'Theo dõi tin đã gửi'}]},
    ],
    question:'Tôi có thể sửa tin sau khi gửi duyệt không?',
    answer:'Phiên bản đã gửi được khóa để kiểm duyệt. Khi có phản hồi hoặc cần cập nhật tin đã công bố, mở dự án để xem thao tác tạo bản đề xuất mới.',
  },
} as const;

export default function GuideDetail({role}:{role:'buyer'|'seller'}) {
  const path=role==='buyer'?'/guides/buyer':'/guides/seller';
  const alternate=role==='buyer'?'seller':'buyer';
  const guide=editorialPages[path],playbook=playbooks[role];
  const topics=guideTopics.filter(topic=>topic.role===role);
  const breadcrumb=breadcrumbJson([{label:'Trang chủ',path:'/'},{label:'Hướng dẫn',path:'/guides'},{label:guide.title,path}]);
  return <main className="guide-page guide-playbook">
    {breadcrumb&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:breadcrumb}}/>}
    <header className="guide-hero guide-hero-detail"><div className="guide-wrap">
      <nav aria-label="Đường dẫn"><ol className="guide-crumbs"><li><a href="/">Trang chủ</a></li><li><a href="/guides">Hướng dẫn</a></li><li aria-current="page">{guideRoles[role]}</li></ol></nav>
      <span className="guide-kicker">Cẩm nang sử dụng sàn</span><h1>{guide.title}</h1><p>{playbook.goal}</p>
      <a className="guide-primary" href="#buoc-1">Bắt đầu bước 1 <span aria-hidden="true">↓</span></a>
    </div></header>
    <div className="guide-wrap guide-detail">
      <nav className="guide-outline playbook-outline" aria-label="Các bước hướng dẫn"><strong>3 bước thực hiện</strong>
        <ol>{topics.map(topic=><li key={topic.step}><a href={'#buoc-'+topic.step}><span aria-hidden="true">{topic.step}</span>{topic.title}</a></li>)}</ol>
        <a className="playbook-switch" href={'/guides/'+alternate}>Xem hướng dẫn {guideRoles[alternate].toLowerCase()} →</a>
        <a href="/guides">← Về cẩm nang</a>
      </nav>
      <div className="guide-step-list">
        {topics.map((topic,index)=>{
          const step=playbook.steps[index];
          return <section className="guide-step playbook-step" key={topic.step} id={'buoc-'+topic.step} aria-labelledby={'guide-step-title-'+topic.step}>
            <header className="playbook-step-header"><span className="guide-icon" aria-hidden="true"><Icon name={step.icon} size={25}/></span>
              <div><span className="guide-kicker">Bước {topic.step} / 3</span><h2 id={'guide-step-title-'+topic.step}>{topic.title}</h2></div></header>
            <ol className="playbook-tasks" role="list">{step.tasks.map((task,taskIndex)=><li key={task}><span aria-hidden="true">{taskIndex+1}</span>{task}</li>)}</ol>
            <p className="playbook-tip"><strong>Lưu ý</strong> {step.tip}</p>
            <div className="guide-step-actions">{step.links.map((link,i)=><a className={i===0?'playbook-action':undefined} key={link.href} href={link.href}>
              {link.label} <span aria-hidden="true">→</span></a>)}
              {topic.step<3&&<a className="playbook-next" href={'#buoc-'+(topic.step+1)}>Sang bước {topic.step+1} ↓</a>}
            </div>
          </section>;
        })}
        <details className="playbook-question"><summary>{playbook.question}</summary><p>{playbook.answer}</p></details>
        <aside className="guide-help"><span className="guide-icon" aria-hidden="true"><Icon name="help" size={23}/></span>
          <div><h2>Cần hỗ trợ thêm?</h2><p>Chọn chủ đề để đến đúng khu vực xử lý.</p></div><a href="/contact">Liên hệ và hỗ trợ →</a></aside>
      </div>
    </div>
  </main>;
}
