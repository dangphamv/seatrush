# SeatRush: User stories

> Nguồn: @docs/prd.md. Mỗi story xong phải có test và được tick ở đây. Kích thước: S/M/L.

## EVT: Danh mục
### [ ] EVT-01 Xem danh sách sự kiện (S)
As a người mua, I want xem các sự kiện đang và sắp mở bán, so that biết lúc nào cần vào.
- Given có 2 sự kiện `on_sale` và 1 sự kiện `draft`, When gọi `GET /v1/events`, Then trả về 2 sự kiện, sắp theo `sales_open_at` tăng dần, không có sự kiện `draft`.

### [ ] EVT-02 Xem chi tiết sự kiện và số ghế còn (S, phụ thuộc EVT-01)
- Given sự kiện có khu vực A còn 10 ghế trống và 2 ghế đang giữ đã hết hạn, When gọi `GET /v1/events/:id`, Then khu vực A báo `available = 12`.
- Given id không tồn tại, Then trả về 404 dạng problem+json.

### [ ] EVT-03 Admin tạo sự kiện kèm khu vực và sinh ghế (M)
- Given admin token hợp lệ, When `POST /v1/admin/events` với 2 khu vực (rows × seats_per_row), Then tạo đúng số ghế và trả về 201.
- Given không có token hoặc sai token, Then 401.

## QUE: Phòng chờ ảo
### [ ] QUE-01 Vào hàng chờ (M)
- Given sự kiện chưa tới `sales_open_at`, When `POST /v1/events/:id/queue`, Then 409 `sales_not_open`.
- Given đã mở bán, When client vào hàng chờ 2 lần với cùng `client id`, Then chỉ có 1 vị trí (vị trí không đổi).

### [ ] QUE-02 Xem vị trí và được cho vào (M, phụ thuộc QUE-01)
- Given tốc độ cho vào là N người/giây, When đã qua t giây kể từ lúc mở bán, Then N×t người đầu hàng có `admitted = true` kèm `accessToken`.
- Given chưa tới lượt, Then trả về `position` và `etaSeconds`, không có token.

### [ ] QUE-03 Access token bảo vệ bước giữ ghế (S)
- Given token hết hạn, sai chữ ký, hoặc của sự kiện khác, When `POST /v1/orders`, Then 403.

## HLD: Giữ ghế
### [ ] HLD-01 Giữ ghế theo khu vực và số lượng (L, phụ thuộc QUE-03)
- Given khu vực còn ≥ q ghế, When `POST /v1/orders {sectionId, quantity: q, email}`, Then tạo đơn `pending`, giữ q ghế liền nhau theo thứ tự hàng/số, `expiresAt = now + 10 phút`.
- Given khu vực còn ít hơn q ghế, Then 409 `not_enough_seats` và không giữ ghế nào (all-or-nothing).
- Given q > 4 hoặc email đã có 4 vé cho sự kiện này, Then 422.

### [ ] HLD-02 Không giữ trùng dưới tải (L)
- Given khu vực có 50 ghế, When 200 request giữ 1 ghế chạy đồng thời, Then đúng 50 request thành công, 150 nhận 409, và không có ghế nào thuộc 2 đơn.

### [ ] HLD-03 Idempotency key (M)
- Given cùng `Idempotency-Key` và cùng client gửi lại `POST /v1/orders`, Then trả về đúng đơn cũ, không giữ thêm ghế.

### [ ] HLD-04 Hết hạn giữ ghế (M)
- Given đơn `pending` quá `expiresAt`, When job dọn chạy, Then đơn chuyển `expired`, ghế về `available`, phát event `order.expired`.
- Given ghế đã hết hạn giữ nhưng job chưa chạy, Then người khác vẫn giữ được ghế đó.

## PAY: Thanh toán
### [ ] PAY-01 Tạo link thanh toán (M, phụ thuộc HLD-01)
- Given đơn `pending` chưa hết hạn, When `POST /v1/orders/:id/checkout`, Then trả về `checkoutUrl` của cổng đang dùng (fake/PayOS).
- Given đơn đã `expired` hoặc `confirmed`, Then 409.

### [ ] PAY-02 Webhook xác nhận đơn (L)
- Given webhook có chữ ký hợp lệ, số tiền đúng, đơn còn hạn, Then đơn `confirmed`, mỗi ghế có 1 vé, ghế `sold`, phát `order.confirmed`, tất cả trong 1 transaction.
- Given chữ ký sai, Then 401, không đổi gì.
- Given số tiền khác tổng đơn, Then đơn `refund_required`.

### [ ] PAY-03 Webhook trùng hoặc trễ (L)
- Given cùng một webhook đến 2 lần (kể cả đồng thời), Then chỉ xử lý 1 lần, lần sau trả 200.
- Given tiền đến sau khi đơn đã `expired`, Then đơn `refund_required`, không cấp vé, phát `order.refund_required`.

## NTF: Thông báo
### [ ] NTF-01 Outbox → Redis Streams → notifier (M)
- Given event đã ghi vào outbox trong transaction xác nhận đơn, When relay chạy, Then event được đẩy lên stream và đánh dấu `published_at`.
- Given notifier nhận cùng một event 2 lần, Then chỉ tạo 1 thông báo.

## ADM: Dashboard
### [ ] ADM-01 Số liệu realtime (M)
- Given admin token, When mở `GET /v1/admin/events/:id/stats/stream` (SSE), Then mỗi giây nhận `{available, held, sold, revenue, queueLength, admitted}`.

## WEB: Giao diện
### [ ] WEB-01 Trang sự kiện và vào hàng chờ (M)
### [ ] WEB-02 Phòng chờ có vị trí, ETA, tự chuyển trang khi tới lượt (M)
### [ ] WEB-03 Chọn khu vực/số lượng, đếm ngược giữ ghế, thanh toán (L)
### [ ] WEB-04 Trang đơn hàng: trạng thái, mã vé (S)
### [ ] WEB-05 Cổng thanh toán giả lập (S)
### [ ] WEB-06 Dashboard admin realtime (M)

## OPS
### [ ] OPS-01 Load test k6 và truy vấn kiểm tra bán trùng (M)
### [ ] OPS-02 Dockerfile multi-stage, CI build + quét Trivy, push ghcr.io theo SHA (M)
### [ ] OPS-03 Metrics Prometheus, health check, runbook (S)

## Business rules
- Giá lưu bằng số nguyên VND (`bigint`), không dùng float.
- Thời gian lưu `timestamptz`, hiển thị theo `Asia/Ho_Chi_Minh`.
- State machine đơn hàng: `pending → confirmed | expired | refund_required`; `expired → refund_required` (khi tiền đến trễ). Không có đường đi khác.
- Ghế: `available → held → sold`; `held → available` khi đơn hết hạn.

## Ma trận quyền
| Hành động | Khách (không token) | Khách đã được cho vào | Admin |
|---|---|---|---|
| Xem sự kiện | ✅ | ✅ | ✅ |
| Vào hàng chờ, xem vị trí | ✅ | ✅ | ✅ |
| Giữ ghế | ❌ 403 | ✅ | ❌ (admin không mua) |
| Xem đơn của mình | Cần `client id` khớp | ✅ | ✅ |
| Tạo sự kiện, xem dashboard | ❌ 401 | ❌ 401 | ✅ |
| Webhook | Chỉ khi có chữ ký hợp lệ | | |
