param(
  [switch]$Auto,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$root = 'C:\emcl-release'
$log = Join-Path $root 'auto-release.log'
$lock = Join-Path $root 'auto-release.lock'

function Write-Log([string]$message) {
  $line = '[' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '] ' + $message
  Add-Content -LiteralPath $log -Value $line -Encoding UTF8
  Write-Host $line
}

if (-not (Test-Path $root)) { exit 0 }
Set-Location $root

if (Test-Path $lock) {
  $age = (Get-Date) - (Get-Item $lock).LastWriteTime
  if ($age.TotalMinutes -lt 30) { Write-Log 'Another auto-release run is active; skipped.'; exit 0 }
  Remove-Item $lock -Force
}
New-Item -ItemType File -Path $lock -Force | Out-Null

try {
  git fetch origin main --quiet
  $local = (git rev-parse HEAD).Trim()
  $remote = (git rev-parse origin/main).Trim()
  if ($local -eq $remote) { Write-Log 'No new commits on origin/main.'; exit 0 }

  $dirty = (git status --porcelain)
  if ($dirty) { Write-Log 'Working tree is not clean; auto release skipped.'; exit 0 }

  $latestMessage = (git log -1 --format=%s origin/main)
  if ($latestMessage -match '^Auto release') { Write-Log 'Latest commit is an auto-release commit; skipped.'; exit 0 }

  $changed = @(git diff --name-only HEAD..origin/main)
  $sourceChanges = @($changed | Where-Object { $_ -match '^(src/|package\.json$|package-lock\.json$|build/|electron-builder)' })
  if (-not $sourceChanges.Count) { Write-Log 'No application source changes; skipped.'; exit 0 }

  Write-Log ('Changes detected: ' + ($sourceChanges -join ', '))
  if ($DryRun) { Write-Log 'DryRun: would inspect, test and build a release.'; exit 0 }

  git merge --ff-only origin/main --quiet

  $jsFiles = @()
  $jsFiles += Get-ChildItem (Join-Path $root 'src\main') -Filter *.js -File | Select-Object -ExpandProperty FullName
  $jsFiles += @((Join-Path $root 'src\preload.js'), (Join-Path $root 'src\renderer\app.js'))
  foreach ($file in $jsFiles) {
    if (Test-Path $file) {
      & node --check $file
      if ($LASTEXITCODE -ne 0) { throw ('Syntax check failed: ' + $file) }
    }
  }

  $pkg = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  $oldVersion = [string]$pkg.version
  $parts = $oldVersion.Split('.')
  if ($parts.Count -lt 2) { throw 'Invalid package version' }
  $parts[$parts.Count - 1] = ([int]$parts[$parts.Count - 1] + 1).ToString()
  $newVersion = $parts -join '.'
  $updateFile = Join-Path $root 'docs\update.json'
  $update = Get-Content -LiteralPath $updateFile -Raw -Encoding UTF8 | ConvertFrom-Json
  if ([string]$update.version -eq $newVersion) {
    $parts[$parts.Count - 1] = ([int]$parts[$parts.Count - 1] + 1).ToString()
    $newVersion = $parts -join '.'
  }

  Write-Log ('Building release ' + $newVersion)
  & node -e "const fs=require('fs');const p='package.json';const d=JSON.parse(fs.readFileSync(p));d.version='$newVersion';fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n')"
  if ($LASTEXITCODE -ne 0) { throw 'Version bump failed' }

  $portableDir = Join-Path $root ('dist-auto-portable-' + $newVersion)
  $nsisDir = Join-Path $root ('dist-auto-nsis-' + $newVersion)
  & npx electron-builder --win portable --x64 --config.directories.output=$portableDir --config.portable.artifactName="EMCL-Portable-$newVersion.exe"
  if ($LASTEXITCODE -ne 0) { throw 'Portable build failed' }
  & npx electron-builder --win nsis --x64 --config.directories.output=$nsisDir --config.nsis.artifactName="EMCL-Setup-$newVersion.exe"
  if ($LASTEXITCODE -ne 0) { throw 'Installer build failed' }

  $portable = Join-Path $portableDir ("EMCL-Portable-$newVersion.exe")
  $setup = Join-Path $nsisDir ("EMCL-Setup-$newVersion.exe")
  $asar = Join-Path $portableDir 'win-unpacked\resources\app.asar'
  if (-not (Test-Path $portable) -or -not (Test-Path $setup) -or -not (Test-Path $asar)) { throw 'Build output missing' }

  $downloadDir = Join-Path $root 'docs\downloads'
  $updatesDir = Join-Path $downloadDir 'updates'
  New-Item -ItemType Directory -Path $updatesDir -Force | Out-Null
  Copy-Item $portable (Join-Path $downloadDir ("EMCL-Portable-$newVersion.exe")) -Force
  Copy-Item $setup (Join-Path $downloadDir ("EMCL-Setup-$newVersion.exe")) -Force
  Copy-Item $asar (Join-Path $updatesDir ("app-$newVersion.asar")) -Force

  $portableHash = (Get-FileHash $portable -Algorithm SHA256).Hash
  $asarHash = (Get-FileHash $asar -Algorithm SHA256).Hash

  foreach ($name in @('index.html', 'download.html', 'history.html')) {
    $path = Join-Path $root ('docs\' + $name)
    $text = [IO.File]::ReadAllText($path, [Text.Encoding]::UTF8)
    $text = $text.Replace($oldVersion, $newVersion)
    [IO.File]::WriteAllText($path, $text, (New-Object Text.UTF8Encoding($false)))
  }

  $update.version = $newVersion
  $update.downloadUrl = "https://www.emcl.life/downloads/EMCL-Portable-$newVersion.exe"
  $update.sha256 = $portableHash
  $update.asarUrl = "https://www.emcl.life/downloads/updates/app-$newVersion.asar"
  $update.asarSha256 = $asarHash
  $update.notes = @("自动发布 $newVersion", '包含本次源码改动与增量更新包')
  $json = $update | ConvertTo-Json -Depth 10
  [IO.File]::WriteAllText($updateFile, $json + "`n", (New-Object Text.UTF8Encoding($false)))

  git add package.json src docs\index.html docs\download.html docs\history.html docs\update.json ("docs\downloads\EMCL-Portable-$newVersion.exe") ("docs\downloads\EMCL-Setup-$newVersion.exe") ("docs\downloads\updates\app-$newVersion.asar")
  git commit -m "Auto release $newVersion" --quiet
  if ($LASTEXITCODE -ne 0) { throw 'Commit failed' }
  git push origin HEAD:main --quiet
  if ($LASTEXITCODE -ne 0) { throw 'Push failed' }
  Write-Log ("Published " + $newVersion)
} catch {
  Write-Log ('Auto release failed: ' + $_.Exception.Message)
  exit 1
} finally {
  Remove-Item $lock -Force -ErrorAction SilentlyContinue
}
