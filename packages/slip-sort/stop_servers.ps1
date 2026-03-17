# SLIP_SORT Server Stop Script
# Stops both backend and frontend servers

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   Stopping SLIP_SORT Servers" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

$connections = netstat -ano | Select-String "LISTENING"

# Kill backend on port 8000
Write-Host "Checking for backend on port 8000..." -ForegroundColor Yellow
foreach ($line in $connections) {
    if ($line -match ":8000\s+.*LISTENING\s+(\d+)") {
        $procId = $Matches[1]
        Write-Host "Stopping backend (PID: $procId)..." -ForegroundColor Yellow
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
}

# Kill frontend on port 5185
Write-Host "Checking for frontend on port 5185..." -ForegroundColor Yellow
foreach ($line in $connections) {
    if ($line -match ":5185\s+.*LISTENING\s+(\d+)") {
        $procId = $Matches[1]
        Write-Host "Stopping frontend (PID: $procId)..." -ForegroundColor Yellow
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host "Servers stopped!" -ForegroundColor Green
Write-Host ""
Write-Host "Press any key to close..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
