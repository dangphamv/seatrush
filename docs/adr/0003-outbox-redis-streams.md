# ADR 0003: Phát sự kiện bằng transactional outbox và Redis Streams

**Trạng thái:** Chấp nhận (27/11/2026)

## Bối cảnh
Khi đơn được xác nhận, cần gửi thông báo (email, sau này là dịch vụ Notify). Nếu gửi trực tiếp trong request: DB commit xong mà gửi lỗi thì mất thông báo; gửi xong mà DB rollback thì thông báo sai.

## Quyết định
- Ghi event vào bảng `outbox` **trong cùng transaction** với thay đổi trạng thái đơn.
- Relay (chạy trong process API, mỗi 500 ms): `SELECT ... WHERE published_at IS NULL ORDER BY id LIMIT 100 FOR UPDATE SKIP LOCKED` → `XADD seatrush.orders` → đặt `published_at`. Nhiều instance chạy cùng lúc cũng không đẩy trùng trong lúc bình thường.
- Notifier đọc bằng consumer group (`XREADGROUP`), ghi `notifications` với `event_id UNIQUE` (`ON CONFLICT DO NOTHING`), rồi `XACK`. Giao **ít nhất 1 lần** (at-least-once), consumer idempotent nên kết quả như đúng 1 lần.
- Message chưa ack quá 30 giây được nhận lại bằng `XAUTOCLAIM`.

## Vì sao chưa dùng Kafka
Redis đã có sẵn cho phòng chờ; một topic, một consumer. Dự án Notify (lộ trình #3) sẽ thay bằng Kafka, chỉ cần đổi relay vì định dạng event đã ổn định.
