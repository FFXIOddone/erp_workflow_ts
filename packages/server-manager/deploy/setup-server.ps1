#Requires -RunAsAdministrator
<#
.SYNOPSIS
    ERP Server Setup Script for WS-RACHEL (192.168.254.75)
    Run this ONCE on WS-RACHEL to install all prerequisites.

.DESCRIPTION
    Installs: Node.js 20 LTS, Git, Docker Desktop, pnpm, PM2
    Configures: Firewall, RDP, WinRM, auto-start services
    
.NOTES
    Run as Administrator on WS-RACHEL:
      Right-click PowerShell > Run as Administrator
      Set-ExecutionPolicy Bypass -Scope Process -Force
      .\setup-server.ps1
#>

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'  # Speed up downloads

# --- Configuration ----------------------------------------------------------------
$ERP_ROOT = "C:\ERP"
$ERP_DB_USER = "erp_user"
$ERP_DB_PASS = "erp_password"
$ERP_DB_NAME = "erp_workflow"
$NODE_VERSION = "20.11.1"  # LTS
$PNPM_VERSION = "9"

# --- Helpers ----------------------------------------------------------------------
function Write-Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Write-Done($msg) { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Skip($msg) { Write-Host "  -> $msg (already installed)" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red }

function Test-CommandExists($cmd) {
    $null -ne (Get-Command $cmd -ErrorAction SilentlyContinue)
}

# --- Pre-flight -------------------------------------------------------------------
Write-Host @"

  ============================================================
  Wilde Signs ERP Server Setup
  Target: WS-RACHEL (192.168.254.75)
  ============================================================

"@ -ForegroundColor Magenta

Write-Step "Pre-flight checks"
$hostname = $env:COMPUTERNAME
Write-Host "  Computer: $hostname"
Write-Host "  OS: $((Get-CimInstance Win32_OperatingSystem).Caption)"
Write-Host "  RAM: $([math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)) GB"
Write-Host "  CPU: $((Get-CimInstance Win32_Processor).Name)"

# Create ERP root directory
if (-not (Test-Path $ERP_ROOT)) {
    New-Item -Path $ERP_ROOT -ItemType Directory -Force | Out-Null
    Write-Done "Created $ERP_ROOT"
} else {
    Write-Skip "$ERP_ROOT exists"
}

# Create log directory
$LOG_DIR = "$ERP_ROOT\logs"
if (-not (Test-Path $LOG_DIR)) {
    New-Item -Path $LOG_DIR -ItemType Directory -Force | Out-Null
}

# Start transcript for debugging
Start-Transcript -Path "$LOG_DIR\setup-$(Get-Date -Format 'yyyyMMdd-HHmmss').log" -Force

# --- Step 1: Enable RDP -----------------------------------------------------------
Write-Step "1/8 - Enabling Remote Desktop (RDP)"
try {
    Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server" -Name "fDenyTSConnections" -Value 0 -Force
    Enable-NetFirewallRule -DisplayGroup "Remote Desktop" -ErrorAction SilentlyContinue
    # Also try the name in different locales
    netsh advfirewall firewall set rule group="Remote Desktop" new enable=yes 2>$null
    Write-Done "RDP enabled - you can now connect via Remote Desktop"
} catch {
    Write-Fail "RDP setup failed: $($_.Exception.Message)"
}

# --- Step 2: Enable WinRM ---------------------------------------------------------
Write-Step "2/8 - Enabling WinRM (Remote PowerShell)"
try {
    # Enable WinRM
    Enable-PSRemoting -Force -SkipNetworkProfileCheck -ErrorAction SilentlyContinue
    
    # Allow unencrypted for local network (or configure HTTPS later)
    Set-Item WSMan:\localhost\Client\TrustedHosts -Value "192.168.254.*" -Force -ErrorAction SilentlyContinue
    
    # Ensure WinRM service starts automatically
    Set-Service WinRM -StartupType Automatic
    Start-Service WinRM -ErrorAction SilentlyContinue
    
    Write-Done "WinRM enabled - remote PowerShell access ready"
} catch {
    Write-Fail "WinRM setup had issues: $($_.Exception.Message)"
    Write-Host "  (This is non-critical, RDP will still work)" -ForegroundColor DarkYellow
}

# --- Step 3: Install Git ----------------------------------------------------------
Write-Step "3/8 - Installing Git"
if (Test-CommandExists "git") {
    Write-Skip "Git $(git --version)"
} else {
    Write-Host "  Downloading Git..."
    $gitInstaller = "$env:TEMP\git-installer.exe"
    Invoke-WebRequest -Uri "https://github.com/git-for-windows/git/releases/download/v2.43.0.windows.1/Git-2.43.0-64-bit.exe" -OutFile $gitInstaller
    Write-Host "  Installing Git (silent)..."
    Start-Process -FilePath $gitInstaller -ArgumentList "/VERYSILENT /NORESTART /NOCANCEL /SP- /CLOSEAPPLICATIONS /RESTARTAPPLICATIONS /COMPONENTS=`"icons,ext\reg\shellhere,assoc,assoc_sh`"" -Wait -NoNewWindow
    # Add to PATH for this session
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    Remove-Item $gitInstaller -Force -ErrorAction SilentlyContinue
    Write-Done "Git installed"
}

# --- Step 4: Install Node.js 20 LTS ----------------------------------------------
Write-Step "4/8 - Installing Node.js $NODE_VERSION LTS"
if (Test-CommandExists "node") {
    $currentNode = node --version 2>$null
    Write-Skip "Node.js $currentNode"
} else {
    Write-Host "  Downloading Node.js $NODE_VERSION..."
    $nodeInstaller = "$env:TEMP\node-installer.msi"
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-x64.msi" -OutFile $nodeInstaller
    Write-Host "  Installing Node.js (silent)..."
    Start-Process msiexec.exe -ArgumentList "/i `"$nodeInstaller`" /qn /norestart" -Wait -NoNewWindow
    # Add to PATH for this session
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path += ";C:\Program Files\nodejs"
    Remove-Item $nodeInstaller -Force -ErrorAction SilentlyContinue
    Write-Done "Node.js installed: $(node --version)"
}

# --- Step 5: Install pnpm ---------------------------------------------------------
Write-Step "5/8 - Installing pnpm"
if (Test-CommandExists "pnpm") {
    Write-Skip "pnpm $(pnpm --version)"
} else {
    Write-Host "  Installing pnpm via npm..."
    npm install -g "pnpm@$PNPM_VERSION" 2>&1 | Out-Null
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    Write-Done "pnpm installed: $(pnpm --version)"
}

# --- Step 6: Install Docker Desktop -----------------------------------------------
Write-Step "6/8 - Installing Docker Desktop (for PostgreSQL)"
$dockerRunning = Get-Process "Docker Desktop" -ErrorAction SilentlyContinue
if ($dockerRunning -or (Test-CommandExists "docker")) {
    Write-Skip "Docker Desktop"
} else {
    Write-Host "  Downloading Docker Desktop (this may take a few minutes)..."
    $dockerInstaller = "$env:TEMP\docker-desktop-installer.exe"
    
    # Enable required Windows features first
    Write-Host "  Enabling Hyper-V and WSL2..."
    try {
        Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All -All -NoRestart -ErrorAction SilentlyContinue | Out-Null
    } catch {
        Write-Host "  (Hyper-V may not be available, trying WSL2 backend instead)" -ForegroundColor DarkYellow
    }
    
    try {
        Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -All -NoRestart -ErrorAction SilentlyContinue | Out-Null
        Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -All -NoRestart -ErrorAction SilentlyContinue | Out-Null
    } catch {
        Write-Host "  (WSL2 features may need Windows Update)" -ForegroundColor DarkYellow
    }
    
    Invoke-WebRequest -Uri "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe" -OutFile $dockerInstaller
    Write-Host "  Installing Docker Desktop (silent)..."
    Start-Process -FilePath $dockerInstaller -ArgumentList "install --quiet --accept-license" -Wait -NoNewWindow
    Remove-Item $dockerInstaller -Force -ErrorAction SilentlyContinue
    
    Write-Done "Docker Desktop installed (may need reboot to fully activate)"
    Write-Host "  WARNING: After reboot, Docker Desktop must be started once to complete setup" -ForegroundColor Yellow
}

# --- Step 7: Install PM2 ---------------------------------------------------------
Write-Step "7/8 - Installing PM2 (process manager)"
if (Test-CommandExists "pm2") {
    Write-Skip "PM2 $(pm2 --version)"
} else {
    Write-Host "  Installing PM2 globally..."
    npm install -g pm2 2>&1 | Out-Null
    npm install -g pm2-windows-startup 2>&1 | Out-Null
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    Write-Done "PM2 installed"
}

# --- Step 8: Firewall Rules -------------------------------------------------------
Write-Step "8/8 - Configuring Firewall"

$firewallRules = @(
    @{ Name = "ERP-API"; Port = 8001; Description = "ERP API Server" },
    @{ Name = "ERP-Web"; Port = 5173; Description = "ERP Web Frontend" },
    @{ Name = "ERP-Portal"; Port = 5174; Description = "ERP Customer Portal" },
    @{ Name = "ERP-StationPrinting"; Port = 5180; Description = "Station: Printing" },
    @{ Name = "ERP-StationProduction"; Port = 5181; Description = "Station: Production" },
    @{ Name = "ERP-StationShipping"; Port = 5182; Description = "Station: Shipping" },
    @{ Name = "ERP-StationDesign"; Port = 5183; Description = "Station: Design" },
    @{ Name = "ERP-OrderEntry"; Port = 5184; Description = "Order Entry" },
    @{ Name = "ERP-SlipSort"; Port = 5185; Description = "Slip Sort Frontend" },
    @{ Name = "ERP-SlipSortAPI"; Port = 8000; Description = "Slip Sort API" },
    @{ Name = "ERP-PostgreSQL"; Port = 5432; Description = "PostgreSQL Database" },
    @{ Name = "ERP-pgAdmin"; Port = 5050; Description = "pgAdmin Web UI" }
)

foreach ($rule in $firewallRules) {
    $exists = Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue
    if (-not $exists) {
        New-NetFirewallRule -DisplayName $rule.Name -Direction Inbound -Protocol TCP -LocalPort $rule.Port -Action Allow -Description $rule.Description | Out-Null
        Write-Done "$($rule.Name) (port $($rule.Port))"
    } else {
        Write-Skip "$($rule.Name) (port $($rule.Port))"
    }
}

# --- Create ERP share -------------------------------------------------------------
Write-Step "Creating ERP network share"
$shareName = "ERP"
$existing = Get-SmbShare -Name $shareName -ErrorAction SilentlyContinue
if (-not $existing) {
    New-SmbShare -Name $shareName -Path $ERP_ROOT -FullAccess "Everyone" -Description "Wilde Signs ERP Deployment" | Out-Null
    Write-Done "\\$hostname\ERP share created"
} else {
    Write-Skip "\\$hostname\ERP share exists"
}

# --- Summary ----------------------------------------------------------------------
Stop-Transcript | Out-Null

Write-Host @"

  ============================================================
  Setup Complete!
  ============================================================

  [OK] RDP enabled (port 3389)
  [OK] WinRM enabled (port 5985)
  [OK] Git, Node.js, pnpm, PM2 installed
  [OK] Docker Desktop installed (reboot may be needed)
  [OK] Firewall rules configured
  [OK] ERP share: \\$hostname\ERP

  NEXT STEPS:
  1. Reboot this PC (if Docker was newly installed)
  2. After reboot, open Docker Desktop once
  3. From Jake's PC, run: deploy-to-server.ps1

  RDP Access: mstsc /v:192.168.254.75
  Remote PS:  Enter-PSSession 192.168.254.75

  ============================================================

"@ -ForegroundColor Green

# Check if reboot needed
if (-not $dockerRunning -and -not (Test-CommandExists "docker")) {
    Write-Host "  WARNING: REBOOT REQUIRED to complete Docker installation" -ForegroundColor Yellow
    $restart = Read-Host "  Restart now? (y/n)"
    if ($restart -eq 'y') {
        Restart-Computer -Force
    }
}
