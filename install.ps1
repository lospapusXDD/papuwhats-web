$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "💬 Instalando PapuWhats Desktop para Windows..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Cerrar cualquier instancia previa si está abierta
Get-Process -Name "PapuWhats" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 800

$InstallDir = "$env:LOCALAPPDATA\PapuWhats"
$ZipFile = "$env:TEMP\PapuWhats-1.0.0-win.zip"
$Url = "https://github.com/lospapusXDD/papuwhats-web/releases/download/v1.0.0/PapuWhats-1.0.0-win.zip"

Write-Host "⬇️  Descargando última versión de PapuWhats..." -ForegroundColor Yellow
Invoke-WebRequest -Uri $Url -OutFile $ZipFile -UseBasicParsing

Write-Host "📦 Extrayendo archivos..." -ForegroundColor Yellow
if (Test-Path $InstallDir) {
    Remove-Item -Path $InstallDir -Recurse -Force
}
Expand-Archive -Path $ZipFile -DestinationPath $InstallDir -Force
Remove-Item -Path $ZipFile -Force

$ExePath = "$InstallDir\PapuWhats.exe"
if (-not (Test-Path $ExePath)) {
    $found = Get-ChildItem -Path $InstallDir -Filter "PapuWhats.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { $ExePath = $found.FullName }
}

Write-Host "🖥️  Creando acceso directo en el Escritorio..." -ForegroundColor Yellow
$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$Shortcut = $WshShell.CreateShortcut("$DesktopPath\PapuWhats.lnk")
$Shortcut.TargetPath = $ExePath
$Shortcut.Save()

Write-Host ""
Write-Host "✅ ¡PapuWhats se instaló y actualizó correctamente!" -ForegroundColor Green
Write-Host "🚀 Iniciando aplicación..." -ForegroundColor Cyan
Start-Process $ExePath

