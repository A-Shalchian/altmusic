$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$tools = Join-Path $root 'tools'
New-Item -ItemType Directory -Force $tools | Out-Null

Write-Output 'downloading yt-dlp'
Invoke-WebRequest -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile (Join-Path $tools 'yt-dlp.exe')

Write-Output 'downloading ffmpeg'
$tmp = Join-Path $env:TEMP 'ffmpeg.zip'
Invoke-WebRequest -Uri 'https://github.com/BtbN/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-win64-gpl.zip' -OutFile $tmp
$ex = Join-Path $env:TEMP 'ffmpeg_x'
if (Test-Path $ex) { Remove-Item -Recurse -Force $ex }
Expand-Archive $tmp -DestinationPath $ex -Force
$bin = Get-ChildItem -Recurse -Path $ex -Filter 'ffmpeg.exe' | Select-Object -First 1
Copy-Item $bin.FullName (Join-Path $tools 'ffmpeg.exe') -Force
Copy-Item (Join-Path $bin.DirectoryName 'ffprobe.exe') (Join-Path $tools 'ffprobe.exe') -Force
Remove-Item $tmp -Force
Remove-Item -Recurse -Force $ex

Write-Output 'tools ready'
