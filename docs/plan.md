# Plan triển khai

Nguồn: @docs/stories.md, @docs/api-contract.yaml, `docs/adr/`.

## Phase 0: Scaffold (tuần tự)
| Task | File | DoD |
|---|---|---|
| Monorepo, tsconfig, eslint, turbo | `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `packages/{tsconfig,eslint-config}` | `pnpm typecheck` xanh |
| docker compose Postgres + Redis | `docker-compose.yml` | `docker compose up -d --wait` |
| Migration runner + schema | `packages/db` | `pnpm migrate` 2 lần không lỗi |
| API khung: env, health, problem+json, request id, metrics | `apps/api/src/{main,app.module,env,common}` | `GET /health` 200 |
| CI cơ bản | `.github/workflows/ci.yml` | lint, typecheck, test với service Postgres/Redis |

## Track BE (`apps/api`) — có thể chạy song song với Track FE sau khi contract chốt
| Thứ tự | Story | File | Test |
|---|---|---|---|
| 1 | EVT-01..03 | `events/` | danh sách, chi tiết, admin tạo sự kiện, 401 |
| 2 | QUE-01..03 | `queue/` | vào 2 lần cùng vị trí, vạch cho vào theo thời gian, token sai/hết hạn |
| 3 | HLD-01..04 | `orders/` | all-or-nothing, **200 request đồng thời / 50 ghế**, idempotency, hết hạn |
| 4 | PAY-01..03 | `payments/` | chữ ký sai, sai số tiền, **webhook trùng đồng thời**, tiền đến trễ |
| 5 | NTF-01 | `outbox/` | relay đẩy lên stream, consumer nhận 2 lần chỉ tạo 1 thông báo |
| 6 | ADM-01 | `admin/` | stats đúng số, SSE gửi dữ liệu |

## Track FE (`apps/web`)
WEB-01 → WEB-02 → WEB-03 → WEB-04/05 → WEB-06. Gọi API thật trên local (contract đã chốt, không cần mock).

## Track OPS
OPS-03 (metrics, health) cùng Phase 0 → OPS-01 (k6 + `verify.sql`) sau HLD/PAY → OPS-02 (Dockerfile, CI image, ghcr) cuối cùng.

## Definition of Done (mọi task)
Test pass trên DB thật · `pnpm lint typecheck` xanh · đúng contract · story được tick · commit conventional.
