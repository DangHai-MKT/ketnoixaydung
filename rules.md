# Quy tắc phát triển giao diện Kết Nối Xây Dựng

## 1. Phạm vi và mục tiêu

Áp dụng khi tạo mới, sửa hoặc nghiệm thu giao diện của dự án hiện có. Mỗi trang phải có hình thức đẹp, nổi bật, chuyên nghiệp và giúp người làm xây dựng hoàn thành công việc dễ dàng trên điện thoại.

- Tiếp tục dùng Next.js App Router, TypeScript, Better Auth, Drizzle và PostgreSQL của dự án.
- Tái sử dụng thành phần, kiểu dáng và nghiệp vụ đang có. Giữ các chức năng đã hoàn thiện trừ khi yêu cầu thay đổi chúng.
- Trước khi sửa mã Next.js, đọc hướng dẫn liên quan trong `node_modules/next/dist/docs/` theo `AGENTS.md`.
- Xem trang hiện tại, xác định người dùng, mục đích và thao tác chính trước khi thiết kế.

## 2. Nhận diện và chất lượng thị giác

- Dùng thương hiệu **Kết Nối Xây Dựng**, tên miền **ketnoixaydung.vn** và logo hiện có. Lấy cấu hình nhận diện từ thành phần dùng chung.
- Kế thừa hệ màu xanh đậm, xanh dương, cam và nền sáng của website. Dùng cam hoặc màu hành động chính có chủ đích cho thao tác quan trọng.
- Phân cấp rõ tiêu đề, thông tin quyết định, nội dung bổ sung và hành động. Mỗi khu vực nên có một thao tác chính dễ nhận biết.
- Dùng khoảng cách, cỡ chữ, bo góc, đường viền và trạng thái nút thống nhất giữa các trang. Tận dụng kiểu chữ hiện có.
- Chọn ảnh thật liên quan đến công trình hoặc doanh nghiệp. Bảo toàn tỷ lệ ảnh, dùng ảnh đại diện tối ưu, có bố cục thay thế khi thiếu ảnh.
- Ưu tiên bố cục thoáng, nhóm nội dung theo việc khách cần làm. Mỗi nhãn, biểu tượng và đoạn giải thích phải phục vụ một quyết định hoặc thao tác cụ thể.
- Chỉ hiển thị số liệu, đánh giá, dấu xác minh và năng lực đã có căn cứ. Ghi rõ dữ liệu minh họa trong môi trường xem trước.

## 3. Dễ sử dụng cho người ít rành công nghệ

- Viết tiếng Việt tự nhiên theo cách người làm xây dựng trao đổi. Ví dụ dùng “Tài liệu dành cho người mua”, “Số điểm muốn rút”, “Gọi nhà cung cấp”.
- Nút phải nói rõ kết quả của thao tác. Dùng “Gửi nhu cầu”, “Lưu bản nháp”, “Mở liên hệ · 50 POINT”.
- Khi thao tác ảnh hưởng đến POINT hoặc quyền truy cập, hiển thị rõ giá, phạm vi được xem và thời điểm bị trừ điểm trước khi xác nhận.
- Cho khách biết đang ở bước nào, bước tiếp theo là gì và cần chờ ai xử lý.
- Gom các chức năng liên quan thành một hành trình. Giữ từ khóa, bộ lọc và thông tin đã nhập khi chuyển sang bước liên quan.
- Cho phép gọi điện, gửi email hoặc mở Zalo trực tiếp khi người dùng có quyền xem đầu mối hợp lệ.
- Luôn có đường quay lại và cách tiếp tục sau lỗi. Tránh vòng lặp chuyển trang làm khách mất thông tin đang nhập.

## 4. Biểu mẫu và trạng thái thao tác

- Ban đầu chỉ hiện các trường cần để hoàn thành bước hiện tại. Đặt thông tin bổ sung trong mục mở rộng có tên dễ hiểu.
- Giữ nhãn trường luôn nhìn thấy. Đánh dấu trường bắt buộc và giải thích yêu cầu ngay tại nơi nhập.
- Ưu tiên lựa chọn có sẵn, tìm kiếm trong danh sách dài, ví dụ nhập thực tế và giá trị mặc định hợp lý.
- Định dạng số tiền có dấu phân cách. Chọn bàn phím điện thoại, email hoặc số phù hợp. Giữ số 0 đầu của số tài khoản và mã số thuế.
- Hạn chế nhập lại dữ liệu đã được xác nhận. Giữ bản nháp và nội dung đang soạn khi điều hướng hoặc thu nhỏ chat.
- Với tải tệp, cho biết loại tệp, dung lượng, ai được xem và kết quả tải. Nếu tệp không bắt buộc, cung cấp cách bỏ qua rõ ràng.
- Hiển thị trạng thái đang tải, đang gửi, thành công, dữ liệu trống và lỗi bằng thông điệp giúp khách biết phải làm gì.
- Khóa nút khi đang gửi và chống xử lý trùng ở máy chủ cho thao tác ghi dữ liệu hoặc ghi sổ.
- Lỗi cần gắn với trường tương ứng nếu có thể. Thông tin lỗi phía khách phải tránh để lộ truy vấn, khóa bí mật hoặc dữ liệu tài khoản.

## 5. Điện thoại và khả năng tiếp cận

