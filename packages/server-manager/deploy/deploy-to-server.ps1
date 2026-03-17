<#
.SYNOPSIS
    Deploy ERP to WS-RACHEL server (192.168.254.32)
    Run this from Jake's PC to push code and start services.

.DESCRIPTION
    Copies the ERP project to WS-RACHEL, installs dependencies,
    starts PostgreSQL via Docker, runs Prisma migrations, and
    launches all services via PM2.

.PARAMETER SkipCopy
    Skip the file copy step (just restart services)

.PARAMETER SkipInstall
    Skip pnpm install (use when only config changed)

.EXAMPLE
    .\deploy-to-server.ps1           # Full deploy
    .\deploy-to-server.ps1 -SkipCopy # Restart services only
#>

param(
    [switch]$SkipCopy,
    [switch]$SkipInstall,
    [switch]$SkipDocker
)

$ErrorActionPreference = 'Stop'

# --- Configuration ----------------------------------------------------------------
$SERVER_IP = "192.168.254.32"
$SERVER_NAME = "WILDESIGNS-RACH"
$ERP_SHARE = "\\$SERVER_IP\ERP"
$ERP_LOCAL = "C:\ERP\erp_workflow_ts"
$SOURCE = $PSScriptRoot | Split-Path | Split-Path  # Go up to erp_workflow_ts root

# --- Helpers ----------------------------------------------------------------------
function Write-Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Write-Done($msg) { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red }

# --- Pre-flight -------------------------------------------------------------------
Write-Host @"

  ============================================================
  Deploying ERP to WS-RACHEL
  Server: $SERVER_IP
  ============================================================

"@ -ForegroundColor Magenta

# Test connectivity
Write-Step "Checking server connectivity"
if (-not (Test-Connection $SERVER_IP -Count 1 -Quiet)) {
    Write-Fail "Cannot reach $SERVER_IP - is WS-RACHEL powered on?"
    exit 1
}
Write-Done "Server is reachable"

