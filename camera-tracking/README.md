# Camera chấm công · banglc-tech

Robot camera đặt ở cửa: **chấm công bằng khuôn mặt**, **theo dõi lượt ra vào**, và **chào hỏi vui** bằng giọng nói. Chạy hoàn toàn trên trình duyệt (HTML/CSS/JS thuần, không cần build, không cần máy chủ).

## Tính năng bản nháp (v0)

- **Camera tracking**: phát hiện nhiều khuôn mặt cùng lúc, gán ID theo dõi ổn định, vẽ khung + tên, đếm số người trong khung và lượt qua cửa trong ngày (tách nhân viên / khách lạ).
- **Chấm công**: nhận diện nhân viên đã đăng ký, tự luân phiên Vào/Ra (hoặc bấm nút Vào/Ra), chống ghi trùng, lưu ảnh nhỏ làm bằng chứng, nhận biết đi muộn theo giờ bắt đầu ca.
- **Robot chào hỏi**: mặt robot hoạt hình nhìn theo người trước camera, chào bằng giọng tiếng Việt (Web Speech API) theo buổi sáng/trưa/chiều/tối, chào khi về, chào cả khách lạ.
- **Nhân sự**: đăng ký bằng 3–8 mẫu khuôn mặt chụp từ camera hoặc tải ảnh lên; sửa, xóa, tìm kiếm.
- **Lịch sử**: lọc theo ngày và nhân viên, tổng hợp Vào đầu / Ra cuối / giờ công / đi muộn, xuất CSV chi tiết và CSV tổng hợp (mở được bằng Excel).
- **Cài đặt**: chọn camera, lật gương, bộ phát hiện Tiny/SSD, ngưỡng khớp, số khung xác nhận, chế độ chấm công, giọng nói; sao lưu / khôi phục JSON.

## Chạy

Camera chỉ hoạt động trên HTTPS hoặc `localhost`. Mở `index.html` trực tiếp bằng `file://` sẽ bị trình duyệt chặn.

```bash
# cách 1: Python
python3 -m http.server 8080
# cách 2: Node
npx serve .
```

Rồi mở http://localhost:8080. Bật GitHub Pages cho repo (Settings → Pages → Deploy from branch `main`, thư mục `/`) để dùng trên thiết bị khác qua HTTPS.

Lần đầu mở, trình duyệt tải thư viện nhận diện và mô hình (khoảng 10–15 MB) từ CDN, các lần sau dùng bộ nhớ đệm.

## Triển khai thực tế

Không cần máy chủ và không cần máy tính chạy 24/7. Có hai phần:

| Phần | Ở đâu | Cần bật khi nào |
|---|---|---|
| Mã nguồn (trang web tĩnh) | GitHub Pages (miễn phí) hoặc bất kỳ hosting tĩnh nào | Luôn sẵn, không cần quản trị |
| Thiết bị đặt ở cửa (có camera + trình duyệt Chrome/Edge) | Máy tính bảng Android cũ, mini PC, laptop, Raspberry Pi, hoặc màn hình của robot nếu mở được trình duyệt | Chỉ trong giờ có người ra vào; tắt ngoài giờ cũng được |

Cách làm: bật GitHub Pages cho repo → mở đường dẫn trên thiết bị ở cửa → cho phép camera → bấm "Toàn màn hình". Nên ghim trang (Chrome: Thêm vào màn hình chính) để mở lại nhanh sau khi khởi động.

Lưu ý: dữ liệu chấm công hiện lưu ngay trên thiết bị đó. Nếu muốn xem từ nơi khác, định kỳ dùng "Sao lưu JSON" hoặc "Xuất CSV". Khi làm bản chính thức sẽ thêm máy chủ hoặc đồng bộ lên Lark Base để nhiều thiết bị dùng chung một danh sách nhân viên và một lịch sử.

## Cấu trúc

```
index.html      giao diện 3 tab: Camera · Nhân sự · Lịch sử + hộp thoại Cài đặt
css/style.css   giao diện (màu chủ đạo #0061FF, font Manrope, hỗ trợ dark mode)
js/store.js     lưu trữ localStorage: nhân viên, lịch sử, lượt qua cửa, cài đặt
js/facelib.js   bọc thư viện face-api (TensorFlow.js) + tracker theo IoU + gom phiếu nhận diện
js/app.js       luồng camera, vòng lặp nhận diện, chấm công, robot chào, đăng ký, lịch sử, cài đặt
```

Thư viện: [@vladmandic/face-api](https://github.com/vladmandic/face-api) 1.7.15 (tải từ jsDelivr, dự phòng unpkg). Mô hình: Tiny Face Detector, Face Landmark 68 Tiny, Face Recognition (vector 128 chiều). Có thể bật SSD MobileNet trong Cài đặt nếu cần chính xác hơn.

## Cách nhận diện hoạt động

1. Mỗi khung hình: phát hiện khuôn mặt → điểm mốc → vector đặc trưng 128 chiều.
2. So khoảng cách Euclid với các mẫu của từng nhân viên; dưới ngưỡng (mặc định 0.50) coi là khớp.
3. Tracker gán ID cho từng khuôn mặt giữa các khung hình; một khuôn mặt chỉ được "xác nhận" khi đủ N khung liên tiếp (mặc định 5) cho cùng một kết quả, để tránh nhận nhầm thoáng qua.
4. Khi xác nhận là nhân viên và đang bật chấm công: ghi Vào/Ra theo quy tắc chống trùng (60 giây) và khoảng cách tối thiểu giữa Vào và Ra (10 phút).
5. Khi một khuôn mặt rời khung sau khi đã được theo dõi đủ lâu: đếm 1 lượt qua cửa.

## Giới hạn hiện tại

- Dữ liệu nằm trong localStorage của trình duyệt trên thiết bị đó (giới hạn ~5 MB). Chưa đồng bộ nhiều thiết bị, chưa có máy chủ. Dùng Sao lưu JSON để chuyển máy.
- Nhận diện khuôn mặt 2D có thể bị đánh lừa bằng ảnh; chưa có chống giả mạo (liveness).
- Chưa phân biệt hướng đi vào hay đi ra qua cửa; Vào/Ra hiện luân phiên theo lần chấm trước.
- Giọng nói phụ thuộc giọng tiếng Việt có sẵn trong trình duyệt / hệ điều hành (Chrome trên Windows và Android có giọng Google tiếng Việt; Safari cần cài giọng Linh trong hệ thống).

## Ghi chú nội bộ (cần chốt)

- Hướng đi đã thống nhất: robot camera, nhiệm vụ đầu là chấm công + tracking ra vào cửa + chào hỏi tương tác. Bản này là nháp để xem và góp ý trước khi làm chính thức.
- Cần chốt: nơi lưu dữ liệu lâu dài (Lark Base / máy chủ riêng), phần cứng robot sẽ chạy trình duyệt gì, có cần chống giả mạo bằng ảnh không, câu chào theo thương hiệu.
