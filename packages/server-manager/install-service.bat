@echo off
REM ERP Server Manager - Install as Windows Startup
REM Run this script as Administrator for full functionality

echo ========================================
echo ERP Server Manager - Installation
echo ========================================
echo.

REM Check if PM2 is installed globally
where pm2 >nul 2>nul
if %errorlevel% neq 0 (
    echo Installing PM2 globally...
    call npm install -g pm2
)

REM Navigate to the server-manager directory
cd /d "%~dp0"

REM Start the servers with PM2
echo Starting ERP servers...
call pm2 start ecosystem.config.js

REM Save the PM2 process list
echo Saving process list...
call pm2 save

REM Create a startup script in the Startup folder
echo Creating Windows startup task...
set STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set STARTUP_SCRIPT=%STARTUP_FOLDER%\ERP-Servers.bat

echo @echo off > "%STARTUP_SCRIPT%"
echo cd /d "%~dp0" >> "%STARTUP_SCRIPT%"
echo call pm2 resurrect >> "%STARTUP_SCRIPT%"

echo.
echo ============================================
echo ERP Servers installed successfully!
echo.
echo The servers will now start automatically
echo when you log into Windows.
echo.
echo For servers to run at the login screen
echo (before logging in), you need to:
echo 1. Run this script as Administrator
echo 2. Set up PM2 as a Windows Service using:
echo    pm2-service-install
echo.
echo Use the Server Manager app to control them.
echo ============================================
echo.
pause
