import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(packageRoot, '..', '..');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const REQUIRED_NODE_VERSION = 'v24.14.0';

function run(command, args, options = {}) {
  const { cwd = workspaceRoot, capture = false } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    if (capture) {
      child.stdout?.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
        return;
      }

      const error = new Error(stderr.trim() || stdout.trim() || `${command} exited with code ${code}`);
      error.stdout = stdout;
      error.stderr = stderr;
      error.exitCode = code;
      reject(error);
    });
  });
}

async function probeBetterSqlite3() {
  return run(
    process.execPath,
    [
      '-e',
      "require('better-sqlite3'); console.log(`better-sqlite3 OK for ${process.version} ABI ${process.versions.modules}`)",
    ],
    { capture: true }
  );
}

function ensureSupportedNodeVersion() {
  if (process.version !== REQUIRED_NODE_VERSION) {
    throw new Error(
      `This repo is pinned to Node ${REQUIRED_NODE_VERSION.slice(1)}. Found ${process.version}. Please switch Node before running this command.`
    );
  }
}

export async function ensureBetterSqlite3Compatible() {
  ensureSupportedNodeVersion();

  try {
    const result = await probeBetterSqlite3();
    const message = result.stdout.trim();
    if (message) {
      console.log(`[dev] ${message}`);
    }
    return;
  } catch (error) {
    const firstFailure = error instanceof Error ? error.message : String(error);
    console.log('[dev] better-sqlite3 needs a rebuild for this Node runtime. Rebuilding now...');
    if (firstFailure) {
      console.log(`[dev] First probe failed: ${firstFailure}`);
    }
  }

  await run(npmCmd, ['rebuild', 'better-sqlite3']);

  const rebuilt = await probeBetterSqlite3().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `better-sqlite3 is still incompatible after rebuild for Node ${process.version} ABI ${process.versions.modules}: ${message}`
    );
  });

  const rebuiltMessage = rebuilt.stdout.trim();
  if (rebuiltMessage) {
    console.log(`[dev] ${rebuiltMessage}`);
  }
}

const invokedDirectly =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (invokedDirectly) {
  ensureBetterSqlite3Compatible().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[dev] ${message}`);
    process.exit(1);
  });
}
