@echo off
REM Enable Remote Desktop - Run as Administrator
REM =============================================

echo Enabling Remote Desktop...
reg add "HKLM\System\CurrentControlSet\Control\Terminal Server" /v fDenyTSConnections /t REG_DWORD /d 0 /f

echo Enabling firewall rule...
netsh advfirewall firewall set rule group="remote desktop" new enable=Yes

echo.
echo Remote Desktop is now enabled!
echo You can connect to this PC using: mstsc /v:%COMPUTERNAME%
echo.
pause
