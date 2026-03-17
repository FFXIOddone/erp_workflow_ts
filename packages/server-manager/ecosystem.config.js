// PM2 Ecosystem Configuration for ERP Workflow
const path = require('path');

// Get the workspace root (erp_workflow_ts folder)
const workspaceRoot = path.resolve(__dirname, '..', '..');

// Shared restart settings:
// - max_restarts: 5 — give up after 5 rapid crashes
// - min_uptime: 10s — must run 10s to count as "stable" (resets crash counter)
// - restart_delay: 3s — wait between restart attempts
// - stop_exit_codes: [0] — don't restart on clean exit
const restartDefaults = {
  watch: false,
  autorestart: true,
  max_restarts: 5,
  min_uptime: '10s',
  restart_delay: 3000,
  stop_exit_codes: [0],
};

module.exports = {
  apps: [
    {
      name: 'erp-backend',
      script: path.join(workspaceRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
      args: 'src/index.ts',
      cwd: path.join(workspaceRoot, 'packages', 'server'),
      interpreter: 'node',
      env: {
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://erp_user:erp_password@localhost:5432/erp_workflow?schema=public',
        JWT_SECRET: 'dev-secret-change-in-production',
        PORT: 8001,
      },
      ...restartDefaults,
    },
    {
      name: 'erp-frontend',
      script: path.join(workspaceRoot, 'node_modules', 'vite', 'bin', 'vite.js'),
      args: '--port 5173 --host 0.0.0.0',
      cwd: path.join(workspaceRoot, 'packages', 'web'),
      interpreter: 'node',
      env: {
        NODE_ENV: 'development',
      },
      ...restartDefaults,
    },
    {
      name: 'erp-portal',
      script: path.join(workspaceRoot, 'node_modules', 'vite', 'bin', 'vite.js'),
      args: '--port 5174 --host 0.0.0.0',
      cwd: path.join(workspaceRoot, 'packages', 'portal'),
      interpreter: 'node',
      env: {
        NODE_ENV: 'development',
      },
      ...restartDefaults,
    },
    {
      name: 'station-printing',
      script: path.join(workspaceRoot, 'node_modules', 'vite', 'bin', 'vite.js'),
      args: '--port 5180 --host 0.0.0.0',
      cwd: path.join(workspaceRoot, 'packages', 'station-printing'),
      interpreter: 'node',
      env: {
        NODE_ENV: 'development',
      },
      ...restartDefaults,
    },
    {
      name: 'station-production',
      script: path.join(workspaceRoot, 'node_modules', 'vite', 'bin', 'vite.js'),
      args: '--port 5181 --host 0.0.0.0',
      cwd: path.join(workspaceRoot, 'packages', 'station-production'),
      interpreter: 'node',
      env: {
        NODE_ENV: 'development',
      },
      ...restartDefaults,
    },
    {
      name: 'station-shipping',
      script: path.join(workspaceRoot, 'node_modules', 'vite', 'bin', 'vite.js'),
      args: '--port 5182 --host 0.0.0.0',
      cwd: path.join(workspaceRoot, 'packages', 'station-shipping'),
      interpreter: 'node',
      env: {
        NODE_ENV: 'development',
      },
      ...restartDefaults,
    },
    {
      name: 'station-design',
      script: path.join(workspaceRoot, 'node_modules', 'vite', 'bin', 'vite.js'),
      args: '--port 5183 --host 0.0.0.0',
      cwd: path.join(workspaceRoot, 'packages', 'station-design'),
      interpreter: 'node',
      env: {
        NODE_ENV: 'development',
      },
      ...restartDefaults,
    },
    {
      name: 'order-entry',
      script: path.join(workspaceRoot, 'node_modules', 'vite', 'bin', 'vite.js'),
      args: '--port 5184 --host 0.0.0.0',
      cwd: path.join(workspaceRoot, 'packages', 'order-entry'),
      interpreter: 'node',
      env: {
        NODE_ENV: 'development',
      },
      ...restartDefaults,
    },
    {
      name: 'slip-sort-backend',
      script: 'python',
      args: '-m uvicorn main:app --host 0.0.0.0 --port 8000 --reload',
      cwd: path.join(workspaceRoot, 'packages', 'slip-sort', 'backend'),
      interpreter: 'none',
      env: {
        PYTHONUNBUFFERED: '1',
      },
      ...restartDefaults,
    },
    {
      name: 'slip-sort-frontend',
      script: path.join(workspaceRoot, 'node_modules', 'vite', 'bin', 'vite.js'),
      args: '--port 5185 --host 0.0.0.0',
      cwd: path.join(workspaceRoot, 'packages', 'slip-sort', 'frontend'),
      interpreter: 'node',
      env: {
        NODE_ENV: 'development',
      },
      ...restartDefaults,
    },
  ],
};
