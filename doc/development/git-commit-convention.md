# Git 与发布

提交格式为 `<type>(<scope>): <准确的中文结果>`，type 使用 feat/fix/refactor/perf/test/docs/build/ci/chore/revert；scope 使用 contract/sdkgen/frontend/repo/deps 等真实模块。标题不超过 72 字符、不带句号，正文前空一行。一个提交只表达一个可独立解释的变更，包含必要测试与文档。

默认分支为 main；开发分支使用 codex/<topic>。保持线性历史，不使用普通 merge 制造双父提交；只做快进或整理后的 squash。禁止覆盖已发布 tag、Release 资产或主分支历史。

执行 `./script/bootstrap.sh` 为当前仓库启用 `.githooks/commit-msg`、提交模板和 pull/merge 的 fast-forward-only；不修改全局 Git 配置。

发布前通过 `./script/check.sh`，两个前端包使用相同版本。创建 `vX.Y.Z` tag 后，GitHub Actions 验证、打包并创建同版本 Release：Go module 从 tag 获取，前端从 Release 的 npm tgz 获取。版本检查失败即停止，不回退其他包。

消费端固定 GitHub 版本，并保留 go.sum/package-lock.json。升级通过显式改版本、构建和验证完成，不在构建时偷偷跟随 latest。生成器和工作台的协议变更必须同版本验证。
