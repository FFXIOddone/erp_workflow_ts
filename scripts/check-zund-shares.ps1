Write-Host "=== Shares on Zund 2 (.28) ==="
net view \\192.168.254.28

Write-Host ""
Write-Host "=== Shares on Zund 1 (.38) ==="
net view \\192.168.254.38

Write-Host ""
Write-Host "=== Try Statistics share on Zund 2 ==="
$z2stats = Test-Path "\\192.168.254.28\Statistics"
Write-Host "  Statistics share: $z2stats"
$z2prog = Test-Path "\\192.168.254.28\Program Data"
Write-Host "  Program Data share: $z2prog"

Write-Host ""
Write-Host "=== Try shares on Zund 1 ==="
$z1stats = Test-Path "\\192.168.254.38\Statistics"
Write-Host "  Statistics share: $z1stats"
$z1prog = Test-Path "\\192.168.254.38\Program Data"
Write-Host "  Program Data share: $z1prog"
$z1c = Test-Path "\\192.168.254.38\C$"
Write-Host "  C$ admin share: $z1c"

Write-Host ""
Write-Host "=== Check Zund 2 DB path ==="
$z2db = "\\192.168.254.28\Program Data\Zund Cut Center\databases\statistic.org.db3"
if (Test-Path $z2db) {
    $info = Get-Item $z2db
    Write-Host "  FOUND: $([math]::Round($info.Length/1MB,2))MB, modified $($info.LastWriteTime)"
} else {
    Write-Host "  NOT FOUND: $z2db"
    # Try the old path
    $z2old = "\\192.168.254.28\Statistics\Statistic.db3"
    if (Test-Path $z2old) {
        $info = Get-Item $z2old
        Write-Host "  OLD PATH WORKS: $z2old ($([math]::Round($info.Length/1MB,2))MB)"
    }
}

Write-Host ""
Write-Host "=== Check Zund 1 DB path ==="
$z1db = "\\192.168.254.38\Program Data\Zund Cut Center\databases\statistic.org.db3"
if (Test-Path $z1db) {
    $info = Get-Item $z1db
    Write-Host "  FOUND: $([math]::Round($info.Length/1MB,2))MB, modified $($info.LastWriteTime)"
} else {
    Write-Host "  NOT FOUND: $z1db"
}
