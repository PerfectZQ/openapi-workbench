# OpenAPI Workbench

业务无关的契约工具链：同一 Swagger 2.0 契约驱动 React API Explorer，以及 Go / TypeScript SDK Provider。工作台、通用 UI 和生成器在一个项目中维护，通过同一 GitHub 版本发布。

## 安装与使用

Go 1.26.4、Node.js 24。消费项目固定同一版本：

```bash
go get github.com/PerfectZQ/openapi-workbench@v0.1.1
npm install https://github.com/PerfectZQ/openapi-workbench/releases/download/v0.1.1/api-explorer-react.tgz
# 需要单独复用控件时安装
npm install https://github.com/PerfectZQ/openapi-workbench/releases/download/v0.1.1/workbench-ui.tgz
```

Go 导入 `contract` 与 `sdkgen`；前端导入 `@api-explorer/react`、`@api-explorer/react/core`，通用控件通过 `@workbench/ui/*` 使用。SDK 生成的语言可单独或组合选择，项目专属名称和输出位置由调用方提供。工作台的契约加载、认证、路径和 SDK 下载同样由宿主注入。

详见 [接入指南](doc/guide/quick-start.md) 和 [前端用法](frontend/README.md)。

## 结构

| 目录 | 职责 |
| --- | --- |
| `contract/` | Go 契约模型、公共命名与方法归一化 |
| `sdkgen/` | 统一调度、Go / TypeScript Provider 和归档 |
| `frontend/` | React 工作台、独立示例与通用 UI |
| `test/`、`frontend/test/` | 公开入口与契约、构建测试 |
| `script/`、`.github/workflows/` | 初始化、验证与配套版本发布 |
| `.agents/skills/`、`AGENTS.md` | Agent 规范与项目工作流 |
| `.feature/` | 按模块、月份和需求归档的阶段记录 |
| `doc/` | 长期有效的使用、架构、开发与设计文档 |

## 本地开发

```bash
./script/bootstrap.sh
./script/check.sh
./script/package.sh v0.1.1
# 示例工作台
npm --prefix frontend run dev
```

通过 `GO_BIN=/path/to/go` 指定 Go 1.26.4。版本 tag 与两个前端包版本保持一致，GitHub Actions 完成检查并发布配套 npm 包和 SHA256 清单；Go module 使用同一 tag。

## 文档导航

- [架构与模块边界](doc/architecture/architecture.md)
- [接入指南](doc/guide/quick-start.md) · [API Explorer](frontend/README.md)
- [SDK Provider 与扩展规范](doc/development/sdk-generation.md)
- [代码规范](doc/development/code-guidelines.md) · [测试规范](doc/development/testing-guidelines.md)
- [文档规范](doc/development/documentation-guidelines.md) · [Git 与发布](doc/development/git-commit-convention.md)
- [前端设计入口](frontend/ANIMATION.md) · [API 工作台契约](doc/animation/api-workbench.md)
- [Agent 导航](AGENTS.md)

当前支持 Swagger 2.0 和已实现的 `x-api-*` 扩展；不宣称支持全部 OpenAPI 3 特性。JetBrains Mono 按 [SIL OFL](frontend/public/JetBrainsMono-OFL.txt) 随包分发。
