# 前端挂载与部署

API Explorer 的前端是产品自带资源。界面、全局 UI、JSON 编辑器及 Worker、样式、中英文文案和字体在产品发布前一次构建，安装后即可挂载。swag 负责生成 Swagger JSON，API Explorer 负责读取并展示它。

## 静态目录挂载

```bash
api-explorer assets --spec /swagger/doc.json --out ./public/api-explorer
```

将完整输出目录挂载到 `/api-explorer/`，访问这个地址即可使用。目录内包含 `index.html`、`assets/`、字体许可和 `api-explorer.json`；最后一个文件记录 Swagger 地址。输出目录必须不存在，命令不会覆盖已有应用文件。

后续只更换契约地址时，可修改 `api-explorer.json` 的 `spec`。契约内容变化时，刷新页面即可读取新内容，无需重新生成页面。挂载路径保留尾部 `/`，以便浏览器正确加载相对资源。

## Go 直接挂载

```go
import explorer "github.com/PerfectZQ/openapi-workbench"

mux.Handle("/api-explorer/", http.StripPrefix("/api-explorer",
    explorer.Handler("/swagger/doc.json")))
```

页面通过 Go embed 随产品交付，这种方式不用导出静态目录。支持挂载到其他子路径；`Handler` 的参数是浏览器访问的 Swagger 地址。完整可运行程序见[接入指南](quick-start.md)。

安装时已有完整资源，不在用户项目执行 npm、构建前端或下载另一套 UI。页面和 Swagger 接口的登录、权限由服务现有中间件负责。调试请求限定同源；需要访问其他后端时，由现有网关提供同源路由。

## 页面示例

以下图片来自虚构 Inventory 示例（1440 × 900），仅访问本机服务。

![接口概览](images/inventory-overview.png)

![JSON 请求与响应](images/inventory-request.png)

![全局认证与请求头](images/inventory-auth.png)

请求草稿与响应在当前页面切换接口时保留，刷新清空。接口文档、调试面板、全局认证、编辑器和所有控件属于同一个 API Explorer 产品。

## 产品内部构建

只有产品维护者需要前端工具链：

```bash
npm --prefix frontend ci
GO_BIN=/path/to/go1.26.4/bin/go ./script/check.sh
./script/package.sh v0.7.0
```

`frontend/assets/` 是完整预构建页面，由根 Go 包嵌入，也随唯一前端 npm 包分发。`frontend/dist/` 是深度定制需要的 React、core 和 UI 子路径产物；这些都是一个包的入口。`frontend/src/ui/` 只是内部代码目录，不拥有独立 manifest、版本或发布包。

`check.sh` 构建前端并验证 Go、前端和补丁。`package.sh` 校验产品版本与锁文件，只生成 `api-explorer-react.tgz` 和校验文件。生成资源要与源代码一并提交，确保 `go install` / `go get` 不需要本地 Node.js。发布前验证预构建资源与源码一致；不得覆盖已发布 tag。

React 定制、组件属性和本地示例开发见[前端 README](../../frontend/README.md)。

## 常见问题

| 现象 | 检查 |
| --- | --- |
| 子路径资源 404 | 挂载完整目录，入口保留尾部 `/`；Go 的 StripPrefix 与挂载路径一致 |
| 页面加载契约 404 | `--spec` 或 Handler 参数必须是浏览器可访问的地址，不是服务器文件路径 |
| 契约加载 401 | 页面与契约分别使用服务的认证中间件；页面里的调试凭证不会代替契约加载认证 |
| 能看文档，发送请求失败 | 检查真实 API 路由、同源网关和页面中的认证设置 |
| 升级页面 | 更新产品版本并重新导出或编译 Go 服务，整体部署资源目录 |

认证接入见[标准认证与鉴权](authentication.md)：Session Cookie 直接复用同源会话，Token 型宿主通过 `createWorkbenchHost` 共用一个提供方加载契约及调试请求。
