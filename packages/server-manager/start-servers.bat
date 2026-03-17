@echo off
title ERP Servers - Starting...
echo.
echo =============================================
echo   ERP Server Manager - Starting All Servers
echo =============================================
echo.

REM Navigate to the workspace root (two levels up from server-manager)
cd /d "%~dp0\..\.."
echo Working directory: %cd%
echo.

REM Check if npm is available
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: npm is not installed or not in PATH
    pause
    exit /b 1
)

REM Kill any existing processes on our ports
echo [1/9] Cleaning up old processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8001 ^| findstr LISTENING 2^>nul') do taskkill /F /PID %%a >nul 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING 2^>nul') do taskkill /F /PID %%a >nul 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING 2^>nul') do taskkill /F /PID %%a >nul 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5174 ^| findstr LISTENING 2^>nul') do taskkill /F /PID %%a >nul 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5180 ^| findstr LISTENING 2^>nul') do taskkill /F /PID %%a >nul 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5181 ^| findstr LISTENING 2^>nul') do taskkill /F /PID %%a >nul 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5182 ^| findstr LISTENING 2^>nul') do taskkill /F /PID %%a >nul 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5183 ^| findstr LISTENING 2^>nul') do taskkill /F /PID %%a >nul 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5184 ^| findstr LISTENING 2^>nul') do taskkill /F /PID %%a >nul 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5185 ^| findstr LISTENING 2^>nul') do taskkill /F /PID %%a >nul 2>nul
timeout /t 2 /nobreak >nul

REM Clear .vite caches (OneDrive locks these and causes EPERM errors)
echo        Clearing Vite caches...
for %%d in (web portal station-printing station-production station-shipping station-design order-entry slip-sort\frontend) do (
    if exist "packages\%%d\node_modules\.vite" rmdir /s /q "packages\%%d\node_modules\.vite" >nul 2>nul
)
timeout /t 1 /nobreak >nul

REM Start API Server (must start first - all apps depend on it)
echo [2/12] Starting API Server (port 8001)...
start "ERP API Server" cmd /k "cd /d %cd% && call restart-on-crash.bat npm run dev:server"
timeout /t 5 /nobreak >nul

REM Start Web App
echo [3/12] Starting Web App (port 5173)...
start "ERP Web App" cmd /k "cd /d %cd% && call restart-on-crash.bat npm run dev:web"
timeout /t 2 /nobreak >nul

REM Start Customer Portal
echo [4/12] Starting Customer Portal (port 5174)...
start "ERP Portal" cmd /k "cd /d %cd% && call restart-on-crash.bat npm run dev:portal"
timeout /t 2 /nobreak >nul

REM Start Station Apps (Tauri dev servers)
echo [5/12] Starting Station - Printing (port 5180)...
start "ERP Station Printing" cmd /k "cd /d %cd%\packages\station-printing && call ..\..\restart-on-crash.bat npx vite --host 0.0.0.0"
timeout /t 2 /nobreak >nul

echo [6/12] Starting Station - Production (port 5181)...
start "ERP Station Production" cmd /k "cd /d %cd%\packages\station-production && call ..\..\restart-on-crash.bat npx vite --host 0.0.0.0"
timeout /t 2 /nobreak >nul

echo [7/12] Starting Station - Shipping (port 5182)...
start "ERP Station Shipping" cmd /k "cd /d %cd%\packages\station-shipping && call ..\..\restart-on-crash.bat npx vite --host 0.0.0.0"
timeout /t 2 /nobreak >nul

echo [8/12] Starting Station - Design (port 5183)...
start "ERP Station Design" cmd /k "cd /d %cd%\packages\station-design && call ..\..\restart-on-crash.bat npx vite --host 0.0.0.0"
timeout /t 2 /nobreak >nul

echo [9/12] Starting Order Entry (port 5184)...
start "ERP Order Entry" cmd /k "cd /d %cd%\packages\order-entry && call ..\..\restart-on-crash.bat npx vite --host 0.0.0.0"
timeout /t 2 /nobreak >nul

echo [10/12] Starting Slip Sort Backend (port 8000)...
start "Slip Sort Backend" cmd /k "cd /d %cd%\packages\slip-sort\backend && call ..\..\..\restart-on-crash.bat python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
timeout /t 2 /nobreak >nul

echo [11/12] Starting Slip Sort Frontend (port 5185)...
start "Slip Sort Frontend" cmd /k "cd /d %cd%\packages\slip-sort\frontend && call ..\..\..\restart-on-crash.bat npx vite --host 0.0.0.0"

echo.
echo =============================================
echo   All ERP Servers Started!
echo =============================================
echo.
echo   API Server:          http://localhost:8001
echo   Web App:             http://localhost:5173
echo   Customer Portal:     http://localhost:5174
echo   Station - Printing:  http://localhost:5180
echo   Station - Production:http://localhost:5181
echo   Station - Shipping:  http://localhost:5182
echo   Station - Design:    http://localhost:5183
echo   Order Entry:         http://localhost:5184
echo   Slip Sort Backend:   http://localhost:8000
echo   Slip Sort Frontend:  http://localhost:5185
echo.
echo   Each server runs in its own window.
echo   Close those windows to stop individually,
echo   or run stop-servers.bat to stop all.
echo.
pause
