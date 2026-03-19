<#
.SYNOPSIS
    Diagnose and repair Thrive RIP2 issues on WS-RIP2 (192.168.254.77).
.DESCRIPTION
    Run this script ON the WS-RIP2 machine via Remote Desktop.
    Checks Thrive services, validates QueueXML.Info files, removes corrupt
    XMLs so Thrive can regenerate them, and verifies SMB share health.
.EXAMPLE
    # Diagnostic only (dry run — no fixes applied)
    .\fix-thrive-rip2.ps1

    # Apply fixes (restart services, delete corrupt XMLs)
    .\fix-thrive-rip2.ps1 -Fix
#>

[CmdletBinding()]
param(
    [switch]$Fix
)

$ErrorActionPreference = 'Continue'

# ─── Configuration ──────────────────────────────────────

$ThriveShareRoot = 'C:\ProgramData\ONYX Graphics\Thrive22'
$QueueXMLPaths = @(
    'C:\Thrive22Input_WS-RIP2\HP Latex 570\Info\QueueXML.Info',
    'C:\Thrive22Input_WS-RIP2\HP Latex 570-2\Info\QueueXML.Info',
    'C:\Thrive22Input_WS-RIP2\HP Latex 800 W\Info\QueueXML.Info',
    'C:\Thrive22Input_WS-RIP2\HP Scitex FB700\Info\QueueXML.Info',
    'C:\Thrive22Input_WS-RIP2\HP Scitex FB700-2\Info\QueueXML.Info',
    'C:\Thrive22Input_WS-RIP2\Mimaki JV33-160 A\Info\QueueXML.Info',
    'C:\Thrive22Input_WS-RIP2\Mimaki JV33-160 B\Info\QueueXML.Info'
)
# Also check the SMB share path (may differ from local path)
$SMBShareNames = @('Thrive22Input_WS-RIP2', 'Thrive22Cutter_WS-RIP2')
$ERPServerIP = '192.168.254.32'
$MinDiskSpaceGB = 10

# ─── Helpers ────────────────────────────────────────────

function Write-Status {
    param([string]$Label, [string]$Status, [string]$Detail = '')
    $color = switch ($Status) {
        'PASS' { 'Green' }
        'FAIL' { 'Red' }
        'WARN' { 'Yellow' }
        'FIX'  { 'Magenta' }
        default { 'White' }
    }
    $prefix = switch ($Status) {
        'PASS' { '[OK]  ' }
        'FAIL' { '[FAIL]' }
        'WARN' { '[WARN]' }
        'FIX'  { '[FIX] ' }
        default { '[INFO]' }
    }
    Write-Host "  $prefix " -ForegroundColor $color -NoNewline
    Write-Host "$Label" -NoNewline
    if ($Detail) { Write-Host " — $Detail" -ForegroundColor DarkGray } else { Write-Host '' }
}

# ─── Main ───────────────────────────────────────────────

Write-Host ''
Write-Host '======================================================' -ForegroundColor Cyan
Write-Host '  Thrive RIP2 Repair Script (WS-RIP2)' -ForegroundColor Cyan
if ($Fix) {
    Write-Host '  MODE: FIX (will apply repairs)' -ForegroundColor Magenta
} else {
    Write-Host '  MODE: DIAGNOSTIC ONLY (use -Fix to apply repairs)' -ForegroundColor Yellow
}
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray
Write-Host '======================================================' -ForegroundColor Cyan
Write-Host ''

$issues = 0

# ─── Step 1: Check Thrive/Onyx Services ────────────────

Write-Host '[1] Thrive / Onyx Services' -ForegroundColor Yellow

$servicePatterns = @('*Thrive*', '*Onyx*', '*ONYX*', '*PrintMonitor*')
$foundServices = @()
foreach ($pattern in $servicePatterns) {
    $svcs = Get-Service -Name $pattern -ErrorAction SilentlyContinue
    if ($svcs) { $foundServices += $svcs }
}
# Deduplicate
$foundServices = $foundServices | Sort-Object Name -Unique

