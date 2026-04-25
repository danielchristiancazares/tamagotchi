/**
 * preload.js — Secure Preload Script
 *
 * This script runs in an isolated context with access to both Node/Electron
 * APIs and the renderer DOM. It acts as a tightly-controlled bridge,
 * exposing ONLY the specific methods the renderer needs via contextBridge.
 *
 * Security:
 *   - contextIsolation is true → this context is separate from the renderer
 *   - nodeIntegration is false → renderer has no direct Node access
 *   - Only whitelisted IPC channels are exposed through window.electronAPI
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

  saveGame: (data) => ipcRenderer.invoke('save-game', data),
  loadGame: () => ipcRenderer.invoke('load-game'),

  onBeforeQuit: (callback) => {
    const wrapped = (_event, ...args) => callback(...args);
    ipcRenderer.on('before-quit', wrapped);
    return () => {
      ipcRenderer.removeListener('before-quit', wrapped);
    };
  },

  notifyQuitSaveDone: () => ipcRenderer.send('quit-save-done'),

  setCompanionMode: (enabled) => ipcRenderer.invoke('set-companion-mode', enabled)

});
