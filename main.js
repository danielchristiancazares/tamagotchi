/**
 * main.js — Electron Main Process
 *
 * Handles window creation, IPC communication for save/load,
 * application lifecycle events, and security configuration.
 */

const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs').promises;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SAVE_FILE_PATH = path.join(app.getPath('userData'), 'save-game.json');
const WINDOW_WIDTH = 420;
const WINDOW_HEIGHT = 640;

let mainWindow = null;

// ---------------------------------------------------------------------------
// Window Creation
// ---------------------------------------------------------------------------

function createWindow() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');

  mainWindow = new BrowserWindow({
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
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  Menu.setApplicationMenu(null);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// IPC Handlers — Save / Load
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// App Lifecycle
// ---------------------------------------------------------------------------

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

const QUIT_SAVE_TIMEOUT_MS = 3000;
let quitInProgress = false;

app.on('before-quit', (event) => {
  if (quitInProgress) return;
  if (!mainWindow || mainWindow.isDestroyed()) return;

  event.preventDefault();
  quitInProgress = true;

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    app.quit();
  };

  ipcMain.once('quit-save-done', finish);
  mainWindow.webContents.send('before-quit');

  // Safety net: don't block quit forever if the renderer never acks
  setTimeout(() => {
    if (!done) console.warn('[main] Save ack timed out, quitting anyway');
    finish();
  }, QUIT_SAVE_TIMEOUT_MS);
});
