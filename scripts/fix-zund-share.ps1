<#
.SYNOPSIS
    Re-establish SMB credentials for Zund 2 Statistics share (.28).
.DESCRIPTION
    Run from the ERP server when the Zund statistics DB is inaccessible.
    Drops stale credentials and re-maps with persistent net use.
.EXAMPLE
    .\scripts\fix-zund-share.ps1
#>

[CmdletBinding()]
param()

$ErrorActionPreference = 'Continue'

$ZundIP       = '192.168.254.28'
$SharePath    = "\\$ZundIP\Statistics"
$DBFile       = "$SharePath\Statistic.db3"
$Username     = 'User'
$Password     = 'Wilde1234'

Write-Host ''
Write-Host '======================================================' -ForegroundColor Cyan
Write-Host '  Zund 2 Statistics Share — Credential Fix' -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray
Write-Host '======================================================' -ForegroundColor Cyan
Write-Host ''

# Step 1: Ping
Write-Host '[1] Network connectivity' -ForegroundColor Yellow
$ping = Test-Connection -ComputerName $ZundIP -Count 2 -Quiet
if ($ping) {
    Write-Host "  [OK]   Ping $ZundIP" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] Ping $ZundIP — machine unreachable, cannot proceed" -ForegroundColor Red
    exit 1
}

Write-Host ''

# Step 2: Check current access
Write-Host '[2] Current share access' -ForegroundColor Yellow
$currentAccess = Test-Path $SharePath
if ($currentAccess) {
    Write-Host "  [OK]   $SharePath is already accessible" -ForegroundColor Green
} else {
    Write-Host "  [WARN] $SharePath not accessible — will fix" -ForegroundColor Yellow
}

Write-Host ''

# Step 3: Drop stale mapping and re-establish
Write-Host '[3] Re-establishing credentials' -ForegroundColor Yellow

# Remove any existing mapping (ignore errors if none exists)
$deleteResult = net use $SharePath /delete /y 2>&1
Write-Host "  [INFO] Cleared existing mapping: $($deleteResult | Select-Object -First 1)" -ForegroundColor DarkGray

# Re-map with persistent credentials
$mapResult = net use $SharePath /user:$Username $Password /persistent:yes 2>&1
$mapExitCode = $LASTEXITCODE

if ($mapExitCode -eq 0) {
    Write-Host "  [OK]   Mapped $SharePath with persistent credentials" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] net use failed: $mapResult" -ForegroundColor Red
    exit 1
}

Write-Host ''

# Step 4: Verify access
Write-Host '[4] Verification' -ForegroundColor Yellow

if (Test-Path $SharePath) {
    Write-Host "  [OK]   Share accessible" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] Share still not accessible after net use" -ForegroundColor Red
    exit 1
}

if (Test-Path $DBFile) {
    $info = Get-Item $DBFile
    $sizeMB = [math]::Round($info.Length / 1MB, 2)
    $ageHours = [math]::Round(((Get-Date) - $info.LastWriteTime).TotalHours, 1)
    Write-Host "  [OK]   Statistic.db3 found (${sizeMB}MB, modified ${ageHours}h ago)" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] Statistic.db3 not found at $DBFile" -ForegroundColor Red
    exit 1
}

# Test copy
$tempDest = Join-Path $env:TEMP "test_Statistic_$(Get-Date -Format 'yyyyMMdd_HHmmss').db3"
try {
    Copy-Item $DBFile $tempDest -ErrorAction Stop
    Write-Host "  [OK]   Copy test passed" -ForegroundColor Green
    Remove-Item $tempDest -Force -ErrorAction SilentlyContinue
} catch {
    Write-Host "  [FAIL] Copy test failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ''
Write-Host '======================================================' -ForegroundColor Cyan
Write-Host '  Zund Statistics share is fixed and accessible' -ForegroundColor Green
Write-Host '  Persistent mapping saved — will survive reboots' -ForegroundColor Green
Write-Host '======================================================' -ForegroundColor Cyan
Write-Host ''
