# TypeScript SDK

运行 `npm install && npm run build`。从包入口导入 Client，通过 `new Client({ endpoint: "https://api.example.com" }).api` 调用方法。认证通过 authenticate 注入。

默认使用 REST；大整数使用 bigint，不经浮点数转换。SDK 不自动重试请求。
