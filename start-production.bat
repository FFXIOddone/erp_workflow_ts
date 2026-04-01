@echo off
title ERP Production Server
echo ============================================
echo   Wilde Signs ERP - Production Mode
echo ============================================
echo.

cd /d "%~dp0"
cd ..\..

:: Create logs directory
if not exist "logs" mkdir logs

:: Install dependencies if this workspace has not been bootstrapped yet
if not exist "node_modules" (
    echo Installing dependencies...
    call pnpm install
    if errorlevel 1 (
        echo ERROR: Dependency install failed.
        pause
        exit /b 1
    )
)

:: Ensure native addons match the active Node runtime before starting PM2
echo Checking native modules...
node packages\server\scripts\ensure-better-sqlite3.mjs
if errorlevel 1 (
    echo ERROR: better-sqlite3 preflight failed for the active Node runtime.
    pause
    exit /b 1
)

:: Check if Docker/PostgreSQL is running
echo Checking PostgreSQL...
docker compose ps --services --filter "status=running" 2>nul | findstr "db" >nul
if errorlevel 1 (
    echo Starting PostgreSQL...
    docker compose up -d
    timeout /t 5 /nobreak >nul
) else (
    echo PostgreSQL is running.
)

:: Generate Prisma client if needed
if not exist "packages\server\node_modules\.prisma" (
    echo Generating Prisma client...
    cd packages\server
    npx prisma generate
    cd ..\..
)

:: Build slip-sort frontend (FastAPI serves it from frontend/dist)
echo.
echo Building slip-sort frontend...
cd packages\slip-sort\frontend
call npm run build
cd ..\..\..

:: Stop any existing PM2 processes
echo.
echo Stopping existing processes...
npx pm2 delete all 2>nul

:: Start production server
echo.
echo Starting ERP Production Server...
npx pm2 start packages\server-manager\ecosystem.production.config.js

echo.
echo ============================================
echo   ERP is running at http://0.0.0.0:8001
echo ============================================
echo.
echo   Main App:     http://localhost:8001/
echo   Portal:       http://localhost:8001/portal
echo   Printing:     http://localhost:8001/printing
echo   Production:   http://localhost:8001/production
echo   Shipping:     http://localhost:8001/shipping
echo   Design:       http://localhost:8001/design
echo   Order Entry:  http://localhost:8001/order-entry
echo   API:          http://localhost:8001/api/v1/
echo.
echo   Slip Sort:    http://localhost:8000
echo.
echo   Logs: npx pm2 logs
echo   Status: npx pm2 status
echo   Stop: npx pm2 stop all
echo.

npx pm2 logs --lines 20
