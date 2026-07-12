# 项目开发规则

## 1. 项目结构

- 当前项目是 Node.js 20+ 本地 Web 应用：`src/` 放服务端模块，`src/github/` 放 GitHub 授权、凭据和 API 编排，`public/` 放浏览器端静态资源，`tests/` 放 Node 内置测试，`data/` 只放运行时元数据且不得提交真实邮箱、令牌或邮件正文，`docs/` 放方案与协议说明。

## 2. 运行命令

- 使用 Node.js 20+，包管理器为 npm。
- 首次运行或依赖变化后执行 `npm install`。
- 开发/运行：`npm start`。

## 3. 测试命令

- 初始化前未发现测试命令；本项目采用 Node.js 内置测试运行器，统一执行 `npm test`。
- 修改导入解析、验证码提取、邮箱源适配或持久化逻辑后必须运行 `npm test`。
- 修改 `src/github/`、GitHub API 路由或账号 UI 后必须运行 `npm test`，且测试不得访问真实 GitHub API。

## 4. 构建命令

- 本项目无前端编译步骤；发布打包执行 `npm run package`，会生成 Windows x64 exe 和便携 zip 到 `release-assets/`。
- 打包后执行 `npm run sha256` 生成 `release-assets/SHA256SUMS.txt`。
- 修改 `package.json`、`scripts/package-zip.js`、`src/server.js` 的打包路径或运行时数据路径后，必须重新执行 `npm run package`、`npm run sha256`，并测试 exe 与 zip。

## 5. 代码风格

- 服务端使用 CommonJS、2 空格缩进、分号、单引号；浏览器端使用原生 ES 模块。
- 业务解析函数保持纯函数，网络请求、持久化和定时轮询必须与解析逻辑分离。
- 当前未发现 lint / format 命令；新增工具前需先评估其必要性与依赖成本。
- 发布脚本放在 `scripts/`，仅负责生成发布产物；不得在脚本中读取或复制 `data/*.json`。
- `scripts/patch-exe-metadata.js` 只允许修改 Windows exe 版本资源中的产品名、公司名、版权、版本号等发布元数据；不得用于伪造数字签名。

## 6. 模块边界

- `src/parser.js` 只负责从批量文本识别邮箱与 URL，不发起网络请求。
- `src/code-extractor.js` 只负责从邮件内容提取验证码和消息元数据。
- `src/providers/` 封装不同取信网址的请求协议；不得把站点特例写进 UI。
- `src/store.js` 负责本地 JSON 持久化；`src/poller.js` 负责调度，不直接解析导入文本。
- `src/github/service.js` 负责单账号授权与操作编排；`src/github/client.js` 只封装 GitHub REST API；`src/github/credential-vault.js` 只管理操作系统凭据库。令牌不得写入 `Store` 或返回前端。
- `public/` 只通过本地 `/api` 与服务端交互，不直接请求第三方取信网址，以避免 CORS 和令牌暴露。
- `scripts/package-zip.js` 只打包 exe、README、LICENSE、`.env.example` 与演示图；不得把 `node_modules/`、`data/`、`.env` 或本机配置打入便携 zip。

## 7. 禁止事项

- 不得提交 `data/*.json`、真实邮箱、访问令牌或抓取到的邮件正文。
- 不得在日志、错误响应或前端页面中输出完整访问令牌；展示 URL 时必须脱敏。
- 不得绕过请求超时、响应体大小限制和轮询并发上限。
- 未完成协议验证前，不得声称某个第三方站点已经支持自动取信。
- 不得自动注册 GitHub 账号、自动提交注册验证码、绕过 CAPTCHA/风控，或提供批量/定时 star、watch、fork、follow；每次 GitHub 写操作只允许一个明确目标，并要求用户确认。
- GitHub 写请求必须串行执行且间隔至少 1 秒；遇到 `Retry-After`、主限流或次级限流时停止请求并按响应等待，不得无界重试。
- GitHub OAuth token 只能保存到操作系统凭据库；`data/*.json` 只保存账号公开元数据和邮箱关联。

