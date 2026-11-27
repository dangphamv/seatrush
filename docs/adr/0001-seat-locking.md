# ADR 0001: Khoá ghế khi giữ chỗ

**Trạng thái:** Chấp nhận (27/11/2026)

## Bối cảnh
Hàng nghìn request cùng giữ ghế trong một khu vực. Yêu cầu: không bán trùng (G1), giữ all-or-nothing, không để request phải xếp hàng chờ khoá của nhau.

## Phương án
| | Cách làm | Ưu | Nhược |
|---|---|---|---|
| A | `SELECT ... FOR UPDATE` các ghế trống đầu tiên | Đơn giản | Mọi request cùng nhắm vào N ghế đầu, xếp hàng chờ khoá của nhau, throughput sụp |
| B | Optimistic: `UPDATE seats SET ... WHERE id = ? AND status='available'`, sai thì thử lại | Không chờ khoá | Dưới tải cao, tỉ lệ va chạm cao → thử lại nhiều lần |
| C | `FOR UPDATE SKIP LOCKED` trong CTE, rồi `UPDATE` các ghế đã khoá | Mỗi request lấy một nhóm ghế khác nhau, không chờ nhau | Ghế "liền nhau" chỉ gần đúng khi tranh chấp cao |
| D | Đếm tồn kho trong Redis (`DECRBY`) rồi mới ghi DB | Nhanh nhất | 2 nguồn sự thật, phải đối soát khi Redis mất dữ liệu |

## Quyết định
**C**, cộng 2 lớp bảo vệ:
1. Điều kiện lọc gồm cả ghế giữ đã hết hạn (`status='held' AND held_until < now()`), nên không phụ thuộc vào job dọn.
2. Nếu số ghế khoá được < số lượng yêu cầu → rollback toàn bộ (all-or-nothing).
3. `tickets.seat_id UNIQUE`: dù logic sai ở đâu, DB vẫn chặn được một ghế có 2 vé.
4. Xác nhận đơn: `UPDATE seats SET status='sold' WHERE order_id = $1 AND status='held'`; số dòng phải bằng `quantity`, nếu không thì đơn đã mất ghế (hết hạn, người khác giữ) → `refund_required`.

## Hệ quả
- Isolation để mặc định Read Committed là đủ, vì mọi kiểm tra đều nằm trong điều kiện `UPDATE`/khoá dòng.
- Phương án D để dành nếu số đo k6 cho thấy DB là nút thắt; phòng chờ (ADR 0002) đã giới hạn tải vào DB.
