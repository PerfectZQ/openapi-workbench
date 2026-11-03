# CLI 与 Agent Skill

`api-explorer generate --spec swagger.json --out api-tools --name inventory` 从一份 Swagger 2.0 生成完整产品工程，包含静态页面、独立 CLI、Agent Skill 和 Go/TypeScript SDK。`cli/` 是只依赖已发布 openapi-workbench 的 Go 工程，嵌入契约，可离开原服务仓库运行；不导入业务数据库、Service 或服务启动代码。

## 使用 CLI

```bash
cd api-tools/cli
go mod tidy
go build -o ../bin/inventory .
export PATH="$(cd ../bin && pwd):$PATH"
export INVENTORY_BASE_URL=https://inventory.example.com
inventory --help
inventory api list --search item
inventory inventory list-items --help
```

名称和环境前缀由 `--name` 生成。`INVENTORY_SPEC` 可指定匹配部署的本地契约；默认使用构建时嵌入的版本。Base URL 是纯 origin；Swagger 的 `basePath` 自动加入请求，避免要求使用者二次拼接。默认不读取 Swagger host 来决定请求线上环境。

分组优先 `x-cli-group`，其次是带点号 `operationId` 的首段，最后是首个 Tag；无分组时为 `api-operations`。操作采用 operationId 最后一段并转为 kebab-case，无 operationId 时取 Action 或方法与路径。命名冲突会报错，不能依赖加载顺序覆盖操作。

Path、Query、Body 顶层字段形成命名参数。类型、枚举、必填项和字段说明来自契约；同名或保留名称自动加 `path-` / `query-` / `body-` 前缀。复杂值使用 JSON 或 `@file`，完整正文使用 `--body @file` 或 `--body -`。64 位整数不经浮点转换。`api list/describe/call` 继续提供原始契约检查和调用入口。

认证使用 `INVENTORY_AUTH_FILE` / `--auth-file` 或显式 Header；格式见[认证指南](authentication.md)。`--preview` 校验与预览但不取票、不发送请求，不输出凭据和正文。超时默认 60 秒，重定向和自动重试关闭；文件下载必须使用 `--output` 指向新文件，原文件不会被覆盖。

输出为一个 JSON 对象，退出码 0 为请求成功、1 为远端或传输失败、2 为本地参数错误。普通响应保留原 JSON，不通过 `Result`、`data` 等名字推断业务信封。

## 安装 Skill

把 `api-tools/skills/inventory-api/` 放到 Agent 的技能目录，例如 Codex 的 `~/.codex/skills/` 或项目的 `.agents/skills/`。命令必须能从 PATH 找到；Skill 不安装软件、不保存 Token、不自行选择生产环境。

Skill 只保存发现与使用方式，参数和 Schema 通过 CLI 帮助实时读取。更新服务契约后重新生成并构建 CLI，避免第二份静态接口名单漂移。宿主维护业务补充源文件，通过 `skillgen.Generate` 的 `Instructions` 合并；生成的 SKILL.md 不手改。

## 已有业务 CLI 接入

保留业务入口和流程，通用行为直接依赖公共包：

```go
app := cli.App{
    Name: "inventory",
    EnvPrefix: "INVENTORY",
    Specification: swaggerJSON,
}
code := app.Run(ctx, os.Args[1:], os.Stdin, os.Stdout)
```

业务 CLI 自行分发 `auth`、`graph` 等复合命令，原子命令交给 `App.Invoke`。复合命令通过 `App.BindTransportFlags` 和 `App.Call` 复用同一请求链路。App 的宿主回调只用于真实差异：公开路径转换、自动 Header、官方 SSO 和特定响应信封；不要重新实现协议解析、参数绑定或文件传输。

自定义认证回调只在发送前执行，预览不会调用，401 不会重新取票重放。Scope、数据权限、事务和发布条件始终由实际业务服务强制保证。
