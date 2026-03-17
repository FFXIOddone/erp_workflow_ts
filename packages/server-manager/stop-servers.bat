@echo off
title ERP Servers - Stopping...
echo.
echo =============================================
echo   ERP Server Manager - Stopping All Servers
echo =============================================
echo.

REM Kill processes on ERP ports
echo Stopping API Server (port 8001)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8001 ^| findstr LISTENING 2^>nul') do (
    echo   Killing PID %%a
    taskkill /F /PID %%a >nul 2>nul
)

echo Stopping Web App (port 5173)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING 2^>nul') do (
    echo   Killing PID %%a
    taskkill /F /PID %%a >nul 2>nul
)

echo Stopping Customer Portal (port 5174)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5174 ^| findstr LISTENING 2^>nul') do (
    echo   Killing PID %%a
    taskkill /F /PID %%a >nul 2>nul
)

echo Stopping Station - Printing (port 5180)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5180 ^| findstr LISTENING 2^>nul') do (
    echo   Killing PID %%a
    taskkill /F /PID %%a >nul 2>nul
)

echo Stopping Station - Production (port 5181)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5181 ^| findstr LISTENING 2^>nul') do (
    echo   Killing PID %%a
    taskkill /F /PID %%a >nul 2>nul
)

echo Stopping Station - Shipping (port 5182)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5182 ^| findstr LISTENING 2^>nul') do (
    echo   Killing PID %%a
    taskkill /F /PID %%a >nul 2>nul
)

echo Stopping Station - Design (port 5183)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5183 ^| findstr LISTENING 2^>nul') do (
    echo   Killing PID %%a
    taskkill /F /PID %%a >nul 2>nul
)

echo Stopping Order Entry (port 5184)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5184 ^| findstr LISTENING 2^>nul') do (
    echo   Killing PID %%a
    taskkill /F /PID %%a >nul 2>nul
)

echo Stopping Slip Sort Backend (port 8000)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING 2^>nul') do (
    echo   Killing PID %%a
    taskkill /F /PID %%a >nul 2>nul
)

echo Stopping Slip Sort Frontend (port 5185)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5185 ^| findstr LISTENING 2^>nul') do (
    echo   Killing PID %%a
    taskkill /F /PID %%a >nul 2>nul
)

REM Also close any cmd windows with our titles
taskkill /FI "WINDOWTITLE eq ERP API Server*" >nul 2>nul
taskkill /FI "WINDOWTITLE eq ERP Web App*" >nul 2>nul
taskkill /FI "WINDOWTITLE eq ERP Portal*" >nul 2>nul
taskkill /FI "WINDOWTITLE eq ERP Station Printing*" >nul 2>nul
taskkill /FI "WINDOWTITLE eq ERP Station Production*" >nul 2>nul
taskkill /FI "WINDOWTITLE eq ERP Station Shipping*" >nul 2>nul
taskkill /FI "WINDOWTITLE eq ERP Station Design*" >nul 2>nul
taskkill /FI "WINDOWTITLE eq ERP Order Entry*" >nul 2>nul
taskkill /FI "WINDOWTITLE eq Slip Sort Backend*" >nul 2>nul
taskkill /FI "WINDOWTITLE eq Slip Sort Frontend*" >nul 2>nul

echo.
echo =============================================
echo   All ERP Servers Stopped
echo =============================================
echo.
pause
