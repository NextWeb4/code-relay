$ErrorActionPreference = 'Stop'

$repoOwner = 'NextWeb4'
$repoName = 'code-relay'
$repo = "$repoOwner/$repoName"
$tag = 'v1.0.0'
$releaseTitle = 'Initial Clean Release v1.0.0'

function Assert-Command($Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found. Install it and authenticate before publishing."
  }
}

Assert-Command git
Assert-Command gh

$status = git status --short
if ($status) {
  throw "Git working tree is not clean. Commit or discard changes before publishing.`n$status"
}

if (-not (Test-Path -LiteralPath 'release-assets')) {
  throw "release-assets was not found. Run npm run package and npm run sha256 first."
}

$assets = Get-ChildItem -LiteralPath 'release-assets' -File
if (-not ($assets | Where-Object { $_.Name -eq 'SHA256SUMS.txt' })) {
  throw "release-assets/SHA256SUMS.txt was not found. Run npm run sha256 first."
}

gh repo view $repo *> $null
if ($LASTEXITCODE -ne 0) {
  gh repo create $repo --public
}

$remotes = git remote
if ($remotes -notcontains 'origin') {
  git remote add origin "https://github.com/$repo.git"
} else {
  git remote set-url origin "https://github.com/$repo.git"
}

git push -u origin main
git push origin $tag

$existingRelease = gh release view $tag --repo $repo *> $null
if ($LASTEXITCODE -eq 0) {
  gh release upload $tag release-assets/* --repo $repo --clobber
} else {
  gh release create $tag release-assets/* --repo $repo --title $releaseTitle --notes-file RELEASE_NOTES.md
}

Write-Host "Published https://github.com/$repo/releases/tag/$tag"
