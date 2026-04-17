param(
  [Parameter(Mandatory = $true)]
  [string]$RepoRoot
)

$ErrorActionPreference = 'SilentlyContinue'

function Test-CommandLineMatch {
  param(
    [Parameter(Mandatory = $true)]
    [string]$CommandLine,
    [Parameter(Mandatory = $true)]
    [string[]]$Patterns
  )

  foreach ($pattern in $Patterns) {
    if ($CommandLine -match $pattern) {
      return $true
    }
  }

  return $false
}

function Test-DevProcess {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [string]$CommandLine
  )

  $processName = $Name.ToLowerInvariant()

  if (-not $CommandLine) {
    return $false
  }

  switch ($processName) {
    'node.exe' {
      return (Test-CommandLineMatch -CommandLine $CommandLine -Patterns $nodePatterns)
    }
    'cmd.exe' {
      return (Test-CommandLineMatch -CommandLine $CommandLine -Patterns $cmdPatterns)
    }
    'python.exe' {
      return (Test-CommandLineMatch -CommandLine $CommandLine -Patterns $pythonPatterns)
    }
    'npm.cmd' {
      return (Test-CommandLineMatch -CommandLine $CommandLine -Patterns $cmdPatterns)
    }
    'npx.cmd' {
      return (Test-CommandLineMatch -CommandLine $CommandLine -Patterns $cmdPatterns)
    }
    'uvicorn.exe' {
      return (Test-CommandLineMatch -CommandLine $CommandLine -Patterns $pythonPatterns)
    }
    'postgres.exe' {
      return (Test-CommandLineMatch -CommandLine $CommandLine -Patterns $postgresPatterns)
    }
    default {
      return $false
    }
  }
}

$nodePatterns = @(
  'packages\\server-manager',
  'packages\\server\\dev-server\.mjs',
  'packages\\slip-sort',
  'node_modules\\vite',
  'vite\.js',
  'npm run dev:all',
  'npm run dev:server',
  'npm run dev:web',
  'npm run dev:portal',
  'npm run dev:shop-floor',
  'npm run dev:slip-sort',
  'npm run dev:slip-sort:backend',
  'npm run dev:slip-sort:frontend',
  'concurrently',
  'tsx watch src/index\.ts',
  'vite-erp-',
  'uvicorn',
  'slip-sort',
  'better-sqlite3'
)

$cmdPatterns = @(
  'npm run dev:all',
  'npm run dev:server',
  'npm run dev:web',
  'npm run dev:portal',
  'npm run dev:shop-floor',
  'npm run dev:slip-sort',
  'npm run dev:slip-sort:backend',
  'npm run dev:slip-sort:frontend',
  'npm install',
  'npx',
  'concurrently'
)

$pythonPatterns = @(
  'uvicorn',
  'slip-sort',
  'packages\\slip-sort'
)

$postgresPatterns = @(
  'erp_postgres',
  'erp_workflow'
)

$staleProcesses = Get-CimInstance Win32_Process | Where-Object {
  Test-DevProcess -Name $_.Name -CommandLine $_.CommandLine
}

$killedIds = New-Object 'System.Collections.Generic.HashSet[int]'
$killedCount = 0

foreach ($process in $staleProcesses) {
  if ($killedIds.Add([int]$process.ProcessId)) {
    try {
      Stop-Process -Id $process.ProcessId -Force
      $killedCount++
    } catch {
      # Best-effort cleanup. Ignore access-denied or already-exited processes.
    }
  }
}

$staleConhosts = Get-CimInstance Win32_Process | Where-Object {
  $_.Name -ieq 'conhost.exe' -and
  $_.ParentProcessId -and
  $killedIds.Contains([int]$_.ParentProcessId)
}

$conhostCount = 0
foreach ($process in $staleConhosts) {
  try {
    Stop-Process -Id $process.ProcessId -Force
    $conhostCount++
  } catch {
    # Best-effort cleanup.
  }
}

Write-Host ("[cleanup] Stopped {0} ERP-related process(es) and {1} console host(s)." -f $killedCount, $conhostCount)
