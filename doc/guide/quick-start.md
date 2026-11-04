# 安装与使用

API Explorer 是一个完整的 Swagger 扩展产品，从 goswag 生成的同一份 Swagger，一次交付页面、CLI、Agent Skill 和 Go / TypeScript SDK。完整生成入口从 v0.4.0 开始提供。

## 安装

```bash
go install github.com/PerfectZQ/openapi-workbench/cmd/api-explorer@v0.6.0
```

需要 Go 1.26.4。命令安装到 `go env GOBIN` 指定的位置，未设置时为 `$(go env GOPATH)/bin`；确保该目录在 PATH 中。产品已内置构建好的页面，不要求安装前端工具链。

## 一站式生成

```bash
# 沿用服务已有的 goswag 生成命令
swag init --output ./swagger --outputTypes json
api-explorer generate --spec ./swagger/swagger.json --out ./api-tools --name inventory

cd api-tools/cli
go mod tidy
go build -o ../bin/inventory .
```

输出 `explorer/`、`cli/`、`skills/inventory-api/` 和 `sdk/{go,typescript}/`。把 `explorer/` 挂到服务同源静态路径，`bin/` 加入 PATH，Skill 目录放入 Agent 的技能目录，即可使用同一契约。输出目录必须不存在，任何生成失败都不会留下半成品目录。产物中的 CLI 固定当前产品版本，重新生成无需复制通用运行时。

```bash
export INVENTORY_BASE_URL=https://inventory.example.com
inventory api list
inventory inventory list-items --help
```

命令来自 `operationId` 或 Tags，以上分组仅是示例。凭据不写入产物；安装与更新见 [CLI 与 Skill](cli-and-skills.md)，身份提供方、Scope 和业务权限接入见 [标准认证鉴权](authentication.md)。

## 挂载前端

```bash
api-explorer assets --spec /swagger/doc.json --out ./public/api-explorer
```

将输出目录挂载到 `/api-explorer/`。`--spec` 是浏览器可访问的 Swagger 2.0 JSON 地址，可以直接指向 swag 的 `doc.json`。页面、全局组件、编辑器及 Worker、样式、语言和字体均已包含，不用再安装 UI 包或执行构建。

如果使用 Go 服务，可直接依赖同一产品并挂载，无需导出：

```bash
go get github.com/PerfectZQ/openapi-workbench@v0.6.0
```

```go
package main

import (
    "log"
    "net/http"
    explorer "github.com/PerfectZQ/openapi-workbench"
)

func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("GET /swagger/doc.json", func(w http.ResponseWriter, r *http.Request) {
        http.ServeFile(w, r, "swagger.json")
    })
    mux.Handle("/api-explorer/", http.StripPrefix("/api-explorer", explorer.Handler("/swagger/doc.json")))
    log.Fatal(http.ListenAndServe(":8080", mux))
}
```

访问 `http://127.0.0.1:8080/api-explorer/`。已有服务只需要合入挂载代码，并使用服务现有的鉴权中间件保护页面和 Swagger 地址。接口调试通过页面中的全局认证和 Header 设置完成；接口需要在同源后端或网关实际存在。

## 生成 SDK

```bash
api-explorer sdk --spec ./swagger.json --out ./sdk
# 或只生成一种语言
api-explorer sdk --spec ./swagger.json --out ./go-sdk --lang go
```

默认得到 `sdk/go/` 和 `sdk/typescript/`，包含类型、接口方法、HTTP 客户端、依赖声明和使用说明。方法来自 `operationId`；缺失时按 HTTP 方法与路径生成名称，重复名称会报错。

- Go：运行 `cd sdk/go && go test ./...`，按自己的发布地址修改 `go.mod` 中的模块名，通过 `NewClient(Config{Endpoint: "https://api.example.com"}).API` 使用生成的方法（先处理初始化错误）。
- TypeScript：运行 `cd sdk/typescript && npm install && npm run build`，通过 `new Client({ endpoint: "https://api.example.com" }).api` 使用生成的方法。

这两步是使用生成 SDK 自身的语言工具链，不参与前端安装。输出目录必须不存在，避免覆盖已有工程；重新生成可先选择新的输出目录。默认运行时按契约发送 REST 请求，认证由 `Authenticate` / `authenticate` 注入；不内置业务凭证、签名实现或业务网关路径。已有专属客户端运行时的项目可继续使用 [SDK Provider](../development/sdk-generation.md)。

需要在 React 中深度定制页面或认证回调时，参见[前端开发](../../frontend/README.md)；普通安装不需要理解这些内部入口。
