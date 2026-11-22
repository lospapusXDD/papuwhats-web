const { app, BrowserWindow, session, ipcMain } = require('electron');
const path = require('path');

let mainWindow = null;

// Habilitar características de audio, WebRTC y reproducción fluida
app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 400,
    minHeight: 600,
    title: 'PapuWhats',
    backgroundColor: '#0c0b09',
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    autoHideMenuBar: true,
  });

  // Conceder automáticamente permisos de micrófono, cámara, audio y notificaciones
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = ['media', 'notifications', 'microphone', 'camera'];
    if (allowed.includes(permission)) {
      return callback(true);
    }
    callback(false);
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    const allowed = ['media', 'notifications', 'microphone', 'camera'];
    return allowed.includes(permission);
  });

  session.defaultSession.setDevicePermissionHandler(() => true);

  // AUTO-ACTUALIZADOR INSTANTÁNEO:
  // Carga la versión en vivo de GitHub Pages (se actualiza automáticamente en cada push).
  // Si el usuario no tiene internet, recurre a los archivos locales empaquetados.
  const REMOTE_URL = 'https://lospapusxdd.github.io/papuwhats-web/';
  const LOCAL_PATH = path.join(__dirname, '../dist/index.html');

  mainWindow.loadURL(REMOTE_URL).catch(() => {
    console.log('[PapuWhats] Sin conexión remota, cargando bundle local offline...');
    mainWindow.loadFile(LOCAL_PATH);
  });

  // Atajos para recargar rápido: F5 o Ctrl+R
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r')) {
      mainWindow.reload();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
