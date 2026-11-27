---
paths: ["apps/api/**", "packages/db/**"]
---
- Validate input bằng zod (`parse(schema, body)` trong `common/validate.ts`); lỗi → 422 problem+json.
- Truy vấn khoá ghế/đơn: luôn trong `sql.begin`, dùng `FOR UPDATE SKIP LOCKED` hoặc điều kiện trong `UPDATE`. Xem ADR 0001.
- Thêm cột/bảng: viết migration mới `packages/db/sql/NNN_*.sql`, không sửa migration cũ. Query mới chạy trên bảng lớn phải có index, kiểm bằng EXPLAIN.
- Mỗi hành vi có test tích hợp với DB thật; test đồng thời dùng `Promise.all`.
