@echo off
cd /d "%~dp0"

echo === Checking git state ===
git rev-parse --is-inside-work-tree 2>nul
if %errorlevel% neq 0 (
    echo No git repo found, initializing...
    git init -b main
    git remote add origin https://github.com/FFXIOddone/erp_workflow_ts.git
)

echo === Configuring git ===
git config http.postBuffer 524288000

echo === Staging files ===
git add -A

echo === Creating commit ===
git commit -m "Initial commit - Wilde Signs ERP Workflow"

echo === Checking repo size ===
git count-objects -v

echo === Pushing to GitHub ===
git push -u origin main

echo === Done! Exit code: %errorlevel% ===
pause
