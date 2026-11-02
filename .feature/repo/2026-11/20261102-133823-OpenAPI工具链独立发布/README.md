# OpenAPI 工具链独立发布

将契约、Go/TypeScript SDK Provider、React API Explorer 和通用 UI 统一为独立项目。项目接入层保留业务命名、身份和输出配置，工具链不依赖业务服务。

初始化包含 Agent 导航、项目 Skills、文档路由、阶段资料、Git hooks、本地检查和 GitHub Actions。Go module 与前端包使用同一版本 tag，通过 GitHub 分发。

发布验证：独立 Go 测试、前端构建/测试、真实 npm 包检查、GitHub tag/Release，以及消费项目从 GitHub 下载后的完整构建。发布完成状态以远端验证为准。
