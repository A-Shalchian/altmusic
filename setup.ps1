$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

function Section($text) {
  Write-Host ""
  Write-Host ("==> " + $text) -ForegroundColor Cyan
}

function Download($url, $dest) {
  Invoke-WebRequest -Uri $url -OutFile $dest -Headers @{ "User-Agent" = "arashmusic-setup" }
}

Section "Folders"
$tools = Join-Path $root "arashmusic-downloader\tools"
$caddyDir = Join-Path $root "caddy"
$navDir = Join-Path $root "navidrome"
New-Item -ItemType Directory -Force $tools | Out-Null
New-Item -ItemType Directory -Force $caddyDir | Out-Null
New-Item -ItemType Directory -Force (Join-Path $navDir "music") | Out-Null
New-Item -ItemType Directory -Force (Join-Path $navDir "data") | Out-Null

Section "yt-dlp"
$ytdlp = Join-Path $tools "yt-dlp.exe"
if (Test-Path $ytdlp) { Write-Host "already present" } else {
  Download "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" $ytdlp
}

Section "ffmpeg"
if ((Test-Path (Join-Path $tools "ffmpeg.exe")) -and (Test-Path (Join-Path $tools "ffprobe.exe"))) {
  Write-Host "already present"
} else {
  $zip = Join-Path $env:TEMP "ffmpeg.zip"
  Download "https://github.com/BtbN/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-win64-gpl.zip" $zip
  $ex = Join-Path $env:TEMP "ffmpeg_x"
  if (Test-Path $ex) { Remove-Item -Recurse -Force $ex }
  Expand-Archive $zip -DestinationPath $ex -Force
  $bin = Get-ChildItem -Recurse -Path $ex -Filter "ffmpeg.exe" | Select-Object -First 1
  Copy-Item $bin.FullName (Join-Path $tools "ffmpeg.exe") -Force
  Copy-Item (Join-Path $bin.DirectoryName "ffprobe.exe") (Join-Path $tools "ffprobe.exe") -Force
  Remove-Item $zip -Force
  Remove-Item -Recurse -Force $ex
}

Section "Navidrome"
$navExe = Join-Path $navDir "navidrome.exe"
if (Test-Path $navExe) { Write-Host "already present" } else {
  $rel = Invoke-RestMethod -Uri "https://api.github.com/repos/navidrome/navidrome/releases/latest" -Headers @{ "User-Agent" = "arashmusic-setup" }
  $asset = $rel.assets | Where-Object { $_.name -match "Windows|windows" -and $_.name -match "(x86_64|amd64)" -and $_.name -match "\.zip$" } | Select-Object -First 1
  $zip = Join-Path $env:TEMP "navidrome.zip"
  Download $asset.browser_download_url $zip
  $ex = Join-Path $env:TEMP "navidrome_x"
  if (Test-Path $ex) { Remove-Item -Recurse -Force $ex }
  Expand-Archive $zip -DestinationPath $ex -Force
  Copy-Item (Join-Path $ex "navidrome.exe") $navExe -Force
  Remove-Item $zip -Force
  Remove-Item -Recurse -Force $ex
}

Section "Caddy"
$caddyExe = Join-Path $caddyDir "caddy.exe"
if (Test-Path $caddyExe) { Write-Host "already present" } else {
  Download "https://caddyserver.com/api/download?os=windows&arch=amd64" $caddyExe
}

Section "Config and Navidrome settings"
$musicDir = Join-Path $navDir "music"
$dataDir = Join-Path $navDir "data"
$noBom = New-Object System.Text.UTF8Encoding($false)

$cfgPath = Join-Path $root "arashmusic-downloader\config.json"
$examplePath = Join-Path $root "arashmusic-downloader\config.example.json"
if (Test-Path $cfgPath) {
  $cfg = ([System.IO.File]::ReadAllText($cfgPath)).TrimStart([char]0xFEFF) | ConvertFrom-Json
} else {
  $cfg = Get-Content $examplePath -Raw | ConvertFrom-Json
}
$cfg.musicDir = $musicDir
$cfg.navidromeDb = Join-Path $dataDir "navidrome.db"
[System.IO.File]::WriteAllText($cfgPath, ($cfg | ConvertTo-Json), $noBom)
Write-Host "wrote config.json (paths set; secrets preserved if present)"

$navToml = Join-Path $navDir "navidrome.toml"
$tomlLines = @(
  ("MusicFolder = '" + $musicDir + "'"),
  ("DataFolder = '" + $dataDir + "'"),
  "Address = '0.0.0.0'",
  "Port = 4533",
  "ScanSchedule = '@every 1m'",
  "EnableInsightsCollector = false"
)
if ($cfg.lastfmApiKey -and $cfg.lastfmSecret) {
  $tomlLines += "LastFM.Enabled = true"
  $tomlLines += ("LastFM.ApiKey = '" + $cfg.lastfmApiKey + "'")
  $tomlLines += ("LastFM.Secret = '" + $cfg.lastfmSecret + "'")
  Write-Host "Last.fm enabled from config.json"
}
[System.IO.File]::WriteAllText($navToml, ($tomlLines -join "`r`n"), $noBom)
Write-Host "wrote navidrome.toml"

Section "Installing dependencies"
Push-Location $root
npm install
Pop-Location
Push-Location (Join-Path $root "arashmusic")
npm install
Pop-Location
Push-Location (Join-Path $root "arashmusic-downloader")
npm install
Pop-Location

Section "Building the app"
Push-Location (Join-Path $root "arashmusic")
npm run build
Pop-Location

Write-Host ""
Write-Host "Setup complete." -ForegroundColor Green
Write-Host "Next: put your Telegram bot token in arashmusic-downloader\config.json, then run: npm start" -ForegroundColor Green
