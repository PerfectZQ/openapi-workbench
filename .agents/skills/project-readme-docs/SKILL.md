---
name: project-readme-docs
description: 维护项目 README、架构、模块文档及 .feature 阶段记录。
---

# 项目文档

先读 `doc/development/documentation-guidelines.md`。

根 README 保留定位、稳定入口、结构和文档索引；架构文档说明真实边界、调用流程和公开契约，优先用简单流程图和职责表。临时计划、进度与验证放 `.feature/<module>/<YYYY-MM>/<YYYYMMDD-HHMMSS>-<具体需求>/`，不要将阶段记录堆到根目录。

文档与实现同步更新，删除或移动文件同时修复引用；命令必须可执行、相对链接必须存在。只维护仓库内版本，外部文档仅作为链接。不得把本地测试描述成线上发布，只有 GitHub tag/Release 和远端产物验证成功才记录发布完成。
