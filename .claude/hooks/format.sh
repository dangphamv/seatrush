#!/usr/bin/env bash
# Chỉ lint file TS trong apps/packages; lỗi lint → exit 2 để Claude tự sửa.
f=$(jq -r '.tool_input.file_path // empty')
case "$f" in
  */apps/*.ts|*/apps/*.tsx|*/packages/*.ts)
    dir=$(echo "$f" | sed -E 's#(.*/(apps|packages)/[^/]+)/.*#\1#')
    (cd "$dir" && npx eslint --fix "$f") 1>&2 || exit 2 ;;
esac
