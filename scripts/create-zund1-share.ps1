<#
.SYNOPSIS
    Create the Statistics share on Zund 1 (192.168.254.38) to match Zund 2's setup.
.DESCRIPTION
    Zund 2 (.28) has a "Statistics" SMB share. Zund 1 (.38) does not.
    This script creates it remotely via WMI, or prints manual instructions.
.EXAMPLE
    .\scripts\create-zund1-share.ps1
#>

$ZundIP    = '192.168.254.38'
$ShareName = 'Statistics'
$LocalPath = 'C:\Program Data\Zund\02 Statistic database'
$Username  = 'HP USER'
$Password  = ''

$ErrorActionPreference = 'Stop'
$MB = 1048576

Write-Host ''
Write-Host '======================================================'
Write-Host '  Create Statistics Share on Zund 1'
Write-Host "  Target: $ZundIP"
Write-Host '======================================================'
Write-Host ''

# Step 1: Test connectivity
Write-Host '[1] Testing connectivity...'
$ping = Test-Connection -ComputerName $ZundIP -Count 2 -Quiet
if (-not $ping) {
    Write-Host '  FAIL - Cannot reach machine'
    exit 1
}
Write-Host '  OK - Ping successful'

# Step 2: Check if share already exists
Write-Host '[2] Checking existing shares...'
$secPass = ConvertTo-SecureString $Password -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential($Username, $secPass)

try {
    $existing = Get-WmiObject -Class Win32_Share -ComputerName $ZundIP -Credential $cred |
        Where-Object { $_.Name -eq $ShareName }
    if ($existing) {
        Write-Host "  OK - Share already exists -> $($existing.Path)"

        cmd /c "net use `"\\$ZundIP\$ShareName`" /user:`"$Username`" `"`" /persistent:yes" 2>&1 | Out-Null
        $dbFile = "\\$ZundIP\$ShareName\Statistic.db3"
        if (Test-Path $dbFile) {
            $info = Get-Item $dbFile
            $sizeMB = [math]::Round($info.Length / $MB, 2)
            Write-Host "  OK - Statistic.db3 found (${sizeMB} MB)"
        } else {
            Write-Host '  Listing share contents:'
            Get-ChildItem "\\$ZundIP\$ShareName" -ErrorAction SilentlyContinue |
                ForEach-Object { Write-Host "    $($_.Name)" }
        }
        exit 0
    }
    Write-Host "  Share does not exist yet - will create"
} catch {
    Write-Host "  Could not query WMI: $($_.Exception.Message)"
}

# Step 3: Create the share via WMI
Write-Host '[3] Creating share...'
try {
    $shareClass = [wmiclass]"\\$ZundIP\root\cimv2:Win32_Share"
    $result = $shareClass.Create($LocalPath, $ShareName, 0, $null, 'Zund Cut Center Statistics DB')

    if ($result.ReturnValue -eq 0) {
        Write-Host "  OK - Share created -> $LocalPath"
    } else {
        Write-Host "  FAIL - Return code $($result.ReturnValue)"
        throw "Share creation failed"
    }
} catch {
    Write-Host "  FAIL - $($_.Exception.Message)"
    Write-Host ''
    Write-Host '  === MANUAL INSTRUCTIONS ==='
    Write-Host "  1. RDP to $ZundIP  (mstsc /v:$ZundIP)"
    Write-Host '  2. Open PowerShell as Admin'
    Write-Host "  3. Run: New-SmbShare -Name Statistics -Path '$LocalPath' -FullAccess Everyone"
    Write-Host "  4. From ERP server: net use \\$ZundIP\Statistics /user:`"HP USER`" `"`" /persistent:yes"
    exit 1
}

# Step 4: Map and verify
Write-Host '[4] Mapping and verifying...'
cmd /c "net use `"\\$ZundIP\$ShareName`" /user:`"$Username`" `"`" /persistent:yes" 2>&1 | Out-Null

$dbFile = "\\$ZundIP\$ShareName\Statistic.db3"
if (Test-Path $dbFile) {
    $info = Get-Item $dbFile
    $sizeMB = [math]::Round($info.Length / $MB, 2)
    Write-Host "  OK - Statistic.db3 found (${sizeMB} MB, modified $($info.LastWriteTime))"
} else {
    Write-Host '  Share created but DB file not found - check local path on Zund 1'
    Get-ChildItem "\\$ZundIP\$ShareName" -ErrorAction SilentlyContinue |
        ForEach-Object { Write-Host "    $($_.Name)" }
}

Write-Host ''
Write-Host 'Done.'
