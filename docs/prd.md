# SeatRush: PRD (v1, 27/11/2026)

> Nguồn: @docs/research.md. Các quyết định chưa có ý Danny ghi ở "Open questions" kèm giá trị mặc định đang dùng.

## Problem
Lúc concert lớn mở bán, hàng chục nghìn người vào cùng một lúc. Ví dụ: BIGBANG Mỹ Đình có khoảng 60.000 người xếp hàng; concert Anh Trai được báo là "sập hệ thống". Ba lỗi hay gặp:
1. Hệ thống quá tải vì không có cơ chế điều tiết lượng người vào.
2. Hai người mua trúng cùng một ghế (bán trùng), hoặc đã trả tiền mà không có vé.
3. Webhook thanh toán đến trễ hoặc đến 2 lần khiến bị trừ tiền 2 lần hoặc mất đơn.

## Goals
- G1: Không bán trùng ghế, kể cả dưới tải cao và khi webhook đến trùng hoặc trễ.
- G2: API vẫn phản hồi ổn định khi lượng người vào gấp nhiều lần sức chứa, nhờ phòng chờ ảo.
- G3: Người mua luôn biết trạng thái của mình: vị trí trong hàng chờ, thời gian còn lại để giữ ghế, trạng thái đơn hàng.
- G4: Ban tổ chức thấy doanh số và số ghế còn lại theo thời gian thực.

## Non-goals (MVP)
- Chọn từng ghế trên sơ đồ. MVP chỉ chọn khu vực và số lượng, hệ thống tự cấp ghế liền nhau.
- Tài khoản người dùng, đăng nhập. Người mua được nhận diện bằng `client id` trong cookie và email nhận vé. Phần auth/RBAC đã có ở TaskFlow.
- Bán lại vé, chuyển nhượng, hoàn tiền tự động. MVP chỉ đánh dấu đơn cần hoàn tiền.
- Nhiều cổng thanh toán. MVP chỉ có PayOS và một cổng giả lập (fake) cho dev và load test.
- Kafka, Kubernetes. MVP dùng Redis Streams; dự án Notify sau này sẽ thay bằng Kafka.

## Personas
- **Người mua (Linh, 22 tuổi):** dùng điện thoại, mở web đúng giờ mở bán, sợ mất lượt, sợ lừa đảo.
- **Ban tổ chức (admin):** tạo sự kiện và khu vực, mở bán, xem doanh số trực tiếp.

## Core flows
1. Xem danh sách sự kiện → chi tiết sự kiện (khu vực, giá, số ghế còn).
2. Đến giờ mở bán → vào hàng chờ → thấy vị trí và thời gian chờ ước tính → được cho vào (nhận access token có hạn).
3. Chọn khu vực và số lượng (1–4) → hệ thống giữ ghế 10 phút → đếm ngược.
4. Thanh toán → cổng thanh toán → webhook → đơn được xác nhận → thấy vé (mã vé) → nhận thông báo.
5. Hết 10 phút chưa trả tiền → ghế được trả lại. Nếu tiền đến sau khi đã hết hạn → đơn chuyển sang `refund_required`, không cấp vé.
6. Admin xem dashboard: ghế còn lại, đang giữ, đã bán, doanh thu, số người đang trong hàng chờ.

## MVP scope (MoSCoW)
| Must | Should | Could | Won't |
|---|---|---|---|
| Danh mục sự kiện/khu vực/ghế, phòng chờ, giữ ghế có hạn, idempotency key, webhook idempotent, cấp vé với ràng buộc UNIQUE, dọn đơn hết hạn, outbox → Redis Streams → notifier, dashboard admin realtime, k6, Docker, CI | PayOS sandbox thật, OpenTelemetry trace, Prometheus metrics | Giao diện tiếng Anh, email thật qua Resend | Sơ đồ ghế, tài khoản, hoàn tiền tự động, Kafka |

## Success metrics (đo bằng k6 + truy vấn kiểm tra, ghi vào `docs/test-plan.md`)
| Metric | Mục tiêu |
|---|---|
| Số ghế bán trùng | **0** (truy vấn kiểm tra sau mỗi lần chạy tải) |
| Số đơn đã trả tiền mà không có vé và không ở `refund_required` | **0** |
| p95 `POST /orders` (giữ ghế) | < 300 ms trên máy dev, 1.000 VU |
| p95 `GET /queue/status` | < 50 ms |
| Tỉ lệ lỗi 5xx | < 0,1% |
| Thời gian từ webhook tới lúc có thông báo | p95 < 2 s |

## Non-functional requirements
- **Hiệu năng:** điều tiết người vào, mặc định 50 người/giây cho mỗi sự kiện (chỉnh được qua env). Cache trang sự kiện.
- **Bảo mật:** kiểm chữ ký webhook bằng HMAC và so sánh timing-safe; access token của hàng chờ ký HMAC, có hạn; rate limit theo IP; admin dùng token riêng; `helmet`; CORS chỉ cho phép domain web.
- **Tin cậy:** mọi thay đổi trạng thái đơn đều chạy trong transaction; outbox giao ít nhất 1 lần (at-least-once) + consumer idempotent; endpoint `/health`.
- **Quan sát:** log JSON có request id; metrics Prometheus `/metrics`.
- **i18n:** tiếng Việt trước; tiền VND (`Intl.NumberFormat('vi-VN')`), ngày dd/MM/yyyy, múi giờ `Asia/Ho_Chi_Minh`.
- **a11y:** điều khiển được bằng bàn phím, đếm ngược có `aria-live`.

## Analytics events
`queue_joined`, `queue_admitted`, `hold_created`, `hold_failed{reason}`, `checkout_started`, `order_confirmed`, `order_expired`, `payment_late`. Mỗi event là một counter Prometheus.

## Compliance
- Chỉ lưu email người mua (để gửi vé), không lưu thông tin tài khoản ngân hàng của người trả từ webhook (theo tinh thần tối thiểu hoá dữ liệu của Nghị định 13/2023).
- Sự kiện trong demo là sự kiện giả, không dùng tên hay thương hiệu thật.

## Risks
- **Hạ tầng free không chịu được tải:** load test chạy trên máy local (Docker); số đo ghi kèm cấu hình máy.
- **Chi phí vận hành demo:** Render free (API), Vercel free (web), Neon free (Postgres 0,5 GB), Upstash Redis free hoặc Render Key Value. Ước tính $0/tháng; giới hạn là service ngủ sau 15 phút không có request.
- **Phạm vi dễ phình:** sơ đồ ghế đã đưa vào non-goals.

## Open questions (mặc định đang dùng)
1. Thời gian giữ ghế: **10 phút**.
2. Số vé tối đa mỗi đơn: **4**; mỗi email tối đa **4 vé cho một sự kiện** (chống đầu cơ).
3. Tốc độ cho vào từ hàng chờ: **50 người/giây**; access token có hạn **15 phút**.
4. Cổng thanh toán mặc định khi chạy local: **fake**; PayOS bật khi có key.
