#!/usr/bin/env bash
f=$(jq -r '.tool_input.file_path // empty')
case "$(basename "$f")" in
  .env.example) exit 0 ;;
  .env*) echo "Không được chạm vào $f" >&2; exit 2 ;;
esac
