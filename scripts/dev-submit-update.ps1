param(
  [Parameter(Mandatory=$true)][string]$Version,
  [string]$Notes = ''
)

$ErrorActionPreference = 'Stop'
$publicRepo = 'C:\emcl-release'
$devRepo = 'C:\Users\MC_Enderman7810 com\Documents\EMCL'
$worktree = 'C:\emcl-update-publish'
$version = $Version.Trim()
if ($version -notmatch '^\d+\.\d+\.\d+') { throw '版本号格式不正确' }
if (-not (Test-Path $publicRepo) -or -not (Test-Path $devRepo)) { throw '找不到仓库路径' }

function Log([string]$message) { Write-Host ('[dev-update] ' + $message) }

# 1. 更新开发者源码版本号
$pkgPath = Join-Path $devRepo 'package.json'
$pkg = Get-Content -LiteralPath $pkgPath -Raw -Encoding UTF8 | ConvertFrom-Json
$pkg.version = $version
[IO.File]::WriteAllText($pkgPath, ($pkg | ConvertTo-Json -Depth 20) + "`n", (New-Object Text.UTF8Encoding($false)))
Log ('dev version -> ' + $version)

# 2. 构建开发者版目录，只取 app.asar 作为更新包
$outDir = Join-Path $devRepo ('dist-dev-publish-' + $version)
if (Test-Path $outDir) { Remove-Item $outDir -Recurse -Force }
Push-Location $devRepo
try {
  & npx electron-builder --win dir --x64 --config.directories.output=$outDir
  if ($LASTEXITCODE -ne 0) { throw '开发者版构建失败' }
} finally { Pop-Location }

$asar = Join-Path $outDir 'win-unpacked\resources\app.asar'
if (-not (Test-Path $asar)) { throw '找不到构建后的 app.asar' }

# 3. 复制更新包到官网下载目录
$updatesDir = Join-Path $publicRepo 'docs\downloads\updates'
New-Item -ItemType Directory -Path $updatesDir -Force | Out-Null
$assetName = 'dev-app-' + $version + '.asar'
$assetPath = Join-Path $updatesDir $assetName
Copy-Item $asar $assetPath -Force
$hash = (Get-FileHash $assetPath -Algorithm SHA256).Hash
Log ('package ' + $assetName + ' ' + $hash)

# 4. 更新 public 仓库的 update 分支清单
Push-Location $publicRepo
try {
  git fetch origin --quiet
  $branchExists = (git branch --list update)
  if (-not $branchExists) { git branch update origin/main | Out-Null }
  if (Test-Path $worktree) { git worktree remove $worktree --force 2>$null | Out-Null }
  git worktree add --force $worktree update | Out-Null
  $manifest = [ordered]@{
    version = $version
    releaseDate = (Get-Date -Format 'yyyy-MM-dd')
    branch = 'update'
    auto = $true
    downloadUrl = ('https://www.emcl.life/downloads/updates/' + $assetName)
    sha256 = $hash
    notes = @($Notes -split "`r?`n" | Where-Object { $_.Trim() } | ForEach-Object { $_.Trim() })
  }
  $manifestPath = Join-Path $worktree 'dev-update.json'
  [IO.File]::WriteAllText($manifestPath, (($manifest | ConvertTo-Json -Depth 10) + "`n"), (New-Object Text.UTF8Encoding($false)))
  Push-Location $worktree
  try {
    git add dev-update.json
    git commit -m ('Dev update ' + $version) --quiet
    git push origin update --quiet
    if ($LASTEXITCODE -ne 0) { throw '推送 update 分支失败' }
  } finally { Pop-Location }
  Log ('update branch -> ' + $version)
} finally {
  if (Test-Path $worktree) { git worktree remove $worktree --force 2>$null | Out-Null }
  Pop-Location
}

# 5. 提交开发者源码版本号
Push-Location $devRepo
try {
  git add package.json
  git commit -m ('Publish dev update ' + $version) --quiet
  git push dev HEAD:main --quiet
} finally { Pop-Location }
Log 'done'
