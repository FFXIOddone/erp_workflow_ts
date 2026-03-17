@echo off
title ERP Workflow - Development Servers
echo.
echo ========================================
echo   ERP Workflow - Starting All Servers
echo ========================================
echo.

:: Check if node is available
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    pause
    exit /b 1
)

:: Kill any existing processes on our ports
echo [1/4] Cleaning up old processes...
taskkill /F /IM ngrok.exe >nul 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8001 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>nul
timeout /t 2 /nobreak >nul

:: Start API Server
echo [2/4] Starting API Server (port 8001)...
start "ERP API Server" cmd /k "cd /d %~dp0 && npm run dev:server"
timeout /t 5 /nobreak >nul

:: Start Web Dev Server
echo [3/4] Starting Web Dev Server (port 5173)...
start "ERP Web Server" cmd /k "cd /d %~dp0\packages\web && npm run dev"
timeout /t 3 /nobreak >nul

:: Start ngrok tunnel
echo [4/4] Starting ngrok tunnel for mobile access...
start "ngrok Tunnel" cmd /k "ngrok http 5173"
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo   All servers started!
echo ========================================
echo.
echo   Local Access:
echo     Web App:  http://localhost:5173
echo     API:      http://localhost:8001
echo.
echo   Mobile Access:
echo     Check the ngrok window for your public URL
echo     (looks like https://xxxxx.ngrok-free.dev)
echo.
echo   To stop all servers, close this window and
echo   the other terminal windows that opened.
echo.
echo ========================================
pause
