$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "💬 Instalador y Optimizador PapuWhats Desktop para Windows" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Cerrar cualquier instancia previa
Write-Host "🔄 Verificando procesos activos..." -ForegroundColor Yellow
Get-Process -Name "PapuWhats" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 800

$InstallDir = "$env:LOCALAPPDATA\PapuWhats"
$ZipFile = "$env:TEMP\PapuWhats-1.0.0-win.zip"
$Url = "https://github.com/lospapusXDD/papuwhats-web/releases/download/v1.0.0/PapuWhats-1.0.0-win.zip"

# 2. Descarga del paquete
Write-Host "⬇️  Descargando última versión de PapuWhats..." -ForegroundColor Yellow
Invoke-WebRequest -Uri $Url -OutFile $ZipFile -UseBasicParsing

# 3. Extracción
Write-Host "📦 Extrayendo e instalando archivos..." -ForegroundColor Yellow
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

# 4. Configurar permisos de notificaciones de Windows en el Registro
Write-Host "🔔 Habilitando notificaciones y avisos en segundo plano..." -ForegroundColor Yellow
$AppId = "com.papusbank.papuwhats"
$RegPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Notifications\Settings\$AppId"
try {
    if (-not (Test-Path $RegPath)) {
        New-Item -Path $RegPath -Force | Out-Null
    }
    Set-ItemProperty -Path $RegPath -Name "ShowInActionCenter" -Value 1 -Type DWord -Force
    Set-ItemProperty -Path $RegPath -Name "ShowBanners" -Value 1 -Type DWord -Force
    Set-ItemProperty -Path $RegPath -Name "Enabled" -Value 1 -Type DWord -Force
    Set-ItemProperty -Path $RegPath -Name "AllowSounds" -Value 1 -Type DWord -Force
} catch {
    # No crítico
}

# 5. Crear accesos directos (Escritorio y Menú Inicio)
Write-Host "🖥️  Creando accesos directos en Escritorio y Menú Inicio..." -ForegroundColor Yellow
$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$ProgramsPath = [Environment]::GetFolderPath("Programs")

# Acceso directo Escritorio
$Shortcut = $WshShell.CreateShortcut("$DesktopPath\PapuWhats.lnk")
$Shortcut.TargetPath = $ExePath
$Shortcut.WorkingDirectory = Split-Path $ExePath
$Shortcut.Description = "PapuWhats Messenger Oficial"
$Shortcut.Save()

# Acceso directo Menú Inicio
$StartMenuDir = "$ProgramsPath\PapuWhats"
if (-not (Test-Path $StartMenuDir)) {
    New-Item -Path $StartMenuDir -ItemType Directory -Force | Out-Null
}
$StartShortcut = $WshShell.CreateShortcut("$StartMenuDir\PapuWhats.lnk")
$StartShortcut.TargetPath = $ExePath
$StartShortcut.WorkingDirectory = Split-Path $ExePath
$StartShortcut.Description = "PapuWhats Messenger Oficial"
$StartShortcut.Save()

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "✅ ¡PapuWhats Desktop se instaló y configuró exitosamente!" -ForegroundColor Green
Write-Host "🔔 Notificaciones en segundo plano: ACTIVADAS" -ForegroundColor Green
Write-Host "🔄 Actualización automática permanente: HABILITADA" -ForegroundColor Green
Write-Host "🚀 Iniciando aplicación..." -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Green
Start-Process $ExePath
