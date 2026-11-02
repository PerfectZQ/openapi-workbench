# API Explorer

API Explorer 是供用户查看接口文档、填写参数并发送 HTTP 请求的完整网页界面。它读取 Swagger 2.0 JSON 文件中的接口描述，自动展示接口列表、参数与返回字段。接入网站负责提供 JSON 地址和登录认证。

`@api-explorer/react` 是这个界面的安装包，`APIWorkbench` 是代码中渲染它的 React 组件名；这里的“组件”是整页界面，不是一个按钮。`@workbench/ui` 则是下拉选择、复制按钮、JSON 展示与编辑器等基础控件的集合，不读取 Swagger，不负责接口文档。普通接入只装前一个包，它已包含所需控件。

文中的“宿主”就是接入这个页面的你自己的项目；“契约”就是描述接口地址、参数、返回值与认证方式的 JSON 文件。与标准 Swagger UI 的兼容范围和替换步骤见[迁移说明](../doc/guide/swagger-ui-migration.md)。

从零创建接入项目、构建静态页面、用 Go 托管及其运行原理，见[前端资源：构建、接入与部署](../doc/guide/frontend-resources.md)。`npm run build` 输出可安装的组件库；`npm run build:demo` 输出示例 HTML；业务页面由消费项目自己的构建命令生成。

## 项目结构

| 目录 | 职责 |
| --- | --- |
| `src/` | `@api-explorer/react` 的组件、契约与请求处理、InnerTOP 转换、语言资源和样式 |
| `packages/ui/` | `@workbench/ui` 通用控件与编辑器；拥有自己的编译产物和包入口 |
| `demo/` | 通过公开包入口接入的 Inventory 示例 |
| `test/` | 通用认证、路径映射、导出及实际构建依赖边界测试 |

整个目录拥有独立的 `package.json`、`package-lock.json`、TypeScript 与 Vite 配置。Node.js 要求 24，不需要 Go 或业务服务即可构建库和查看示例；接入项目直接安装发布包。

## 接入

在你自己的 React 项目中安装（需要 React / React DOM 19）：

```bash
npm install https://github.com/PerfectZQ/openapi-workbench/releases/download/v0.1.1/api-explorer-react.tgz
```

安装包包含编译后的代码与类型声明，所需基础控件、中英文文案、JSON 编辑器和字体已包含其中。导入页面组件及其样式：

```tsx
import { APIWorkbench, type APIWorkbenchHost } from '@api-explorer/react'
import '@api-explorer/react/style.css'

const host: APIWorkbenchHost = {
  async loadSpecification() {
    const response = await fetch('/openapi.json')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  },
}

export function APIPage() {
  return <APIWorkbench host={host} locale="zh-CN" />
}
```

保持 `host` 引用稳定；宿主变化会重新加载契约。`locale` 支持 `zh-CN` 和 `en-US`，默认中文；每个工作台拥有自己的 i18n 实例，不读写宿主的语言存储。`headerActions` 可放置宿主语言切换等操作；使用宿主 i18n 的子组件应显式包裹宿主的 `I18nextProvider`。

仅使用契约转换而不渲染 UI 时，从 `@api-explorer/react/core` 导入 `publicSpecification`、`replacePathPrefix`、`operations`、`generateInnerTOP` 及相关类型；该入口不加载 React、CSS 或编辑器。

这是全页组件：使用视口高度、页面 Hash 直达接口，并更新页面标题。样式入口包含基础字体、控件 token 和页面重置。调试请求限制同源、拒绝重定向；跨域服务应由宿主网关代理并映射契约地址。当前契约模型为 Swagger 2.0，`x-api-*` 是可选扩展，不表示支持任意 OpenAPI 3.x 文档。

## 宿主能力

| 注入项 | 行为 |
| --- | --- |
| `loadSpecification` | 唯一必需项；返回解析后的契约，宿主负责资源地址、加载认证和错误 |
| `loadSDK` | 可选；提供时显示 SDK 下载 |
| `request.authentication` | 可选；声明自动认证对应的 scheme、Header、文案、取票方法与 401 回调；无配置时按契约手工填写 |
| `request.automaticHeaders` | 可选；提供服务需要的自动 Header，参数预览、cURL 和发送使用同一计算结果 |
| `innerTOP` | 可选；提供服务名、分组、ACL、源路径前缀、传输 Header 和目标路由后才显示 InnerTOP 导出 |

生命周期只读取标准 `deprecated` 与 `x-api-lifecycle`。路径映射使用显式函数，并同时处理标准 `paths` 与 `x-api-actions`。凭证保存在页面内存；手工提供的凭证优先于自动身份，cURL 对敏感值使用占位符，401 不自动重放请求。

## 本地开发

```bash
npm ci
npm run build
npm test
npm run dev
# 生成独立示例页面
npm run build:demo
```

Inventory 示例在 `http://127.0.0.1:5194` 提供本地计数和 JSON 回显，不保存数据。示例读取 `dist` 包入口；修改组件或通用控件后重新执行 `npm run build`。通用控件也只导出 `dist`，消费方无需 TypeScript 源码。

`npm run build` 依次编译通用 UI、构建组件与无 UI 的 core 入口、生成声明，最后检查包括示例在内的项目类型。React 保持为 peer dependency；其他组件依赖和字体包含在 API Explorer 分发包中。`npm pack` 自动重建，仅交付 `dist` 和 README。字体许可证可从 `@api-explorer/react/licenses/JetBrainsMono-OFL.txt` 读取，宿主分发页面时应保留。

独立 UI 包使用 Monaco 的 Vite Worker 导入约定；直接消费 UI 包的 Vite 应用应将 `react`、`react-dom`、`react-i18next`、`monaco-editor` 与 `motion` 配置为 `resolve.dedupe`，保证本地链接依赖与应用共用运行时。API Explorer 的组件分发包已包含编辑器与 Worker，普通接入只需要 React 和 React DOM。