# Check if WinRM is available
$useWinRM = $false
try {
    $t = New-Object System.Net.Sockets.TcpClient
    $r = $t.BeginConnect($SERVER_IP, 5985, $null, $null)
    $useWinRM = $r.AsyncWaitHandle.WaitOne(1000) -and $t.Connected
    $t.Close()
} catch { <# ignore #> }

if ($useWinRM) {
    Write-Done "WinRM available - will use remote PowerShell"
} else {
    Write-Host "  WinRM not available - will use SMB file copy + scheduled task" -ForegroundColor Yellow
}

# --- Step 1: Copy files to server -------------------------------------------------
if (-not $SkipCopy) {
    Write-Step "1/5 - Copying ERP files to server"
    
    # Test share access
    if (-not (Test-Path $ERP_SHARE)) {
        Write-Fail "Cannot access $ERP_SHARE"
        Write-Host "  Make sure you ran setup-server.ps1 on WS-RACHEL first!" -ForegroundColor Yellow
        exit 1
    }
    
    $destDir = "$ERP_SHARE\erp_workflow_ts"
    
    # Use robocopy for efficient sync (only copies changed files)
    Write-Host "  Syncing files with robocopy (changed files only)..."
    $excludeDirs = "node_modules .git target uploads\documents uploads\imports uploads\portal .venv __pycache__ dist .next"
    $excludeFiles = "*.db3 *.log zund-stats.db3"
    
    $robocopyArgs = @(
        "`"$SOURCE`"",
        "`"$destDir`"",
        "/MIR",         # Mirror directory tree
        "/XD $excludeDirs",
        "/XF $excludeFiles",
        "/NFL",         # No file list (less verbose)
        "/NDL",         # No directory list
        "/NJH",         # No job header
        "/NJS",         # No job summary  
        "/NC",          # No file classes
        "/NS",          # No file sizes
        "/NP",          # No progress
        "/MT:8",        # 8 threads
        "/R:1",         # 1 retry
        "/W:1"          # 1 second wait between retries
    )
    
    $robocopyCmd = "robocopy $($robocopyArgs -join ' ')"
    Write-Host "  $robocopyCmd" -ForegroundColor DarkGray
    Invoke-Expression $robocopyCmd
    
    # Robocopy exit codes: 0=no change, 1=files copied, 2=extras deleted, 3=both
    # Exit codes 0-7 are success, 8+ are errors
    if ($LASTEXITCODE -ge 8) {
        Write-Fail "Robocopy failed with exit code $LASTEXITCODE"
        exit 1
    }
    
    Write-Done "Files synced to $destDir"
    
    # Copy the .env file separately (not in git)
    Write-Host "  Copying server .env..."
    $envSource = "$SOURCE\packages\server\.env"
    $envDest = "$destDir\packages\server\.env"
    if (Test-Path $envSource) {
        # Update .env for server context (localhost stays localhost since Docker runs there)
        $envContent = Get-Content $envSource -Raw
        # Keep DATABASE_URL as localhost since Postgres runs on the server itself
        Set-Content -Path $envDest -Value $envContent
        Write-Done ".env copied"
    } else {
        Write-Fail "No .env found at $envSource"
    }
} else {
    Write-Step "1/5 - Skipping file copy (--SkipCopy)"
}

# --- Steps 2-5: Remote execution --------------------------------------------------
$remoteScript = @"
`$ErrorActionPreference = 'Continue'
`$ERP_ROOT = 'C:\ERP\erp_workflow_ts'

# Step 2: Start Docker + PostgreSQL
Write-Host '=== 2/5 - Starting PostgreSQL via Docker ===' -ForegroundColor Cyan
Set-Location `$ERP_ROOT
try {
    docker-compose up -d 2>&1
    Write-Host '  [OK] PostgreSQL container started' -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] Docker failed: `$(\`$_.Exception.Message)" -ForegroundColor Red
    Write-Host '  Make sure Docker Desktop is running!' -ForegroundColor Yellow
}

# Step 3: Install dependencies
Write-Host '=== 3/5 - Installing dependencies ===' -ForegroundColor Cyan
if (-not `$SkipInstall) {
    Set-Location `$ERP_ROOT
    pnpm install 2>&1 | Select-Object -Last 5
    Write-Host '  [OK] Dependencies installed' -ForegroundColor Green
} else {
    Write-Host '  -> Skipped (--SkipInstall)' -ForegroundColor Yellow
}

# Step 4: Run Prisma
Write-Host '=== 4/5 - Running Prisma db push ===' -ForegroundColor Cyan
Set-Location "`$ERP_ROOT\packages\server"
try {
    npx prisma generate 2>&1 | Out-Null
    npx prisma db push 2>&1 | Select-Object -Last 3
    Write-Host '  [OK] Database schema synced' -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] Prisma failed: `$(\`$_.Exception.Message)" -ForegroundColor Red
}

# Step 5: Start services via PM2
Write-Host '=== 5/5 - Starting ERP services via PM2 ===' -ForegroundColor Cyan
Set-Location `$ERP_ROOT
pm2 delete all 2>`$null
pm2 start packages\server-manager\ecosystem.config.js 2>&1 | Out-Null
pm2 save 2>&1 | Out-Null

# Set PM2 to start on Windows boot
try {
    pm2-startup install 2>&1 | Out-Null
} catch {
    Write-Host '  (pm2-startup may need manual setup)' -ForegroundColor DarkYellow
}

Write-Host ''
pm2 list
Write-Host ''
Write-Host '  [OK] All services started!' -ForegroundColor Green
"@

if ($useWinRM) {
    Write-Step "Running remote setup via WinRM"
    $session = New-PSSession -ComputerName $SERVER_IP -ErrorAction Stop
    Invoke-Command -Session $session -ScriptBlock ([scriptblock]::Create($remoteScript))
    Remove-PSSession $session
} else {
    Write-Step "Creating remote execution script"
    
    # Write the script to the share and create a scheduled task to run it
    $remoteScriptPath = "$ERP_SHARE\erp_workflow_ts\_run-deploy.ps1"
    Set-Content -Path $remoteScriptPath -Value $remoteScript -Force
    
    Write-Host @"
  
  ==========================================================
  FILES COPIED SUCCESSFULLY!
  
  WinRM is not enabled yet. To complete deployment:
  
  Option A: RDP into WS-RACHEL and run:
    Open PowerShell as Admin
    cd C:\ERP\erp_workflow_ts
    .\`_run-deploy.ps1
  
  Option B: After running setup-server.ps1 (enables WinRM):
    Re-run this script: .\deploy-to-server.ps1 -SkipCopy
  ==========================================================

"@ -ForegroundColor Yellow
    exit 0
}

# --- Final status -----------------------------------------------------------------
Write-Host @"

  ============================================================
  Deployment Complete!
  ============================================================

  ERP is running on WS-RACHEL (192.168.254.32):

  API Server:   http://192.168.254.32:8001
  Web App:      http://192.168.254.32:5173
  Portal:       http://192.168.254.32:5174
  pgAdmin:      http://192.168.254.32:5050

  Remote access:
    RDP:  mstsc /v:192.168.254.32
    PS:   Enter-PSSession 192.168.254.32

  To update later:
    .\deploy-to-server.ps1

  ============================================================

"@ -ForegroundColor Green
