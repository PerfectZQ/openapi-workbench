# 文档规范

根 `README.md` 仅提供项目定位、入口、目录与文档导航，`AGENTS.md` 提供关键约束和导航，`CLAUDE.md` 链接到同一份 Agent 规范。

长期文档统一归 `doc/{guide,architecture,development,reference,animation}/`；文件名小写短横线，`doc/` 根目录不放 Markdown。前端自己的用法保留 `frontend/README.md`。

计划、进度和验证放 `.feature/<module>/<YYYY-MM>/<YYYYMMDD-HHMMSS>-<具体需求>/`；上层目录仅包含目录，同一需求资料合并，不按每次执行复制记录。时间使用 Asia/Shanghai。模块名使用真实职责如 `contract`、`sdkgen`、`frontend`、`repo`。

修改文档使用项目的 `project-readme-docs` Skill。稳定结论回收到正式文档，链接必须存在；移动文件要同时修复索引和命令。只维护仓库文档，不向外部文档系统同步。第三方资源保留许可；发布状态以远端 tag/Release 及产物为证据。
