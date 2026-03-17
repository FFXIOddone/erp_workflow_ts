@echo off
REM Setup FedEx Export Scheduled Tasks
REM Run this as Administrator on WS-FEDEX1 (192.168.254.131)

echo Setting up FedEx Shipment Export scheduled tasks...

REM Create the exports folder
mkdir "C:\ProgramData\FedEx\FSM\DATABASE\exports" 2>nul

REM Copy the export script
copy /Y "%~dp0fedex-export.ps1" "C:\ProgramData\FedEx\FSM\DATABASE\fedex-export.ps1"

REM Use 32-bit PowerShell to match the 32-bit ODBC drivers
set PS32=%SystemRoot%\SysWOW64\WindowsPowerShell\v1.0\powershell.exe

REM Create 11 AM task (using 32-bit PowerShell)
schtasks /create /tn "FedEx Export 11AM" /tr "%PS32% -ExecutionPolicy Bypass -File C:\ProgramData\FedEx\FSM\DATABASE\fedex-export.ps1" /sc daily /st 11:00 /ru SYSTEM /f

REM Create 4 PM task  
schtasks /create /tn "FedEx Export 4PM" /tr "%PS32% -ExecutionPolicy Bypass -File C:\ProgramData\FedEx\FSM\DATABASE\fedex-export.ps1" /sc daily /st 16:00 /ru SYSTEM /f

echo.
echo Tasks created:
schtasks /query /tn "FedEx Export 11AM" /fo list | findstr "TaskName Status"
schtasks /query /tn "FedEx Export 4PM" /fo list | findstr "TaskName Status"

echo.
echo Running initial export now (using 32-bit PowerShell for ODBC drivers)...
%PS32% -ExecutionPolicy Bypass -File "C:\ProgramData\FedEx\FSM\DATABASE\fedex-export.ps1"

echo.
echo Done! Exports will be saved to:
echo   \\192.168.254.131\DATABASE\exports\shipments_latest.csv
echo.
pause
