# Runbook

## Deploy (build once, deploy many: ADR 0004)
1. Merge vào `main` → CI test → build image → Trivy → push `ghcr.io/<owner>/seatrush-{api,web}:<sha>` và `:main`.
2. Migration (trước khi đổi image API, migration chỉ thêm, không phá: expand → contract):
   `docker run --rm -e DATABASE_URL=... ghcr.io/<owner>/seatrush-api:<sha> node node_modules/@seatrush/db/dist/migrate.js`
3. Đổi image của service API/web sang tag `<sha>` (Render: Image URL; VPS: `docker compose pull && up -d`).
4. Smoke test bên dưới.

## Môi trường demo (27/11/2026)
| Thành phần | Ở đâu |
|---|---|
| API | Render free `seatrush-api` (`srv-dc4icomi0phs73abgudg`), image `ghcr.io/dangphamv/seatrush-api:<sha>`, https://seatrush-api.onrender.com |
| Web | Render free `seatrush-web` (`srv-dc4iebuc6qcc73dn3stg`), image `ghcr.io/dangphamv/seatrush-web:<sha>`, https://seatrush-web.onrender.com |
| Postgres | Neon `seatrush` (`lively-paper-83653661`, aws-ap-southeast-1) |
| Redis | Render Key Value `ai-gateway-kv`, **db 1** (workspace chỉ có 1 Redis free; ai-gateway dùng db 0) |
| Secret | `.env.production.local` (gitignore): `DATABASE_URL`, `ADMIN_TOKEN`, `ACCESS_TOKEN_SECRET` |
| Build | Biến repo `PUBLIC_API_URL` được nhúng vào image web lúc build |

Deploy 1 SHA: `POST /v1/services/<id>/deploys {"imageUrl": "ghcr.io/dangphamv/seatrush-<app>:<sha>"}` (Render API) cho api rồi web.
Chưa tự động: CI chưa gọi deploy hook (cần lưu URL hook làm secret của repo).

## Smoke test
```bash
curl -sf $API/health                       # {"status":"ok"} (kiểm cả Postgres và Redis)
curl -sf $API/v1/events | jq length         # >= 0
curl -sf $API/metrics | grep seatrush_events_total
```

## Rollback
- Ứng dụng: trỏ service về tag `<sha>` trước đó (image cũ còn trên ghcr, không build lại).
- DB: migration là expand-only nên code cũ chạy được trên schema mới; không rollback schema trừ khi có migration contract.

## Biến môi trường
Danh sách đầy đủ: `.env.example`. Bắt buộc ở production: `DATABASE_URL`, `REDIS_URL`, `ADMIN_TOKEN`, `ACCESS_TOKEN_SECRET`, `WEB_URL`, `PAYOS_*`
(thiếu PAYOS ở production → thanh toán tắt, `POST /checkout` trả 503). Bản demo công khai đặt `SEATRUSH_FAKE_PAYMENTS=1` để dùng cổng giả lập: ai cũng "trả tiền" được cho đơn bất kỳ, nên **không bao giờ bật cờ này khi bán vé thật**.

## Xoay vòng secret
- `ACCESS_TOKEN_SECRET`: đổi → mọi người đang trong lượt mua phải vào hàng chờ lại (vị trí giữ nguyên vì nằm trong Redis). Chỉ đổi ngoài giờ mở bán.
- `ADMIN_TOKEN`: đổi bất kỳ lúc nào.
- `PAYOS_CHECKSUM_KEY`: đổi trên PayOS và trên service cùng lúc; webhook ký bằng key cũ trong khoảng giữa sẽ bị 401 → PayOS gửi lại.

## Sự cố thường gặp
| Triệu chứng | Kiểm tra | Xử lý |
|---|---|---|
| p95 `POST /orders` tăng vọt lúc mở bán | `http_request_duration_seconds{route="/v1/orders"}`, `pg_stat_activity` | Giảm `SEATRUSH_ADMIT_RATE` rồi restart: người mua chờ lâu hơn nhưng DB không quá tải (docs/test-plan.md) |
| Đơn cần hoàn tiền | `select code, email, amount_vnd from orders where status = 'refund_required'` | Hoàn tiền thủ công qua PayOS, lý do nằm trong `payment_events.outcome` / outbox payload |
| Thông báo chậm hoặc không có | `select count(*) from outbox where published_at is null`; `XPENDING seatrush.orders notifier` | Relay/notifier chạy trong process API: xem log `Workers`; message treo > 30 s được nhận lại tự động |
| Ghế "giữ" mãi không trả | `select count(*) from orders where status = 'pending' and expires_at < now()` | Job dọn chạy mỗi 5 s; ghế hết hạn vẫn giữ lại được ngay cả khi job chậm (ADR 0001) |
| Nghi bán trùng | `psql -f scripts/verify.sql` | `tickets.seat_id UNIQUE` chặn ở DB; script báo FAIL nếu bất biến nào sai |
