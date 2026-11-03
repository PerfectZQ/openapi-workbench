# 标准认证与鉴权

认证说明来自 goswag 输出的 `securityDefinitions` 和 `security`。API Explorer、CLI 与 Skill 共用这一契约；服务端的身份校验和权限决策通过 `security.Gate` 接入现有系统。模块不持有账户数据库、不签发业务 Token，也不把解码 JWT 当作身份校验。

## 声明与支持范围

遵循 [Swagger 2.0 安全定义](https://swagger.io/specification/v2/#securityDefinitionsObject) 和 [goswag 注解](https://github.com/swaggo/swag#security)。同一个 requirement 内的多个 scheme 是 AND，数组中的 requirement 是 OR；接口声明覆盖全局声明，空数组或空 alternative 允许匿名。

| Swagger 类型 | 页面与 CLI 凭据 | 服务端验证边界 |
| --- | --- | --- |
| `apiKey`，`in: header/query` | 按声明名称传入原值，不猜测 Bearer 前缀 | 接入方校验 API Key、租户及访问权限 |
| `basic` | username/password 编码为 Authorization Basic | 接入方校验账户身份 |
| `oauth2` | 已取得的 access token，Authorization Bearer | 接入 IdP 验证 Token，再校验声明 scope |

Swagger 2.0 没有 OpenAPI 3 的 `http/bearer` 定义。JWT 可作为 OAuth2 access token，或按 `apiKey` 的 Authorization 原值使用；不会根据 Header 名猜协议。OAuth2 登录、回调、刷新和密钥获取使用现有 IdP SDK；产品处理凭据传输、状态及可插拔的验证边界，不新增另一套登录协议。

API Key 的 goswag 声明示例：

```go
// @securityDefinitions.apikey InventoryKey
// @in header
// @name X-API-Key

// @Summary 查询库存
// @ID inventory.ListItems
// @Tags inventory
// @Security InventoryKey
// @Success 200 {array} Item
// @Router /items [get]
```

## CLI 配置

`INVENTORY_AUTH_FILE`（前缀取自生成时的命令名）指向受保护的 JSON 文件。键是契约 scheme 名称，值使用如下结构；示例只是格式占位，不是可用凭据：

```json
{
  "InventoryKey": {"value": "<API_KEY>"},
  "BasicAuth": {"username": "<USERNAME>", "password": "<PASSWORD>"},
  "OAuth": {"value": "<ACCESS_TOKEN>"}
}
```

模块选择一个完整可满足的认证组合，只传入该组合的凭据，保留显式 Header，缺少凭据时以 `AUTH_REQUIRED` 和 `sent=false` 结束。自动配置的凭据仅发往 HTTPS 或本机地址；不跟随跳转，不自动重放 401 或失败的写请求。`--headers-file` 与 `--header-env Header=ENV_NAME` 适用于已有传输凭据。`--preview` 不读取认证文件或调用身份提供方。

已有 SSO 可由 `cli.App.Authenticate` 接入。它收到请求、当前操作的安全声明及传输配置，返回待登录状态或设置凭据；业务系统保留自己的交互登录命令。显式 `--auth-file` 先于该回调应用，因此回调应尊重已提供的身份。

## 服务端接入

`Gate.Protect` 在挂载时校验 scheme、scope 和验证器配置，不完整的配置直接返回错误。`Verify` 接入已存在的 IdP/会话校验，返回可信 `Principal`；模块执行 OAuth scope 检查，再执行可选的 `Authorize` 业务权限判断。以下展示适配点，`verifyWithIdentityProvider` 和 `checkBusinessPermission` 由服务提供：

```go
policy, err := security.Parse(swaggerJSON)
if err != nil { return err }
requirements, err := policy.Requirements("GET", "/items")
if err != nil { return err }
gate := security.Gate{
    Schemes: policy.Schemes,
    Verify: verifyWithIdentityProvider,
    Authorize: checkBusinessPermission,
}
protected, err := gate.Protect(requirements, existingHandler)
if err != nil { return err }
mux.Handle("/api/items", protected)
```

回调签名：

```go
func verifyWithIdentityProvider(ctx context.Context, schemeName string,
    scheme security.Scheme, credential security.Credential) (security.Principal, error)

func checkBusinessPermission(ctx context.Context, request *http.Request,
    identities map[string]security.Principal) error
```

- 验证器必须校验对应身份系统要求的签名、issuer、audience、过期与撤销，Scope 来自可信验证结果，不从客户端声明获取。无效凭据返回 `security.ErrCredentials`。
- 权限拒绝返回 `security.ErrForbidden`。依赖超时等其他错误返回 503 `AUTH_UNAVAILABLE`，不会伪装成未登录，也不会放行。
- 未认证返回 401 `UNAUTHENTICATED`；认证成功但 scope 或业务权限不足返回 403 `FORBIDDEN`。原始身份系统错误和 Token 不回显。
- 后续 Handler 用 `security.Principals(r.Context())` 读取已验证身份。已有 Hertz/Gin/其他框架的强制鉴权链可以继续使用，产品客户端不代替它，也不要求迁移权限数据库。

页面、Swagger JSON 和业务 API 是三个独立资源，应各自应用现有会话/权限策略。不要只保护页面却公开内部契约，也不要把页面上的“允许调用”当作服务端授权。登录与回调路由由接入方拥有，避免被同一个登录保护入口递归拦截。

## 浏览器接入

同源 Session Cookie 可直接沿用现有登录中间件，默认静态页面加载契约和调试请求都会携带浏览器会话。Token 型宿主可用公共工厂一次绑定提供方，不重复编写契约加载、401 和跳转处理：

```ts
const host = createWorkbenchHost({
  specificationURL: '/swagger/doc.json',
  origin: window.location.origin,
  request: {
    authentication: {
      scheme: 'InventoryKey', header: 'X-API-Key',
      label: () => '当前身份',
      getHeaders: () => identityProvider.getHeaders(),
      onUnauthorized: () => showLoginAction(),
    },
  },
})
```

契约 URL 在取得凭据前检查同源；契约与 API 请求拒绝重定向，401 只通知宿主，403 保留权限错误，均不自动重放。页面内手动凭据仅保存在内存，cURL 隐去凭据；IdP 登录按钮与回跳仍由宿主控制。`mapPath` 和 `resourceError` 分别支持网关路径及宿主本地化错误，Cloud Lead 使用同一入口接入员工身份与区域网关。
