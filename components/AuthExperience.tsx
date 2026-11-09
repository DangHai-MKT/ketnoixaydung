import { siteIdentity } from '../lib/site/navigation';
import SiteBrandMark from './SiteBrandMark';
import type {ReactNode} from 'react';
import Icon from './MarketplaceIcon';

type Variant='login'|'register'|'recovery'|'verify';
const stories={
  login:{eyebrow:'CHÀO MỪNG BẠN TRỞ LẠI',title:'Cơ hội mới.',accent:'Kết nối tiếp nối.',description:'Trở lại không gian của bạn để khám phá nguồn tin dự án và tiếp tục những kết nối giá trị.'},
  register:{eyebrow:'CÙNG XÂY DỰNG CƠ HỘI',title:'Một tài khoản.',accent:'Nhiều kết nối giá trị.',description:'Tìm kiếm cơ hội kinh doanh hoặc chia sẻ nguồn tin dự án. Bắt đầu hành trình theo cách của bạn.'},
  recovery:{eyebrow:'ĐỒNG HÀNH CÙNG BẠN',title:'Lấy lại truy cập.',accent:'Tiếp tục hành trình.',description:'Khôi phục tài khoản qua email đã đăng ký để trở lại với những cơ hội đang chờ bạn.'},
  verify:{eyebrow:'HOÀN THIỆN DANH TÍNH',title:'Kết nối tin cậy.',accent:'Bắt đầu từ bạn.',description:'Xác minh email để hoàn thiện thông tin tài khoản và sử dụng các chức năng cần xác thực.'},
};
export default function AuthExperience({variant,title,description,children}:{variant:Variant;title:string;description:string;children:ReactNode}){
  const story=stories[variant];
  return <main className={`auth-experience auth-experience-${variant}`}><div className="auth-experience-grid"><aside className="auth-story"><div className="auth-story-top"><SiteBrandMark /><span>{siteIdentity.name}<small>{siteIdentity.tagline}</small></span></div><div className="auth-story-copy"><span className="auth-story-eyebrow">{story.eyebrow}</span><h2>{story.title}<em>{story.accent}</em></h2><p>{story.description}</p><ul><li><Icon name="shield" size={20}/><span>Thông tin dự án được kiểm duyệt</span></li><li><Icon name="wallet" size={20}/><span>Giá thông tin minh bạch bằng POINT</span></li><li><Icon name="users" size={20}/><span>Mua và cung cấp thông tin trên cùng tài khoản</span></li></ul></div><a className="auth-story-link" href="/projects">Khám phá dự án trên sàn <span aria-hidden="true">↗</span></a></aside><section className="auth-experience-panel"><a className="auth-back-link" href="/">← Về trang chủ</a><header className="auth-experience-heading"><span className="auth-form-symbol"><Icon name={variant==='login'?'users':variant==='register'?'commercial':'shield'} size={25}/></span><h1>{title}</h1><p>{description}</p></header>{children}{variant==='recovery'&&<a className="auth-return-login" href="/login">← Quay lại đăng nhập</a>}<div className="auth-experience-footnote"><Icon name="shield" size={15}/><span>Giữ riêng mật khẩu và thông tin xác minh của bạn.</span></div></section></div></main>;
}
