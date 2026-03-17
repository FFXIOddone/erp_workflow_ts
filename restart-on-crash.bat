@echo off
:: ============================================
:: Auto-Restart Wrapper for ERP Servers
:: Usage: restart-on-crash.bat <command>
:: Example: restart-on-crash.bat npm run dev:server
::
:: Phase 1: Retry up to 5 times with increasing delay
:: Phase 2: If still failing, kill ALL servers and retry once
:: Phase 3: If THAT fails, show error popup and exit
:: ============================================

set CRASH_COUNT=0
set MAX_RETRIES=5
set FULL_RESTART_DONE=0
set SERVICE_CMD=%*

echo.
echo ==========================================
echo   Crash Protection Active
echo   Command: %SERVICE_CMD%
echo   Max retries: %MAX_RETRIES%
echo ==========================================
echo.

:restart
title %SERVICE_CMD%

:: Run the actual command
%SERVICE_CMD%

:: If we get here, the process exited
set EXIT_CODE=%errorlevel%

:: Clean exit (code 0) - just stop, don't auto-restart
if %EXIT_CODE% equ 0 (
    echo.
    echo [%date% %time%] Process exited cleanly (code 0).
    echo Press any key to restart, or close this window.
    pause >nul
    set CRASH_COUNT=0
    set FULL_RESTART_DONE=0
    goto restart
)

:: ---- CRASH DETECTED ----
set /a CRASH_COUNT+=1
echo.
echo [%date% %time%] Process crashed with exit code %EXIT_CODE% (attempt #%CRASH_COUNT% of %MAX_RETRIES%)

:: Phase 1: Retry up to MAX_RETRIES times
if %CRASH_COUNT% lss %MAX_RETRIES% (
    :: Increasing delay: 2s, 4s, 6s, 8s
    set /a DELAY=%CRASH_COUNT% * 2
    title [RETRY #%CRASH_COUNT%/%MAX_RETRIES%] %SERVICE_CMD%
    echo   Retrying in %DELAY% seconds...
    timeout /t %DELAY% /nobreak >nul
    goto restart
)

:: Hit 5 retries - check if we already tried a full restart
if %FULL_RESTART_DONE% equ 1 goto fatal_error

:: Phase 2: Kill all ERP servers and do one clean restart
echo.
echo ==========================================
echo   5 retries failed. Attempting full restart...
echo   Stopping ALL ERP servers first.
echo ==========================================
echo.
title [FULL RESTART] %SERVICE_CMD%

:: Kill all known ERP ports
for %%p in (8001 8000 5173 5174 5180 5181 5182 5183 5184 5185) do (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%%p ^| findstr LISTENING 2^>nul') do (
        taskkill /F /PID %%a >nul 2>nul
    )
)

:: Also stop PM2 if running
npx pm2 stop all >nul 2>nul

echo   All servers stopped. Waiting 5 seconds...
timeout /t 5 /nobreak >nul

:: Reset crash count and mark full restart done
set CRASH_COUNT=0
set FULL_RESTART_DONE=1
echo   Restarting %SERVICE_CMD%...
echo.
goto restart

:fatal_error
:: Phase 3: Nothing worked - show error popup and exit
echo.
echo ==========================================
echo   FATAL: Server could not start
echo   Command: %SERVICE_CMD%
echo   Exit code: %EXIT_CODE%
echo   Tried %MAX_RETRIES% retries + full restart.
echo   Fix the error and try again.
echo ==========================================
echo.
title [FAILED] %SERVICE_CMD%

:: Show a Windows error message box so user notices
mshta "javascript:var sh=new ActiveXObject('WScript.Shell');sh.Popup('Server failed to start after all retries.\n\nCommand: %SERVICE_CMD%\nExit code: %EXIT_CODE%\n\nCheck the console window for errors.',0,'ERP Server Error',16);close();" >nul 2>nul

pause
exit /b 1
