# TypeScript SDK

运行 `npm install && npm run build`。从包入口导入 Client，通过 `new Client({ endpoint: "https://api.example.com" }).api` 调用方法。认证通过 authenticate 注入。

默认使用 REST；大整数使用 bigint，不经浮点数转换。SDK 不自动重试请求。

同一包入口可在浏览器和 Node.js 使用。通过 `basePath: "/gateway"` 为所有操作添加部署前缀，通过 `options.signal` 取消请求。声明 `x-api-result-field` 的操作还提供对应的 `<方法名>Result()`，直接返回声明的业务字段。
