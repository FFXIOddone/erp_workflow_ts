<#
.SYNOPSIS
    Quick check: Is WS-RACHEL ready for ERP deployment?
    Run this from Jake's PC after physical setup.

.DESCRIPTION
    Tests: ping, WinRM, ERP share, Docker, PM2 availability.
    Shows what's ready and what still needs setup.

.EXAMPLE
    .\check-server-ready.ps1
#>

$ErrorActionPreference = 'Continue'

$SERVER_IP = "192.168.254.75"
$ERP_SHARE = "\\$SERVER_IP\ERP"

$pass = 0
$fail = 0

function Test-Check($name, $result, $detail) {
    if ($result) {
        Write-Host "  [PASS] $name" -ForegroundColor Green
        if ($detail) { Write-Host "         $detail" -ForegroundColor DarkGray }
        $script:pass++
    } else {
        Write-Host "  [FAIL] $name" -ForegroundColor Red
        if ($detail) { Write-Host "         $detail" -ForegroundColor DarkYellow }
        $script:fail++
    }
}

Write-Host ""
Write-Host "  ============================================================" -ForegroundColor Cyan
Write-Host "  WS-RACHEL Deployment Readiness Check" -ForegroundColor Cyan
Write-Host "  Server: $SERVER_IP" -ForegroundColor Cyan
Write-Host "  ============================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Ping
Write-Host "  --- Network ---" -ForegroundColor White
$pingOk = Test-Connection $SERVER_IP -Count 1 -Quiet
Test-Check "Ping $SERVER_IP" $pingOk $(if (-not $pingOk) { "Server not reachable - is it powered on?" })

if (-not $pingOk) {
    Write-Host ""
    Write-Host "  Server unreachable. Cannot continue checks." -ForegroundColor Red
    Write-Host ""
    exit 1
}

# 2. WinRM (port 5985)
$winrmOk = $false
try {
    $t = New-Object System.Net.Sockets.TcpClient
    $r = $t.BeginConnect($SERVER_IP, 5985, $null, $null)
    $winrmOk = $r.AsyncWaitHandle.WaitOne(2000) -and $t.Connected
    $t.Close()
} catch { }
Test-Check "WinRM port 5985 open" $winrmOk $(if (-not $winrmOk) { "Run setup-server.ps1 on WS-RACHEL to enable WinRM" })

# 3. WinRM session
$sessionOk = $false
if ($winrmOk) {
    try {
        $s = New-PSSession -ComputerName $SERVER_IP -ErrorAction Stop
        $sessionOk = $true
        Remove-PSSession $s
    } catch {
        $sessionOk = $false
    }
}
Test-Check "WinRM session connects" $sessionOk $(if ($winrmOk -and -not $sessionOk) { "WinRM port open but auth failed - check credentials/TrustedHosts" })

# 4. TrustedHosts on this PC
$trustedHosts = (Get-Item WSMan:\localhost\Client\TrustedHosts -ErrorAction SilentlyContinue).Value
$thOk = $trustedHosts -match $SERVER_IP -or $trustedHosts -eq '*'
Test-Check "TrustedHosts includes $SERVER_IP" $thOk $(if (-not $thOk) { "Current value: '$trustedHosts' - run elevated: Set-Item WSMan:\localhost\Client\TrustedHosts -Value '$SERVER_IP' -Force" })

# 5. ERP Share
Write-Host ""
Write-Host "  --- File Share ---" -ForegroundColor White
$shareOk = Test-Path $ERP_SHARE
Test-Check "ERP share ($ERP_SHARE)" $shareOk $(if (-not $shareOk) { "Share not found - run setup-server.ps1 on WS-RACHEL" })

# 6. ERP directory writable
if ($shareOk) {
    $writeOk = $false
    try {
        $testFile = "$ERP_SHARE\_write_test_$(Get-Random).tmp"
        Set-Content -Path $testFile -Value "test" -ErrorAction Stop
        Remove-Item $testFile -Force
        $writeOk = $true
    } catch { }
    Test-Check "ERP share writable" $writeOk $(if (-not $writeOk) { "Share exists but not writable - check permissions" })
}

# 7-9. Remote software checks (only if WinRM works)
if ($sessionOk) {
    Write-Host ""
    Write-Host "  --- Remote Software ---" -ForegroundColor White
    
    $s = New-PSSession -ComputerName $SERVER_IP -ErrorAction SilentlyContinue
    if ($s) {
        # Node
        $nodeVer = Invoke-Command -Session $s -ScriptBlock { node --version 2>$null } -ErrorAction SilentlyContinue
        Test-Check "Node.js installed" ($null -ne $nodeVer) "Version: $nodeVer"
        
        # pnpm
        $pnpmVer = Invoke-Command -Session $s -ScriptBlock { pnpm --version 2>$null } -ErrorAction SilentlyContinue
        Test-Check "pnpm installed" ($null -ne $pnpmVer) "Version: $pnpmVer"
        
        # PM2
        $pm2Ver = Invoke-Command -Session $s -ScriptBlock { pm2 --version 2>$null } -ErrorAction SilentlyContinue
        Test-Check "PM2 installed" ($null -ne $pm2Ver) "Version: $pm2Ver"
        
        # Docker
        $dockerVer = Invoke-Command -Session $s -ScriptBlock { docker --version 2>$null } -ErrorAction SilentlyContinue
        Test-Check "Docker installed" ($null -ne $dockerVer) "$dockerVer"
        
        # Docker running
        $dockerRunning = Invoke-Command -Session $s -ScriptBlock { docker info 2>$null | Select-Object -First 1 } -ErrorAction SilentlyContinue
        Test-Check "Docker daemon running" ($null -ne $dockerRunning) $(if (-not $dockerRunning) { "Start Docker Desktop on WS-RACHEL" })
        
        # PostgreSQL container
        $pgContainer = Invoke-Command -Session $s -ScriptBlock { docker ps --filter "name=postgres" --format "{{.Status}}" 2>$null } -ErrorAction SilentlyContinue
        Test-Check "PostgreSQL container" ($null -ne $pgContainer -and $pgContainer -match "Up") "Status: $pgContainer"
        
        Remove-PSSession $s
    }
} else {
    Write-Host ""
    Write-Host "  --- Remote Software ---" -ForegroundColor White
    Write-Host "  (Skipped - WinRM not available)" -ForegroundColor DarkYellow
}

# Summary
Write-Host ""
Write-Host "  ============================================================" -ForegroundColor Cyan
Write-Host "  Results: $pass passed, $fail failed" -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Yellow" })
Write-Host "  ============================================================" -ForegroundColor Cyan

if ($fail -eq 0) {
    Write-Host ""
    Write-Host "  All checks passed! Ready to deploy." -ForegroundColor Green
    Write-Host "  Run: .\deploy-to-server.ps1" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "  Some checks failed. Fix the issues above, then re-run this script." -ForegroundColor Yellow
    if (-not $shareOk -or -not $winrmOk) {
        Write-Host ""
        Write-Host "  If WS-RACHEL is freshly set up, RDP in and run:" -ForegroundColor Yellow
        Write-Host "    Set-ExecutionPolicy Bypass -Scope Process -Force" -ForegroundColor White
        Write-Host "    .\setup-server.ps1" -ForegroundColor White
    }
}

Write-Host ""
