# 接入指南

本项目有三项可独立使用的能力：`@api-explorer/react` 提供整页接口文档与 HTTP 调试界面；`@workbench/ui` 提供下拉选择、复制按钮和 JSON 编辑器等单个控件；Go 库 `sdkgen` 根据接口描述生成 Go / TypeScript 客户端源码。只需要接口文档页面时，只装 `@api-explorer/react`，它已包含所需控件。文中的“宿主”指你的接入项目，“契约”指 Swagger 2.0 接口描述 JSON。

第一次接入从[前端资源指南](frontend-resources.md)开始；已有 Swagger UI 时先看[差异与迁移](swagger-ui-migration.md)。

## 配套版本

Go module 与两个前端包使用同一 `vX.Y.Z` tag。固定版本并提交 `go.sum`、`package-lock.json`，构建不得依赖开发机目录或隐式跟随 latest。

```bash
go get github.com/PerfectZQ/openapi-workbench@v0.1.2
npm install https://github.com/PerfectZQ/openapi-workbench/releases/download/v0.1.2/api-explorer-react.tgz
npm install https://github.com/PerfectZQ/openapi-workbench/releases/download/v0.1.2/workbench-ui.tgz
```

工作台消费方需要 React / React DOM 19；单独使用通用 UI 时安装其声明的 peer dependencies，并在 Vite 中去重 React、react-i18next、Monaco 和 Motion。前端仅暴露构建后的公开入口，不引用仓库源码。 单独使用 `@workbench/ui` 编辑器时，Vite 需配置 `optimizeDeps: { exclude: ['@workbench/ui'] }`，由 Vite 处理包内 `?worker&inline` 导入，避免依赖预打包直接读取 Worker 查询路径。

## React 工作台

下面展示已有 React 项目的组件入口。全新项目需要 HTML 入口、Vite 配置、契约加载和部署路由，完整可运行步骤见[前端资源：构建、接入与部署](frontend-resources.md)。组件安装包供宿主构建使用，最终静态页面由宿主生成。

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

保持 host 引用稳定。认证、自动 Header、SDK 下载和 InnerTOP 配置由宿主选择注入；缺省不启用这些能力。更多接口与约束见 [前端 README](../../frontend/README.md)。

## Go / TypeScript SDK 生成

消费项目构造 `sdkgen.Generator`，注册需要的 Provider，然后调用 `Generate(specPath, languages)`。下面的目录与名称是示例，由消费方拥有：

```go
import (
    "github.com/PerfectZQ/openapi-workbench/contract"
    "github.com/PerfectZQ/openapi-workbench/sdkgen"
    "github.com/PerfectZQ/openapi-workbench/sdkgen/artifact"
    "github.com/PerfectZQ/openapi-workbench/sdkgen/golang"
    "github.com/PerfectZQ/openapi-workbench/sdkgen/typescript"
)

generator := sdkgen.Generator{
    NameMethod: func(method *contract.Method) error {
        method.Group, method.Name = "Catalog", method.Op.OperationID
        return nil
    },
    Providers: []sdkgen.Provider{
        golang.Provider{
            Package: "catalog",
            Target: artifact.Target{Directory: "sdk/go", ArchivePath: "downloads/go.zip", ArchiveRoot: "catalog-go"},
        },
        typescript.Provider{
            ClientName: "CatalogClient",
            Target: artifact.Target{Directory: "sdk/typescript", ArchivePath: "downloads/typescript.zip", ArchiveRoot: "catalog-typescript"},
        },
    },
}
err := generator.Generate("openapi.json", []string{"go", "typescript"})
```

`[]string{"go"}` 或 `[]string{"typescript"}` 仅运行对应 Provider；`generator.Languages()` 获取全部已注册语言。完整语言列表先校验，重复项只运行一次。Provider 失败时停止，已完成输出不自动回滚。

Provider 生成操作和类型，依赖消费项目已有的客户端运行时协议（Go 的 clientState/request/businessRequest，TypeScript 的 ClientRuntime），不自行生成认证客户端或业务服务。应把对应运行时、依赖声明和使用说明放在目标工程目录，归档会一并收录；接口投影与运行时必须一起编译、测试。

新增语言遵循 [Provider 规范](../development/sdk-generation.md)，在同一模块注册，不复制另一套命令和契约解析。

SDK 通过 Git 仓库交付时，仅设置 `artifact.Target.Directory`；省略 `ArchivePath` 和 `ArchiveRoot` 即只生成源码，不创建 ZIP。
