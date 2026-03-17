# SLIP_SORT Server Startup Script
# Starts both backend (FastAPI) and frontend (Vite) servers

$Host.UI.RawUI.WindowTitle = "SLIP_SORT Server Manager"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   SLIP_SORT Server Manager" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspaceRoot = Split-Path -Parent (Split-Path -Parent $scriptDir)

# Resolve virtual environment (workspace root .venv or local .venv)
$venvActivate = $null
if (Test-Path "$workspaceRoot\.venv\Scripts\Activate.ps1") {
    $venvActivate = "$workspaceRoot\.venv\Scripts\Activate.ps1"
} elseif (Test-Path "$scriptDir\.venv\Scripts\Activate.ps1") {
    $venvActivate = "$scriptDir\.venv\Scripts\Activate.ps1"
}

if (-not $venvActivate) {
    Write-Host "WARNING: No Python .venv found. Backend may fail to start." -ForegroundColor Red
    Write-Host "  Expected at: $workspaceRoot\.venv\" -ForegroundColor Yellow
}

# Kill existing processes on ports
Write-Host "Checking for existing processes..." -ForegroundColor Yellow

$connections = netstat -ano | Select-String "LISTENING"
foreach ($line in $connections) {
    if ($line -match ":8000\s+.*LISTENING\s+(\d+)") {
        $procId = $Matches[1]
        Write-Host "Stopping existing backend (PID: $procId)..." -ForegroundColor Yellow
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
    if ($line -match ":5185\s+.*LISTENING\s+(\d+)") {
        $procId = $Matches[1]
        Write-Host "Stopping existing frontend (PID: $procId)..." -ForegroundColor Yellow
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
}

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "Starting Backend Server (FastAPI on port 8000)..." -ForegroundColor Green

# Start backend in new window
if ($venvActivate) {
    $backendScript = @"
cd '$scriptDir\backend'
& '$venvActivate'
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"@
} else {
    $backendScript = @"
cd '$scriptDir\backend'
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"@
}

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendScript -WorkingDirectory "$scriptDir\backend"

Start-Sleep -Seconds 3

Write-Host "Starting Frontend Server (Vite on port 5185)..." -ForegroundColor Green

# Start frontend in new window
$frontendScript = @"
cd '$scriptDir\frontend'
npm run dev
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendScript -WorkingDirectory "$scriptDir\frontend"

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   Servers Starting..." -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Backend:  " -NoNewline; Write-Host "http://localhost:8000" -ForegroundColor Green
Write-Host "   Frontend: " -NoNewline; Write-Host "http://localhost:5185" -ForegroundColor Green
Write-Host "   API Docs: " -NoNewline; Write-Host "http://localhost:8000/docs" -ForegroundColor Green
Write-Host ""
Write-Host "   Close the terminal windows to stop servers." -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Wait then open browser
Start-Sleep -Seconds 5
Start-Process "http://localhost:5185"

Write-Host "Done! Browser opening..." -ForegroundColor Green
Write-Host ""
Write-Host "Press any key to close this window..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
