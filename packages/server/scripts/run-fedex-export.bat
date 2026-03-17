@echo off
REM Run FedEx Export Script using 32-bit PowerShell (required for ODBC drivers)
REM Double-click this file on WS-FEDEX1 to run the export

%SystemRoot%\SysWOW64\WindowsPowerShell\v1.0\powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\ProgramData\FedEx\FSM\DATABASE\fedex-export.ps1"
