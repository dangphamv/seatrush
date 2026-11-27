# ADR 0004: Stack, hosting và build image

**Trạng thái:** Chấp nhận (27/11/2026)

## Quyết định
- **Monorepo** pnpm + Turborepo: `apps/api` (NestJS 12), `apps/web` (Next.js 16, Tailwind 4), `packages/db` (postgres.js + migration SQL thuần). Cùng stack với Kịp.
- **Không dùng ORM:** truy vấn khoá ghế cần SQL chính xác (`SKIP LOCKED`, CTE), ORM che mất phần cần học.
- **Build image ở GitHub Actions**, quét Trivy, push lên `ghcr.io/<owner>/seatrush-{api,web}:<sha>`. Nơi chạy (Render "existing image", hoặc VPS `docker compose`) chỉ kéo image về. Image đã test chính là image chạy.
- **Demo:** Postgres (Neon free), Redis (Upstash/Render Key Value free), API trên Render, web trên Vercel. Load test **không** chạy trên hạ tầng free.

## Hệ quả
- Phải cấp cho Render quyền kéo image private từ ghcr (hoặc để package public).
- Phút Actions bị trừ quota nếu repo private.