## 8. 完成标准

- 两种示例格式均可批量导入并去重，能识别邮箱及对应取信 URL。
- 支持新增、删除、启停、立即刷新和持续轮询；状态与验证码实时更新到页面。
- 解析、验证码提取、API 路由和至少一个可控模拟源具有自动化测试。
- `npm test` 通过，`npm start` 可启动，README 说明配置、数据边界和第三方协议限制。
- 发布版本还必须验证 `npm run package`、`npm run sha256`、exe 启动、zip 解压后启动，以及 `package.json`、README、LICENSE、页面 About 区域中的作者信息一致。

## 9. Review 标准

- 检查邮箱与 URL 关联是否会跨记录串配，重复导入是否幂等。
- 检查所有外部请求是否有超时、大小限制、协议限制和错误隔离。
- 检查验证码去重是否稳定，旧验证码是否不会反复触发为“新”。
- 检查令牌是否在 UI、日志、测试快照和 Git 跟踪文件中泄露。
- 检查 GitHub API 路由是否阻止批量目标、缺少确认的写操作和任意 API 路径透传；测试必须使用注入的模拟客户端与内存凭据库。

## 10. 常见风险

- 不同取信站点没有统一 API；需要适配器或用户提供接口响应样例，通用 HTML 猜测只能作为兼容层。
- 第三方接口可能要求额外参数、Cookie、Referer 或 POST 表单，URL 与邮箱的关联规则不能凭空假设。
- 高频轮询可能触发限流或封禁；默认间隔不得低于 5 秒，并限制并发。
- 邮件正文中的订单号、年份可能被误判为验证码；提取应优先使用“验证码/code/OTP”等上下文并保留原始摘要供核对。
- GitHub OAuth Device Flow 的 Client ID 可通过页面保存到本地 `githubConfig`，也可由 `GITHUB_OAUTH_CLIENT_ID` 预配置；连接按钮不得因缺少环境变量被禁用，而应打开配置弹窗。Client ID 可持久化，但 Client Secret 和 OAuth token 禁止写入 JSON。
- `@napi-rs/keyring` 是平台原生可选二进制；Windows 凭据库不可用时必须明确报错，禁止降级为明文 token 文件。
- `@yao-pkg/pkg` 只用于发布期生成 Windows exe；调整或替换打包方案前必须更新 `docs/release-audit.md`，说明许可证、网络行为、回滚方式和与运行时数据路径的冲突处理。
- `resedit` 只用于发布期修正 Windows exe 版本资源；如果替换该工具，必须重新验证 exe 的 `FileDescription`、`ProductName`、`CompanyName`、`LegalCopyright`、`ProductVersion`。

## 11. 邮件归属与实时状态回归约束

- HTML 取信页可能把正文放在 `iframe[srcdoc]`；验证码提取前必须先解码嵌入正文，不得只解析页面外层元数据。
- `+0800`、`+0000` 等时区偏移不得作为无上下文验证码候选。
- 响应提供收件邮箱时，必须与当前 mailbox 精确匹配；不匹配时拒绝展示，禁止跨账户复用验证码。
- `latestCode` 必须来自本次取信响应；本次没有有效验证码时必须清空，不能因历史去重逻辑保留过期值。
- 修改全局自动取信、全部手动刷新或关闭服务路由后，必须覆盖并发上限、单次来源和服务关闭回归测试。

## 12. 批量导入配对约束

- 同一行同时出现邮箱与 URL 时必须在该行内配对；不得让上一行 URL 因字符距离更短而抢占下一行邮箱。
- 只有当前行没有 URL 时，才允许使用跨行距离兼容“URL 在前、邮箱在后”的购买文本。
- 修改 `src/parser.js` 后必须同时覆盖“连续多行邮箱----URL”和“URL/邮箱分行”两类回归测试。
- 每个邮箱只保留一个取信来源；重新导入相同邮箱的新 URL 时更新原记录并清空旧验证码与错误状态，不新增冲突记录。
