/**
 * main.js — Electron Main Process
 *
 * Handles window creation, IPC communication for save/load,
 * application lifecycle events, and security configuration.
 */

const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, screen } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { pathToFileURL } = require('url');

const SAVE_FILE_PATH = path.join(app.getPath('userData'), 'save-game.json');
const WINDOW_WIDTH = 420;
const WINDOW_HEIGHT = 640;
const COMPANION_SIZE = 176;
const COMPANION_MARGIN = 16;

let mainWindow = null;
let isCompanionMode = false;
let tray = null;
let lastNormalBounds = null;

function createWindow(companionMode = false) {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');

  const windowOptions = companionMode ? {
    width: COMPANION_SIZE,
    height: COMPANION_SIZE,
    resizable: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    title: 'Tamagotchi',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      allowRunningInsecureContent: false,
      experimentalFeatures: false
    }
  } : {
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    resizable: false,
    title: 'Tamagotchi',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      allowRunningInsecureContent: false,
      experimentalFeatures: false
    }
  };

  const win = new BrowserWindow(windowOptions);
  mainWindow = win;

  const indexPath = path.join(__dirname, 'renderer', 'index.html');

  if (companionMode) {
    const fileUrl = pathToFileURL(indexPath).toString() + '?mode=companion';
    win.loadURL(fileUrl);
  } else {
    win.loadFile(indexPath);
  }

  Menu.setApplicationMenu(null);

  // Only clear mainWindow if THIS window is still the current one when closed.
  // Prevents a stale 'closed' event from a swapped-out window nulling the new reference.
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
}

function createTray() {
  // Prefer .ico on Windows for crisp tray rendering
  const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  const iconPath = path.join(__dirname, 'assets', iconFile);
  try {
    let icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      console.warn(`[main] Tray icon empty at ${iconPath}, skipping tray`);
      return;
    }
    if (process.platform !== 'win32') {
      icon = icon.resize({ width: 16, height: 16 });
    }
    tray = new Tray(icon);
    tray.setToolTip('Tamagotchi');
    tray.on('click', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
    updateTrayMenu();
  } catch (err) {
    console.warn('[main] Failed to create tray:', err.message);
  }
}

