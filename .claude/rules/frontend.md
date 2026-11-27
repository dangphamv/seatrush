---
paths: ["apps/web/**"]
---
- Màu và khoảng cách lấy từ token trong `app/globals.css` (`--color-*`), không viết mã màu trực tiếp trong component.
- Tiền: `formatVnd()`; ngày: `formatDate()` (Asia/Ho_Chi_Minh) trong `lib/format.ts`.
- Mọi màn hình có đủ trạng thái: đang tải, lỗi, rỗng. Đếm ngược và vị trí hàng chờ dùng `aria-live="polite"`.
- Gọi API qua `lib/api.ts`, kiểu dữ liệu theo `docs/api-contract.yaml`.
