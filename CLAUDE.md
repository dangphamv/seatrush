# SeatRush

Bán vé concert chịu tải mở bán: phòng chờ ảo, giữ ghế có hạn, webhook thanh toán idempotent, không bán trùng ghế.

## Stack
- API: NestJS 12 + postgres.js (SQL thuần, không ORM) + ioredis: `apps/api`
- Web: Next.js 16 App Router + Tailwind 4: `apps/web`
- DB: migration SQL trong `packages/db/sql`, chạy bằng `pnpm migrate`
- Monorepo: pnpm 9 + Turborepo. Dev: `docker compose up -d` (Postgres :5440, Redis :6390)

## Lệnh
- `pnpm dev` | `pnpm test` | `pnpm lint` | `pnpm typecheck` | `pnpm build`
- `pnpm migrate` | `pnpm seed` (sự kiện mẫu đang mở bán)
- Test 1 file: `pnpm --filter @seatrush/api test -- src/orders/orders.test.ts`
- Load test: `pnpm loadtest` (k6 trong Docker) rồi `pnpm verify` (kiểm bất biến)

## Quy ước
- Yêu cầu: @docs/prd.md, @docs/stories.md. Quyết định: `docs/adr/`.
- API contract: @docs/api-contract.yaml. Đổi API thì sửa file này trước.
- Lỗi trả về problem+json qua `ApiError` (`apps/api/src/common/errors.ts`).
- Tiền là số nguyên VND. Thời gian là `timestamptz`.
- Mọi thay đổi trạng thái đơn chạy trong 1 transaction và ghi outbox trong chính transaction đó.
- Test tích hợp chạy với Postgres/Redis thật (docker compose), không mock DB.
- Conventional commits. Mỗi story xong: có test, tick trong `docs/stories.md`.

## Không được
- Không đọc/sửa `.env*` (trừ `.env.example`). Không chạy migration lên DB production.
- Không dùng tên, logo hay giao diện của đơn vị bán vé thật.
