// PM2 Production Ecosystem Configuration for ERP Workflow
// Single process: Express API + all static frontends
// ~200MB RAM vs ~2GB+ in dev mode (10 separate vite servers)
const path = require('path');

const workspaceRoot = path.resolve(__dirname, '..', '..');

// Path to Python interpreter in the workspace venv
const pythonExe = path.join(workspaceRoot, '.venv', 'Scripts', 'python.exe');

module.exports = {
  apps: [
    {
      name: 'erp-production',
      script: path.join(workspaceRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
      args: 'src/index.ts',
      cwd: path.join(workspaceRoot, 'packages', 'server'),
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://erp_user:erp_password@localhost:5432/erp_workflow?schema=public',
        JWT_SECRET: 'wilde-signs-erp-production-secret-2025',
        PORT: 8001,
        HOST: '0.0.0.0',
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
      stop_exit_codes: [0],
      // Log settings
      error_file: path.join(workspaceRoot, 'logs', 'erp-error.log'),
      out_file: path.join(workspaceRoot, 'logs', 'erp-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
    {
      name: 'slip-sort',
      script: '-m',
      args: 'uvicorn main:app --host 0.0.0.0 --port 8000',
      cwd: path.join(workspaceRoot, 'packages', 'slip-sort', 'backend'),
      interpreter: pythonExe,
      env: {
        NODE_ENV: 'production',
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
      stop_exit_codes: [0],
      // Log settings
      error_file: path.join(workspaceRoot, 'logs', 'slip-sort-error.log'),
      out_file: path.join(workspaceRoot, 'logs', 'slip-sort-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
