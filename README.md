# 💬 PapuWhats Web

Nueva versión remodelada de **PapuWhats**, la aplicación de mensajería privada oficial de **PapusBank**.

🌐 **Web en vivo:** [https://lospapusxdd.github.io/papuwhats-web/](https://lospapusxdd.github.io/papuwhats-web/)

---

## ✨ Características y Funcionalidades

- 🎨 **Diseño Moderno & Paleta Orgánica:** Interfaz oscura premium con acentos en tonos ámbar, hueso, musgo y arcilla.
- 🔐 **Autenticación con PapusBank:** Inicio de sesión seguro con Usuario / Nick y contraseña, con soporte de verificación en dos pasos (2FA OTP).
- 💬 **Mensajería en Tiempo Real:** Conversaciones privadas con amigos del banco, guardadas en PostgreSQL.
- 🔊 **Efectos de Sonido Procedurales:** Tono de envío, tono de recepción y timbres sintetizados con Web Audio API.
- 🎙️ **Notas de Voz:** Grabación de notas de voz en directo con forma de onda animada.
- 📞 **Llamadas y Videollamadas:** Simulación de llamadas de voz y videollamadas con acceso a cámara web local.
- 📱 **Diseño 100% Responsivo:** Adaptado para teléfonos móviles, tablets y monitores de escritorio.

---

## 📦 Instalación y Descargas por Plataforma

### 🤖 Android (PWA - Instalación Directa)
No necesitas descargar APK de fuentes desconocidas ni pagar tienda:
1. Abre [https://lospapusxdd.github.io/papuwhats-web/](https://lospapusxdd.github.io/papuwhats-web/) desde **Google Chrome**, **Brave** o **Edge** en tu celular Android.
2. Pulsa en el menú de tres puntos `⋮` arriba a la derecha.
3. Selecciona **"Instalar aplicación"** o **"Añadir a pantalla de inicio"**.
4. ¡Listo! Se instalará como app nativa con icono propio, pantalla completa y acceso a micrófono/cámara.

---

### 🐧 Linux (AppImage & deb)
- **AppImage:** Ejecutable universal que funciona en Ubuntu, Debian, Fedora, Arch, Linux Mint, etc.
  ```bash
  chmod +x PapuWhats-1.0.0.AppImage
  ./PapuWhats-1.0.0.AppImage
  ```
- **Compilación manual:**
  ```bash
  npm install
  npm run electron:build:linux
  ```

---

### 🪟 Windows (Portátil & Instalador)
- **Versión Portable:** Descomprime `PapuWhats-1.0.0-win.zip` y haz doble clic en `PapuWhats.exe`.
- **Compilación con GitHub Actions:** Cada vez que se crea un tag o se ejecuta el workflow de GitHub Actions, se compila automáticamente el instalador `.exe` (NSIS) de 64 bits y se publica en los Releases de GitHub.

---

### 🍎 macOS (DMG & Zip)
- Los paquetes `.dmg` para macOS se generan automáticamente a través del workflow de GitHub Actions (`release-builds.yml`) en runner nativo de Apple macOS.
- **Compilación manual en macOS:**
  ```bash
  npm install
  npm run electron:build:mac
  ```

---

## 🛠️ Tecnologías

- **React 19** + **TypeScript**
- **Vite 8** + **Tailwind CSS v4**
- **Electron** (Empaquetado de escritorio multiplataforma)
- **Zustand** (Gestión de estado)
- **Motion** (Animaciones fluidas)
- **Web Audio API** + **WebRTC** (Llamadas P2P reales)
- **PapusBank API** (`https://papusbank.serveousercontent.com`)

