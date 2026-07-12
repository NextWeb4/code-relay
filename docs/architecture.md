# 技术方案与开源方案审计

## 当前项目审计

- 初始化前目录为空，没有既有技术栈、包管理器、许可证、构建链、数据库或联网边界需要兼容。
- 当前机器提供 Node.js v24.17.0 和 npm 11.13.0。
- 功能本质是：把非结构化文本转换成“邮箱 + 取信 URL”，由本地服务端按站点协议取信，再把最新验证码推送到本地页面。
- 第三方取信站点协议不统一，且第一个示例站点明确提示同一 IP/邮箱只能查询一次，因此它不能安全地进行持续轮询。

## 候选方案

| 方案 | 来源 | 许可证 | 核心能力 | 优点 | 缺点 | 维护状态（2026-07-12 审计） | 契合度 / 冲突点 | 结论与采用方式 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Node.js 标准库 | nodejs.org | Node.js License | HTTP、fetch、SSE、文件持久化、测试 | 零第三方依赖、体积小、离线可运行 | 路由和校验需少量自写 | 随 Node 24 活跃维护 | 高；无现有架构冲突 | **采用**：HTTP 服务、请求、持久化与测试均使用标准库 |
| Express 5.2.1 | npm / expressjs/express | MIT | Web 路由与中间件 | 成熟、资料多、API 简洁 | 当前规模只用到很小一部分，增加供应链与安装步骤 | npm 最近更新 2026-06-24 | 中；无冲突但收益有限 | 不采用；若未来 API 明显扩张可替换路由层 |
| Fastify 5.10.0 | npm / fastify/fastify | MIT | 高性能服务、schema 校验、插件 | 校验和插件体系完善 | 解包体积约 2.9 MB，复杂度超过当前需求 | npm 最近更新 2026-07-05 | 中；适合更大的 API 服务 | 不采用；不为当前小型本地应用引入框架 |
| Hono 4.12.29 | npm / honojs/hono | MIT | 轻量跨运行时 Web 框架 | API 简洁、跨平台 | 当前无需跨边缘运行时，仍引入外部依赖 | npm 最近更新 2026-07-10 | 中高；但核心能力标准库已覆盖 | 不采用；只借鉴清晰的路由边界设计 |

## 采用范围

- 直接复用 Node.js 的 `http`、`fetch`、`EventSource/SSE` 协议、`node:test`、`fs/promises`、`dns/promises`。
- 借鉴成熟框架的分层：路由、业务服务、适配器、纯解析器分离。
- 不采用数据库、前端框架、CSS 框架或邮件解析重依赖；当前只需保存少量本地状态并从 JSON/HTML 中提取验证码。
- 保留未来扩展点：新站点只需在 `src/providers/` 新增协议适配，不改导入解析与 UI。

## 冲突与风险检查

- 技术栈、目录、构建、数据库、权限模型：新项目，无既有冲突。
- 离线 / 联网：UI 和数据存储完全本地；只有用户导入并启用的取信 URL 会产生外部请求。
- 许可证：没有引入运行时第三方依赖，当前无新增许可证风险。
- 权限：本地服务只监听 `127.0.0.1`；外部 URL 仅允许 HTTP/HTTPS，并拒绝回环、局域网和链路本地地址，降低 SSRF 风险。
- 第一种站点：页面声明“同一个 IP 对同一个邮箱只能查询一次”，与持续轮询互斥。该来源必须标记为“单次查询”，只在用户点击时请求一次；这是阻塞该来源实时轮询的外部协议限制。
- 第二种 token URL：可重复 GET，适合自动轮询；令牌只保存在本地数据文件，前端仅接收脱敏 URL。
- 2026-07-12 实际响应复核：token 接口把真实邮件正文编码在 `iframe[srcdoc]` 中，外层只包含邮箱、主题、时间和发件人。解析顺序固定为“解码 srcdoc → 验证收件邮箱 → 提取验证码 → 以本次响应更新 latestCode”，避免把外层 `+0800` 时区误判为验证码。
- 全局自动、全局手动刷新和关闭服务继续复用 Node.js HTTP、定时器和并发工作池；未引入新依赖，现有许可证与架构边界不变。
- 2026-07-12 批量导入复核：纯字符距离会让下一行邮箱错误选择上一行 URL，因为换行距离小于本行分隔符长度。配对策略改为“同一行 URL 优先，当前行无 URL 才跨行查找”；同邮箱再次导入采用来源更新而非新增。该修复只修改现有纯解析器与 JSON store，未引入依赖或额外联网行为。

## 回滚方式

- 项目无数据库迁移和外部安装；停止本地进程即可停止所有联网行为。
- 删除 `data/mailboxes.json` 可清空本地状态。升级数据结构前应保留同目录备份。

## GitHub 自有账号管理扩展（2026-07-12）

### 问题边界与官方约束

