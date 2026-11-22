#!/usr/bin/env bash
set -e

echo "💬 Instalando PapuWhats Desktop..."

OS="$(uname -s)"
case "${OS}" in
    Linux*)     PLATFORM="linux";;
    Darwin*)    PLATFORM="mac";;
    CYGWIN*|MINGW*|MSYS*) PLATFORM="windows";;
    *)          PLATFORM="unknown";;
esac

if [ "$PLATFORM" = "linux" ]; then
    INSTALL_DIR="$HOME/.local/bin"
    DESKTOP_DIR="$HOME/.local/share/applications"
    ICON_DIR="$HOME/.local/share/icons/hicolor/512x512/apps"
    mkdir -p "$INSTALL_DIR" "$DESKTOP_DIR" "$ICON_DIR"

    echo "⬇️  Descargando PapuWhats para Linux..."
    curl -L --progress-bar -o "$INSTALL_DIR/papuwhats.AppImage" "https://github.com/lospapusXDD/papuwhats-web/releases/download/v1.0.0/PapuWhats-1.0.0.AppImage"
    chmod +x "$INSTALL_DIR/papuwhats.AppImage"

    echo "🎨 Configurando icono..."
    curl -fsSL -o "$ICON_DIR/papuwhats.png" "https://raw.githubusercontent.com/lospapusXDD/papuwhats-web/main/icon-512.png" || true

    echo "🖥️  Creando acceso directo en el menú de aplicaciones..."
    cat <<DESKTOP_EOF > "$DESKTOP_DIR/papuwhats.desktop"
[Desktop Entry]
Name=PapuWhats
Comment=Cliente oficial de escritorio para PapuWhats y PapusBank
Exec=$INSTALL_DIR/papuwhats.AppImage %U
Terminal=false
Type=Application
Icon=$ICON_DIR/papuwhats.png
Categories=Network;InstantMessaging;Chat;
StartupWMClass=PapuWhats
DESKTOP_EOF
    chmod +x "$DESKTOP_DIR/papuwhats.desktop"

    if command -v update-desktop-database >/dev/null 2>&1; then
        update-desktop-database "$DESKTOP_DIR" || true
    fi

    echo ""
    echo "✅ ¡PapuWhats se instaló con éxito en tu sistema!"
    echo "💡 Puedes abrirlo desde tu menú de aplicaciones o ejecutando:"
    echo "   $INSTALL_DIR/papuwhats.AppImage &"
    echo ""

    if [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ]; then
        echo "🚀 Iniciando PapuWhats..."
        "$INSTALL_DIR/papuwhats.AppImage" &
    fi
elif [ "$PLATFORM" = "mac" ]; then
    echo "🍎 Para macOS, accede a la versión web o compila desde el repo:"
    echo "   https://lospapusxdd.github.io/papuwhats-web/"
    open "https://lospapusxdd.github.io/papuwhats-web/" || true
else
    echo "⚠️ En Windows ejecuta en PowerShell:"
    echo "   irm https://lospapusxdd.github.io/papuwhats-web/install.ps1 | iex"
fi
