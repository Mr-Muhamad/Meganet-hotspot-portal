// @ts-check
'use strict';

const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const { startServer, server, stopPreview } = require('../admin/server.js');

let mainWindow = null;
let serverPort = null;

// Allow single instance only
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
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
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 700,
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
