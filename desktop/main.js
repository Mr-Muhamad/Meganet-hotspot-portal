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
      // Start local backend on an ephemeral free loopback port (or fallback to 8899)
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

function createWindow() {
  const windowIcon = path.join(__dirname, '..', 'build', 'icon.png');
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

  // Open external links (like support links, preview in browser, etc.) in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Clean up when all windows are closed
app.on('window-all-closed', () => {
  try {
    stopPreview();
  } catch { /* empty */ }

  if (server && server.listening) {
    server.close();
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});
