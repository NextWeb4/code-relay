$ErrorActionPreference = 'Stop'

$repoOwner = 'NextWeb4'
$repoName = 'code-relay'
$repo = "$repoOwner/$repoName"
$tag = 'v1.0.0'
$releaseTitle = 'Initial Clean Release v1.0.0'
$token = $env:GITHUB_TOKEN
if (-not $token) { $token = $env:GH_TOKEN }
if (-not $token) {
  throw 'Set GITHUB_TOKEN or GH_TOKEN before running this script.'
}

function Invoke-GitHubJson($Method, $Uri, $Body = $null) {
  $headers = @{
    Authorization = "Bearer $token"
    Accept = 'application/vnd.github+json'
    'X-GitHub-Api-Version' = '2022-11-28'
    'User-Agent' = 'code-relay-release'
  }
  if ($null -eq $Body) {
    return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers
  }
  return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers -Body ($Body | ConvertTo-Json -Depth 20) -ContentType 'application/json'
}

function Get-GitHubJsonOrNull($Uri) {
  try {
    return Invoke-GitHubJson -Method Get -Uri $Uri
  } catch {
    if ([int]$_.Exception.Response.StatusCode -eq 404) { return $null }
    throw
  }
}

$status = git status --short
if ($status) {
  throw "Git working tree is not clean. Commit or discard changes before publishing.`n$status"
}

if (-not (Test-Path -LiteralPath 'release-assets')) {
  throw 'release-assets was not found. Run npm run package and npm run sha256 first.'
}

$assets = Get-ChildItem -LiteralPath 'release-assets' -File
if (-not ($assets | Where-Object { $_.Name -eq 'SHA256SUMS.txt' })) {
  throw 'release-assets/SHA256SUMS.txt was not found. Run npm run sha256 first.'
}

$existingRepo = Get-GitHubJsonOrNull "https://api.github.com/repos/$repo"
if (-not $existingRepo) {
  Invoke-GitHubJson -Method Post -Uri 'https://api.github.com/user/repos' -Body @{
    name = $repoName
    private = $false
    description = 'A local mailbox verification-code console with owned GitHub account workflows.'
    homepage = 'https://nextweb4.github.io/'
  } | Out-Null
}

git remote set-url origin "https://github.com/$repo.git"

$basic = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("x-access-token:$token"))
$env:GIT_CONFIG_COUNT = '1'
$env:GIT_CONFIG_KEY_0 = 'http.https://github.com/.extraheader'
$env:GIT_CONFIG_VALUE_0 = "AUTHORIZATION: basic $basic"
$env:GIT_TERMINAL_PROMPT = '0'
try {
  git push -u origin main
  git push origin $tag
} finally {
  Remove-Item Env:GIT_CONFIG_COUNT,Env:GIT_CONFIG_KEY_0,Env:GIT_CONFIG_VALUE_0,Env:GIT_TERMINAL_PROMPT -ErrorAction SilentlyContinue
}

$releaseNotes = Get-Content -LiteralPath 'RELEASE_NOTES.md' -Raw
$release = Get-GitHubJsonOrNull "https://api.github.com/repos/$repo/releases/tags/$tag"
if (-not $release) {
  $release = Invoke-GitHubJson -Method Post -Uri "https://api.github.com/repos/$repo/releases" -Body @{
    tag_name = $tag
    target_commitish = 'main'
    name = $releaseTitle
    body = $releaseNotes
    draft = $false
    prerelease = $false
  }
}

$uploadHeaders = @{
  Authorization = "Bearer $token"
  Accept = 'application/vnd.github+json'
  'X-GitHub-Api-Version' = '2022-11-28'
  'User-Agent' = 'code-relay-release'
  'Content-Type' = 'application/octet-stream'
}

$existingAssets = Invoke-GitHubJson -Method Get -Uri "https://api.github.com/repos/$repo/releases/$($release.id)/assets"
foreach ($asset in $assets) {
  $old = $existingAssets | Where-Object { $_.name -eq $asset.Name }
  if ($old) {
    Invoke-GitHubJson -Method Delete -Uri "https://api.github.com/repos/$repo/releases/assets/$($old.id)" | Out-Null
  }
  $uploadUri = "https://uploads.github.com/repos/$repo/releases/$($release.id)/assets?name=$([uri]::EscapeDataString($asset.Name))"
  Invoke-RestMethod -Method Post -Uri $uploadUri -Headers $uploadHeaders -InFile $asset.FullName | Out-Null
}

Write-Host "Published https://github.com/$repo/releases/tag/$tag"
