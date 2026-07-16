# AGENTS.md

## 1. Project structure

- `src/` contains the Node.js server modules; `src/github/` isolates GitHub auth, credentials, API access, and orchestration; `public/` contains the browser UI; `tests/` contains Node built-in tests.
- Runtime metadata may be written under `data/`, but real mailboxes, source URLs, tokens, and message bodies must never be committed.
- `scripts/` owns packaging, executable metadata, checksums, UI verification, and release publication; `release-assets/` is generated output.
- Architecture and release audits belong in `docs/`; publishing instructions remain in `PUBLISHING.md`.

## 2. Run commands

- Use Node.js 20 or newer and npm.
- Install dependencies with `npm install`; start the local service with `npm start`.
- The normal listener is `127.0.0.1:4173`; `启动软件.cmd` is the Windows launcher.
- `.env.example` is documentation only. Set optional variables in the shell; do not assume an automatic dotenv loader.

## 3. Test commands

- Run all tests with `npm test` (`node --test`).
- Parser, extractor, provider, poller, store, route, and GitHub changes require focused regression tests.
- Tests must inject controlled clients and stores; they must not contact live mail retrieval services or GitHub.

## 4. Build commands

- Build the executable and portable archive with `npm run package`; create checksums with `npm run sha256`.
- `npm run build` is an alias for the package workflow. There is no frontend compilation step.
- Validate `release-assets/code-relay-v1.0.0-win-x64.exe`, `release-assets/code-relay-v1.0.0-windows-portable.zip`, and `release-assets/SHA256SUMS.txt` after packaging.
- Publishing scripts may read `GITHUB_TOKEN` or `GH_TOKEN` at runtime, but must not persist credentials in files, logs, remotes, or Git configuration.

## 5. Code style

- Server modules use CommonJS, 2-space indentation, semicolons, and single quotes; browser code uses native JavaScript modules and no framework build.
- Keep parsing and code extraction pure. Separate network requests, persistence, and scheduling from transformations.
- No lint/format command was found in the current repository; record and document one before treating it as a required gate.
- `scripts/patch-exe-metadata.js` may update product/version resources only; it must never imply a digital signature.

## 6. Module boundaries

- `src/parser.js` pairs import records and never performs network I/O. Same-line mailbox/URL pairs must win; cross-line matching is allowed only when the mailbox line has no URL.
- `src/code-extractor.js` extracts messages/codes; timezone offsets such as `+0800` must not become context-free code candidates.
- `src/providers/` owns retrieval protocols, URL redaction, timeouts, and response limits; provider-specific behavior does not belong in `public/`.
- `src/store.js` owns local JSON state; `src/poller.js` owns scheduling and concurrency. A response for a different recipient must never populate the current mailbox.
- `src/github/client.js` wraps REST calls, `service.js` enforces account/action policy, and `credential-vault.js` stores tokens. Tokens never enter Store or frontend responses.
- `public/` calls only local `/api` routes for retrieval and GitHub work; it must not expose credentials through direct third-party requests.

## 7. Prohibited changes

- Never commit `data/*.json`, `.env`, credentials, real mailbox data, retrieved messages, or release outputs.
- Never log or return full tokens; redact credential-like query parameters before displaying URLs.
- Do not bypass URL safety, redirects policy, timeout, 2 MB response limit, polling concurrency, or the minimum five-second interval.
- Do not claim support for a retrieval site without a verified protocol and controlled test.
- Do not register GitHub accounts, submit verification codes, bypass CAPTCHA/risk controls, or add bulk/scheduled star, watch, fork, or follow behavior.
- GitHub writes must remain confirmed, single-target, serialized, at least one second apart, and rate-limit aware.
- Do not add plaintext fallback storage when `@napi-rs/keyring` is unavailable.

## 8. Completion criteria

- `npm test` passes and `npm start` launches the local UI without exposing secrets.
- Both same-line and split-line import formats remain correctly paired and idempotent; stale codes clear when the latest response has none.
- Relevant parser/provider/API/GitHub guards have automated tests.
- Release work also passes `npm run package`, `npm run sha256`, EXE launch, portable ZIP launch, archive-content review, and author/version consistency checks.
- README and security notes reflect any dependency, provider, storage, network, or packaging change.

## 9. Review criteria

- Check record pairing, deduplication, recipient isolation, stale-code removal, one-shot consumption, and false-positive filtering.
- Check every outbound request for safe scheme/host resolution, redirect behavior, timeout, size limit, concurrency, and error isolation.
- Check UI, errors, logs, JSON state, and snapshots for mailbox, URL, token, and message leakage.
- Check GitHub routes for arbitrary-path forwarding, multi-target input, missing confirmation, token exposure, and live-API tests.
- Check portable ZIP contents to ensure `node_modules/`, `data/`, `.env`, and local configuration are excluded.

## 10. Common risks

- Retrieval sites have incompatible protocols and may require cookies, referers, POST bodies, or additional adapters.
- Purchase-text formats can associate a URL with the wrong mailbox if same-line priority regresses.
- Dates, order numbers, and timezone offsets can resemble codes; extraction must retain context.
- Aggressive polling can trigger source rate limits or IP blocking.
- Native keyring availability varies by platform; failure must be explicit rather than insecure.
- `@yao-pkg/pkg` and `resedit` are release-only dependencies; replacements require an updated license/network/rollback audit and executable metadata verification.
