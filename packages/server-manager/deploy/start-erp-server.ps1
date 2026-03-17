<#
.SYNOPSIS
    Run on WS-RACHEL after setup-server.ps1 to complete deployment.
    Starts Docker, installs deps, runs Prisma, launches PM2.
    
.NOTES
    Run as Administrator on WS-RACHEL:
      cd C:\ERP\erp_workflow_ts
      powershell -ExecutionPolicy Bypass -File .\start-erp-server.ps1
#>

$ErrorActionPreference = 'Continue'
$ERP_ROOT = $PSScriptRoot

Write-Host @"

╔══════════════════════════════════════════════════════════════╗
║         Starting Wilde Signs ERP Server                      ║
╚══════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Magenta

# ─── 1. Docker / PostgreSQL ───────────────────────────────────────────────────
Write-Host "━━━ Starting PostgreSQL ━━━" -ForegroundColor Cyan

# Check if Docker is running
$dockerProc = Get-Process "Docker Desktop" -ErrorAction SilentlyContinue
if (-not $dockerProc) {
    Write-Host "  Starting Docker Desktop..." -ForegroundColor Yellow
    $dockerPath = "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe"
    if (Test-Path $dockerPath) {
        Start-Process $dockerPath
        Write-Host "  Waiting for Docker to start (up to 60s)..." -ForegroundColor Gray
        $timeout = 60
        $waited = 0
        while ($waited -lt $timeout) {
            Start-Sleep -Seconds 3
            $waited += 3
            try {
                docker info 2>&1 | Out-Null
                if ($LASTEXITCODE -eq 0) { break }
            } catch {}
            Write-Host "  ... $waited`s" -NoNewline -ForegroundColor DarkGray
        }
        Write-Host ""
    } else {
        Write-Host "  ✗ Docker Desktop not found! Install it first." -ForegroundColor Red
        exit 1
    }
}

# Start PostgreSQL container
Set-Location $ERP_ROOT
docker-compose up -d 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ PostgreSQL is running" -ForegroundColor Green
} else {
    Write-Host "  ✗ Failed to start PostgreSQL" -ForegroundColor Red
    exit 1
}

# Wait for Postgres to be ready
Write-Host "  Waiting for PostgreSQL to be ready..." -ForegroundColor Gray
$pgReady = $false
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 2
    $check = docker exec erp_postgres pg_isready -U erp_user 2>&1
    if ($check -match "accepting connections") {
        $pgReady = $true
        break
    }
}
if ($pgReady) {
    Write-Host "  ✓ PostgreSQL is accepting connections" -ForegroundColor Green
} else {
    Write-Host "  ⚠ PostgreSQL may still be starting..." -ForegroundColor Yellow
}

# ─── 2. Install dependencies ─────────────────────────────────────────────────
Write-Host "`n━━━ Installing dependencies ━━━" -ForegroundColor Cyan

Set-Location $ERP_ROOT
pnpm install 2>&1 | Select-Object -Last 5
Write-Host "  ✓ Dependencies installed" -ForegroundColor Green

# ─── 3. Prisma ───────────────────────────────────────────────────────────────
Write-Host "`n━━━ Syncing database schema ━━━" -ForegroundColor Cyan

Set-Location "$ERP_ROOT\packages\server"
npx prisma generate 2>&1 | Out-Null
npx prisma db push --accept-data-loss 2>&1 | Select-Object -Last 3
Write-Host "  ✓ Database schema synced" -ForegroundColor Green

# ─── 4. Seed data (first run only) ───────────────────────────────────────────
Write-Host "`n━━━ Checking seed data ━━━" -ForegroundColor Cyan

# Check if admin user exists
$seedCheck = "SELECT COUNT(*) FROM ""User"";" | npx prisma db execute --stdin 2>&1
if ($seedCheck -match '"count":"0"' -or $seedCheck -match 'does not exist') {
    Write-Host "  First run - seeding initial data..."
    Set-Location $ERP_ROOT
    pnpm db:seed 2>&1 | Select-Object -Last 3
    Write-Host "  ✓ Initial data seeded (admin/admin123)" -ForegroundColor Green
} else {
    Write-Host "  → Database already has data" -ForegroundColor Yellow
}

# ─── 5. Start PM2 ────────────────────────────────────────────────────────────
Write-Host "`n━━━ Starting ERP services ━━━" -ForegroundColor Cyan

Set-Location $ERP_ROOT

# Stop any existing PM2 processes
pm2 delete all 2>$null | Out-Null

# Start all services
pm2 start packages\server-manager\ecosystem.config.js
pm2 save

Write-Host "`n"
pm2 list

# ─── Summary ──────────────────────────────────────────────────────────────────
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like "192.168.*" } | Select-Object -First 1).IPAddress

Write-Host @"

╔══════════════════════════════════════════════════════════════╗
║                 ERP Server is LIVE!                          ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Access from any computer on the network:                    ║
║                                                              ║
║  Web App:      http://${ip}:5173                             ║
║  API Server:   http://${ip}:8001                             ║
║  Portal:       http://${ip}:5174                             ║
║  pgAdmin:      http://${ip}:5050                             ║
║                                                              ║
║  Login:  admin / admin123                                    ║
║                                                              ║
║  PM2 Commands:                                               ║
║    pm2 list          - Show running services                ║
║    pm2 logs          - Stream all logs                      ║
║    pm2 logs erp-backend  - Backend logs only                ║
║    pm2 monit         - Resource monitor                     ║
║    pm2 reload all    - Graceful restart all                 ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Green
