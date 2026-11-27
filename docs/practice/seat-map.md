# Thực hành playbook: chọn ghế trên sơ đồ (SEAT)

> Mục tiêu: đi đủ 8 giai đoạn của `~/project/claude-code-playbook.html`, Danny quyết định ở mỗi điểm dừng.
> Mỗi giai đoạn kết thúc bằng một file trong repo và một commit, để sau này kể lại được khi phỏng vấn.

## Bắt đầu
```bash
cd ~/project/seatrush && claude          # hook, skill, subagent của dự án được nạp
```
Câu mở đầu:
> Thực hành playbook cho tính năng "chọn ghế trên sơ đồ" (docs/practice/seat-map.md).
> Làm từng giai đoạn, cuối mỗi giai đoạn DỪNG và hỏi tôi bằng AskUserQuestion. Không tự sang giai đoạn sau.

## Điểm dừng
| # | Giai đoạn | Claude làm | Danny quyết | Xong khi |
|---|---|---|---|---|
| 1 | Product (plan mode) | Hỏi tối đa 8 câu: ai dùng, có giữ chế độ chọn theo khu không, mobile, số ghế tối đa trên sơ đồ | Phạm vi MVP, non-goals | Mục "Chọn ghế trên sơ đồ" trong `docs/prd.md` |
| 2 | BA | Stories SEAT-01..n có tiêu chí Given/When/Then; subagent `product-manager` review | Quy tắc: ghế lẻ bị bỏ trống, giữ bao lâu, 2 người cùng bấm 1 ghế thì sao | `docs/stories.md`, `docs/api-contract.yaml` |
| 3 | UX | 2–3 hướng sơ đồ (SVG / canvas / lưới), prototype dạng Artifact, kiểm trên Chrome ở cỡ mobile | Chọn hướng, góp ý prototype | `docs/design/seat-map.md` |
| 4 | Kiến trúc (`/model opusplan`) | ADR: khoá theo từng ghế (`SELECT … FOR UPDATE NOWAIT` hay `UPDATE … WHERE status`), đẩy trạng thái ghế realtime (SSE hay hỏi định kỳ), tải sơ đồ lớn | Duyệt ADR và `docs/plan.md` (`Ctrl+G` để sửa) | `docs/adr/0006-*.md`, `docs/plan.md` |
| 5 | Build | `/new-feature SEAT-01`: liệt kê file → chờ duyệt → test fail → commit test → code → test pass | Duyệt danh sách file, xem test fail trước khi code | Mỗi story có 2 commit `test(SEAT-xx)` rồi `feat(SEAT-xx)` |
| 6 | QA | `/code-review medium`, `/security-review`, Playwright E2E cho flow chọn ghế, test 2 người cùng bấm 1 ghế | Chọn lỗi nào sửa | `docs/test-plan.md` cập nhật, `apps/web/e2e/*.spec.ts` |
| 7 | DevOps | `/ship`: PR → CI → canh PR | Merge PR, duyệt deploy theo SHA | PR merged, demo cập nhật |
| 8 | Vận hành | `/schedule`: mỗi sáng kiểm tra `/health` và số đơn `refund_required` | Duyệt routine | Routine chạy, `docs/runbook.md` cập nhật |

## Ghi chú phỏng vấn (điền sau mỗi giai đoạn)
| Giai đoạn | Mình đã quyết gì | Vì sao | Bằng chứng (file/commit) |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |
| 6 | | | |
| 7 | | | |
| 8 | | | |

Câu kể mẫu: *"Tôi đóng vai tech lead: chốt yêu cầu, duyệt kiến trúc, viết hoặc duyệt test. AI viết phần còn lại trong khuôn khổ có hook (typecheck mỗi lượt, chặn đọc .env), TDD và review nhiều tầng. Mỗi bước để lại một file trong repo."*
