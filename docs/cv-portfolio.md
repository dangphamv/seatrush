# SeatRush cho CV và portfolio (bản nháp, số đo thật ngày 27/11/2026)

## CV: 1 dự án, 3 gạch đầu dòng
**SeatRush**: concert ticketing under flash-sale load · NestJS, PostgreSQL, Redis, Next.js, k6, Docker, GitHub Actions
- Built a ticketing system with a Redis virtual waiting room, 10-minute seat holds and PayOS webhooks; **0 double-sold seats across 3,000 simulated buyers contending for 2,000 seats** (k6, invariants checked in SQL after every run).
- Cut seat-hold p95 latency **from 980 ms to 211 ms** by admitting buyers at a fixed rate with HMAC-signed access tokens, and taking row locks with `FOR UPDATE SKIP LOCKED` so concurrent buyers never wait on each other.
- Made payments idempotent (unique provider reference, late or mismatched payments routed to refund) and published booking events via a transactional outbox to Redis Streams; images are built once in CI, scanned with Trivy and pushed to GHCR by commit SHA.

## Portfolio: thẻ dự án
- **Tiêu đề:** SeatRush
- **Một câu:** Bán vé concert lúc mở bán mà không ai mua trùng ghế.
- **Flow:** hàng chờ Redis → access token → giữ ghế SKIP LOCKED → webhook idempotent → outbox → thông báo
- **Số liệu:** 0 ghế bán trùng / 3.000 người mua · p95 giữ ghế 980 → 211 ms · 27 test tích hợp trên DB thật
- **Stack:** NestJS, PostgreSQL, Redis, Next.js 16, k6, Docker, GitHub Actions
- **Link:** repo GitHub (cần tạo), demo (cần deploy), video 30 giây chạy k6 + dashboard admin (cần quay)

## Câu chuyện phỏng vấn (STAR, khoảng 2 phút)
- **S:** Concert lớn ở VN có hàng chục nghìn người vào cùng lúc; báo chí từng đưa tin "cháy vé, sập hệ thống".
- **T:** Không bán trùng ghế, không mất tiền của người mua, API vẫn phản hồi dưới 300 ms khi tải gấp nhiều lần sức chứa.
- **A:** So 4 cách khoá ghế (ADR 0001) và chọn SKIP LOCKED + UNIQUE làm lớp chặn cuối; phòng chờ tính vạch cho vào theo thời gian nên không cần job nền (ADR 0002); webhook idempotent bằng unique reference; outbox để thông báo không mất, không sai.
- **R:** 0 ghế trùng ở cả 2 cấu hình tải; phòng chờ giảm p95 4,6 lần, đổi lại người mua chờ thêm khoảng 2,5 giây. Bài học: tính đúng đắn đặt ở DB (constraint), còn hiệu năng đặt ở cửa vào (điều tiết).

## Lưu ý trung thực
- Số đo trên MacBook Pro 8 CPU, Docker local, không phải hạ tầng production. Nói rõ khi được hỏi.
- Chưa đo: độ trễ webhook → thông báo; chưa có OpenTelemetry trace (PRD mục Should).
