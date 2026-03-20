<#
.SYNOPSIS
    Remote diagnostic for Thrive (.77) and Zund (.28) equipment connectivity.
.DESCRIPTION
    Run from the ERP server to check network connectivity, SMB share access,
    QueueXML.Info file validity, and Zund statistics DB availability.
.EXAMPLE
    .\scripts\diagnose-equipment.ps1
#>

[CmdletBinding()]
param()

$ErrorActionPreference = 'Continue'

# ─── Configuration ──────────────────────────────────────

$ThriveRIP2 = @{
    Name = 'Thrive RIP2 (WS-RIP2)'
    IP   = '192.168.254.77'
    Share = '\\192.168.254.77\Thrive22Input_WS-RIP2'
    QueueFiles = @(
        '\\192.168.254.77\Thrive22Input_WS-RIP2\HP Latex 570\Info\QueueXML.Info',
        '\\192.168.254.77\Thrive22Input_WS-RIP2\HP Latex 570-2\Info\QueueXML.Info',
        '\\192.168.254.77\Thrive22Input_WS-RIP2\HP Latex 800 W\Info\QueueXML.Info',
        '\\192.168.254.77\Thrive22Input_WS-RIP2\HP Scitex FB700\Info\QueueXML.Info',
        '\\192.168.254.77\Thrive22Input_WS-RIP2\HP Scitex FB700-2\Info\QueueXML.Info',
        '\\192.168.254.77\Thrive22Input_WS-RIP2\Mimaki JV33-160 A\Info\QueueXML.Info',
        '\\192.168.254.77\Thrive22Input_WS-RIP2\Mimaki JV33-160 B\Info\QueueXML.Info'
    )
}

$ThriveFlatbed = @{
    Name = 'Thrive Flatbed (WILDE-FLATBEDPC)'
    IP   = '192.168.254.53'
    Share = '\\192.168.254.53\Thrive22Input_WILDE-FLATBEDPC'
    QueueFiles = @(
        '\\192.168.254.53\Thrive22Input_WILDE-FLATBEDPC\HP Scitex FB700\Info\QueueXML.Info',
        '\\192.168.254.53\Thrive22Input_WILDE-FLATBEDPC\HP Scitex FB700-2\Info\QueueXML.Info'
    )
}

$ZundConfigs = @(
    @{
        Name      = 'Zund 1'
        IP        = '192.168.254.38'
        SharePath = '\\192.168.254.38\ProgramData\Zund\02 Statistic database'
        DBFile    = '\\192.168.254.38\ProgramData\Zund\02 Statistic database\Statistic.db3'
        Username  = 'HP USER'
        Password  = 'Wilde1234'
    },
    @{
        Name       = 'Zund 2'
        IP         = '192.168.254.28'
        SharePath  = '\\192.168.254.28\Statistics'
        DBFile     = '\\192.168.254.28\Statistics\Statistic.db3'
        Username   = 'User'
        Password   = 'Wilde1234'
    }
)

# ─── Helpers ────────────────────────────────────────────

function Write-Status {
    param([string]$Label, [string]$Status, [string]$Detail = '')
    $color = switch ($Status) {
        'PASS' { 'Green' }
        'FAIL' { 'Red' }
        'WARN' { 'Yellow' }
        default { 'White' }
    }
    $prefix = switch ($Status) {
        'PASS' { '[OK]  ' }
        'FAIL' { '[FAIL]' }
        'WARN' { '[WARN]' }
        default { '[INFO]' }
    }
    Write-Host "  $prefix " -ForegroundColor $color -NoNewline
    Write-Host "$Label" -NoNewline
    if ($Detail) { Write-Host " — $Detail" -ForegroundColor DarkGray } else { Write-Host '' }
}

function Test-XmlValid {
    param([string]$Path)
    try {
        $content = Get-Content -Path $Path -Raw -ErrorAction Stop
        if (-not $content -or $content.Trim().Length -eq 0) { return @{ Valid = $false; Reason = 'Empty file' } }
        if (-not $content.Trim().StartsWith('<')) { return @{ Valid = $false; Reason = 'Not XML (no opening tag)' } }
        [xml]$null = $content
        return @{ Valid = $true; Reason = '' }
    } catch {
        return @{ Valid = $false; Reason = $_.Exception.Message.Split("`n")[0] }
    }
}

