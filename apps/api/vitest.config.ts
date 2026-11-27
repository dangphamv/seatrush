import { defineConfig } from "vitest/config";

// Test dùng chung 1 DB/Redis thật → chạy tuần tự từng file.
export default defineConfig({ test: { fileParallelism: false, testTimeout: 20_000, hookTimeout: 30_000 } });
