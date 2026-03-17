@echo off
title ERP Build All Frontends
echo ============================================
echo   Building All Frontend Apps for Production
echo ============================================
echo.

cd /d "%~dp0"

:: Build shared first
echo [1/8] Building @erp/shared...
cd packages\shared
call npm run build
if errorlevel 1 (
    echo FAILED: @erp/shared
    pause
    exit /b 1
)
cd ..\..
echo   OK
echo.

:: Set production mode for base paths
set NODE_ENV=production

:: Build web
echo [2/8] Building @erp/web...
cd packages\web
call npm run build
cd ..\..
echo   OK
echo.

:: Build portal  
echo [3/8] Building @erp/portal...
cd packages\portal
call npm run build
cd ..\..
echo   OK
echo.

:: Build station-printing
echo [4/8] Building station-printing...
cd packages\station-printing
call npm run build
cd ..\..
echo   OK
echo.

:: Build station-production
echo [5/8] Building station-production...
cd packages\station-production
call npm run build
cd ..\..
echo   OK
echo.

:: Build station-shipping
echo [6/8] Building station-shipping...
cd packages\station-shipping
call npm run build
cd ..\..
echo   OK
echo.

:: Build station-design
echo [7/8] Building station-design...
cd packages\station-design
call npm run build
cd ..\..
echo   OK
echo.

:: Build order-entry
echo [8/8] Building order-entry...
cd packages\order-entry
call npm run build
cd ..\..
echo   OK
echo.

echo ============================================
echo   All builds complete!
echo ============================================
echo.
echo   Run start-production.bat to launch the server.
echo.
pause