# ─── Main ───────────────────────────────────────────────

Write-Host ''
Write-Host '======================================================' -ForegroundColor Cyan
Write-Host '  ERP Equipment Diagnostic — Network Share Checks' -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray
Write-Host '======================================================' -ForegroundColor Cyan
Write-Host ''

$allPassed = $true

# ─── Thrive RIP2 (.77) ─────────────────────────────────

Write-Host "[$($ThriveRIP2.Name)] — $($ThriveRIP2.IP)" -ForegroundColor Yellow

# Ping
$ping = Test-Connection -ComputerName $ThriveRIP2.IP -Count 2 -Quiet
if ($ping) {
    Write-Status 'Ping' 'PASS'
} else {
    Write-Status 'Ping' 'FAIL' 'Machine unreachable'
    $allPassed = $false
}

# SMB share
if (Test-Path $ThriveRIP2.Share) {
    Write-Status 'SMB share' 'PASS' $ThriveRIP2.Share
} else {
    Write-Status 'SMB share' 'FAIL' "$($ThriveRIP2.Share) not accessible"
    $allPassed = $false
}

# QueueXML.Info files
foreach ($qf in $ThriveRIP2.QueueFiles) {
    $printerName = ($qf -split '\\')[-3]
    if (-not (Test-Path $qf)) {
        Write-Status "QueueXML ($printerName)" 'WARN' 'File not found'
        continue
    }

    $fileInfo = Get-Item $qf
    $ageMins = [math]::Round(((Get-Date) - $fileInfo.LastWriteTime).TotalMinutes, 1)
    $sizeKB = [math]::Round($fileInfo.Length / 1024, 1)

    if ($fileInfo.Length -eq 0) {
        Write-Status "QueueXML ($printerName)" 'FAIL' "Empty file (0 bytes), last modified ${ageMins}m ago"
        $allPassed = $false
        continue
    }

    $xmlCheck = Test-XmlValid -Path $qf
    if ($xmlCheck.Valid) {
        Write-Status "QueueXML ($printerName)" 'PASS' "${sizeKB}KB, last modified ${ageMins}m ago"
    } else {
        Write-Status "QueueXML ($printerName)" 'FAIL' "Malformed XML (${sizeKB}KB, ${ageMins}m ago): $($xmlCheck.Reason)"
        $allPassed = $false
    }
}

Write-Host ''

# ─── Thrive Flatbed (.53) ──────────────────────────────

Write-Host "[$($ThriveFlatbed.Name)] — $($ThriveFlatbed.IP)" -ForegroundColor Yellow

$ping53 = Test-Connection -ComputerName $ThriveFlatbed.IP -Count 2 -Quiet
if ($ping53) {
    Write-Status 'Ping' 'PASS'
} else {
    Write-Status 'Ping' 'FAIL' 'Machine unreachable'
    $allPassed = $false
}

if (Test-Path $ThriveFlatbed.Share) {
    Write-Status 'SMB share' 'PASS' $ThriveFlatbed.Share
} else {
    Write-Status 'SMB share' 'FAIL' "$($ThriveFlatbed.Share) not accessible"
    $allPassed = $false
}

foreach ($qf in $ThriveFlatbed.QueueFiles) {
    $printerName = ($qf -split '\\')[-3]
    if (-not (Test-Path $qf)) {
        Write-Status "QueueXML ($printerName)" 'WARN' 'File not found'
        continue
    }
    $fileInfo = Get-Item $qf
    $ageMins = [math]::Round(((Get-Date) - $fileInfo.LastWriteTime).TotalMinutes, 1)
    $sizeKB = [math]::Round($fileInfo.Length / 1024, 1)

    if ($fileInfo.Length -eq 0) {
        Write-Status "QueueXML ($printerName)" 'FAIL' "Empty file (0 bytes)"
        $allPassed = $false
        continue
    }

    $xmlCheck = Test-XmlValid -Path $qf
    if ($xmlCheck.Valid) {
        Write-Status "QueueXML ($printerName)" 'PASS' "${sizeKB}KB, modified ${ageMins}m ago"
    } else {
        Write-Status "QueueXML ($printerName)" 'FAIL' "Malformed: $($xmlCheck.Reason)"
        $allPassed = $false
    }
}

