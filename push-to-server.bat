@echo off
REM Quick deploy from Jake's PC to WS-RACHEL
REM Just double-click this file to push updates

echo.
echo   Deploying ERP updates to WS-RACHEL (192.168.254.32)...
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0packages\server-manager\deploy\update-server.ps1"

echo.
pause
