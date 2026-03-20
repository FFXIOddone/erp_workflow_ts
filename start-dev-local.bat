@echo off
title ERP Workflow - All Servers (Single Window)
echo.
echo =============================================
echo   ERP Workflow - Local Development
echo   All servers in ONE window with color labels
echo =============================================
echo.

:: Check if node is available
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    pause
    exit /b 1
)

:: Kill any existing processes on our ports
echo Cleaning up old processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8001 :8000 :5173 :5174 :5180 :5181 :5182 :5183 :5184 :5185 :5186" ^| findstr LISTENING 2^>nul') do taskkill /F /PID %%a >nul 2>nul
timeout /t 2 /nobreak >nul

:: Clear Vite caches (OneDrive locks these and causes EPERM errors)
echo Clearing Vite caches...
for %%d in (web portal station-printing station-production station-shipping station-design order-entry slip-sort\frontend) do (
    if exist "packages\%%d\node_modules\.vite" rmdir /s /q "packages\%%d\node_modules\.vite" >nul 2>nul
)
for %%d in (vite-erp-web vite-erp-portal vite-erp-station-printing vite-erp-station-production vite-erp-station-shipping vite-erp-station-design vite-erp-order-entry vite-erp-slip-sort) do (
    if exist "%TEMP%\%%d" rmdir /s /q "%TEMP%\%%d" >nul 2>nul
)

:: Ensure Zund Statistics shares are mapped (credentials expire after reboot)
echo Mapping Zund Statistics shares...
net use \\192.168.254.28\Statistics /user:User Wilde1234 /persistent:yes >nul 2>nul
:: Zund 1 uses HP USER with Wilde1234
cmd /c "net use ""\\192.168.254.38\ProgramData\Zund\02 Statistic database"" /user:""HP USER"" ""Wilde1234"" /persistent:yes" >nul 2>nul

:: Check if node_modules exists; if not, install deps
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

echo.
:: Activate Python venv for slip-sort backend (uvicorn)
if exist ".venv\Scripts\activate.bat" (
    echo Activating Python venv...
    call .venv\Scripts\activate.bat
)

echo Starting all servers with concurrently...
echo Each server gets a colored prefix label.
echo Press Ctrl+C to stop ALL servers.
echo.
echo =============================================
echo   API Server:                http://localhost:8001
echo   Web App:                   http://localhost:5173
echo   Customer Portal:           http://localhost:5174
echo   Station - Printing:        http://localhost:5180
echo   Station - Production:      http://localhost:5181
echo   Station - Shipping:        http://localhost:5182
echo   Station - Design:          http://localhost:5183
echo   Order Entry:               http://localhost:5184
echo   Shop Floor:                http://localhost:5186
echo   Packing Slip Manager API:  http://localhost:8000
echo   Packing Slip Manager UI:   http://localhost:5185
echo =============================================
echo.

cd /d "%~dp0"
:: Use cmd /c to avoid PowerShell treating stderr (e.g. email warnings) as fatal errors
cmd /c "npm run dev:all 2>&1"
