---
name: frontend-design
description: API Explorer 与通用 UI 的设计、交互、前端实现和迁移验证。
---

# 前端设计与实现

先读 `AGENTS.md`、`frontend/ANIMATION.md` 和对应设计契约。明确用户任务、真实输入、状态和交互后再实现。

- 保持接口目录、参考与请求调试的信息层级，复用现有 token、控件、字体和编辑器，不引入无依据的视觉样式或额外运行时。
- 通用工作台只读取契约和宿主注入；业务路径、认证、区域、SDK 下载地址留给宿主。
- 公开包只导出构建产物，禁止消费方导入源码。React 使用 peer dependency，编辑器与 Worker 随入口交付。
- 覆盖加载/空/错状态、中英文、键盘与可见焦点、reduced-motion；新增验收只面向常见电脑窗口，保留原移动行为。
- `npm --prefix frontend run build` 与 `npm --prefix frontend test` 验证类型与依赖边界；界面或交互变化再通过浏览器检查真实示例和相应尺寸。
- 只做结构搬迁时先验证构建结果、依赖闭包与公开入口，避免改变交互语义。
