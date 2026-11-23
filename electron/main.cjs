const { app, BrowserWindow, session, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;
let isQuitting = false;

// Configurar App ID para notificaciones nativas en Windows
if (process.platform === 'win32') {
  app.setAppUserModelId(process.execPath || 'com.papusbank.papuwhats');
}

// Mantener ejecución activa y fluida en segundo plano
app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

function createWindow() {
  const iconPath = path.join(__dirname, '../build/icon.png');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 400,
    minHeight: 600,
    title: 'PapuWhats',
    backgroundColor: '#0c0b09',
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false, // CRÍTICO: No pausar timers ni llamadas en segundo plano
    },
    autoHideMenuBar: true,
  });

  // Al cerrar la ventana, ocultar a la bandeja del sistema (segundo plano) en vez de terminar la app
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      if (tray && process.platform === 'win32') {
        tray.displayBalloon({
          title: 'PapuWhats',
          content: 'PapuWhats sigue activo en segundo plano para recibir llamadas y mensajes.',
        });
      }
      return false;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Conceder permisos automáticamente de notificaciones, micrófono y cámara
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = ['media', 'notifications', 'microphone', 'camera'];
    if (allowed.includes(permission)) {
      return callback(true);
    }
    callback(false);
  });

  session.defaultSession.setPermissionCheckHandler(() => true);
  session.defaultSession.setDevicePermissionHandler(() => true);

  // Cargar URL en vivo (se actualiza solo) con fallback offline
  const REMOTE_URL = 'https://lospapusxdd.github.io/papuwhats-web/';
  const LOCAL_PATH = path.join(__dirname, '../dist/index.html');

  mainWindow.loadURL(REMOTE_URL).catch(() => {
    console.log('[PapuWhats] Sin conexión remota, cargando bundle local offline...');
    mainWindow.loadFile(LOCAL_PATH);
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r')) {
      mainWindow.reload();
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '../build/icon.png');
  tray = new Tray(iconPath);
  tray.setToolTip('PapuWhats (Activo en segundo plano)');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir PapuWhats',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Salir completamente',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

// Single Instance Lock: evitar abrir múltiples instancias
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    try {
      createTray();
    } catch (e) {
      console.warn('[Tray notice]:', e);
    }

    app.on('activate', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      } else {
        createWindow();
      }
    });
  });
}

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  // Mantener la app en segundo plano en la bandeja
});
