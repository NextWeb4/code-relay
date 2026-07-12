# Release Packaging Audit

## Project Type

- Type: Node.js 20+ local web application.
- Runtime UI: static HTML/CSS/JavaScript served by `src/server.js`.
- Build model: no frontend compilation; release packaging only.
- Target for v1.0.0: Windows x64 executable plus portable zip.

## First-Principles Packaging Analysis

- Expected behavior: users should be able to start the local service, open the browser dashboard, and keep runtime mailbox data outside the Git repository and outside executable snapshots.
- Actual release gap before this audit: the project had no executable packaging, no release metadata, and no portable release asset generation.
- Missing capability: a reproducible way to package a Node local web app as a Windows executable while keeping static assets bundled and runtime data writable.
- Minimal integration point: add release scripts and adjust the default data path only when running as a packaged executable.
- Proof path: run `npm test`, build the exe, start the built exe, open `/api/state`, create the portable zip, and generate SHA256 checksums.

## Candidate Comparison

| Option | Source | License | Core Capability | Pros | Cons | Maintenance Status | Fit | Possible Conflict | Adopted | Integration |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Node.js SEA | Node.js standard runtime | MIT-like Node.js license | Single executable application blob | Official runtime feature, no heavy packager | Requires binary preparation/injection flow and extra tooling for Windows metadata | Active | Medium | More custom release plumbing than this project needs | No | Keep as future option |
| `pkg` | npm / GitHub `vercel/pkg` | MIT | Package Node apps into executables | Familiar CLI and small config surface | Original package is older and less aligned with new Node versions | Low to moderate | Medium | Higher risk with Node 20+ targets | No | Rejected in favor of maintained fork |
| `@yao-pkg/pkg` | npm / GitHub `yao-pkg/pkg` | MIT | Package Node apps into executables | Maintained fork, supports modern Node targets, compatible with current CommonJS app | Downloads/uses prebuilt Node runtime during packaging; native modules still need runtime verification | Active | High | Packaged snapshots are read-only, so runtime data path must move outside snapshot | Yes | `npm run package:exe` with `public/**/*` assets |
| `rcedit` | npm / GitHub `electron/node-rcedit` | MIT | Edit Windows exe version resources | Familiar CLI | npm marks the package as unsupported | Deprecated | Medium | Adds an unsupported release dependency | No | Rejected after audit |
| `resedit` | npm / GitHub `jet2jet/resedit-js` | MIT | Edit Windows exe version resources | Pure JavaScript, recently updated, no native binary | Its README warns to be careful when modifying emitted binaries | Active | High | Must verify generated exe metadata after patching | Yes | `scripts/patch-exe-metadata.js` updates product metadata after `pkg` |
| PowerShell `Compress-Archive` | Windows standard PowerShell | Microsoft Windows component | Create zip archives | No npm dependency, available on Windows release target | Windows-specific script | Active as platform tool | High | None for Windows release target | Yes | `scripts/package-zip.js` stages exe/docs and calls `Compress-Archive` |

## Adopted Reuse

- Directly reused: `@yao-pkg/pkg` for Windows x64 executable packaging.
- Directly reused: `resedit` for Windows executable version-resource metadata.
- Directly reused: PowerShell `Compress-Archive` for the portable zip.
- Borrowed design only: Node.js SEA remains a documented fallback idea but is not integrated.
- Not adopted: original `pkg`, because the maintained fork better fits Node 20+.

## Integration Scope

- Kept: existing CommonJS server, static UI, API routes, tests, and npm workflow.
- Replaced: no application business logic was replaced.
- Added: release scripts, package metadata, Windows exe metadata patching, and executable runtime data-path handling.
- Adapted: `src/server.js` writes packaged-exe runtime data to local app data instead of the read-only packaged snapshot.

## License And Risk

- `@yao-pkg/pkg` is MIT licensed.
- `resedit` is MIT licensed.
- Existing runtime dependencies remain MIT/ISC as reported in `package-lock.json`.
- No known license conflict for a public MIT release.
- Packaging may download or use Node runtime binaries during build; this is a build-time network behavior, not an application runtime behavior.
- `npm install` reported `prebuild-install@7.1.3` as deprecated through the packaging dependency tree. No vulnerability was reported by npm audit at the time of this release.

## Rollback

- Remove `@yao-pkg/pkg` from `devDependencies`.
- Remove `package:exe`, `package:zip`, `package`, `build`, and `sha256` scripts if packaging is no longer needed.
- Keep the `src/server.js` packaged data-path branch only if another exe packager also uses read-only snapshots; otherwise revert to the source data path.
