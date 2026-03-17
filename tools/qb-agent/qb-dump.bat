@echo off
title QB Agent - Wilde Signs ERP
echo ============================================
echo   QuickBooks Data Agent - Wilde Signs ERP
echo ============================================
echo.
echo This tool will:
echo   1. Connect to QuickBooks on this machine via ODBC
echo   2. Export invoices, sales orders, and estimates
echo   3. Send the data to the ERP server
echo.

REM Run from the directory where this script lives (e.g., USB drive)
cd /d "%~dp0"

REM Check PowerShell is available
where powershell >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: PowerShell is not available on this machine.
    pause
    exit /b 1
)

REM Run the PowerShell script with execution policy bypass
powershell -ExecutionPolicy Bypass -File "%~dp0qb-dump.ps1"

echo.
pause