if ($foundServices.Count -eq 0) {
    Write-Status 'Service discovery' 'WARN' 'No Thrive/Onyx services found (may run as user process instead)'
    
    # Check for Thrive processes
    $thriveProcs = Get-Process -Name '*Thrive*', '*Onyx*', '*ProductionHouse*' -ErrorAction SilentlyContinue
    if ($thriveProcs) {
        foreach ($proc in $thriveProcs) {
            $uptime = [math]::Round(((Get-Date) - $proc.StartTime).TotalHours, 1)
            Write-Status "Process: $($proc.Name)" 'PASS' "PID $($proc.Id), running ${uptime}h"
        }
    } else {
        Write-Status 'Thrive processes' 'FAIL' 'No Thrive/Onyx processes found — software may not be running'
        $issues++
    }
} else {
    foreach ($svc in $foundServices) {
        if ($svc.Status -eq 'Running') {
            Write-Status "Service: $($svc.DisplayName)" 'PASS' 'Running'
        } elseif ($svc.Status -eq 'Stopped') {
            Write-Status "Service: $($svc.DisplayName)" 'FAIL' 'Stopped'
            $issues++
            if ($Fix) {
                Write-Status "Restarting $($svc.DisplayName)" 'FIX' ''
                try {
                    Start-Service $svc.Name -ErrorAction Stop
                    Start-Sleep -Seconds 3
                    $refreshed = Get-Service $svc.Name
                    if ($refreshed.Status -eq 'Running') {
                        Write-Status "Service: $($svc.DisplayName)" 'PASS' 'Restarted successfully'
                    } else {
                        Write-Status "Service: $($svc.DisplayName)" 'FAIL' "Still $($refreshed.Status) after restart"
                    }
                } catch {
                    Write-Status "Restart failed" 'FAIL' $_.Exception.Message
                }
            }
        } else {
            Write-Status "Service: $($svc.DisplayName)" 'WARN' $svc.Status
            $issues++
        }
    }
}

Write-Host ''

# ─── Step 2: Validate QueueXML.Info Files ──────────────

Write-Host '[2] QueueXML.Info Validation' -ForegroundColor Yellow

# Find the actual local paths — the config above assumes standard install
# Also look under the SMB share roots
$searchRoots = @('C:\Thrive22Input_WS-RIP2', 'D:\Thrive22Input_WS-RIP2')
$foundQueueFiles = @()

foreach ($root in $searchRoots) {
    if (Test-Path $root) {
        $found = Get-ChildItem -Path $root -Recurse -Filter 'QueueXML.Info' -ErrorAction SilentlyContinue
        $foundQueueFiles += $found
    }
}

if ($foundQueueFiles.Count -eq 0) {
    # Fall back to known paths
    Write-Status 'Discovery' 'WARN' 'Could not auto-discover — checking known paths'
    foreach ($qf in $QueueXMLPaths) {
        if (Test-Path $qf) { $foundQueueFiles += Get-Item $qf }
    }
}

