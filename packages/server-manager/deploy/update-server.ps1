<#
.SYNOPSIS
    Quick-push ERP updates to WS-RACHEL and restart services.
    
.DESCRIPTION
    Syncs changed files and restarts PM2 processes.
    Much faster than full deploy - only copies changed files.

.PARAMETER RestartOnly
    Skip file sync, just restart PM2 services

.PARAMETER Backend
    Only restart the backend API server

.PARAMETER Frontend  
    Only restart frontend apps

.EXAMPLE
    .\update-server.ps1              # Sync files + restart all
    .\update-server.ps1 -Backend     # Sync + restart API only
    .\update-server.ps1 -RestartOnly # Just restart services
#>

param(
    [switch]$RestartOnly,
    [switch]$Backend,
    [switch]$Frontend
)

$SERVER_IP = "192.168.254.32"
$ERP_SHARE = "\\$SERVER_IP\ERP\erp_workflow_ts"
$SOURCE = $PSScriptRoot | Split-Path | Split-Path

Write-Host "=== ERP Quick Update -> WS-RACHEL ===" -ForegroundColor Cyan

# 1. Sync files (skip if RestartOnly)
if (-not $RestartOnly) {
    Write-Host "  Syncing changed files..." -ForegroundColor Gray
    
    $excludeDirs = "node_modules .git target uploads .venv __pycache__ dist .next"
    $excludeFiles = "*.db3 *.log"
    
    robocopy "$SOURCE" "$ERP_SHARE" /MIR /XD $excludeDirs /XF $excludeFiles /NFL /NDL /NJH /NJS /NC /NS /NP /MT:8 /R:1 /W:1 2>&1 | Out-Null
    
    if ($LASTEXITCODE -lt 8) {
        Write-Host "  [OK] Files synced" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] Sync failed (exit $LASTEXITCODE)" -ForegroundColor Red
        exit 1
    }
    
    # Copy .env
    if (Test-Path "$SOURCE\packages\server\.env") {
        Copy-Item "$SOURCE\packages\server\.env" "$ERP_SHARE\packages\server\.env" -Force
    }
}

# 2. Restart services via WinRM
Write-Host "  Restarting services..." -ForegroundColor Gray

try {
    $session = New-PSSession -ComputerName $SERVER_IP -ErrorAction Stop
    
    if ($Backend) {
        Invoke-Command -Session $session -ScriptBlock {
            pm2 restart erp-backend 2>&1 | Out-Null
            Write-Host "  [OK] Backend restarted" -ForegroundColor Green
        }
    } elseif ($Frontend) {
        Invoke-Command -Session $session -ScriptBlock {
            pm2 restart erp-frontend erp-portal 2>&1 | Out-Null
            Write-Host "  [OK] Frontend apps restarted" -ForegroundColor Green
        }
    } else {
        Invoke-Command -Session $session -ScriptBlock {
            Set-Location "C:\ERP\erp_workflow_ts"
            pm2 reload all 2>&1 | Out-Null
            pm2 list
        }
    }
    
    Remove-PSSession $session
    Write-Host "  [OK] Update complete!" -ForegroundColor Green
} catch {
    Write-Host "  WinRM not available. RDP into WS-RACHEL and run:" -ForegroundColor Yellow
    Write-Host "    pm2 reload all" -ForegroundColor White
}

Write-Host ""
Write-Host "  Web:    http://192.168.254.32:5173" -ForegroundColor DarkGray
Write-Host "  API:    http://192.168.254.32:8001" -ForegroundColor DarkGray
Write-Host "  Portal: http://192.168.254.32:5174" -ForegroundColor DarkGray
