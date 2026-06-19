param([switch]$Remove)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$taskName = "Amusic"

if ($Remove) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Auto-start removed."
  return
}

$command = "Set-Location '" + $root + "'; npm start"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument ("-WindowStyle Hidden -NoProfile -Command `"" + $command + "`"")
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "Start the Amusic music stack at logon" -Force | Out-Null

Write-Host "Auto-start installed. The whole stack will launch hidden at every logon."
Write-Host "Start it now without rebooting:  npm start"
Write-Host "Remove auto-start:  npm run autostart:remove"
