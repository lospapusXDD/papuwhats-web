$ErrorActionPreference = "Stop"
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "💬 Instalando PapuWhats Desktop para Windows..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$InstallDir = "$env:LOCALAPPDATA\PapuWhats"
$ZipFile = "$env:TEMP\PapuWhats-1.0.0-win.zip"
$Url = "https://github.com/lospapusXDD/papuwhats-web/releases/download/v1.0.0/PapuWhats-1.0.0-win.zip"

Write-Host "⬇️  Descargando paquete de Windows (218 MB)..." -ForegroundColor Yellow
Invoke-WebRequest -Uri $Url -OutFile $ZipFile -UseBasicParsing

Write-Host "📦 Extrayendo archivos..." -ForegroundColor Yellow
if (Test-Path $InstallDir) {
    Remove-Item -Path $InstallDir -Recurse -Force
}
Expand-Archive -Path $ZipFile -DestinationPath $InstallDir -Force
Remove-Item -Path $ZipFile -Force

$ExePath = "$InstallDir\win-unpacked\PapuWhats.exe"
if (-not (Test-Path $ExePath)) {
    $ExePath = "$InstallDir\PapuWhats.exe"
}

Write-Host "🖥️  Creando acceso directo en el Escritorio..." -ForegroundColor Yellow
$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$Shortcut = $WshShell.CreateShortcut("$DesktopPath\PapuWhats.lnk")
$Shortcut.TargetPath = $ExePath
$Shortcut.Save()

Write-Host ""
Write-Host "✅ ¡PapuWhats se instaló correctamente!" -ForegroundColor Green
Write-Host "🚀 Iniciando aplicación..." -ForegroundColor Cyan
Start-Process $ExePath
