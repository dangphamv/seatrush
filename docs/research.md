# SeatRush: nghiên cứu chủ đề (Giai đoạn 1, 27/11/2026)

> Đầu ra của giai đoạn Product theo `claude-code-playbook.html`. Giai đoạn sau đọc file này bằng `@docs/research.md`.
> Trạng thái: **chờ Danny chốt chủ đề**. Sau khi chốt mới viết `docs/prd.md`.

## Một câu
Hệ thống bán vé concert chịu được đợt mở bán dồn dập: có phòng chờ ảo, giữ ghế có thời hạn, thanh toán qua webhook, **không bán trùng một ghế nào**, có số đo tải thật.

## Vì sao chọn chủ đề này
1. **Portfolio đang lệch về AI.** Văn Bản Xanh, Kịp, AI Gateway, Lịch Âm và CQ 2.0 đều là ứng dụng LLM. Chưa có dự án nào chứng minh được xử lý tranh chấp đồng thời, thanh toán và tải cao, trong khi đó là phần chính của vòng phỏng vấn backend senior.
2. **JD senior fullstack thường hỏi đúng những thứ này** (theo các tin tuyển dụng tìm được, không phải khảo sát thị trường):
   - Event-driven, message queue (Kafka, Redis Streams, NATS) và delivery semantics (at-least-once, exactly-once).
   - Tối ưu query Postgres.
   - OpenTelemetry, Prometheus, dashboard SLO.
   - Viết design doc.
3. **"Design Ticketmaster" là đề system design kinh điển.** Có dự án chạy thật thì trả lời bằng số đo thật, không phải lý thuyết.
4. **Bài toán có thật ở Việt Nam, dễ kể cho HR:**
   - BIGBANG ở Mỹ Đình (8/2026): khoảng 60.000 người xếp hàng, vé đợt đại chúng hết trong hơn 1 giờ.
   - Concert Anh Trai: Znews có bài báo "cháy vé, sập hệ thống".
5. **Đã có sẵn trong lộ trình** (`Lo-trinh-du-an-Senior-Backend.html`, dự án số 2, chưa bắt đầu). Bao các câu phỏng vấn 3–7 và tuần 2 của kế hoạch PostgreSQL: lost update, `SKIP LOCKED`, idempotency, outbox.

## Phạm vi MVP (2 tuần, theo lịch mẫu của playbook)
| Phần | Làm gì | Kỹ thuật cần học |
|---|---|---|
| Danh mục | Sự kiện, khu vực, sơ đồ ghế | Mô hình dữ liệu, index, cache trang sự kiện |
| Phòng chờ ảo | Lúc mở bán, người mua vào hàng đợi, lấy token theo lượt | Redis sorted set, rate limit, đẩy vị trí hàng đợi bằng SSE |
| Giữ ghế | Giữ 10 phút, hết hạn thì tự trả ghế | `UPDATE ... WHERE status='available'` hoặc `FOR UPDATE SKIP LOCKED`, TTL, job dọn ghế hết hạn |
| Thanh toán | PayOS sandbox, webhook xác nhận | Kiểm chữ ký webhook, idempotency key, xử lý webhook đến trễ hoặc trùng |
| Sự kiện nội bộ | Đặt vé thành công thì gửi email hoặc thông báo | Outbox pattern, Redis Streams (sau này đổi sang Kafka trong dự án Notify) |
| Trang admin | Doanh số và ghế còn lại, cập nhật theo thời gian thực | SSE hoặc WebSocket, materialized view |
| Kiểm chứng | k6 mô phỏng 10k–50k người mua tranh ghế | Đếm số ghế bán trùng (phải bằng 0), đo p95, throughput |
| Vận hành | Docker, CI build image, đẩy lên ghcr.io, deploy | OTel, Prometheus, Grafana, runbook |

Stack: Next.js 16 + NestJS + PostgreSQL + Redis, monorepo pnpm/Turborepo, cùng stack với Kịp để tái dùng kinh nghiệm.

Ngoài phạm vi MVP: chọn ghế trên sơ đồ SVG phức tạp, bán lại vé, nhiều cổng thanh toán, Kafka/K8s (để dành cho dự án Notify).

## Kết quả để ghi vào CV (chỉ ghi số đo thật, chưa đo thì để trống)
Bản nháp, điền số sau khi chạy k6:

- Built a concert ticketing system with a virtual waiting room and time-limited seat holds; **0 double-sold seats across ___k simulated buyers** contending for ___ seats (k6).
- Kept checkout p95 at ___ ms under ___ req/s by gating traffic through a Redis queue and taking row locks with `SKIP LOCKED`.
- Made payment webhooks idempotent and published booking events through a transactional outbox, so retried or out-of-order webhooks never charged twice or lost a ticket.

Trang portfolio: sơ đồ kiến trúc, video 30 giây chạy k6 kèm dashboard Grafana, link ADR.

## Áp dụng playbook
| Ngày | Việc | File đầu ra | Tính năng Claude Code |
|---|---|---|---|
| 1 | Chốt chủ đề, PRD, `CLAUDE.md` | `docs/research.md`, `docs/prd.md`, `CLAUDE.md` | plan mode, brainstorming, `/init` |
| 2 | User story, AC, data model, API contract | `docs/stories.md`, `docs/api-contract.yaml` | subagent BA, AskUserQuestion |
| 3 | Luồng mua vé, prototype, design token | `docs/design/` | frontend-design, Artifacts |
| 4 | ADR (khoá ghế, hàng đợi, outbox), chia task, scaffold, CI | `docs/adr/*.md` | Plan agent, hooks, permissions |
| 5–9 | Build theo story bằng TDD, 2 track song song (web/api) | code + test | worktree, `/new-feature`, subagent, `/code-review` |
| 10–11 | E2E, k6, bug bash, security | `docs/test-plan.md`, kết quả k6 | Playwright MCP, `/security-review` |
| 12 | Docker, CI build image, đẩy lên ghcr.io, staging | `.github/workflows/` | skill deploy |
| 13 | Release | `docs/runbook.md` | `/ship` |
| 14 | Dashboard, retro, cập nhật CV và portfolio | — | `/schedule` |

## Rủi ro
- Không dùng tên, logo, giao diện của Ticketbox, CTicket hay ban tổ chức thật. Sự kiện trong demo là sự kiện giả.
- Hạ tầng free (Render, Neon) không chịu được k6. Chạy tải trên máy local hoặc trên runner GitHub, ghi rõ cấu hình máy cạnh số đo.
- 2 tuần là gọn nếu giữ đúng phạm vi. Chọn ghế trên sơ đồ là thứ dễ phình nhất, nên MVP chỉ chọn theo khu vực và số lượng.

## Phương án khác đã cân nhắc
- **Trình soạn thảo cộng tác thời gian thực (CRDT/Yjs):** mạnh về fullstack, frontend, WebSocket. Nhưng ít liên quan tới câu hỏi backend senior và khó đo bằng con số.
- **SaaS đa tenant có thu phí theo gói:** sát công việc thật (RLS, billing, webhook). Nhưng trùng nhiều với TaskFlow (RBAC/RLS) và PetZone.

## Nguồn
- Tin tuyển dụng: NFQ, Gradion, Qode, Caddi (Lever/Workable), Kafi (ITviec).
- vietnamplus.vn: vé BIGBANG Hà Nội hết trong hơn 1 tiếng.
- tienphong.vn: hàng trăm nghìn người săn vé Big Bang.
- znews.vn: concert Anh Trai cháy vé, sập hệ thống.
