# Triển khai kênh trao đổi theo đơn mua

Kênh trao đổi cần bảng `purchase_messages`. Với cơ sở dữ liệu Vibe Host đã khởi tạo, áp dụng riêng `db/migrations/0013_purchase_messages.sql` một lần trong một giao dịch, qua công cụ PostgreSQL được người vận hành cấp quyền. Kiểm tra đúng cơ sở dữ liệu đích trước khi chạy. Tệp tạo bảng và chỉ mục, giữ nguyên dữ liệu đơn mua và sổ điểm.

Nếu tài khoản Vibe Host thiếu công cụ chạy SQL, chuyển tệp cho Mắt Bảo hoặc người quản trị PostgreSQL để áp dụng. Quy trình triển khai ứng dụng qua Git không tự chạy tệp này. Bootstrap staging dành cho cơ sở dữ liệu rỗng, vì vậy cần áp dụng tệp 0013 sau khi bootstrap một cơ sở dữ liệu mới.

Sau khi áp dụng, xác nhận bảng tồn tại bằng `SELECT to_regclass('public.purchase_messages');` rồi triển khai commit chứa tính năng chat. Nếu triển khai mã trước, trang trao đổi sẽ hiển thị thông báo chưa sẵn sàng cho đến khi bảng được tạo.

## Nghiệm thu

1. Mở một đơn mua đã hoàn tất bằng tài khoản người mua. Vào **Thông tin đã mua → Trao đổi với người bán** và gửi tin.
2. Mở thông báo bằng tài khoản người bán, kiểm tra liên kết mở đúng đơn rồi gửi phản hồi.
3. Đăng nhập lại bằng tài khoản người mua, mở thông báo hoặc bấm **Tải tin mới** để xem phản hồi.
4. Kiểm tra tài khoản khác không mở được cuộc trò chuyện. Với đơn đã hoàn điểm có lịch sử trao đổi, kiểm tra hai bên xem được tin cũ và nút gửi đã được khóa.
