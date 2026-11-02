# API Explorer

API Explorer 是基于 Swagger 的完整产品。普通接入直接挂载随产品交付的前端资源，见[安装与使用](../doc/guide/quick-start.md)；本页仅面向需要 React 深度定制或修改产品源码的开发者。

`@api-explorer/react` 是唯一前端包，包含整页应用及全局 UI、编辑器、语言、样式和预构建页面。`APIWorkbench` 是 React 入口名，`ui/` 是产品内部目录。所有入口共用一个版本与发布包。

## 项目结构

| 目录 | 职责 |
| --- | --- |
| `src/` | `@api-explorer/react` 的组件、契约与请求处理、InnerTOP 转换、语言资源和样式 |
| `src/ui/` | 产品全局控件、编辑器、主题与语言资源 |
| `standalone/`、`assets/` | 默认产品页面源码与可直接挂载的完整构建产物 |
| `demo/` | 通过公开包入口接入的 Inventory 示例 |
| `test/` | 通用认证、路径映射、导出及实际构建依赖边界测试 |

整个目录拥有独立的 `package.json`、`package-lock.json`、TypeScript 与 Vite 配置。Node.js 要求 24，不需要 Go 或业务服务即可构建库和查看示例；接入项目直接安装发布包。

## React 定制接入

在你自己的 React 项目中安装（需要 React / React DOM 19）：

```bash
npm install https://github.com/PerfectZQ/openapi-workbench/releases/download/v0.3.0/api-explorer-react.tgz
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

Inventory 示例在 `http://127.0.0.1:5194` 提供本地计数和 JSON 回显，不保存数据。示例读取 `dist` 包入口；修改产品源码后重新执行 `npm run build`。全部入口只导出构建产物，消费方不引用 TypeScript 源码。

`npm run build` 统一生成整页 React 入口、core、产品 UI 子路径和类型声明，并构建 `assets/` 完整静态页面。`npm pack` 自动构建，仅交付 `dist`、`assets` 与 README。Go 包嵌入同一套 `assets/`，发布源码必须包含这些产物。字体许可随页面分发，也可从 `@api-explorer/react/licenses/JetBrainsMono-OFL.txt` 获取。

宿主已有其他页面需要复用产品控件时，可从同一包的 `@api-explorer/react/ui/*` 导入，例如 `@api-explorer/react/ui/Select`。这些子路径保留 React、i18n 和 Monaco 的宿主运行时，Vite 配置如下：

```ts
resolve: { dedupe: ['react', 'react-dom', 'react-i18next', 'monaco-editor', 'motion'] },
optimizeDeps: { exclude: ['@api-explorer/react'] },
```

组件按需使用已有主题和 i18n 上下文；Monaco Worker 由 Vite 处理。普通页面挂载无需这些配置。
