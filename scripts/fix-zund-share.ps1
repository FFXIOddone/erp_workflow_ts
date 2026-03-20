<#
.SYNOPSIS
    Re-establish SMB credentials for Zund Statistics shares (both machines).
.DESCRIPTION
    Run from the ERP server when Zund statistics DBs are inaccessible.
    Drops stale credentials and re-maps with persistent net use.
.EXAMPLE
    .\scripts\fix-zund-share.ps1
#>

[CmdletBinding()]
param()

$ErrorActionPreference = 'Continue'

$ZundMachines = @(
    @{
        Name      = 'Zund 1'
        IP        = '192.168.254.38'
        SharePath = '\\192.168.254.38\Statistics'
        DBFile    = '\\192.168.254.38\Statistics\Statistic.db3'
        Username  = 'HP USER'
        Password  = 'Wilde1234'
    },
    @{
        Name      = 'Zund 2'
        IP        = '192.168.254.28'
        SharePath = '\\192.168.254.28\Statistics'
        DBFile    = '\\192.168.254.28\Statistics\Statistic.db3'
        Username  = 'User'
        Password  = 'Wilde1234'
    }
)

Write-Host ''
Write-Host '======================================================' -ForegroundColor Cyan
Write-Host '  Zund Statistics Shares — Credential Fix' -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray
Write-Host '======================================================' -ForegroundColor Cyan
Write-Host ''

foreach ($zund in $ZundMachines) {
    Write-Host "--- $($zund.Name) ($($zund.IP)) ---" -ForegroundColor White
    Write-Host ''

    # Step 1: Ping
    Write-Host '[1] Network connectivity' -ForegroundColor Yellow
    $ping = Test-Connection -ComputerName $zund.IP -Count 2 -Quiet
    if ($ping) {
        Write-Host "  [OK]   Ping $($zund.IP)" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] Ping $($zund.IP) — machine unreachable, skipping" -ForegroundColor Red
        Write-Host ''
        continue
    }

    Write-Host ''

    # Step 2: Check current access
    Write-Host '[2] Current share access' -ForegroundColor Yellow
    $currentAccess = Test-Path $zund.SharePath
    if ($currentAccess) {
        Write-Host "  [OK]   $($zund.SharePath) is already accessible" -ForegroundColor Green
    } else {
        Write-Host "  [WARN] $($zund.SharePath) not accessible — will fix" -ForegroundColor Yellow
    }

    Write-Host ''

    # Step 3: Drop stale mapping and re-establish
    Write-Host '[3] Re-establishing credentials' -ForegroundColor Yellow

    # Remove any existing mapping (ignore errors if none exists)
    $deleteResult = net use $zund.SharePath /delete /y 2>&1
    Write-Host "  [INFO] Cleared existing mapping: $($deleteResult | Select-Object -First 1)" -ForegroundColor DarkGray

    # Re-map with persistent credentials (per-machine username/password)
    if ($zund.Password -eq '') {
        $mapResult = cmd /c "net use `"$($zund.SharePath)`" /user:`"$($zund.Username)`" `"`" /persistent:yes 2>&1"
    } else {
        $mapResult = net use $zund.SharePath /user:$($zund.Username) $($zund.Password) /persistent:yes 2>&1
    }
    $mapExitCode = $LASTEXITCODE

    if ($mapExitCode -eq 0) {
        Write-Host "  [OK]   Mapped $($zund.SharePath) with persistent credentials" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] net use failed: $mapResult" -ForegroundColor Red
        Write-Host ''
        continue
    }

    Write-Host ''

    # Step 4: Verify access
    Write-Host '[4] Verification' -ForegroundColor Yellow

    if (Test-Path $zund.SharePath) {
        Write-Host "  [OK]   Share accessible" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] Share still not accessible after net use" -ForegroundColor Red
        Write-Host ''
        continue
    }

    if (Test-Path $zund.DBFile) {
        $info = Get-Item $zund.DBFile
        $sizeMB = [math]::Round($info.Length / 1MB, 2)
        $ageHours = [math]::Round(((Get-Date) - $info.LastWriteTime).TotalHours, 1)
        Write-Host "  [OK]   Statistic.db3 found (${sizeMB}MB, modified ${ageHours}h ago)" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] Statistic.db3 not found at $($zund.DBFile)" -ForegroundColor Red
        Write-Host ''
        continue
    }

    # Test copy
    $tempDest = Join-Path $env:TEMP "test_Statistic_$($zund.Name.Replace(' ',''))_$(Get-Date -Format 'yyyyMMdd_HHmmss').db3"
    try {
        Copy-Item $zund.DBFile $tempDest -ErrorAction Stop
        Write-Host "  [OK]   Copy test passed" -ForegroundColor Green
        Remove-Item $tempDest -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Host "  [FAIL] Copy test failed: $($_.Exception.Message)" -ForegroundColor Red
    }

    Write-Host ''
}

Write-Host '======================================================' -ForegroundColor Cyan
Write-Host '  Zund Statistics share fix complete' -ForegroundColor Green
Write-Host '  Persistent mappings saved — will survive reboots' -ForegroundColor Green
Write-Host '======================================================' -ForegroundColor Cyan
Write-Host ''
