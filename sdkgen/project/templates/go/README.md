# Go SDK

运行 `go test ./...` 验证。将 go.mod 的模块名替换为自己的仓库地址。

```go
client, err := sdk.NewClient(sdk.Config{Endpoint: "https://api.example.com"})
// 检查 err 后，通过 client.API 调用生成的方法。
```

默认按契约路径发起 REST 请求。认证通过 Config.Authenticate 注入。SDK 不自动重试写操作；文件响应由调用者关闭。
