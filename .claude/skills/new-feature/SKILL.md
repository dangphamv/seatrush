---
name: new-feature
description: Thực hiện 1 user story end-to-end theo TDD
argument-hint: "<STORY-ID>"
disable-model-invocation: true
---
Story: $ARGUMENTS
1. Đọc story $ARGUMENTS trong @docs/stories.md và phần liên quan ở @docs/api-contract.yaml
2. Liệt kê file sẽ đổi, chờ tôi xác nhận
3. Viết test từ AC → chạy → phải FAIL → commit "test($ARGUMENTS): ..."
4. Implement tới khi `pnpm test` pass; KHÔNG sửa test
5. Đụng SQL/migration thì gọi subagent db-reviewer
6. Chạy /simplify rồi /code-review medium --fix
7. Tick checklist trong docs/stories.md, commit "feat($ARGUMENTS): ..."
