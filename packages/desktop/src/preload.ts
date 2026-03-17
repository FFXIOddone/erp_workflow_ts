// Preload script for Electron
// This runs in a context with access to both Node.js and the browser

import { contextBridge, ipcRenderer } from 'electron';

// Expose safe APIs to the renderer process
contextBridge.exposeInMainWorld('electron', {
  // App info
  platform: process.platform,
  
  // IPC communication (if needed later)
  send: (channel: string, data: unknown) => {
    const validChannels = ['print-order', 'export-pdf'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  
  receive: (channel: string, callback: (...args: unknown[]) => void) => {
    const validChannels = ['print-complete', 'export-complete'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },
});

// Type declaration for the exposed API
declare global {
  interface Window {
    electron: {
      platform: string;
      send: (channel: string, data: unknown) => void;
      receive: (channel: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}
