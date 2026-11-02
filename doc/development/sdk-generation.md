# OpenAPI 与 SDK 生成规范

SDK 生成器属于项目业务无关的 OpenAPI 工具层，统一位于 `contract/` 与 `sdkgen/`。当前输入为 Swagger 2.0，以及项目采用的 `x-api-*` 双协议扩展；不宣称支持任意 OpenAPI 版本或全部 Schema 特性。

## 目录与边界

```text
openapi-workbench/
├── contract/                  # 契约类型、稳定模型命名、Action 路径归一化与方法目录
└── sdkgen/
    ├── provider.go            # Provider 协议与 Generator 装配
    ├── generate.go            # 语言选择、契约读取、统一执行
    ├── artifact/              # 可重复的 ZIP 归档
    ├── golang/                # Go Provider
    └── typescript/            # TypeScript Provider
```

通用层只依赖标准库及本目录内代码，不导入业务 Handler、Service、数据库或项目运行配置。它不识别业务路由，也不内置业务包名、客户端名和输出位置。

消费项目的命令入口负责 Provider 注册、输出配置和公开分组/方法命名。业务命名规则通过 `Generator.NameMethod` 提供；通用层先归一化 Action 文档路径，再调用命名规则并校验方法重名。

消费项目的 Go / TypeScript SDK 是独立客户端工程，保留各自的请求编解码、认证集成、依赖与使用说明。Provider 生成操作、模型及 `config.gen.go` / `src/config.gen.ts`，统一拥有客户端配置校验和请求 URL 拼接；只有同时配置 `ArchivePath` 和 `ArchiveRoot` 时才归档，Git 安装的消费方仅配置 `Directory`；不会生成或初始化业务服务，也不会将依赖安装目录和构建缓存装入归档。

## 客户端 BasePath

Go `Config.BasePath` 与 TypeScript `ClientConfig.basePath` 是运行时参数，由 SDK 使用者初始化客户端时填写，不在 Provider 或业务适配器中预设业务值。

```text
请求 URL = Endpoint + BasePath + 契约接口路径 + Query
```

例如契约路径为 `/v1/items`，Endpoint 为 `https://example.test`：

| BasePath | 实际请求 |
| --- | --- |
| 空值或省略 | `https://example.test/v1/items` |
| `/gateway` | `https://example.test/gateway/v1/items` |
| `/tenant/catalog` | `https://example.test/tenant/catalog/v1/items` |

Endpoint 仅接受 HTTP(S) origin；BasePath 是额外挂载路径，以 `/` 开头、不以 `/` 结尾，不接受完整 URL、Query、Fragment、转义字符或路径回退段。它追加到完整契约路径之前，不替换路径、不去重已有段，也不修改 Swagger `paths`。路径参数仍先按参数语义编码，Query 独立编码；REST、普通 Action 和文件请求使用相同规则。签名网关请求固定走网关入口，不接受非空 BasePath。

消费项目的 demo 应直接展示 SDK 初始化参数，并说明服务直连、代理挂载和签名网关各自的 Endpoint、BasePath 与最终 URL；不要新增自动选择业务前缀的客户端封装。

### 从 v0.1.x 升级

v0.2.0 开始由 Provider 生成配置及 URL 逻辑。消费项目删除手写的重复声明，然后接入生成入口：

- Go：删除本地 `Config`、`clientState` 与 `newClientState`；请求创建时使用生成的 `c.requestURL(path, query)`，不再自行拼 Endpoint 或改写业务前缀。
- TypeScript：从 `config.gen.js` 导入 `ClientConfig`、`configureClient` 与 `requestURL`；构造时保存 `configureClient(config)` 的不可变结果，请求时调用 `requestURL(config, path, query)`。需要维持公开类型入口时 re-export `ClientConfig`，不重复声明接口。
- 原有业务专属“替换某段路径”参数不等价于 BasePath；调用方按真实网关挂载填写新参数。生成器不提供业务路径兼容表。

## Provider 协议

每种语言一个 Provider，当前只实现 Go 和 TypeScript：

```go
type Provider interface {
    Language() string
    Generate(contract.Specification, map[string][]contract.Method) error
}
```

- `Language` 返回注册名称，当前为 `go`、`typescript`。注册顺序决定默认生成顺序。
- `Generate` 接收同一次读取的契约和归一化方法目录；将它们视为只读，每次调用创建独立的名称/模型集合。
- Provider 负责语言标识符冲突检查、类型映射、服务/方法代码、生成文件清理及归档。语言差异留在 Provider，不在公共流程按语言散落分支。
- `artifact.Target` 由接入方指定源码目录、ZIP 路径和 ZIP 内根目录；Go 的 `Package`、TypeScript 的 `ClientName` 同样由接入方指定。
- 两个 Provider 按一致职责组织：`provider.go` 编排，`config.go` 配置与 URL 生成，`services.go` 客户端与服务，`methods.go` 方法，`parameters.go` 参数，`models.go` 模型输出，`types.go` 类型映射，`schema.go` 引用/组合处理，`comments.go` 注释，`files.go` 文件输出，`archive.go` 打包规则。按处理阶段抽方法，不将整个生成流程塞入单个函数。
- 共享的契约、命名和文件操作只维护一份；不为未来语言预先增加空 Provider、配置或实现分支。

新增语言时，实现对应 Provider，在项目接入层注册并配置输出，补齐该语言的运行时工程和验证。通用执行流程和命令不需要复制。测试须从公开生成入口覆盖契约到源码和归档，包含稳定输出、类型/参数约束及命名冲突；跨语言方法应保持同一 wire 路径和协议语义。


## 验证与接入

Go 使用 `go test ./...`；完整构建与测试使用 `./script/check.sh`。安装与调用见 [接入指南](../guide/quick-start.md)。