function updateTrayMenu() {
  if (!tray) return;
  const contextMenu = Menu.buildFromTemplate([
    {
      label: isCompanionMode ? 'Full Window' : 'Companion Mode',
      click: () => toggleCompanionMode()
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
  tray.setContextMenu(contextMenu);
}

function toggleCompanionMode() {
  switchMode(!isCompanionMode);
}

let switchInProgress = false;

function getCompanionPosition() {
  // Top-right corner of the primary display's work area (excludes taskbar)
  const display = screen.getPrimaryDisplay();
  const { x, y, width } = display.workArea;
  return {
    x: x + width - COMPANION_SIZE - COMPANION_MARGIN,
    y: y + COMPANION_MARGIN
  };
}

function switchMode(toCompanion) {
  if (toCompanion === isCompanionMode) return;
  if (switchInProgress) return;
  switchInProgress = true;
  isCompanionMode = toCompanion;

  console.log(`[main] Switching to ${toCompanion ? 'companion' : 'normal'} mode`);

  // Capture old window's bounds and reference, but DON'T destroy yet.
  // We must create the new window first, otherwise BrowserWindow count
  // briefly hits zero and `window-all-closed` quits the app.
  let oldWindow = null;
  if (mainWindow && !mainWindow.isDestroyed()) {
    oldWindow = mainWindow;
    if (toCompanion) {
      try { lastNormalBounds = mainWindow.getBounds(); } catch (_) { /* ignore */ }
    }
  }

  clearQuitHandlers();
  quitInProgress = false;

  createWindow(toCompanion);

  if (mainWindow) {
    try {
      if (toCompanion) {
        const pos = getCompanionPosition();
        mainWindow.setPosition(pos.x, pos.y);
      } else if (lastNormalBounds) {
        mainWindow.setPosition(lastNormalBounds.x, lastNormalBounds.y);
      }
    } catch (_) { /* ignore */ }
  }

  if (oldWindow && !oldWindow.isDestroyed()) {
    try {
      oldWindow.destroy();
    } catch (_) { /* ignore */ }
  }

  updateTrayMenu();
  // Release the guard on next tick so any in-flight close events settle first
  setImmediate(() => { switchInProgress = false; });
}

ipcMain.handle('save-game', async (_event, data) => {
  try {
    const json = JSON.stringify(data, null, 2);
    await fs.writeFile(SAVE_FILE_PATH, json, 'utf-8');
    console.log(`[main] Game saved to ${SAVE_FILE_PATH}`);
    return { success: true };
  } catch (err) {
    console.error('[main] Save failed:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('set-companion-mode', async (_event, enabled) => {
  // Reply BEFORE swapping the window. Otherwise we destroy the renderer
  // that's awaiting this IPC response and the promise never resolves.
  setImmediate(() => switchMode(!!enabled));
  return { success: true };
});

ipcMain.handle('load-game', async () => {
  let raw;
  try {
    raw = await fs.readFile(SAVE_FILE_PATH, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log('[main] No save file found (first launch)');
      return null;
    }
    console.error('[main] Load read error:', err.message);
    return null;
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error('[main] Save file is corrupted JSON:', err.message);
    // Back up the corrupted file so it can be inspected
    const backupPath = SAVE_FILE_PATH + '.corrupted.' + Date.now();
    try {
      await fs.writeFile(backupPath, raw);
      console.log(`[main] Corrupted save backed up to ${backupPath}`);
    } catch (backupErr) {
      console.error('[main] Failed to back up corrupted save:', backupErr.message);
    }
    return null;
  }

  // Validate minimum structure
  if (!data || typeof data !== 'object' || !data.pet || typeof data.pet !== 'object') {
    console.warn('[main] Save file missing pet data');
    return null;
  }

  // Validate pet has required fields
  const required = ['name', 'stage', 'stats', 'bornAt'];
  const pet = data.pet;
  const missing = required.filter(k => pet[k] === undefined);
  if (missing.length > 0) {
    console.warn('[main] Save pet missing fields:', missing.join(', '));
    return null;
  }

  console.log(`[main] Valid save loaded from ${SAVE_FILE_PATH}`);
  return data;
});

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(isCompanionMode);
    }
  });
});

app.on('window-all-closed', () => {
  if (switchInProgress) return; // mid-swap, new window is being created
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

const QUIT_SAVE_TIMEOUT_MS = 3000;
let quitInProgress = false;
let _quitSaveDoneHandler = null;
let _quitSaveTimeout = null;

function clearQuitHandlers() {
  if (_quitSaveDoneHandler) {
    ipcMain.removeListener('quit-save-done', _quitSaveDoneHandler);
    _quitSaveDoneHandler = null;
  }
  if (_quitSaveTimeout) {
    clearTimeout(_quitSaveTimeout);
    _quitSaveTimeout = null;
  }
}

app.on('before-quit', (event) => {
  if (quitInProgress) return;
  if (switchInProgress) return; // mode swap is destroying the window, not a real quit
  if (!mainWindow || mainWindow.isDestroyed()) return;

  event.preventDefault();
  quitInProgress = true;

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearQuitHandlers();
    app.quit();
  };

  _quitSaveDoneHandler = finish;
  ipcMain.once('quit-save-done', _quitSaveDoneHandler);
  mainWindow.webContents.send('before-quit');

  // Safety net: don't block quit forever if the renderer never acks
  _quitSaveTimeout = setTimeout(() => {
    if (!done) console.warn('[main] Save ack timed out, quitting anyway');
    finish();
  }, QUIT_SAVE_TIMEOUT_MS);
});