if ($foundQueueFiles.Count -eq 0) {
    Write-Status 'QueueXML files' 'FAIL' 'No QueueXML.Info files found — check Thrive installation path'
    $issues++
} else {
    foreach ($file in $foundQueueFiles) {
        $printerName = $file.Directory.Parent.Name
        $ageMins = [math]::Round(((Get-Date) - $file.LastWriteTime).TotalMinutes, 1)
        $sizeKB = [math]::Round($file.Length / 1024, 1)

        # Check for empty files
        if ($file.Length -eq 0) {
            Write-Status "QueueXML ($printerName)" 'FAIL' "Empty (0 bytes), modified ${ageMins}m ago"
            $issues++
            if ($Fix) {
                Write-Status "Deleting empty QueueXML ($printerName)" 'FIX' 'Thrive will regenerate'
                Remove-Item $file.FullName -Force -ErrorAction SilentlyContinue
            }
            continue
        }

        # Check for stale files (> 24 hours old)
        if ($ageMins -gt 1440) {
            Write-Status "QueueXML ($printerName)" 'WARN' "Very stale (${ageMins}m / $([math]::Round($ageMins/60,1))h old) — Thrive may not be updating"
        }

        # Validate XML
        try {
            $content = Get-Content -Path $file.FullName -Raw -ErrorAction Stop
            if (-not $content -or $content.Trim().Length -eq 0) {
                Write-Status "QueueXML ($printerName)" 'FAIL' "Effectively empty"
                $issues++
                if ($Fix) {
                    Write-Status "Deleting corrupt QueueXML ($printerName)" 'FIX' 'Thrive will regenerate'
                    Remove-Item $file.FullName -Force -ErrorAction SilentlyContinue
                }
                continue
            }

            [xml]$parsed = $content
            Write-Status "QueueXML ($printerName)" 'PASS' "${sizeKB}KB, valid XML, modified ${ageMins}m ago"
        } catch {
            Write-Status "QueueXML ($printerName)" 'FAIL' "Malformed XML (${sizeKB}KB): $($_.Exception.Message.Split("`n")[0])"
            $issues++
            if ($Fix) {
                Write-Status "Deleting corrupt QueueXML ($printerName)" 'FIX' 'Thrive will regenerate on next poll'
                Remove-Item $file.FullName -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

Write-Host ''

# ─── Step 3: SMB Shares ────────────────────────────────

Write-Host '[3] SMB Shares' -ForegroundColor Yellow

foreach ($shareName in $SMBShareNames) {
    $share = Get-SmbShare -Name $shareName -ErrorAction SilentlyContinue
    if ($share) {
        Write-Status "Share: $shareName" 'PASS' "Path: $($share.Path)"
    } else {
        Write-Status "Share: $shareName" 'FAIL' 'Share not found — ERP server cannot access queue files'
        $issues++
    }
}

Write-Host ''

# ─── Step 4: Disk Space ────────────────────────────────

Write-Host '[4] Disk Space' -ForegroundColor Yellow

$drives = Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Used -ne $null }
foreach ($drive in $drives) {
    $freeGB = [math]::Round($drive.Free / 1GB, 1)
    $totalGB = [math]::Round(($drive.Used + $drive.Free) / 1GB, 1)
    $pctFree = [math]::Round(($drive.Free / ($drive.Used + $drive.Free)) * 100, 0)

    if ($freeGB -lt $MinDiskSpaceGB) {
        Write-Status "Drive $($drive.Name):" 'FAIL' "${freeGB}GB free of ${totalGB}GB (${pctFree}%) — LOW SPACE can cause corrupt writes"
        $issues++
    } elseif ($freeGB -lt ($MinDiskSpaceGB * 2)) {
        Write-Status "Drive $($drive.Name):" 'WARN' "${freeGB}GB free of ${totalGB}GB (${pctFree}%)"
    } else {
        Write-Status "Drive $($drive.Name):" 'PASS' "${freeGB}GB free of ${totalGB}GB (${pctFree}%)"
    }
}

Write-Host ''

# ─── Step 5: Windows Firewall (SMB) ────────────────────

Write-Host '[5] Windows Firewall — SMB Access' -ForegroundColor Yellow

$smbRules = Get-NetFirewallRule -Direction Inbound -Enabled True -ErrorAction SilentlyContinue |
    Where-Object {
        $portFilter = $_ | Get-NetFirewallPortFilter -ErrorAction SilentlyContinue
        $portFilter.LocalPort -eq 445
    }

if ($smbRules) {
    Write-Status 'SMB (port 445) inbound' 'PASS' "$($smbRules.Count) rule(s) allow inbound SMB"
} else {
    Write-Status 'SMB (port 445) inbound' 'WARN' 'No explicit allow rule found — may be blocked'
    $issues++
}

Write-Host ''

# ─── Step 6: Connectivity to ERP Server ────────────────

Write-Host '[6] Connectivity to ERP Server' -ForegroundColor Yellow

$pingERP = Test-Connection -ComputerName $ERPServerIP -Count 2 -Quiet
if ($pingERP) {
    Write-Status "Ping ERP ($ERPServerIP)" 'PASS'
} else {
    Write-Status "Ping ERP ($ERPServerIP)" 'FAIL' 'Cannot reach ERP server'
    $issues++
}

Write-Host ''

# ─── Summary ───────────────────────────────────────────

Write-Host '======================================================' -ForegroundColor Cyan
if ($issues -eq 0) {
    Write-Host '  RESULT: All checks passed — Thrive RIP2 is healthy' -ForegroundColor Green
} else {
    Write-Host "  RESULT: $issues issue(s) found" -ForegroundColor Red
    if (-not $Fix) {
        Write-Host '  Run with -Fix to apply automatic repairs' -ForegroundColor Yellow
    } else {
        Write-Host '  Fixes applied — rerun without -Fix to verify' -ForegroundColor Magenta
    }
}
Write-Host '======================================================' -ForegroundColor Cyan
Write-Host ''