- Thiết kế từ màn hình nhỏ và kiểm tra ở độ rộng 360–390 px, máy tính bảng và màn hình máy tính.
- Nội dung chính phải vừa màn hình. Với bảng rộng, cung cấp cách cuộn dễ nhận biết hoặc chuyển thành thẻ trên điện thoại.
- Nút chạm chính có vùng bấm tối thiểu khoảng 44 × 44 px. Nội dung và trường nhập phải đủ lớn để đọc dễ dàng.
- Dùng HTML đúng nghĩa, nhãn biểu mẫu, tiêu đề có thứ bậc và văn bản thay thế ảnh phù hợp.
- Hỗ trợ bàn phím, trạng thái focus rõ ràng và độ tương phản theo WCAG 2.2 AA. Trạng thái cần có chữ hoặc biểu tượng kèm màu.
- Cửa sổ chat, hộp thoại và thanh nổi cần có nút đóng hoặc thu nhỏ, hỗ trợ Escape khi phù hợp, khôi phục focus và tránh che thao tác quan trọng.

## 6. SEO cho trang hiển thị công khai

- Trang công khai đủ điều kiện lập chỉ mục cần có tiêu đề và mô tả riêng, URL canonical, Open Graph và ảnh chia sẻ phù hợp. Tái sử dụng `lib/site/seo.ts`.
- Dùng một H1 chính mô tả nội dung trang, các H2/H3 có thứ bậc và đường dẫn điều hướng khi trang có nhiều cấp.
- Viết nội dung hữu ích theo chuyên môn, loại công trình và địa bàn thực tế. Mô tả phải đúng dữ liệu, tránh nhồi từ khóa hoặc tạo trang địa phương trùng nội dung.
- Dùng liên kết HTML có đích truy cập được để công cụ tìm kiếm đi qua danh sách, phân trang và trang chi tiết. Giữ đường dẫn cũ bằng chuyển hướng thích hợp khi hợp nhất trang.
- Với tìm kiếm và bộ lọc, xác định rõ trang nào được lập chỉ mục, canonical và cách xử lý biến thể URL để hạn chế nội dung trùng.
- Bổ sung dữ liệu có cấu trúc phù hợp với nội dung thực sự hiển thị, như Organization, BreadcrumbList, Article hoặc LocalBusiness khi hồ sơ đủ dữ liệu. Các đánh giá và dấu xác minh phải có căn cứ.
- Cập nhật sitemap và robots theo quy tắc đang có. Trang quản trị, tài khoản, đơn mua, hội thoại và liên kết mời riêng tư cần `noindex`.
- Phần thông tin trả phí chỉ được trả từ máy chủ sau khi kiểm tra quyền. Metadata, JSON-LD, HTML, dữ liệu truyền xuống trình duyệt và nội dung lập chỉ mục phải bảo vệ dữ liệu chưa được cấp quyền.
- Trang chưa công bố hoặc không tồn tại cần trả trạng thái phù hợp. Dùng cấu hình môi trường để tránh lập chỉ mục localhost và bản thử.

## 7. Hiệu năng

- Ưu tiên hiển thị nhanh nội dung chính. Giảm JavaScript phía khách khi nội dung có thể dựng trên máy chủ.
- Dùng thumbnail đúng kích thước cho thẻ doanh nghiệp và dự án, tải lười ảnh ngoài vùng nhìn thấy và khai báo kích thước để giảm xê dịch bố cục.
- Kiểm soát số lượng kết quả, phân trang, số truy vấn và tải nền của chat. Tạm giảm hoặc dừng cập nhật khi tab bị ẩn khi phù hợp.
- Khi đo trên môi trường triển khai, hướng đến LCP ≤ 2,5 giây, INP ≤ 200 ms và CLS ≤ 0,1. Báo rõ kết quả đo thực tế và điều kiện kiểm tra.

## 8. Thông báo và quyền truy cập

- Gửi thông báo khi người nhận cần xử lý hoặc cần biết kết quả. Mỗi thông báo dẫn thẳng đến hồ sơ liên quan và cập nhật trạng thái đã đọc.
- Với tin dự án, người đăng nhận thông báo khi admin duyệt theo quy tắc đã chốt.
- Email và Zalo dùng cấu hình, tùy chọn nhận tin và điều kiện gửi đã được duyệt của dự án.
- Kiểm tra quyền và quyền sở hữu ở máy chủ. Giao diện cần phù hợp với vai trò người mua, người bán, hỗ trợ, tài chính và admin.

## 9. Nghiệm thu trước khi bàn giao

- Kiểm tra luồng qua điểm vào bình thường trên máy tính và điện thoại, gồm người chưa đăng nhập và vai trò liên quan.
- Kiểm tra trạng thái đang tải, trống, lỗi, thiếu quyền và thao tác lặp lại đối với phần đã thay đổi.
- Kiểm tra metadata, canonical, tiêu đề trang, dữ liệu có cấu trúc và việc giữ kín nội dung bảo vệ khi sửa trang công khai.
- Chạy TypeScript và kiểm thử phù hợp. Với thay đổi giao diện, xem trực tiếp trên trình duyệt để kiểm tra bố cục, chữ, ảnh và khả năng thao tác.
- Khi bàn giao, nêu rõ phần đã làm, kiểm tra đã thực hiện, điểm còn thiếu và trạng thái localhost, staging hoặc Vibe Host.
- Mọi thay đổi cơ sở dữ liệu, ghi sổ hoặc triển khai phải theo phạm vi đã được chủ dự án cho phép.
