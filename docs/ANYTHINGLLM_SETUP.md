# AnythingLLM 接入说明

## 架构

- 小程序 **不持有** AnythingLLM API Key。
- 所有大模型请求经云函数 `anythingllmChat` 转发到 AnythingLLM 的 `POST /api/v1/workspace/{slug}/chat`。
- **密钥「全局加密/安全」**：请在 **微信云开发控制台 → 云函数 → anythingllmChat → 版本与配置 → 环境变量** 中填写敏感项。密钥不会打进小程序包，也不应提交到 Git；云端配置由腾讯云侧安全管理。

> 不建议在小程序端用 AES 等方式「加密存密钥」：解密所需材料仍在客户端，无法防逆向。

## 1. 上传并部署云函数

在微信开发者工具中，右键 `cloudfunctions/anythingllmChat` → **上传并部署：云端安装依赖**。

## 2. 配置环境变量

在云开发控制台为该云函数添加：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `ANYTHINGLLM_BASE_URL` | API 根路径 | `https://你的域名.com/api` 或 `https://你的域名.com`（会自动补 `/api`） |
| `ANYTHINGLLM_API_KEY` | AnythingLLM 开发者 API Key | 在 AnythingLLM 后台生成 |
| `ANYTHINGLLM_WORKSPACE_SLUG` | 默认工作区 slug（兜底，在未配 CHAT 时使用） | 可选 |
| `ANYTHINGLLM_WORKSPACE_CHAT` | **当前唯一使用的工作区**（聊天；问答/润色/摘要/上传等均走此 slug） | 必填其一 |
| `ANYTHINGLLM_CHAT_MODE` | 可选，`chat` / `query` / `automatic` | 默认 `chat` |

> **说明**：原独立知识库工作区（`ANYTHINGLLM_WORKSPACE_KB` / `workspaceType: 'kb'`）已暂缓，云函数与小程序端已统一为聊天工作区；恢复双工作区时需再改云函数 `pickWorkspace` 与 `aiService` 中的 `workspaceType`。

保存后需**重新部署**该云函数使环境变量生效（按控制台提示操作）。

> 当前仓库内 `anythingllmChat/index.js` 带有明文 `DEFAULT_ANYTHINGLLM` 仅便于你本地跑通流程；上架或推送到公开 Git 前请改为环境变量并删掉明文。

## 3. 小程序端开关

编辑 `miniprogram/config/ai.config.js`：

- `USE_MOCK_AI: false` — 走云函数 + AnythingLLM（正式环境）。
- `USE_MOCK_AI: true` — 本地模拟，不上线大模型（无密钥场景调试用）。

## 4. 网络与域名

云函数访问公网 AnythingLLM 实例需外网可达；若实例为内网或自签证书，需在部署环境自行处理 TLS/网络（云函数默认校验 HTTPS 证书）。

## 5. API 参考

AnythingLLM 官方 OpenAPI：`{你的实例}/api/docs`（路径以实例为准）。