Write-Host ''

# ─── Zund Machines ──────────────────────────────────────

foreach ($ZundConfig in $ZundConfigs) {
    Write-Host "[$($ZundConfig.Name)] — $($ZundConfig.IP)" -ForegroundColor Yellow

    $pingOk = Test-Connection -ComputerName $ZundConfig.IP -Count 2 -Quiet
    if ($pingOk) {
        Write-Status 'Ping' 'PASS'
    } else {
        Write-Status 'Ping' 'FAIL' 'Machine unreachable'
        $allPassed = $false
        Write-Host ''
        continue
    }

    # Test share access
    $shareOk = Test-Path $ZundConfig.SharePath
    if ($shareOk) {
        Write-Status 'Statistics share' 'PASS' $ZundConfig.SharePath
    } else {
        Write-Status 'Statistics share' 'FAIL' 'Not accessible — will attempt credential fix'
        $allPassed = $false

        # Attempt to map with credentials
        Write-Host '  Attempting net use with stored credentials...' -ForegroundColor DarkGray
        try {
            net use $ZundConfig.SharePath /delete /y 2>$null | Out-Null
            if ($ZundConfig.Password -eq '') {
                cmd /c "net use `"$($ZundConfig.SharePath)`" /user:`"$($ZundConfig.Username)`" `"`" /persistent:yes" 2>&1 | Out-Null
            } else {
                net use $ZundConfig.SharePath /user:$($ZundConfig.Username) $($ZundConfig.Password) /persistent:yes 2>&1 | Out-Null
            }
            if (Test-Path $ZundConfig.SharePath) {
                Write-Status 'Credential fix' 'PASS' 'Share now accessible'
            } else {
                Write-Status 'Credential fix' 'FAIL' 'Still not accessible after net use'
            }
        } catch {
            Write-Status 'Credential fix' 'FAIL' $_.Exception.Message
        }
    }

    # Test DB file
    if (Test-Path $ZundConfig.DBFile) {
        $dbInfo = Get-Item $ZundConfig.DBFile
        $dbSizeMB = [math]::Round($dbInfo.Length / 1MB, 2)
        $dbAge = [math]::Round(((Get-Date) - $dbInfo.LastWriteTime).TotalHours, 1)
        if ($dbInfo.Length -gt 0) {
            Write-Status 'Statistic.db3' 'PASS' "${dbSizeMB}MB, last modified ${dbAge}h ago"
        } else {
            Write-Status 'Statistic.db3' 'FAIL' 'File is 0 bytes'
            $allPassed = $false
        }

        # Try copy to temp
        $tempDest = Join-Path $env:TEMP "diag_Statistic_$($ZundConfig.Name.Replace(' ',''))_$(Get-Date -Format 'yyyyMMdd_HHmmss').db3"
        try {
            Copy-Item $ZundConfig.DBFile $tempDest -ErrorAction Stop
            Write-Status 'DB copy test' 'PASS' "Copied to $tempDest"
            Remove-Item $tempDest -Force -ErrorAction SilentlyContinue
        } catch {
            Write-Status 'DB copy test' 'FAIL' $_.Exception.Message
            $allPassed = $false
        }
    } else {
        Write-Status 'Statistic.db3' 'FAIL' 'File not found'
        $allPassed = $false
    }

    Write-Host ''
}

Write-Host ''

# ─── Summary ───────────────────────────────────────────

Write-Host '======================================================' -ForegroundColor Cyan
if ($allPassed) {
    Write-Host '  RESULT: All checks passed' -ForegroundColor Green
} else {
    Write-Host '  RESULT: Issues detected — see FAIL items above' -ForegroundColor Red
}
Write-Host '======================================================' -ForegroundColor Cyan
Write-Host ''
