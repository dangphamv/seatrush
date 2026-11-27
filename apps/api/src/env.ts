import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  DB_POOL_MAX: z.coerce.number().default(20),
  REDIS_URL: z.string().default("redis://localhost:6390"),
  WEB_URL: z.string().url().default("http://localhost:3000"),
  API_URL: z.string().url().default("http://localhost:4000"),
  ADMIN_TOKEN: z.string().min(12),
  ACCESS_TOKEN_SECRET: z.string().min(16),
  SEATRUSH_ADMIT_RATE: z.coerce.number().positive().default(50),
  SEATRUSH_ACCESS_MINUTES: z.coerce.number().positive().default(15),
  SEATRUSH_HOLD_MINUTES: z.coerce.number().positive().default(10),
  SEATRUSH_MAX_TICKETS: z.coerce.number().int().positive().default(4),
  // Số request mỗi IP mỗi giây; 0 = tắt (load test chạy từ 1 IP).
  SEATRUSH_RATE_LIMIT: z.coerce.number().int().min(0).default(20),
  // 0 = không chạy relay/notifier/dọn đơn trong process (test tự gọi).
  SEATRUSH_WORKERS: z.enum(["0", "1"]).default("1"),
  // Bản demo công khai không có key PayOS: bật cổng giả lập một cách tường minh (mặc định tắt ở production).
  SEATRUSH_FAKE_PAYMENTS: z.enum(["0", "1"]).default("0"),
  PAYOS_CLIENT_ID: z.string().optional(),
  PAYOS_API_KEY: z.string().optional(),
  PAYOS_CHECKSUM_KEY: z.string().optional(),
});

// Validate lúc khởi động: thiếu biến bắt buộc thì process thoát ngay, không chạy nửa vời.
const parsed = schema.safeParse(Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== "")));
if (!parsed.success) {
  console.error("Invalid environment:", z.prettifyError(parsed.error));
  process.exit(1);
}
export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";
