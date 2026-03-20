# WS-RACHEL ERP Server Deployment Guide

## Overview
Dedicated ERP server running on **WS-RACHEL** (192.168.254.75) — a repurposed Windows PC on the Wilde Signs network.

## One-Time Setup (requires physical access or local login)

### Step 1: Run Setup Script on WS-RACHEL
1. Temporarily connect a monitor + keyboard to WS-RACHEL
2. Log in with a local admin account
3. Open PowerShell as Administrator
4. Run:
```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
\\192.168.254.75\C$\Users\Jake\OneDrive` -` Wilde` Signs\Desktop\Scripts\erp_workflow_ts\packages\server-manager\deploy\setup-server.ps1
```
Or copy from USB:
```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
D:\setup-server.ps1
```

This installs: Git, Node.js 20, pnpm, Docker Desktop, PM2  
Enables: RDP, WinRM, firewall rules  
Creates: `C:\ERP\` directory, `\\WS-RACHEL\ERP` network share

### Step 2: Reboot (if Docker was newly installed)
```powershell
Restart-Computer
```

### Step 3: After reboot, start Docker Desktop
- Log in, open Docker Desktop from Start Menu
- Wait for it to finish starting (whale icon in system tray)

### Step 4: Deploy from Jake's PC
```powershell
cd "C:\Users\Jake\OneDrive - Wilde Signs\Desktop\Scripts\erp_workflow_ts"
.\packages\server-manager\deploy\deploy-to-server.ps1
```
Or double-click `push-to-server.bat`

## Day-to-Day Usage

### Push Code Updates
From Jake's PC:
```powershell
# Full sync + restart
.\packages\server-manager\deploy\update-server.ps1

# Restart backend only (e.g. after API changes)
.\packages\server-manager\deploy\update-server.ps1 -Backend

# Just restart services (no file sync)
.\packages\server-manager\deploy\update-server.ps1 -RestartOnly
```
Or double-click `push-to-server.bat` for quick updates.

### Remote Access
```powershell
# RDP (graphical)
mstsc /v:192.168.254.75

# PowerShell (command line)
Enter-PSSession 192.168.254.75

# Quick command
Invoke-Command -ComputerName 192.168.254.75 -ScriptBlock { pm2 list }
```

### Check Status
```powershell
# From Jake's PC
Invoke-Command -ComputerName 192.168.254.75 -ScriptBlock { pm2 list }
Invoke-Command -ComputerName 192.168.254.75 -ScriptBlock { pm2 logs --lines 20 }
```

### Access ERP (from any PC on the network)
| Service | URL |
|---------|-----|
| Web App | http://192.168.254.75:5173 |
| API | http://192.168.254.75:8001 |
| Portal | http://192.168.254.75:5174 |
| pgAdmin | http://192.168.254.75:5050 |
| Station: Printing | http://192.168.254.75:5180 |
| Station: Production | http://192.168.254.75:5181 |
| Station: Shipping | http://192.168.254.75:5182 |
| Station: Design | http://192.168.254.75:5183 |
| Order Entry | http://192.168.254.75:5184 |

### Login
- **ERP**: admin / admin123
- **pgAdmin**: admin@wildesigns.local / admin123

## Architecture

```
Jake's PC (WILDESIGNS-JAKE, .75)
  └─ Development, code editing
  └─ push-to-server.bat → syncs to WS-RACHEL

WS-RACHEL (.32) - Dedicated Server
  ├─ Docker → PostgreSQL (port 5432)
  ├─ PM2 → erp-backend (port 8001)
  ├─ PM2 → erp-frontend (port 5173)
  ├─ PM2 → erp-portal (port 5174)
  ├─ PM2 → station-printing (5180)
  ├─ PM2 → station-production (5181)
  ├─ PM2 → station-shipping (5182)
  ├─ PM2 → station-design (5183)
  ├─ PM2 → order-entry (5184)
  └─ PM2 → slip-sort (8000 + 5185)
```

## Troubleshooting

### ERP not loading?
```powershell
# Check PM2 status
Invoke-Command -ComputerName 192.168.254.75 -ScriptBlock { pm2 list }

# Check logs
Invoke-Command -ComputerName 192.168.254.75 -ScriptBlock { pm2 logs erp-backend --lines 50 }

# Restart everything
Invoke-Command -ComputerName 192.168.254.75 -ScriptBlock { pm2 reload all }
```

### Database connection issues?
```powershell
Invoke-Command -ComputerName 192.168.254.75 -ScriptBlock { docker ps }
# If erp_postgres is not running:
Invoke-Command -ComputerName 192.168.254.75 -ScriptBlock { 
    cd C:\ERP\erp_workflow_ts
    docker-compose up -d 
}
```

### After power outage or unexpected shutdown?
PM2 and Docker are configured to auto-start, but Docker Desktop may need a manual start on first boot. RDP in and start Docker Desktop, then:
```powershell
pm2 resurrect
```

### WS-RACHEL is unreachable?
1. Check physical connectivity (network cable, power)
2. Ping: `ping 192.168.254.75`
3. If down, walk over and check the PC is powered on
