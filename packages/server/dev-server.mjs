/**
 * Dev server wrapper with manual restart support.
 * 
 * Spawns `tsx watch src/index.ts` as a child process and listens for
 * keyboard shortcuts in the terminal:
 *   Ctrl+R  — Kill and restart the server
 *   Ctrl+C  — Shut down gracefully
 *   rs<Enter> — Restart (nodemon-style)
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// tsx lives in the workspace root node_modules/.bin (npm workspace hoisting)
const workspaceRoot = path.resolve(__dirname, '..', '..');
const tsxCmd = process.platform === 'win32' ? 'tsx.cmd' : 'tsx';
const tsxPath = path.join(workspaceRoot, 'node_modules', '.bin', tsxCmd);

let child = null;
let restarting = false;
let inputBuffer = '';

function startServer() {
  // Build the full command as a single string so shell handles quoting properly
  const cmd = `"${tsxPath}" watch src/index.ts`;
  child = spawn(cmd, {
    cwd: __dirname,
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, FORCE_COLOR: '1', UV_THREADPOOL_SIZE: '16' },
    shell: true,
  });

  child.on('exit', (code, signal) => {
    if (restarting) return; // we triggered this, restart() handles respawn
    if (signal === 'SIGTERM' || signal === 'SIGINT') process.exit(0);
    if (code !== null && code !== 0) {
      console.log(`\n[dev] Server exited with code ${code}. Waiting for restart (Ctrl+R)...`);
    }
  });
}

function restart() {
  restarting = true;
  console.log('\n\x1b[36m[dev] Restarting server...\x1b[0m\n');
  if (child) {
    child.on('exit', () => {
      restarting = false;
      startServer();
    });
    if (process.platform === 'win32') {
      // On Windows, tsx runs via shell — need to kill the process tree
      spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'], { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  } else {
    restarting = false;
    startServer();
  }
}

function shutdown() {
  console.log('\n\x1b[33m[dev] Shutting down...\x1b[0m');
  if (child) {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'], { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  }
  setTimeout(() => process.exit(0), 1000);
}

// Banner
console.log('\x1b[36m[dev] Starting server with tsx watch...\x1b[0m');
console.log('\x1b[36m[dev] Press Ctrl+R to restart, Ctrl+C to quit\x1b[0m\n');

startServer();

// Listen for keyboard input
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  process.stdin.on('data', (key) => {
    // Ctrl+C
    if (key === '\x03') {
      shutdown();
      return;
    }
    // Ctrl+R
    if (key === '\x12') {
      restart();
      return;
    }
    // Support typing 'rs' + Enter (nodemon-style)
    if (key === '\r' || key === '\n') {
      if (inputBuffer.trim() === 'rs') {
        restart();
      }
      inputBuffer = '';
      return;
    }
    inputBuffer += key;
    // Keep buffer short
    if (inputBuffer.length > 10) inputBuffer = inputBuffer.slice(-5);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
