# OpenAPI Workbench

为已有 HTTP 服务提供接口文档、网页调试和 Go / TypeScript 客户端代码生成。输入是描述接口地址、参数与返回值的 Swagger 2.0 JSON 文件（本文称“接口契约”）。

| 你想做什么 | 使用什么 | 得到什么 |
| --- | --- | --- |
| 给服务加一个可查接口、填参数、发送请求的网页 | API Explorer，包名 `@api-explorer/react` | 一个完整的 React 接口文档与调试页面组件，代码名 `APIWorkbench`；接入你的页面后构建部署 |
| 在其他页面复用下拉选择、复制按钮、JSON 展示或编辑器 | 通用 UI 控件包 `@workbench/ui` | 单个界面控件；这些控件不读取 Swagger，也不生成接口文档 |
| 让 Go / TypeScript 程序调用自己的服务 | Go 库中的 `sdkgen` | 按接口契约生成客户端的方法与类型；两种语言各有一个生成实现，称为 Provider |

只需要接口文档页面时，安装 API Explorer 即可；它已包含所需控件，无需另装通用 UI 包，也无需使用 SDK 生成器。“宿主”指安装本工具的你自己的网站或服务，负责提供页面地址、接口契约和登录认证。

API Explorer 使用自己实现的 React 界面和请求逻辑，没有在内部嵌套 Swagger UI。它支持的协议与接入方式也有差异，迁移前阅读[与 Swagger UI 的区别和替换步骤](doc/guide/swagger-ui-migration.md)。

## 页面示例

下图使用仓库自带的虚构 Inventory 演示：左侧选择接口，中间查看参数与返回结构，右侧编辑 JSON 并查看请求结果。示例只向本机回显 `Notebook`，不连接真实业务服务。

![Inventory 示例：接口说明、JSON 请求体与 200 回显](doc/guide/images/inventory-request.png)

[查看接口概览、请求调试和认证设置三张示例图](doc/guide/frontend-resources.md#页面示例)。

## 安装与使用

前端接入使用 Node.js 24、React / React DOM 19；使用 SDK 生成器才需要 Go 1.26.4。按需要安装，组合使用时固定同一版本：

```bash
# 接口文档与调试页面
npm install https://github.com/PerfectZQ/openapi-workbench/releases/download/v0.1.2/api-explorer-react.tgz
# 可选：其他页面需要单独复用控件
npm install https://github.com/PerfectZQ/openapi-workbench/releases/download/v0.1.2/workbench-ui.tgz
# 可选：生成 Go / TypeScript 客户端代码
go get github.com/PerfectZQ/openapi-workbench@v0.1.2
```

Go 导入 `contract` 与 `sdkgen`；前端导入 `@api-explorer/react`、`@api-explorer/react/core`，通用控件通过 `@workbench/ui/*` 使用。SDK 生成的语言可单独或组合选择，项目专属名称和输出位置由调用方提供。工作台的契约加载、认证、路径和 SDK 下载同样由宿主注入。

首次接入前端从[前端资源：构建、接入与部署](doc/guide/frontend-resources.md)开始：包含从零创建页面、生成 HTML/JS/CSS、Go 嵌入部署、宿主认证与运行原理。生成器接入见[接入指南](doc/guide/quick-start.md)，组件能力见[前端用法](frontend/README.md)。

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
./script/package.sh v0.1.2
# 示例工作台
npm --prefix frontend run dev
# 生成可部署的 Inventory 示例页面：frontend/dist-demo/
npm --prefix frontend run build:demo
```

通过 `GO_BIN=/path/to/go` 指定 Go 1.26.4。版本 tag 与两个前端包版本保持一致，GitHub Actions 完成检查并发布配套 npm 包和 SHA256 清单；Go module 使用同一 tag。

## 文档导航

- [架构与模块边界](doc/architecture/architecture.md)
- [接入指南](doc/guide/quick-start.md) · [API Explorer](frontend/README.md)
- [前端资源构建、全新项目接入与部署原理](doc/guide/frontend-resources.md)
- [与 Swagger UI 的区别和替换步骤](doc/guide/swagger-ui-migration.md)
- [SDK Provider 与扩展规范](doc/development/sdk-generation.md)
- [代码规范](doc/development/code-guidelines.md) · [测试规范](doc/development/testing-guidelines.md)
- [文档规范](doc/development/documentation-guidelines.md) · [Git 与发布](doc/development/git-commit-convention.md)
- [前端设计入口](frontend/ANIMATION.md) · [API 工作台契约](doc/animation/api-workbench.md)
- [Agent 导航](AGENTS.md)

当前支持 Swagger 2.0 和已实现的 `x-api-*` 扩展；不宣称支持全部 OpenAPI 3 特性。JetBrains Mono 按 [SIL OFL](frontend/public/JetBrainsMono-OFL.txt) 随包分发。
