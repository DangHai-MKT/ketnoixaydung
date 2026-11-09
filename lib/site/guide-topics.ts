export const guideTopics = [
  {role:'buyer', step:1, title:'Tìm và lọc dự án', description:'Tìm theo lĩnh vực, khu vực, giai đoạn và khoảng giá.', keywords:'tìm kiếm danh mục cơ hội'},
  {role:'buyer', step:2, title:'Kiểm tra số dư và mua thông tin', description:'Xem giá POINT, kiểm tra số dư rồi xác nhận mua.', keywords:'nạp điểm ví thanh toán giá'},
  {role:'buyer', step:3, title:'Mở thông tin đã mua', description:'Tìm đơn mua và mở nội dung của phiên bản đã mua.', keywords:'đơn mua tài liệu liên hệ hoàn điểm tranh chấp'},
  {role:'seller', step:1, title:'Xác minh hồ sơ nhà cung cấp', description:'Hoàn thiện hồ sơ và theo dõi phản hồi xác minh.', keywords:'đăng ký người bán doanh nghiệp giấy tờ'},
  {role:'seller', step:2, title:'Tạo bản nháp và đặt giá', description:'Soạn tin, thêm thông tin và chọn giá bán bằng POINT.', keywords:'đăng tin tạo dự án hình ảnh mô tả gợi ý giá'},
  {role:'seller', step:3, title:'Gửi duyệt và theo dõi kết quả', description:'Xem trước, gửi kiểm duyệt và theo dõi từng phiên bản.', keywords:'xuất bản công bố từ chối sửa tin'},
] as const;

export const guideRoles = {buyer:'Người mua',seller:'Nhà cung cấp'} as const;
export const guideTopicHref = (topic: typeof guideTopics[number]) => '/guides/'+topic.role+'#buoc-'+topic.step;
