import type {ReactNode} from 'react';
import type {PublicProject} from '../lib/projects/contracts';
import {categoryLabels,formatPoints} from '../lib/projects/workflow';
import {provinceLabel} from '../lib/projects/locations';
import ProjectGallery from './ProjectGallery';
import Icon from './MarketplaceIcon';
import './public-project-detail.css';

function areaLabel(min:string|null,max:string|null) {
  const format=(value:string)=>Number(value).toLocaleString('vi-VN',{maximumFractionDigits:2})+' m²';
  if(min&&max)return Number(min)===Number(max)?format(min):format(min)+' – '+format(max);
  if(min)return 'Từ '+format(min);
  if(max)return 'Đến '+format(max);
  return 'Chưa cập nhật';
}

export default function PublicProjectDetail({project,preview=false,purchasePanel,unlockedContent}:{
  project:PublicProject;preview?:boolean;purchasePanel?:ReactNode;unlockedContent?:ReactNode;
}) {
  const images=project.files?.length?project.files:project.imageUrl?[{id:project.id,url:project.imageUrl,label:'Ảnh công khai'}]:[];
  const category=categoryLabels[project.category]??project.category;
  const location=[project.districtName,project.provinceCode&&provinceLabel(project.provinceCode)].filter(Boolean).join(', ')||'Chưa cập nhật';
  const facts=[
    { label:'Khu vực công khai', value:location, icon:'pin' },
    { label:'Lĩnh vực', value:category, icon:project.category },
    { label:'Giai đoạn', value:project.projectStage||'Chưa cập nhật', icon:'clock' },
    { label:'Loại công trình', value:project.publicData.constructionType||'Chưa cập nhật', icon:'commercial' },
    { label:'Diện tích', value:areaLabel(project.sizeMinSqm,project.sizeMaxSqm), icon:'file' },
  ];
  return <div className={'pd-showcase'+(preview?' pd-showcase-preview':'')}>
    {preview&&<p className="p2-preview-notice">Xem trước phần công khai của phiên bản này — chưa phải quyết định công bố.</p>}
    <header className="pd-title">
      <div className="pd-badges"><span><Icon name={project.category} size={16}/>{category}</span>
        <span><Icon name="shield" size={16}/>{preview?'Bản xem trước':unlockedContent?'Phiên bản đã mua':'Tin đã kiểm duyệt'}</span></div>
      <h1>{project.title}</h1>
      <div className="pd-meta"><span><Icon name="pin" size={17}/>{location}</span>
        {project.publishedAt&&!preview&&<span><Icon name="clock" size={17}/>{unlockedContent?'Duyệt':'Công bố'} <time dateTime={new Date(project.publishedAt).toISOString()}>
          {new Date(project.publishedAt).toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</time></span>}</div>
    </header>

    <nav className="pd-jumps" aria-label="Nội dung chi tiết dự án">
      {unlockedContent&&<a href="#thong-tin-da-mua">Thông tin đã mở khóa</a>}
      <a href="#anh-du-an">Hình ảnh</a><a href="#thong-tin-du-an">Phạm vi gói</a>
      <a href="#tong-quan-du-an">Tổng quan</a><a href="#mo-thong-tin">Quyền xem thông tin</a>
    </nav>

    <div className="pd-layout">
      <section className="pd-media pd-surface" id="anh-du-an">
        <div className="pd-section-head"><h2>Hình ảnh dự án</h2><span>{images.length?images.length+' ảnh công khai':'Chưa có ảnh'}</span></div>
        <ProjectGallery key={project.versionId} images={images} title={project.title}/>
      </section>

      <div className="pd-side">
        <section className="p2-purchase-card pd-price-card" id="mo-thong-tin">
          <div className="pd-price-head"><h2>{unlockedContent?'Đã thanh toán':'Giá mở thông tin'}</h2><span>Phiên bản {project.versionNo}</span></div>
          <strong>{formatPoints(project.pricePoints)} <small>POINT</small></strong>
          <div className="pd-purchase-actions">{preview?<p className="p2-note">Bản xem trước không thực hiện giao dịch.</p>:purchasePanel}</div>
          {!unlockedContent&&<div className="pd-access"><h3><Icon name="shield" size={20}/> Nội dung được bảo vệ</h3>
            <p>Quyền xem áp dụng cho phiên bản đã mua. Tùy hồ sơ, nội dung có thể gồm:</p>
            <ul><li>Các đơn vị tham gia và đầu mối dự án</li><li>Vị trí chi tiết và thông tin thương mại</li><li>Tài liệu được cấp quyền</li></ul></div>}
          {!preview&&<div className="pd-side-links"><a href="/guides/buyer">Hướng dẫn mua →</a><a href="/contact">Hỗ trợ →</a></div>}
        </section>
        <section className="pd-surface pd-quick" aria-labelledby="pd-quick-title">
          <div className="pd-section-head"><h2 id="pd-quick-title">Thông tin nhanh</h2></div>
          <dl className="pd-quick-facts">{facts.map(({ label,value,icon })=>(
            <div key={label}>
              <dt><Icon name={icon} size={17}/>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}</dl>
        </section>
      </div>

      <div className="pd-information">
        {unlockedContent}
        <section className="pd-surface pd-package" id="thong-tin-du-an">
          <div className="pd-section-head"><h2>Phạm vi gói thông tin</h2><span>Phiên bản {project.versionNo}</span></div>
          <dl className="pd-facts">
            <div><dt>Giai đoạn</dt><dd>{project.projectStage||'Chưa cập nhật'}</dd></div>
            <div><dt>Hạng mục và phạm vi</dt><dd>{project.publicData.scopeSummary||'Nhà cung cấp chưa công bố phạm vi cụ thể.'}</dd></div>
          </dl>
        </section>
        <section className="pd-surface" id="tong-quan-du-an"><div className="pd-section-head"><h2>Tổng quan dự án</h2></div>
          <p className="pd-description">{project.publicSummary||'Chưa có mô tả công khai.'}</p>
          {project.publicData.technicalSummary&&<div className="pd-technical"><h3>Thông số công khai</h3><p className="pd-description">{project.publicData.technicalSummary}</p></div>}
        </section>
      </div>
    </div>
  </div>;
}