- GitHub 可接受使用政策明确禁止 fake accounts、automated inauthentic activity、automated starring/following 和协调式虚假互动，因此本项目不实现自动注册、自动填验证码、批量/定时互动或多账号同目标联动。
- 邮箱模块只用于人工查看 GitHub 发来的验证码或通知；账号注册和 CAPTCHA/风控步骤必须由用户在 GitHub 页面完成。
- 管理能力只面向用户自有账号，并通过 GitHub OAuth Device Flow 逐账号授权；每个 star、watch、fork、follow 请求只接受一个目标并要求显式确认。

### 开源方案审计

| 方案名称 | 来源 | 许可证 | 核心能力 | 优点 | 缺点 | 维护状态（2026-07-12） | 与当前项目契合度 / 冲突点 | 是否采用 / 采用方式 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `@octokit/auth-oauth-device` 8.0.3 | npm / octokit/auth-oauth-device.js | MIT | GitHub OAuth Device Flow、轮询与错误处理 | 官方 Octokit 组件；Node 20+；避免自写授权协议 | ESM，需要从现有 CommonJS 动态导入；需要 OAuth Client ID | npm 最近更新 2025-10-31 | 高；与 Node 20 兼容，不影响邮箱离线运行 | **采用**：只负责逐账号 Device Flow 授权 |
| `@octokit/request` 10.0.11 | npm / octokit/request.js | MIT | GitHub REST 请求、错误脱敏、可注入 fetch | 官方组件；端点映射清晰；便于测试 | 增加少量依赖；仍需自行做业务级确认与排队 | npm 最近更新 2026-06-29 | 高；用动态导入适配 CommonJS | **采用**：封装固定允许列表端点，不开放任意路径代理 |
| `@octokit/rest` 22.0.1 | npm / octokit/rest.js | MIT | 完整 REST SDK | 能力覆盖广、生态成熟 | 当前只需少量端点，API 面过大；解包与依赖收益低 | npm 最近更新 2025-10-31 | 中；无硬冲突但超出 YAGNI | 不采用；未来端点显著扩张时再评估 |
| `@napi-rs/keyring` 1.3.0 | npm / Brooooooklyn/keyring-node | MIT | Windows Credential Manager/macOS Keychain/Linux Secret Service | token 不落明文 JSON；API 很小；多平台预编译 | 原生可选二进制，安装和系统凭据服务是新风险 | npm 最近更新 2026-04-30 | 高；Windows 当前环境匹配，需禁止明文降级 | **采用**：仅保存 OAuth token；测试使用内存实现 |
| `keytar` 7.9.0 | npm / atom/node-keytar | MIT | 操作系统凭据库 | 历史使用广 | 原生构建链更重，项目维护归属和发布节奏不如 napi-rs 方案清晰 | npm 元数据更新 2025-07-30 | 中；可用但维护风险更高 | 不采用 |
| Node.js 原生 `fetch` + 自写 Device Flow + 明文 JSON token | Node.js / 自研 | Node.js License / 自研 | 零依赖授权和请求 | 依赖少 | 重复实现 OAuth 轮询；明文 token 与安全边界冲突 | 不适用 | 低；安全与维护成本不可接受 | 不采用 |

### 冲突检查与采用范围

- 技术栈：三个依赖均支持 Node 20+；Octokit ESM 与现有 CommonJS 存在模块格式差异，适配方式固定为服务内部动态 `import()`，不迁移全项目模块系统。
- 目录和职责：新增 `src/github/`，不把 GitHub 站点逻辑写进邮箱 provider、poller 或前端；现有邮箱解析和轮询保持不变。
- 运行和构建：仍使用 `npm start`、`npm test` 且无构建步骤；首次运行增加 `npm install`。原生 keyring 包安装失败时 GitHub 模块不可用，但邮箱模块必须继续可用。
- 数据与权限：`mailboxes.json` 可升级为包含 GitHub 公开账号元数据的版本，但不包含 OAuth token；token 只进入操作系统凭据库。删除账号时同时删除对应凭据。
- 配置可用性：OAuth Client ID 不是凭据，可由连接弹窗写入本地 `githubConfig`，环境变量只作为可选预配置。缺少 Client ID 时按钮仍可点击并显示配置入口，避免双击启动场景被灰色按钮阻塞。
- 联网边界：新增固定域名 `github.com` OAuth Device Flow 与 `api.github.com` REST 请求；不允许用户传入任意 API URL，不改变邮箱取信的 SSRF 规则。
- 许可证：三项新增依赖均为 MIT；与私有本地应用兼容，需在依赖锁文件中固定版本。
- API 纪律：写请求串行、至少间隔 1 秒、尊重 `Retry-After` 和 rate-limit headers；不对失败的非幂等请求自动无限重试。
- 回滚：删除 `src/github/`、GitHub 路由/UI 和三项依赖即可恢复纯邮箱版本；账号元数据是可忽略扩展字段，不影响旧邮箱数据读取。凭据需要通过断开账号流程从操作系统凭据库删除。
