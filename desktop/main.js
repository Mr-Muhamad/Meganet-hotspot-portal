// @ts-check
'use strict';

// Ensure the process runs as a full GUI Electron application even if
// ELECTRON_RUN_AS_NODE is inherited from the parent environment / IDE.
delete process.env.ELECTRON_RUN_AS_NODE;

const { app, BrowserWindow, shell, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

// When packaged (NSIS under Program Files or Portable), keep user profiles,
// custom presets, and isolated staging builds inside writable userData.
if (app.isPackaged) {
  if (!process.env.ADMIN_DATA_DIR) {
    process.env.ADMIN_DATA_DIR = path.join(app.getPath('userData'), 'admin-data');
  }
  if (!process.env.BUILD_WORK_DIR) {
    process.env.BUILD_WORK_DIR = path.join(app.getPath('userData'), 'workspace-work');
  }
}

// Allow single instance only — exit immediately before spawning server/GPU cache
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.exit(0);
}

const { startServer, server, stopPreview } = require('../admin/server.js');

let mainWindow = null;
let serverPort = null;

if (gotTheLock) {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      // Start local backend on an ephemeral free loopback port (0 when ADMIN_PORT is unset)
      serverPort = await startServer(Number(process.env.ADMIN_PORT) || 0);

      createWindow();

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
      });
    } catch (err) {
      dialog.showErrorBox('Initialization Error', 'Failed to start local admin server: ' + err.message);
      app.quit();
    }
  });
}

function isAllowedAppUrl(rawUrl, activePort) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:') return false;
    if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') return false;
    const port = parsed.port ? Number(parsed.port) : 80;
    return Boolean(activePort) && port === Number(activePort);
  } catch {
    return false;
  }
}

function isAllowedExternalUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:' ||
      parsed.protocol === 'http:' ||
      parsed.protocol === 'mailto:' ||
      parsed.protocol === 'tel:';
  } catch {
    return false;
  }
}

function createWindow() {
  const windowIcon = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, '..', 'build', 'icon.png');
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 700,
    icon: fs.existsSync(windowIcon) ? windowIcon : undefined,
    title: 'Meganet Hotspot Studio - مولد قوالب ميكروتك',
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  mainWindow.loadURL(`http://127.0.0.1:${serverPort}/index.html`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Restrict main window navigation strictly to the local Studio server
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isAllowedAppUrl(url, serverPort)) return;
    event.preventDefault();
    if (isAllowedExternalUrl(url)) {
      shell.openExternal(url);
    }
  });

  // Open safe external links (like support links, preview in browser, etc.) in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedAppUrl(url, serverPort)) {
      return { action: 'allow' };
    }
    if (isAllowedExternalUrl(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-create-window', (childWin) => {
    childWin.webContents.on('will-navigate', (event, url) => {
      if (isAllowedAppUrl(url, serverPort)) return;
      event.preventDefault();
      if (isAllowedExternalUrl(url)) shell.openExternal(url);
    });
    childWin.webContents.setWindowOpenHandler(({ url }) => {
      if (isAllowedAppUrl(url, serverPort)) return { action: 'allow' };
      if (isAllowedExternalUrl(url)) shell.openExternal(url);
      return { action: 'deny' };
    });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Electron suppresses beforeunload dialogs unless handled via will-prevent-unload.
  mainWindow.webContents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'question',
      buttons: ['تجاهل التعديلات وإغلاق', 'البقاء في التطبيق'],
      defaultId: 1,
      cancelId: 1,
      title: 'تعديلات غير محفوظة',
      message: 'لديك تعديلات غير محفوظة في الاستوديو.',
      detail: 'هل تريد إغلاق التطبيق وتجاهل هذه التعديلات؟'
    });
    if (choice === 0) {
      event.preventDefault();
    }
  });
}

function cleanupServerAndPreview() {
  try {
    stopPreview();
  } catch { /* empty */ }

  if (server && server.listening) {
    server.close();
  }
}

app.on('before-quit', () => {
  cleanupServerAndPreview();
});

// Clean up when all windows are closed (keep server alive on macOS until before-quit)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    cleanupServerAndPreview();
    app.quit();
  }
});

module.exports = { isAllowedAppUrl, isAllowedExternalUrl, cleanupServerAndPreview };
