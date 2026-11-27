# ADR 0005: Môi trường dev local và cấu hình

**Trạng thái:** Chấp nhận (27/11/2026)

- `docker compose up -d` chạy Postgres 17 (cổng 5440) và Redis 7 (cổng 6390). Cổng lệch mặc định để không đụng các dự án khác.
- `pnpm migrate && pnpm seed` tạo schema và 1 sự kiện mẫu đang mở bán.
- Env được validate bằng zod lúc khởi động (`apps/api/src/env.ts`); thiếu biến bắt buộc ở production thì process thoát ngay.
- `.env.example` là danh sách đầy đủ; `.env*` khác bị gitignore và bị hook chặn đọc.
- Migration theo kiểu expand → contract; mỗi file SQL chạy trong 1 transaction, lưu vào bảng `schema_migrations`.
- Threat model ngắn: webhook (giả mạo → HMAC + timing-safe), access token (giả mạo → HMAC + exp), admin (token riêng, so sánh timing-safe), lạm dụng (rate limit theo IP, tối đa 4 vé mỗi email mỗi sự kiện).
