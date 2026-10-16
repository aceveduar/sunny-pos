# Crea (o actualiza) la tarea de Windows que respalda Sunny POS todos los días.
# Uso (una sola vez, en PowerShell):
#   powershell -ExecutionPolicy Bypass -File scripts\programar_respaldo.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\programar_respaldo.ps1 -Hora 23:30 -Ref abcdefghijklmnopqrst
# -Ref: proyecto de otro negocio (sin -Ref usa el de negocio.js). Una tarea por negocio.
# Corre aunque la computadora haya estado apagada a esa hora (al prenderla).
# Para quitarla: Unregister-ScheduledTask -TaskName "Sunny POS - respaldo*"
param(
  [string]$Hora = '23:30',
  [string]$Ref = ''
)

$repo = Split-Path -Parent $PSScriptRoot
$python = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $python) { Write-Host 'No encontré Python. Instálalo o agrégalo al PATH.' -ForegroundColor Red; exit 1 }
if (-not (Test-Path (Join-Path $HOME 'sunnypos-token.txt'))) {
  Write-Host 'Falta el token en ~\sunnypos-token.txt (ver CLAUDE.md → Supabase → Acceso).' -ForegroundColor Red; exit 1
}

$nombre = if ($Ref) { "Sunny POS - respaldo $Ref" } else { 'Sunny POS - respaldo' }
# El proyecto va como variable de entorno solo dentro de esa tarea
$cmd = if ($Ref) { "/c set SUPABASE_REF=$Ref&& `"$python`" scripts\respaldo.py" } else { "/c `"$python`" scripts\respaldo.py" }
$accion = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument $cmd -WorkingDirectory $repo
$cuando = New-ScheduledTaskTrigger -Daily -At $Hora
$ajustes = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 1)
Register-ScheduledTask -TaskName $nombre -Action $accion -Trigger $cuando -Settings $ajustes `
  -Description 'Respaldo diario de la base de Sunny POS (scripts\respaldo.py)' -Force | Out-Null

Write-Host "Listo: '$nombre' corre todos los días a las $Hora." -ForegroundColor Green
Write-Host 'Para probarla ahora:  Start-ScheduledTask -TaskName' "'$nombre'"
Write-Host 'Resultado: Documentos\SunnyPOS-Respaldos\respaldo.log y Configuración → Datos (respaldo automático).'
