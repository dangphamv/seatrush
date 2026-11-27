# Test plan và kết quả

## Ma trận test tự động (`pnpm test`, Postgres + Redis thật)
| Story | Case | File |
|---|---|---|
| EVT-01 | Chỉ sự kiện on_sale, sắp theo giờ mở bán | `apps/api/src/events/events.test.ts` |
| EVT-02 | Ghế giữ hết hạn tính là còn; 404 problem+json | `events.test.ts` |
| EVT-03 | Admin tạo sự kiện + sinh ghế (hàng AA sau Z); 401 sai/thiếu token; 409 trùng slug; 422 | `events.test.ts` |
| QUE-01 | 409 trước giờ mở bán; vào 2 lần (cả song song) giữ nguyên vị trí | `queue/queue.test.ts` |
| QUE-02 | Đầu hàng được vào, người sau có vị trí + ETA, không có token; 404 khi chưa vào hàng | `queue.test.ts` |
| QUE-03 | Token sai chữ ký / hết hạn / khác client / khác sự kiện → 403 | `queue.test.ts` |
| HLD-01 | Giữ ghế liền nhau theo hàng, 10 phút; all-or-nothing; 422 > 4 vé; 400 thiếu key; **giới hạn vé theo email với 4 đơn song song** | `orders/orders.test.ts` |
| HLD-02 | **200 request đồng thời / 50 ghế → đúng 50 đơn, 150 nhận 409, không ghế nào thuộc 2 đơn** | `orders.test.ts` |
| HLD-03 | Cùng Idempotency-Key gửi song song → 1 đơn (201 + 200) | `orders.test.ts` |
| HLD-04 | Job dọn: expired, trả ghế, phát order.expired; ghế đã sang đơn mới không bị trả; người khác xem đơn → 404 | `orders.test.ts` |
| PAY-01 | Link thanh toán chỉ cho đơn còn trả được | `payments/payments.test.ts` |
| PAY-02 | Xác nhận + vé + outbox trong 1 transaction; chữ ký sai → 401; sai số tiền → hoàn tiền | `payments.test.ts` |
| PAY-03 | **Webhook gửi 10 lần đồng thời → xử lý đúng 1 lần**; tiền đến sau khi hết hạn → hoàn tiền; ghế đã bị người khác lấy → hoàn tiền | `payments.test.ts` |
| NTF-01 | Relay đẩy lên stream 1 lần; consumer giao lại không tạo thông báo trùng; 4 relay song song không đẩy trùng | `outbox/outbox.test.ts` |
| ADM-01 | Số liệu đúng; SSE gửi dữ liệu; 401 | `admin/admin.test.ts` |

Kết quả: **27/27 pass**, chạy 3 lần liên tiếp không flaky (27/11/2026).

## E2E thủ công trên Chrome (27/11/2026)
Trang sự kiện → vào hàng chờ → chọn VIP × 2 → đếm ngược 10:00 → cổng giả lập → đơn "Đã xác nhận" với 2 mã vé → dashboard admin cập nhật (2 đã bán, 7.000.000 ₫). Console không có lỗi.

## Load test (OPS-01)
Lệnh: `VUS=1000 BUYERS_PER_VU=3 SEATS=2000 ADMIT_RATE=<n> pnpm loadtest`. 3.000 người mua tranh 2.000 ghế; mỗi người vào hàng chờ, chờ tới lượt, giữ 1–2 ghế, 80% thanh toán.

Môi trường: MacBook Pro (MacBookPro18,3, 8 CPU), Docker 8 CPU / 8 GB; 1 container API (image production), Postgres 17 và Redis 7 trong Docker, `DB_POOL_MAX=30`. Số đo trên máy dev, không phải hạ tầng production.

| | A. Không điều tiết (`ADMIT_RATE=100000`) | B. Phòng chờ 200 người/giây |
|---|---|---|
| p95 giữ ghế (`POST /orders`) | **980 ms** | **211 ms** |
| p99 giữ ghế | 1,02 s | 249 ms |
| p95 hỏi vị trí hàng chờ | — (vào ngay) | 27 ms |
| Thời gian chờ trong hàng, p95 | 2,6 s | 5,1 s |
| Tổng request / lỗi | 7.062 / **0** | 30.152 / **0** |
| Giữ được ghế / hết ghế (409) | 1.326 / 1.674 | 1.333 / 1.667 |
| Bán trùng ghế (`pnpm verify`) | **0** | **0** |

Đọc kết quả:
- Cả 2 cấu hình đều **không bán trùng ghế nào** và không có lỗi 5xx: tính đúng đắn không phụ thuộc tải (ADR 0001).
- Phòng chờ giảm p95 giữ ghế **4,6 lần** (980 → 211 ms), đổi lại người mua chờ thêm khoảng 2,5 giây trong hàng. Đây đúng là đánh đổi của ADR 0002: dồn tải vào Redis (rẻ) thay vì vào transaction Postgres (đắt).
- Chưa đo: độ trễ từ webhook tới thông báo (PRD đặt p95 < 2 s); cần thêm timestamp vào `notifications`.

Dữ liệu gốc: `docs/loadtest/*/k6.txt`, `verify.txt`, `env.txt`.
