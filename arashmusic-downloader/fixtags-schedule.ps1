param([switch]$Remove, [string]$At = "21:00")

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$taskName = "Amusic tag fixer"

if ($Remove) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Tag fixer schedule removed."
  return
}

if (-not (Test-Path (Join-Path $root "remote.json"))) {
  Write-Host "Create remote.json first (copy remote.example.json, fill in host, username, password)."
  exit 1
}

$command = "Set-Location '" + $root + "'; npm run fixtags:remote *> fixtags-remote.log"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument ("-WindowStyle Hidden -NoProfile -Command `"" + $command + "`"")
$triggers = @(
  (New-ScheduledTaskTrigger -Daily -At $At),
  (New-ScheduledTaskTrigger -AtLogOn)
)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $triggers -Settings $settings -Description "Send badly tagged songs from the music host to Claude Code on this laptop" -Force | Out-Null

Write-Host ("Tag fixer scheduled daily at " + $At + " and at logon. Log: fixtags-remote.log")
Write-Host "Run it now:  npm run fixtags:remote"
Write-Host "Remove:  npm run fixtags:unschedule"
