<#
.SYNOPSIS
    Build all ERP packages for production and deploy to WS-RACHEL.
    
.DESCRIPTION
    1. Builds shared package
    2. Builds all frontend apps (web, portal, stations)
    3. Copies compiled output + server code to WS-RACHEL
    4. Starts the single Express server that serves everything
    
    In production mode, only ONE Node.js process runs (the Express server)
    which serves the API AND all frontend apps as static files.
    This uses ~200MB RAM instead of ~2GB+ with all Vite dev servers.

.PARAMETER BuildOnly
    Only build, don't deploy to server

.PARAMETER DeployOnly
    Skip build, just deploy existing dist/ folders to server

.PARAMETER Local
    Build and run locally in production mode (for testing)

.EXAMPLE
    .\build-and-deploy.ps1            # Full build + deploy to WS-RACHEL
    .\build-and-deploy.ps1 -Local     # Build + run locally in prod mode
    .\build-and-deploy.ps1 -DeployOnly # Push existing builds to server
#>

param(
    [switch]$BuildOnly,
    [switch]$DeployOnly,
    [switch]$Local
)

$ErrorActionPreference = 'Stop'
$ROOT = $PSScriptRoot | Split-Path | Split-Path  # erp_workflow_ts root
$SERVER_IP = "192.168.254.32"
$ERP_SHARE = "\\$SERVER_IP\ERP\erp_workflow_ts"

function Write-Step($n, $total, $msg) { Write-Host "`n━━━ [$n/$total] $msg ━━━" -ForegroundColor Cyan }
function Write-Done($msg) { Write-Host "  ✓ $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "  ✗ $msg" -ForegroundColor Red }

$totalSteps = if ($BuildOnly) { 3 } elseif ($DeployOnly) { 3 } else { 6 }

Write-Host @"

╔══════════════════════════════════════════════════════════════╗
║        ERP Production Build & Deploy                         ║
╚══════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Magenta

Set-Location $ROOT

# ═══════════════════════════════════════════════════════════════════════════════
# BUILD PHASE
# ═══════════════════════════════════════════════════════════════════════════════

if (-not $DeployOnly) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    
    # Step 1: Build shared package (must be first - other packages depend on it)
    Write-Step 1 $totalSteps "Building @erp/shared"
    Set-Location "$ROOT\packages\shared"
    pnpm build 2>&1 | Select-Object -Last 3
    Write-Done "Shared package built"
    
    # Step 2: Build all frontend apps in parallel
    Write-Step 2 $totalSteps "Building all frontend apps"
    
    $apps = @(
        @{ Name = "web"; Label = "Web App" },
        @{ Name = "portal"; Label = "Portal" },
        @{ Name = "station-printing"; Label = "Station: Printing" },
        @{ Name = "station-production"; Label = "Station: Production" },
        @{ Name = "station-shipping"; Label = "Station: Shipping" },
        @{ Name = "station-design"; Label = "Station: Design" },
        @{ Name = "order-entry"; Label = "Order Entry" }
    )
    
    # Set API URL for production builds
    $env:VITE_API_URL = if ($Local) { "http://localhost:8001" } else { "http://192.168.254.32:8001" }
    $env:VITE_WS_URL = if ($Local) { "ws://localhost:8001" } else { "ws://192.168.254.32:8001" }
    
    $failed = @()
    foreach ($app in $apps) {
        $appDir = "$ROOT\packages\$($app.Name)"
        if (Test-Path "$appDir\package.json") {
            Write-Host "  Building $($app.Label)..." -ForegroundColor Gray -NoNewline
            Set-Location $appDir
            try {
                pnpm build 2>&1 | Out-Null
                if (Test-Path "$appDir\dist\index.html") {
                    Write-Host " ✓" -ForegroundColor Green
                } else {
                    Write-Host " ✗ (no dist/index.html)" -ForegroundColor Red
                    $failed += $app.Label
                }
            } catch {
                Write-Host " ✗ ($($_.Exception.Message))" -ForegroundColor Red
                $failed += $app.Label
            }
        }
    }
    
    if ($failed.Count -eq 0) {
        Write-Done "All apps built successfully"
    } else {
        Write-Fail "Failed: $($failed -join ', ')"
    }
    
    # Step 3: Generate Prisma client
    Write-Step 3 $totalSteps "Generating Prisma client"
    Set-Location "$ROOT\packages\server"
    npx prisma generate 2>&1 | Out-Null
    Write-Done "Prisma client generated"
    
    $sw.Stop()
    Write-Host "`n  Build completed in $([math]::Round($sw.Elapsed.TotalSeconds, 1))s" -ForegroundColor DarkGray
}

if ($BuildOnly) {
    Write-Host "`n  Build complete! Run with -Local to test, or without flags to deploy." -ForegroundColor Green
    exit 0
}

# ═══════════════════════════════════════════════════════════════════════════════
# LOCAL TEST MODE
# ═══════════════════════════════════════════════════════════════════════════════

if ($Local) {
    Write-Step $totalSteps $totalSteps "Starting production server locally"
    Set-Location "$ROOT\packages\server"
    
    $env:NODE_ENV = "production"
    $env:SERVER_PORT = "8001"
    $env:SERVER_HOST = "0.0.0.0"
    
    Write-Host @"

  Starting ERP in production mode...
  
  Web App:   http://localhost:8001
  Portal:    http://localhost:8001/portal
  API:       http://localhost:8001/api/v1
  
  Press Ctrl+C to stop.

"@ -ForegroundColor Green
    
    npx tsx src/index.ts
    exit 0
}

# ═══════════════════════════════════════════════════════════════════════════════
# DEPLOY TO WS-RACHEL
# ═══════════════════════════════════════════════════════════════════════════════

