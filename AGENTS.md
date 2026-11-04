# Agent 导航

始终使用简体中文。目录即索引，职责单一、边界清晰，抽象围绕真实调用方；及时删除失效实现，优先简单一致的方案。

## 项目定位与边界

API Explorer 是基于 Swagger 的完整扩展产品：安装即携带可挂载前端，同一产品命令生成 CLI、Agent Skill 和 Go / TypeScript SDK；仓库与 Go module 地址保留 openapi-workbench。

- `contract/` 拥有 Go 契约模型和归一化；`sdkgen/` 拥有生成调度与语言 Provider；`frontend/` 拥有 React 工作台和 `src/ui/` 产品全局控件；`cli/` 拥有契约命令运行时，`skillgen/` 生成技能，`security/` 拥有标准认证传输与鉴权边界，`product/` 组合完整交付。
- 独立 Go module 对外导出 `contract`、`sdkgen`；不要套入 `internal/` 导致消费项目无法导入。
- 项目专属路由、身份获取、业务名称与 SDK 输出位置由调用方配置，不在本项目识别业务系统。
- 只实现已存在的能力，禁止为未来语言添加空 Provider、无调用接口或冗余配置。语言共性维护一份，类型映射和输出语法归对应 Provider。
- 产品前端统一使用一个 npm 包；`frontend/src/ui/` 是内部目录，不得恢复独立 UI manifest、版本或发布包。普通用户直接挂载内置资源，不要求自建 React/Vite 工程。
- 不修改生成文件来修复生成器；修改生成源码后验证正式入口与真实产物。不得覆盖并发修改。

## CodeGraph

存在 `.codegraph/` 且索引可用时，理解和定位代码先用 CodeGraph，再用 `rg` 核对调用方、删除影响和依赖范围；索引不可用时直接使用普通工具，不自动初始化索引。MCP 只通过项目级 `.codex/config.toml` 配置。

## Skill 与文档路由

- 前端工作使用 [frontend-design](.agents/skills/frontend-design/SKILL.md)，先读 [前端契约](frontend/ANIMATION.md)。仅新增 PC 验收（1366×768、1440×900、1920×1080），保留已有移动端行为；中文/英文、键盘焦点和 reduced-motion 均须检查。
- README、架构及模块文档使用 [project-readme-docs](.agents/skills/project-readme-docs/SKILL.md)。
- 修改对应领域前阅读：[架构](doc/architecture/architecture.md)、[代码规范](doc/development/code-guidelines.md)、[SDK Provider](doc/development/sdk-generation.md)、[测试](doc/development/testing-guidelines.md)、[文档](doc/development/documentation-guidelines.md)、[Git 与发布](doc/development/git-commit-convention.md)。
- 根 README 只保留定位、入口与文档导航；长期文档归 `doc/{guide,architecture,development,reference,animation}/`，文件采用小写短横线名。
- 阶段记录归 `.feature/<module>/<YYYY-MM>/<YYYYMMDD-HHMMSS>-<具体需求>/`；`module` 使用 `contract`、`sdkgen`、`frontend`、`repo` 等真实职责。上层目录不放文件，同一需求资料合并，时间使用 Asia/Shanghai。

## 工具链与验证

Go 1.26.4、Node.js 24、npm。通过 `GO_BIN=/path/to/go` 指定版本匹配的 Go，默认使用 PATH 中的 `go`。

- `./script/bootstrap.sh`：只配置当前仓库 Git hooks/线性历史并安装前端依赖，不改变全局配置。
- `GO_BIN=/path/to/go ./script/check.sh`：Go 格式/测试、前端构建/测试及补丁检查。
- `./script/package.sh v0.7.0`：按前端版本生成同一 Release 的一个完整 npm 包和校验文件。
- 测试集中在 `test/` 和 `frontend/test/`，从公开入口验证行为；不为测试导出私有 helper，不使用业务 Fake/Mock。
- `.artifacts/`、依赖、缓存不提交。文档链接必须真实存在；临时诊断和测试脚本即用即删。

## 发布

仓库为 `PerfectZQ/openapi-workbench`。Go module 与唯一前端 npm 包共用同一 `vX.Y.Z` tag，通过 GitHub Releases 分发；不得覆盖已经发布的 tag 或资产。消费项目固定版本，不使用本地 `replace` / `file:` 作为发布依赖。发布前先完成测试和包验证；用户明确授权发布时直接按范围完成。
