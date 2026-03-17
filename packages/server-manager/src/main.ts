import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron';
import * as path from 'path';
import { exec } from 'child_process';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// Server status tracking
interface ServerStatus {
  backend: 'stopped' | 'starting' | 'running' | 'error';
  frontend: 'stopped' | 'starting' | 'running' | 'error';
}

let serverStatus: ServerStatus = {
  backend: 'stopped',
  frontend: 'stopped',
};

// Fixed workspace path - always point to the development location
const WORKSPACE_ROOT = 'C:\\Users\\Jake\\OneDrive - Wilde Signs\\Desktop\\Scripts\\erp_workflow_ts';

function getEcosystemConfig(): string {
  const wsRoot = WORKSPACE_ROOT.replace(/\\/g, '\\\\');
  return `module.exports = {
  apps: [
    {
      name: 'erp-backend',
      script: '${wsRoot}\\\\node_modules\\\\tsx\\\\dist\\\\cli.mjs',
      args: 'src/index.ts',
      cwd: '${wsRoot}\\\\packages\\\\server',
      interpreter: 'node',
      env: {
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://erp_user:erp_password@localhost:5432/erp_workflow?schema=public',
        JWT_SECRET: 'dev-secret-change-in-production',
        PORT: 8001,
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 1000,
    },
    {
      name: 'erp-frontend',
      script: '${wsRoot}\\\\node_modules\\\\vite\\\\bin\\\\vite.js',
      args: '--port 5173 --host 0.0.0.0',
      cwd: '${wsRoot}\\\\packages\\\\web',
      interpreter: 'node',
      env: {
        NODE_ENV: 'development',
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 1000,
    },
  ],
};`;
}

function getEcosystemPath(): string {
  const configDir = app.getPath('userData');
  const ecosystemPath = path.join(configDir, 'ecosystem.config.js');
  
  // Always write fresh config
  fs.writeFileSync(ecosystemPath, getEcosystemConfig());
  
  return ecosystemPath;
}

function runPM2Command(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    // Quote arguments with spaces
    const quotedArgs = args.map(a => a.includes(' ') ? `"${a}"` : a).join(' ');
    const command = `pm2 ${quotedArgs}`;
    
    console.log('Running PM2 command:', command);
    
    exec(command, {
      cwd: WORKSPACE_ROOT,
      env: { ...process.env },
      shell: 'cmd.exe',
      windowsHide: true,
    }, (error, stdout, stderr) => {
      if (error) {
        console.error('PM2 Error:', stderr || error.message);
        reject(new Error(stderr || error.message));
      } else {
        console.log('PM2 Output:', stdout);
        resolve(stdout);
      }
    });
  });
}

async function startServers(): Promise<void> {
  try {
    console.log('Starting servers with PM2...');
    serverStatus.backend = 'starting';
    serverStatus.frontend = 'starting';
    sendStatusUpdate();

    const ecosystemPath = getEcosystemPath();
    await runPM2Command(['start', ecosystemPath]);
    
    // Wait a moment for PM2 to actually start the processes
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check actual status
    await getServerStatus();
    
    console.log('Servers started successfully');
  } catch (error) {
    console.error('Failed to start servers:', error);
    serverStatus.backend = 'error';
    serverStatus.frontend = 'error';
    sendStatusUpdate();
  }
}

async function stopServers(): Promise<void> {
  try {
    console.log('Stopping all servers...');
    sendStatusUpdate();
    
    await runPM2Command(['delete', 'all']);
    
    serverStatus.backend = 'stopped';
    serverStatus.frontend = 'stopped';
    sendStatusUpdate();
    console.log('Servers stopped');
  } catch (error) {
    console.error('Failed to stop servers:', error);
    // Even on error, mark as stopped since delete all usually works
    serverStatus.backend = 'stopped';
    serverStatus.frontend = 'stopped';
    sendStatusUpdate();
  }
}

