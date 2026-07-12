# Code Relay

Code Relay is a local mailbox verification-code console. It imports mailbox and retrieval URL pairs, polls supported retrieval endpoints from `127.0.0.1`, extracts verification codes, and helps you manually manage owned GitHub accounts through GitHub Device Flow.

Code Relay 是一个本地邮箱验证码聚合台。它可以导入“邮箱 + 取信网址”，在本机 `127.0.0.1` 上轮询支持的取信接口，提取验证码，并通过 GitHub Device Flow 辅助管理你自己的 GitHub 账号。

![Code Relay dashboard](docs/demo/code-relay-dashboard.png)
![Code Relay GitHub panel](docs/demo/code-relay-github.png)

## Features / 功能特点

- Import raw purchase text, TXT, or CSV files and pair mailboxes with HTTP/HTTPS retrieval URLs.
- Poll repeatable sources, protect one-shot sources, and update the dashboard through local SSE.
- Extract verification codes from plain text, HTML, JSON-like mail payloads, and `iframe[srcdoc]` mail bodies.
- Reject common false positives such as dates, time zones, email local parts, and GitHub button text.
- Keep full mailbox data, source URLs, tokens, and codes only in local runtime storage.
- Connect owned GitHub accounts with Device Flow; OAuth tokens are stored in the operating system credential vault, not JSON files.
- Execute only confirmed single-target GitHub actions: `star`, `watch`, `fork`, and `follow`.
- Switch the UI between Chinese and English; the language preference is saved in `localStorage`.

- 支持粘贴原始购买文本，或导入 TXT / CSV 文件，自动配对邮箱与 HTTP/HTTPS 取信网址。
- 支持可重复来源轮询、单次来源保护，并通过本地 SSE 实时刷新页面。
- 支持从纯文本、HTML、类 JSON 邮件内容和 `iframe[srcdoc]` 正文中提取验证码。
- 避免把日期、时区、邮箱账号片段、GitHub 按钮文案等误判成验证码。
- 完整邮箱、取信 URL、token 和验证码仅保存在本机运行时数据中。
- 使用 GitHub Device Flow 连接自有账号；OAuth token 写入操作系统凭据库，不写入 JSON。
- GitHub 写操作只支持确认后的单目标 `star`、`watch`、`fork`、`follow`。
- 页面支持中文/英文切换，语言偏好保存到 `localStorage`。

## Requirements / 环境要求

- Node.js 20 or newer.
- npm.
- Windows is the primary packaged target for v1.0.0.

- Node.js 20 或更高版本。
- npm。
- v1.0.0 的主要打包目标是 Windows。

## Installation / 安装方法

```powershell
npm install
```

Optional environment variables can be copied from `.env.example`. The app does not require a `.env` loader; set variables in your shell before running if needed.

可参考 `.env.example` 设置可选环境变量。本项目默认不加载 `.env` 文件，如需配置请在启动前写入当前 shell 环境。

## Usage / 使用方法

```powershell
npm start
```

Then open <http://127.0.0.1:4173>. Windows users can also double-click `启动软件.cmd`, which starts the service and opens the browser.

启动后访问 <http://127.0.0.1:4173>。Windows 用户也可以双击 `启动软件.cmd`，它会启动服务并打开浏览器。

Supported import examples:

```text
name@example.com----https://mail.example.com/api?token=YOUR_TOKEN

Click to fetch mailbox: https://mail.example.com/
qq mailbox:
1234567890@qq.com
```

## Packaging / 打包说明

Build Windows release assets:

```powershell
npm run package
npm run sha256
```

Generated files are written to `release-assets/`:

- `code-relay-v1.0.0-win-x64.exe`: Windows x64 executable.
- `code-relay-v1.0.0-windows-portable.zip`: portable zip containing the executable, README, license, and demo images.
- `SHA256SUMS.txt`: SHA256 checksums for release assets.

This project has no frontend build step. Packaging uses `@yao-pkg/pkg` for the Windows executable and PowerShell `Compress-Archive` for the portable zip.

本项目没有前端编译步骤。Windows exe 使用 `@yao-pkg/pkg` 打包，便携 zip 使用 PowerShell `Compress-Archive` 生成。

## Test / 测试

```powershell
npm test
```

The automated tests cover import pairing, mailbox isolation, code extraction, provider parsing, GitHub API guards, token redaction, global refresh controls, and legacy false-code cleanup.

自动化测试覆盖导入配对、邮箱隔离、验证码提取、取信来源解析、GitHub API 防护、token 脱敏、全局刷新控制和历史误码清理。

## Data And Security / 数据与安全

- Runtime data is stored in `data/mailboxes.json` during source runs and in the user's local app data directory when running the packaged exe.
- `data/*.json`, `.env`, tokens, credentials, logs, build outputs, and caches are excluded from Git.
- The server listens on `127.0.0.1` by default.
- External retrieval requests have timeout, size, and concurrency limits.
- The software does not register GitHub accounts, submit verification codes, bypass CAPTCHA, or run bulk scheduled GitHub interactions.

- 源码运行时数据写入 `data/mailboxes.json`；exe 打包版本写入用户本机应用数据目录。
- `data/*.json`、`.env`、token、credentials、日志、构建产物和缓存均被排除在 Git 外。
- 服务默认只监听 `127.0.0.1`。
- 外部取信请求带有超时、响应大小和并发限制。
- 本软件不会注册 GitHub 账号、自动提交验证码、绕过 CAPTCHA，也不提供批量或定时 GitHub 互动。

## Author / 作者信息

- Author / 作者：HaoXiang Huang
- Email / 邮箱：didadida1688@gmail.com
- Homepage / 主页：https://nextweb4.github.io/
- GitHub：https://github.com/NextWeb4

## License

MIT License. See [LICENSE](LICENSE).
