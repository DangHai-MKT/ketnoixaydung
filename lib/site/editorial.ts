import { siteIdentity } from './navigation';
type EditorialEntry = {
  title: string;
  description: string;
  sections: {title: string; text: string}[];
  links: {label: string; href: string}[];
};

export const editorialPages = {
  '/about': {
    title: `Giới thiệu ${siteIdentity.name}`,
    description: 'Sàn kết nối người mua và nhà cung cấp thông tin dự án xây dựng tại Việt Nam.',
    sections: [
      {title: 'Tìm cơ hội xây dựng', text: 'Người mua có thể tìm dự án theo danh mục, khu vực và giai đoạn, sau đó xem phần giới thiệu công khai trước khi quyết định mua quyền truy cập thông tin.'},
      {title: 'Đăng thông tin dự án', text: 'Nhà cung cấp hoàn tất xác minh hồ sơ trước khi đăng tin. Người bán tự đặt giá bằng POINT và gửi từng phiên bản tin để kiểm duyệt trước khi công bố.'},
    ],
    links: [{label: 'Khám phá dự án', href: '/projects'}, {label: 'Xem hướng dẫn', href: '/guides'}],
  },
  '/contact': {
    title: 'Liên hệ và hỗ trợ',
    description: 'Tìm đúng nơi xử lý yêu cầu về tài khoản, hồ sơ người bán và giao dịch trên sàn.',
    sections: [
      {title: 'Tài khoản và giao dịch', text: 'Đăng nhập để mở khu vực trợ giúp tài khoản. Với giao dịch đã mua, bạn có thể mở chi tiết đơn mua để xem các lựa chọn hỗ trợ áp dụng cho giao dịch đó.'},
      {title: 'Hồ sơ nhà cung cấp và tin dự án', text: 'Mở khu vực người bán để xem phản hồi xác minh hoặc ghi chú kiểm duyệt của từng phiên bản. Giữ thông tin cá nhân và tài liệu giao dịch trong khu vực tài khoản.'},
    ],
    links: [{label: 'Trợ giúp tài khoản', href: '/account/help'}, {label: 'Trợ giúp người bán', href: '/seller/help'}, {label: 'Câu hỏi thường gặp', href: '/faq'}],
  },
  '/guides': {
    title: 'Hướng dẫn sử dụng sàn',
    description: 'Chọn hướng dẫn phù hợp để tìm mua thông tin hoặc đăng tin dự án xây dựng.',
    sections: [
      {title: 'Dành cho người mua', text: 'Tìm dự án, xem giá và phần mô tả công khai, rồi mở đơn đã mua để truy cập nội dung của phiên bản tương ứng.'},
      {title: 'Dành cho nhà cung cấp', text: 'Bắt đầu với hồ sơ xác minh, sau đó tạo bản nháp, chọn giá và gửi tin đi kiểm duyệt.'},
    ],
    links: [{label: 'Hướng dẫn người mua', href: '/guides/buyer'}, {label: 'Hướng dẫn người bán', href: '/guides/seller'}],
  },
  '/guides/buyer': {
    title: 'Hướng dẫn người mua',
    description: 'Các bước tìm dự án, xem giá POINT và mở thông tin đã mua.',
    sections: [
      {title: '1. Tìm dự án phù hợp', text: 'Dùng từ khóa và bộ lọc khu vực, danh mục, giai đoạn hoặc khoảng giá. Mở tin để xem phần công khai và giá của phiên bản đang được bán.'},
      {title: '2. Xem lại trước khi mua', text: 'Đăng nhập, kiểm tra số POINT và xem thông tin xác nhận giao dịch. Kiểm tra mô tả công khai và phiên bản trước khi xác nhận.'},
      {title: '3. Mở thông tin đã mua', text: 'Vào Dự án đã mua để xem nội dung được bảo vệ của đúng phiên bản giao dịch. Khi cần hỗ trợ, mở chi tiết đơn để xem các thao tác hiện có.'},
    ],
    links: [{label: 'Tìm dự án', href: '/projects'}, {label: 'Dự án đã mua', href: '/account/purchases'}],
  },
  '/guides/seller': {
    title: 'Hướng dẫn người bán',
    description: 'Cách xác minh hồ sơ, chuẩn bị tin, đặt giá và theo dõi kiểm duyệt.',
    sections: [
      {title: '1. Xác minh hồ sơ', text: 'Mở khu vực nhà cung cấp, hoàn thiện thông tin và tải tài liệu theo yêu cầu của biểu mẫu. Theo dõi phản hồi trong hồ sơ.'},
      {title: '2. Soạn và đặt giá', text: 'Dùng mẫu tạo dự án để điền nhanh. Tách liên hệ, vị trí chính xác và tài liệu bảo vệ khỏi mô tả công khai. Bạn có thể tự nhập giá POINT hoặc tham khảo mức đề xuất khi có đủ dữ liệu.'},
      {title: '3. Gửi duyệt và theo dõi', text: 'Xem trước phần công khai rồi gửi tin. Khi sửa một tin đang công bố, phiên bản hiện hành giữ nguyên cho đến khi bản đề xuất được duyệt.'},
    ],
    links: [{label: 'Mở khu vực nhà cung cấp', href: '/become-seller'}, {label: 'Dự án của tôi', href: '/seller/projects'}],
  },
  '/faq': {
    title: 'Câu hỏi thường gặp',
    description: 'Giải đáp về nội dung dự án, giá POINT và quy trình đăng tin.',
    sections: [
      {title: 'Tôi có thể xem gì trước khi mua?', text: 'Trang chi tiết hiển thị phần mô tả công khai và giá. Nội dung bảo vệ được mở theo quyền truy cập của đơn mua tương ứng.'},
      {title: 'Ai có thể đăng tin?', text: 'Tài khoản có hồ sơ nhà cung cấp đã được xác minh mới có thể tạo và gửi tin dự án.'},
      {title: 'Giá được thay đổi như thế nào?', text: 'Người bán đặt giá bằng POINT. Giá của phiên bản đang công bố chỉ đổi khi phiên bản đề xuất được duyệt và công bố.'},
    ],
    links: [{label: 'Xem hướng dẫn sử dụng', href: '/guides'}, {label: 'Tìm hỗ trợ', href: '/contact'}],
  },
} satisfies Record<string, EditorialEntry>;

export type EditorialPath = keyof typeof editorialPages;
