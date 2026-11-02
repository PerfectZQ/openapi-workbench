# OpenAPI 工具链独立发布

将契约、Go/TypeScript SDK Provider、React API Explorer 和通用 UI 统一为独立项目。项目接入层保留业务命名、身份和输出配置，工具链不依赖业务服务。

初始化包含 Agent 导航、项目 Skills、文档路由、阶段资料、Git hooks、本地检查和 GitHub Actions。Go module 与前端包使用同一版本 tag，通过 GitHub 分发。

发布验证：独立 Go 测试、前端构建/测试、真实 npm 包检查、GitHub tag/Release，以及消费项目从 GitHub 下载后的完整构建。发布完成状态以远端验证为准。

## 发布与接入结果

- `v0.1.0` 已发布：<https://github.com/PerfectZQ/openapi-workbench/releases/tag/v0.1.0>。
- GitHub Actions 完成 Go 测试、前端构建与通用测试、配套版本检查和 Release 创建：<https://github.com/PerfectZQ/openapi-workbench/actions/runs/41395679663>。
- Release 提供 `api-explorer-react.tgz`、`workbench-ui.tgz` 和 `SHA256SUMS`；Go module 使用同一 tag。
- 消费项目已从 GitHub 获取 Go module 和 npm 包，单语言、多语言、别名、重复项与错误选择验证通过；生成 SDK 的传输回归与前端完整构建通过。
- npm 安装包需通过 Vite 的 `optimizeDeps.exclude` 排除通用 UI，让 Worker 特殊导入由 Vite 转换；实际接入验证已覆盖该配置。
- 本记录证明独立项目发布与消费方本地接入，不代表消费服务已上线部署。
