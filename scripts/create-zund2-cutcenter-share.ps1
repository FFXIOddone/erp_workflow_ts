<#
.SYNOPSIS
    Create the "Zund Cut Center" share on Zund 2 (192.168.254.28) to match Zund 1's setup.
.DESCRIPTION
    Zund 1 (.38) has a "Zund Cut Center" SMB share pointing to the Cut Center program data.
    Zund 2 (.28) does not. This script attempts to create it remotely via WMI,
    or prints manual instructions to run on the Zund 2 PC via RDP.
.EXAMPLE
    .\scripts\create-zund2-cutcenter-share.ps1
#>

$ZundIP    = '192.168.254.28'
$ShareName = 'Zund Cut Center'
$LocalPath = 'C:\ProgramData\Zund Cut Center'
$Username  = 'User'
$Password  = 'Wilde1234'

$ErrorActionPreference = 'Stop'

Write-Host ''
Write-Host '======================================================'
Write-Host '  Create "Zund Cut Center" Share on Zund 2'
Write-Host "  Target: $ZundIP"
Write-Host '======================================================'
Write-Host ''

# Step 1: Test connectivity
Write-Host '[1] Testing connectivity...'
$ping = Test-Connection -ComputerName $ZundIP -Count 2 -Quiet
if (-not $ping) {
    Write-Host '  FAIL - Cannot reach machine' -ForegroundColor Red
    exit 1
}
Write-Host '  OK - Ping successful' -ForegroundColor Green

# Step 2: Check if share already exists
Write-Host '[2] Checking if share already exists...'
try {
    $testPath = "\\$ZundIP\$ShareName"
    cmd /c "net use `"$testPath`" /user:`"$Username`" `"$Password`"" 2>&1 | Out-Null
    if (Test-Path $testPath) {
        Write-Host "  OK - Share already exists and is accessible" -ForegroundColor Green
        $materialDb = "$testPath\Material.db3"
        if (Test-Path $materialDb) {
            $info = Get-Item $materialDb
            $sizeMB = [math]::Round($info.Length / 1048576, 2)
            Write-Host "  Material.db3 found (${sizeMB} MB, modified $($info.LastWriteTime))" -ForegroundColor Green
        } else {
            Write-Host '  Listing share contents:'
            Get-ChildItem $testPath -ErrorAction SilentlyContinue |
                ForEach-Object { Write-Host "    $($_.Name)" }
        }
        exit 0
    }
} catch {
    Write-Host "  Share not accessible yet" -ForegroundColor Yellow
}

# Step 3: Try to create via WMI
Write-Host '[3] Attempting to create share via WMI...'
try {
    $secPass = ConvertTo-SecureString $Password -AsPlainText -Force
    $cred = New-Object System.Management.Automation.PSCredential($Username, $secPass)
    $shareClass = [wmiclass]"\\$ZundIP\root\cimv2:Win32_Share"
    $result = $shareClass.Create($LocalPath, $ShareName, 0, $null, 'Zund Cut Center Program Data')

    if ($result.ReturnValue -eq 0) {
        Write-Host "  OK - Share created -> $LocalPath" -ForegroundColor Green
    } else {
        throw "Share creation returned code $($result.ReturnValue)"
    }
} catch {
    Write-Host "  WMI failed: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host ''
    Write-Host '  === MANUAL INSTRUCTIONS ===' -ForegroundColor Cyan
    Write-Host "  RDP into Zund 2:  mstsc /v:$ZundIP"
    Write-Host "  Login: $Username / $Password"
    Write-Host '  Open PowerShell as Admin and run:'
    Write-Host ''
    Write-Host "  New-SmbShare -Name 'Zund Cut Center' -Path '$LocalPath' -FullAccess Everyone" -ForegroundColor White
    Write-Host ''
    Write-Host "  Then from ERP server, map it:"
    Write-Host "  net use `"\\$ZundIP\$ShareName`" /user:`"$Username`" `"$Password`" /persistent:yes" -ForegroundColor White
    Write-Host ''
    exit 1
}

# Step 4: Map and verify
Write-Host '[4] Mapping and verifying...'
cmd /c "net use `"\\$ZundIP\$ShareName`" /user:`"$Username`" `"$Password`" /persistent:yes" 2>&1 | Out-Null

$materialDb = "\\$ZundIP\$ShareName\Material.db3"
if (Test-Path $materialDb) {
    $info = Get-Item $materialDb
    $sizeMB = [math]::Round($info.Length / 1048576, 2)
    Write-Host "  OK - Material.db3 found (${sizeMB} MB, modified $($info.LastWriteTime))" -ForegroundColor Green
} else {
    Write-Host '  Share created but Material.db3 not found - checking contents:' -ForegroundColor Yellow
    Get-ChildItem "\\$ZundIP\$ShareName" -ErrorAction SilentlyContinue |
        ForEach-Object { Write-Host "    $($_.Name)" }
}

Write-Host ''
Write-Host 'Done.'