$deployStep = if ($DeployOnly) { 1 } else { 4 }

Write-Step $deployStep $totalSteps "Syncing files to WS-RACHEL"

# Test share access
if (-not (Test-Path $ERP_SHARE -ErrorAction SilentlyContinue)) {
    # Try creating the share path
    if (-not (Test-Path "\\$SERVER_IP\ERP" -ErrorAction SilentlyContinue)) {
        Write-Fail "Cannot access \\$SERVER_IP\ERP share"
        Write-Host "  Run setup-server.ps1 on WS-RACHEL first to create the share." -ForegroundColor Yellow
        Write-Host "  Or manually create C:\ERP and share it:" -ForegroundColor Yellow
        Write-Host "    net share ERP=C:\ERP /grant:Everyone,FULL" -ForegroundColor White
        exit 1
    }
    New-Item -Path $ERP_SHARE -ItemType Directory -Force | Out-Null
}

Set-Location $ROOT

# Sync everything except heavy dev-only folders
$excludeDirs = "node_modules .git target .venv __pycache__ .next"
$excludeFiles = "*.db3 *.log"

robocopy "$ROOT" "$ERP_SHARE" /MIR /XD $excludeDirs /XF $excludeFiles /NFL /NDL /NJH /NJS /NC /NS /NP /MT:8 /R:1 /W:1 2>&1 | Out-Null

if ($LASTEXITCODE -lt 8) {
    Write-Done "Files synced to WS-RACHEL"
} else {
    Write-Fail "File sync failed (robocopy exit $LASTEXITCODE)"
    exit 1
}

# Copy .env
if (Test-Path "$ROOT\packages\server\.env") {
    Copy-Item "$ROOT\packages\server\.env" "$ERP_SHARE\packages\server\.env" -Force
    Write-Done ".env file copied"
}

$deployStep++
Write-Step $deployStep $totalSteps "Creating production startup script on server"

# Create a startup script that WS-RACHEL will run
$startupScript = @"
@echo off
REM ─── Wilde Signs ERP Production Server ───
REM This runs the compiled ERP on a single port (8001).
REM All frontends are served as static files.

echo.
echo   Starting Wilde Signs ERP Server...
echo   ══════════════════════════════════
echo.

cd /d C:\ERP\erp_workflow_ts

REM Start PostgreSQL (Docker)
echo   Starting PostgreSQL...
docker-compose up -d 2>nul
timeout /t 5 /nobreak >nul

REM Install dependencies (first run only)
if not exist "node_modules" (
    echo   Installing dependencies...
    call pnpm install
    echo   Running Prisma...
    cd packages\server
    call npx prisma generate
    call npx prisma db push --accept-data-loss
    cd ..\..
)

REM Start the production server
echo.
echo   ══════════════════════════════════════════════
echo   ERP Server starting on port 8001
echo.
echo   Web App:    http://192.168.254.32:8001
echo   Portal:     http://192.168.254.32:8001/portal
echo   API:        http://192.168.254.32:8001/api/v1
echo   ══════════════════════════════════════════════
echo.

set NODE_ENV=production
set SERVER_PORT=8001
set SERVER_HOST=0.0.0.0
cd packages\server
call npx tsx src/index.ts
"@

Set-Content -Path "$ERP_SHARE\start-erp.bat" -Value $startupScript -Force
Write-Done "start-erp.bat created on server"

# Create a PM2-based production ecosystem
$pm2Config = @"
const path = require('path');
const workspaceRoot = path.resolve(__dirname);

module.exports = {
  apps: [{
    name: 'erp-production',
    script: path.join(workspaceRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    args: 'src/index.ts',
    cwd: path.join(workspaceRoot, 'packages', 'server'),
    interpreter: 'node',
    env: {
      NODE_ENV: 'production',
      SERVER_PORT: 8001,
      SERVER_HOST: '0.0.0.0',
      DATABASE_URL: 'postgresql://erp_user:erp_password@localhost:5432/erp_workflow?schema=public',
      JWT_SECRET: 'production-server-wilde-signs-erp-secret-key-2024',
    },
    // Production restart settings
    watch: false,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 3000,
    stop_exit_codes: [0],
    // Resource limits
    max_memory_restart: '1G',
  }],
};
"@

Set-Content -Path "$ERP_SHARE\ecosystem.production.js" -Value $pm2Config -Force
Write-Done "PM2 production config created"

$deployStep++
Write-Step $deployStep $totalSteps "Summary"

Write-Host @"

╔══════════════════════════════════════════════════════════════╗
║              Deployment Package Ready!                       ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Files synced to: \\$SERVER_IP\ERP\erp_workflow_ts           ║
║                                                              ║
║  TO START on WS-RACHEL (one-time):                           ║
║                                                              ║
║  1. RDP: mstsc /v:192.168.254.32                             ║
║     (or plug in a monitor)                                   ║
║                                                              ║
║  2. Open PowerShell as Admin and run:                        ║
║       cd C:\ERP\erp_workflow_ts                              ║
║       pnpm install                                           ║
║       cd packages\server                                     ║
║       npx prisma generate                                    ║
║       npx prisma db push --accept-data-loss                  ║
║       cd ..\..                                               ║
║       pm2 start ecosystem.production.js                      ║
║       pm2 save                                               ║
║                                                              ║
║  OR just double-click: C:\ERP\erp_workflow_ts\start-erp.bat  ║
║                                                              ║
║  ACCESS (from any network PC):                               ║
║    Web App:  http://192.168.254.32:8001                      ║
║    Portal:   http://192.168.254.32:8001/portal               ║
║    API:      http://192.168.254.32:8001/api/v1               ║
║                                                              ║
║  SINGLE PROCESS = ~200MB RAM instead of 2GB+                 ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Green
