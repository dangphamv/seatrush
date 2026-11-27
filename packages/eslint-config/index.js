// ESLint dùng chung cho package Node (api, db). apps/web dùng eslint-config-next.
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["dist/**", "coverage/**"]),
  js.configs.recommended,
  { languageOptions: { globals: globals.node } },
  tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: { parserOptions: { projectService: true } },
    rules: {
      // Promise quên await trong pipeline/worker = lỗi im lặng hoặc process thoát sớm.
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      // Tham số chỉ để validate/đúng chữ ký (vd. body xác nhận) → đặt tên bắt đầu bằng "_".
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
]);
