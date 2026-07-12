# Publishing Code Relay

This repository is prepared for `NextWeb4/code-relay`.

## Direct Release With GitHub API

Requirements:

- `GITHUB_TOKEN` or `GH_TOKEN` set to a token that can create/push `NextWeb4/code-relay` and upload releases.
- Local release assets already generated in `release-assets/`.

Run:

```powershell
$env:GITHUB_TOKEN = '<token>'
powershell -ExecutionPolicy Bypass -File scripts/publish-release-api.ps1
```

The script verifies the clean Git state, creates `NextWeb4/code-relay` when missing, pushes `main` and `v1.0.0`, then creates the GitHub Release with files from `release-assets/`. It uses a temporary Git HTTP header and does not write the token to `.git/config`.

## Optional GitHub CLI Flow

If GitHub CLI is installed and authenticated, this wrapper can be used:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/publish-release.ps1
```

## Release Assets

- `code-relay-v1.0.0-win-x64.exe`
- `code-relay-v1.0.0-windows-portable.zip`
- `SHA256SUMS.txt`
