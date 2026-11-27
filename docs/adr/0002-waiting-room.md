# ADR 0002: Phòng chờ ảo

**Trạng thái:** Chấp nhận (27/11/2026)

## Bối cảnh
Lúc mở bán, số người vào có thể gấp 100 lần sức chứa của API giữ ghế. Cần điều tiết lượng người vào và cho người mua biết vị trí của mình.

## Phương án
- **A. Rate limit thẳng trên `POST /orders`:** ai nhanh tay thì được, người còn lại nhận 429 và F5 liên tục, làm tải tăng thêm.
- **B. Hàng đợi FIFO trong Redis + "vạch cho vào" tăng theo thời gian:** công bằng, chi phí O(log n) mỗi lần hỏi vị trí.
- **C. Dịch vụ ngoài (Cloudflare Waiting Room, Queue-it):** tốt cho production, nhưng không học được gì và tốn phí.

## Quyết định
**B.**
- `INCR queue:{event}:seq` cấp số thứ tự; `ZADD NX queue:{event} seq clientId` (NX nên gọi lại không đổi vị trí).
- Vạch cho vào: `admitted = floor((now - salesOpenAt) × rate)`, tính được từ thời gian nên **không cần job chạy nền** và nhiều instance API cho cùng kết quả.
- `ZRANK < admitted` → được vào. API cấp **access token ký HMAC** gồm `eventId, clientId, exp` (mặc định 15 phút). Bước giữ ghế chỉ kiểm chữ ký, không gọi Redis.
- ETA = `(rank - admitted) / rate`.

## Hệ quả
- Người được cho vào nhưng không mua thì vẫn chiếm lượt. Chấp nhận được, vì ghế còn lại vẫn được người sau giữ khi họ tới lượt.
- Tốc độ cho vào cố định, chưa tự điều chỉnh theo tải DB. Ghi vào backlog.