async function restartServer(server: 'backend' | 'frontend' | 'all'): Promise<void> {
  try {
    if (server === 'all') {
      serverStatus.backend = 'starting';
      serverStatus.frontend = 'starting';
      sendStatusUpdate();
      
      // First check if processes exist, if not start them
      try {
        await runPM2Command(['restart', 'all']);
      } catch {
        // Processes might not exist, try starting instead
        await startServers();
        return;
      }
    } else if (server === 'backend') {
      serverStatus.backend = 'starting';
      sendStatusUpdate();
      try {
        await runPM2Command(['restart', 'erp-backend']);
      } catch {
        await startServers();
        return;
      }
    } else {
      serverStatus.frontend = 'starting';
      sendStatusUpdate();
      try {
        await runPM2Command(['restart', 'erp-frontend']);
      } catch {
        await startServers();
        return;
      }
    }
    
    // Wait for restart
    await new Promise(resolve => setTimeout(resolve, 2000));
    await getServerStatus();
    
    console.log(`${server} server(s) restarted`);
  } catch (error) {
    console.error(`Failed to restart ${server}:`, error);
    await getServerStatus();
  }
}

async function getServerStatus(): Promise<void> {
  try {
    const output = await runPM2Command(['jlist']);
    const processes = JSON.parse(output);

    const backend = processes.find((p: any) => p.name === 'erp-backend');
    const frontend = processes.find((p: any) => p.name === 'erp-frontend');

    serverStatus.backend = backend?.pm2_env?.status === 'online' ? 'running' : 'stopped';
    serverStatus.frontend = frontend?.pm2_env?.status === 'online' ? 'running' : 'stopped';
  } catch (error) {
    // PM2 might not have any processes or daemon not running
    serverStatus.backend = 'stopped';
    serverStatus.frontend = 'stopped';
  }
  sendStatusUpdate();
}

function sendStatusUpdate(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('status-update', serverStatus);
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 450,
    height: 400,
    resizable: false,
    maximizable: false,
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // In packaged app with asar, __dirname is inside the asar archive
  const htmlPath = path.join(__dirname, '..', 'src', 'index.html');
  mainWindow.loadFile(htmlPath);
  mainWindow.setMenuBarVisibility(false);

  mainWindow.on('close', (event) => {
    // Minimize to tray instead of closing
    event.preventDefault();
    mainWindow?.hide();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray(): void {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  let trayIcon: Electron.NativeImage;

  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      trayIcon = nativeImage.createEmpty();
    }
  } catch {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon.isEmpty() ? nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAADKSURBVDiNpZMxDoJAEEXfLhQewNITeAMTe2NhZ2lhYmmhBy7gLTiAx7CwsNdDUHAL1kQ2y7JBfiaTyWT+n/mzAzAHLkAFHIENsEmzJ7AGHsBLcy5dJnJ4j8ABeBqhNHdyI3dykUNdzDMBSCJwBG49AZQEM+Deh7+BWTQO7lMIIWB7BrahtgGWQFlScoZ3Q0bJwB7Y5UqZsgjYhhDuQK3JVT0VlMClazwtI7B+L0BLUNcfWMVT4Ak8GwLeKf+8QnPxXkCK1vL/v+ALzcdgZUwDfR0AAAAASUVORK5CYII=') : trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Manager',
      click: () => {
        mainWindow?.show();
      },
    },
    { type: 'separator' },
    {
      label: 'Start Servers',
      click: () => startServers(),
    },
    {
      label: 'Restart All',
      click: () => restartServer('all'),
    },
    {
      label: 'Stop Servers',
      click: () => stopServers(),
    },
    { type: 'separator' },
    {
      label: 'Open Frontend',
      click: () => {
        require('electron').shell.openExternal('http://localhost:5173');
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Manager (Servers Keep Running)',
      click: () => {
        mainWindow?.destroy();
        app.quit();
      },
    },
  ]);

  tray.setToolTip('ERP Server Manager');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow?.show();
  });
}

// IPC Handlers
ipcMain.handle('start-servers', async () => {
  await startServers();
  return serverStatus;
});

ipcMain.handle('stop-servers', async () => {
  await stopServers();
  return serverStatus;
});

ipcMain.handle('restart-server', async (_, server: 'backend' | 'frontend' | 'all') => {
  await restartServer(server);
  return serverStatus;
});

ipcMain.handle('get-status', async () => {
  await getServerStatus();
  return serverStatus;
});

ipcMain.handle('open-frontend', () => {
  require('electron').shell.openExternal('http://localhost:5173');
});

// App lifecycle
app.whenReady().then(async () => {
  createWindow();
  createTray();

  // Check current status and start if not running
  await getServerStatus();
  if (serverStatus.backend === 'stopped' && serverStatus.frontend === 'stopped') {
    await startServers();
  }

  // Periodic status check
  setInterval(() => getServerStatus(), 5000);
});

app.on('window-all-closed', () => {
  // Don't quit - keep running in tray
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
