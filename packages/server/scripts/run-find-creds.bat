@echo off
REM Find FedEx Database Credentials - searches config files and registry
%SystemRoot%\SysWOW64\WindowsPowerShell\v1.0\powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\ProgramData\FedEx\FSM\DATABASE\find-fedex-creds.ps1"
