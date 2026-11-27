---
name: release
description: Release production theo checklist
disable-model-invocation: true
allowed-tools: Bash(pnpm *), Bash(git tag *), Bash(gh release *), Bash(gh run *)
---
Version hiện tại: !`git describe --tags --abbrev=0 2>/dev/null || echo "chưa có tag"`
1. Xác nhận CI main xanh (`gh run list -b main -L 1`) và image `:<sha>` đã có trên ghcr
2. Sinh release notes từ commit kể từ tag trên, nhóm theo feat/fix
3. HỎI tôi trước khi: migrate DB production, deploy production
4. Smoke test theo docs/runbook.md (health, danh sách sự kiện, vào hàng chờ)
5. Tag + `gh release create`
