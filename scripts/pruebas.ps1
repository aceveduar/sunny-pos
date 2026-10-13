# Corre las pruebas automáticas (Caja, seguridad, kits y apartados) contra la base
# del negocio, dentro de transacciones que siempre se deshacen: no queda nada guardado.
# Correr antes de publicar cambios que toquen dinero, stock, turnos o permisos:
#   powershell -ExecutionPolicy Bypass -File scripts\pruebas.ps1
# Usa scripts\instalar\sql.py (token del proyecto en ~\sunnypos-token.txt).
# Sale con código 0 si todo pasa y 1 si algo falla.

$env:PYTHONIOENCODING = 'utf-8'
$sql = Join-Path $PSScriptRoot 'instalar\sql.py'
$falla = $false
foreach ($f in @('caja.sql', 'kits_y_apartados.sql')) {
  Write-Host "== $f"
  $out = (& python $sql (Join-Path $PSScriptRoot "pruebas\$f") 2>&1 | Out-String)
  if ($out -match 'PRUEBA FALL[^"\\]*') {
    Write-Host "  FALLÓ: $($Matches[0])" -ForegroundColor Red
    $falla = $true; continue
  }
  $lineas = $out.Trim() -split "`r?`n"
  if ($lineas[-1].Trim() -ne 'TODAS LAS PRUEBAS PASARON') {
    Write-Host '  No se pudieron correr (¿token vencido? ver ~\sunnypos-token.txt)' -ForegroundColor Red
    Write-Host ($out.Substring(0, [Math]::Min(500, $out.Length)))
    $falla = $true; continue
  }
  foreach ($l in $lineas) {
    $color = if ($l.Trim() -eq 'TODAS LAS PRUEBAS PASARON') { 'Green' } else { 'Gray' }
    Write-Host "  ✓ $($l.Trim())" -ForegroundColor $color
  }
}
if ($falla) { exit 1 }
exit 0
