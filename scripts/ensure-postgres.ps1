param(
  [Parameter(Mandatory = $true)]
  [string]$RepoRoot,
  [int]$Port = 5432,
  [int]$TimeoutSeconds = 60
)

$ErrorActionPreference = 'SilentlyContinue'

function Test-PostgresPort {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Port
  )

  try {
    return [bool](Test-NetConnection -ComputerName 127.0.0.1 -Port $Port -InformationLevel Quiet)
  } catch {
    return $false
  }
}

if (Test-PostgresPort -Port $Port) {
  Write-Host "[db] PostgreSQL is already reachable on port $Port."
  exit 0
}

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
  Write-Host "[db] PostgreSQL is not reachable on port $Port and Docker is not available."
  exit 1
}

Push-Location $RepoRoot
try {
  Write-Host "[db] Starting PostgreSQL container via docker compose..."
  docker compose up -d postgres | Out-Host
  if ($LASTEXITCODE -ne 0) {
    Write-Host "[db] docker compose failed to start PostgreSQL."
    exit 1
  }
} finally {
  Pop-Location
}

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
while ((Get-Date) -lt $deadline) {
  if (Test-PostgresPort -Port $Port) {
    Write-Host "[db] PostgreSQL is reachable on port $Port."
    exit 0
  }

  Start-Sleep -Seconds 2
}

Write-Host "[db] PostgreSQL did not become reachable on port $Port within $TimeoutSeconds seconds."
exit 1
