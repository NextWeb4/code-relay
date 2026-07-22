<p align="center">
  <a href="README.md"><img src="https://img.shields.io/badge/English-0969da?style=flat-square" alt="English"></a>
  <a href="README.zh-CN.md"><img src="https://img.shields.io/badge/%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-c8102e?style=flat-square" alt="简体中文"></a>
  <a href="README.ja.md"><img src="https://img.shields.io/badge/%E6%97%A5%E6%9C%AC%E8%AA%9E-8250df?style=flat-square" alt="日本語"></a>
</p>

# Code Relay

A local mailbox verification-code console with guarded retrieval polling and manual workflows for GitHub accounts you own.

![Last commit](https://img.shields.io/github/last-commit/NextWeb4/code-relay?style=flat-square)
![Repository size](https://img.shields.io/github/repo-size/NextWeb4/code-relay?style=flat-square)
![GitHub stars](https://img.shields.io/github/stars/NextWeb4/code-relay?style=flat-square)
![Node.js 20 or newer](https://img.shields.io/badge/Node.js-20%2B-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![MIT License](https://img.shields.io/github/license/NextWeb4/code-relay?style=flat-square)

![Code Relay mailbox dashboard](docs/demo/code-relay-dashboard.png)

![Code Relay owned GitHub accounts panel](docs/demo/code-relay-github.png)

## What It Does

Code Relay runs a local service on `127.0.0.1:4173`. It imports mailbox/retrieval-URL pairs from pasted purchase text, TXT, or CSV; polls supported HTTP/HTTPS sources; extracts likely verification codes; and streams state changes to the browser with Server-Sent Events.

- Pairs and deduplicates mailbox addresses with retrieval URLs, including same-line `mailbox----url` and supported split-line formats.
- Handles repeatable polling sources and guarded one-shot sources.
- Extracts codes from plain text, HTML, JSON-like payloads, and `iframe[srcdoc]` message bodies.
- Rejects common false positives such as dates, time-zone offsets, email local parts, and unrelated button text.
- Keeps mailbox state, source URLs, messages, and codes in local runtime storage.
- Offers Chinese and English UI text with the preference stored in `localStorage`.
- Connects an owned GitHub account through OAuth Device Flow and stores its token in the operating-system credential vault.
- Allows only confirmed, single-target GitHub `star`, `watch`, `fork`, and `follow` actions.

Code Relay does not register GitHub accounts, submit verification codes, bypass CAPTCHA or risk controls, or run bulk/scheduled GitHub interactions.

## Requirements

- Node.js 20 or newer.
- npm (the repository includes `package-lock.json`).
- Windows for the packaged `v1.0.0` executable and portable ZIP.
- A GitHub OAuth Client ID only when using the optional GitHub module. It can be entered in the UI or supplied through `GITHUB_OAUTH_CLIENT_ID`; mail retrieval works without it.

## Install and Run

```powershell
npm install
npm start
```

Open <http://127.0.0.1:4173>. On Windows, `启动软件.cmd` starts the service and opens the browser.

`.env.example` documents optional environment values, but the application does not load `.env` automatically. Set values in the current shell before starting.

Example imports:

```text
name@example.com----https://mail.example.com/api?token=YOUR_TOKEN

Click to fetch mailbox: https://mail.example.com/
qq mailbox:
1234567890@qq.com
```

Same-line mailbox/URL pairs stay on that line. Cross-line matching is used only when the mailbox line has no URL, so one record cannot steal the next record's source.

## Runtime Configuration

- `PORT` changes the local listener port; the normal service still binds to the loopback interface.
- `DATA_FILE` overrides the JSON state path. Protect that file because it contains mailbox addresses, retrieval URLs, messages, and extracted codes.
- `GITHUB_OAUTH_CLIENT_ID` supplies the optional OAuth application identifier without saving it through the UI.
- `CODE_RELAY_OPEN_BROWSER` controls whether startup opens the local page automatically.

These variables must be set in the current process environment before launch. `.env.example` documents them, but Code Relay does not include a dotenv loader.

## Daily Workflow

1. Start the service and open the local dashboard.
2. Use **Batch Import** to paste purchase text or load a supported TXT/CSV source, then check the added, updated, duplicate, and rejected counts.
3. Search or filter the mailbox cards and confirm whether each source is repeatable or one-shot. A one-shot source must remain a deliberate manual fetch.
4. Refresh one mailbox, refresh all, or enable automatic polling only for eligible repeatable sources. Server-Sent Events update the dashboard after local state changes.
5. Confirm the mailbox and message context before copying a code. Delete a mailbox record when its local data is no longer needed.
6. For the optional GitHub flow, select a linked mailbox, authorize an owned account through Device Flow, run one confirmed action against one target, and disconnect the account to remove its vault token.

## Test

```powershell
npm test
```

Tests use Node's built-in test runner and cover import pairing, mailbox isolation, code extraction, provider parsing, polling, storage, HTTP routes, GitHub request guards, credential redaction, global refresh controls, and stale-code cleanup. Tests must not call real retrieval or GitHub APIs.

No lint or format command is currently declared.

## Package a Windows Release

```powershell
npm run package
npm run sha256
```

The project has no frontend compilation step. Packaging uses `@yao-pkg/pkg` for the Windows x64 executable, `resedit` for version-resource metadata, and PowerShell `Compress-Archive` through the packaging script for the portable ZIP.

Expected files in `release-assets/`:

| File | Purpose |
| --- | --- |
| `code-relay-v1.0.0-win-x64.exe` | Windows x64 executable |
| `code-relay-v1.0.0-windows-portable.zip` | EXE, README, LICENSE, `.env.example`, and verified demo images |
| `SHA256SUMS.txt` | SHA256 checksums for release files |

No MSI is produced because this local Node web application has no installer project. Publishing instructions are in `PUBLISHING.md`; the API script pushes `main` and tag `v1.0.0` to `NextWeb4/code-relay` and reads `GITHUB_TOKEN` or `GH_TOKEN` at runtime without writing it into Git configuration.

## Project Structure

| Path | Responsibility |
| --- | --- |
| `src/server.js` | Local HTTP/API/SSE server and shutdown orchestration |
| `src/parser.js` | Pure mailbox/URL import parsing |
| `src/code-extractor.js` | Verification-code and message extraction |
| `src/providers/` | Guarded retrieval protocols and response parsing |
| `src/network-guard.js` | URL/network restrictions for outbound retrieval |
| `src/poller.js` | Poll scheduling, concurrency, and one-shot handling |
| `src/store.js` | Local JSON persistence |
| `src/github/` | Device Flow, credential vault, GitHub REST client, and single-account service orchestration |
| `public/` | Native HTML/CSS/JavaScript browser UI; third-party requests go through local `/api` routes |
| `tests/` | Node built-in test suites |
| `scripts/` | Windows packaging, metadata, checksums, UI verification, and release publishing |

## Data and Security

- Source runs store runtime state in `data/mailboxes.json`; packaged runs use the user's local application-data directory.
- `data/*.json`, `.env`, credentials, logs, build outputs, and caches are excluded from Git.
- OAuth tokens are stored only through `@napi-rs/keyring`; there is no plaintext-file fallback when the system vault is unavailable.
- Retrieval requests reject unsafe destinations and redirects, time out, limit response bodies to 2 MB, and redact token-like query values in displayed URLs.
- Polling defaults and guards prevent unbounded concurrency; do not reduce the interval below five seconds.
- GitHub writes are serialized, require a single explicit target and confirmation, wait at least one second between writes, and stop for primary, secondary, or `Retry-After` limits.
- Full mailbox addresses, source URLs, codes, and mail content are sensitive local data. Do not include them in logs, screenshots, test snapshots, or commits.

## Maintenance and Contributions

- Read the [architecture guide](docs/architecture.md) before changing parser, provider, polling, storage, GitHub, or browser boundaries; add focused coverage in the corresponding `tests/*.test.js` suite.
- Browser changes must preserve the native no-build frontend and keep the Chinese/English application strings aligned. Documentation changes must keep the three README versions aligned.
- Release work must follow [the release audit](docs/release-audit.md) and [publishing guide](PUBLISHING.md), then verify the EXE, portable archive, demo images, and checksums without committing generated assets.
- Keep retrieval and GitHub operations manual, single-purpose, rate-limit aware, and inside the safety limits documented above.

## Author

- HaoXiang Huang
- [Rays688888@Gmail.com](mailto:Rays688888@Gmail.com)
- <https://nextweb4.github.io/>
- <https://github.com/NextWeb4>

## License

[MIT](LICENSE) © 2026 HaoXiang Huang.


