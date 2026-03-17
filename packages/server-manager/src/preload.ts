import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  startServers: () => ipcRenderer.invoke('start-servers'),
  stopServers: () => ipcRenderer.invoke('stop-servers'),
  restartServer: (server: 'backend' | 'frontend' | 'all') => ipcRenderer.invoke('restart-server', server),
  getStatus: () => ipcRenderer.invoke('get-status'),
  openFrontend: () => ipcRenderer.invoke('open-frontend'),
  onStatusUpdate: (callback: (status: any) => void) => {
    ipcRenderer.on('status-update', (_, status) => callback(status));
  },
});
