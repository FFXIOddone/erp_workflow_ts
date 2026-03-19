# Map Zund 1 (HP USER, blank password)
$z1 = "\\192.168.254.38\Statistics"
net use $z1 /delete /y 2>&1 | Out-Null
cmd /c "net use `"$z1`" /user:`"HP USER`" `"`" /persistent:yes 2>&1"
if (Test-Path "$z1\Statistic.db3") {
    $info = Get-Item "$z1\Statistic.db3"
    Write-Host "[OK] Zund 1 - Statistic.db3 ($([math]::Round($info.Length / 1048576, 2)) MB)" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Zund 1 - DB not accessible" -ForegroundColor Red
}

# Map Zund 2 (User, Wilde1234)
$z2 = "\\192.168.254.28\Statistics"
net use $z2 /delete /y 2>&1 | Out-Null
net use $z2 /user:User Wilde1234 /persistent:yes 2>&1 | Out-Null
if (Test-Path "$z2\Statistic.db3") {
    $info = Get-Item "$z2\Statistic.db3"
    Write-Host "[OK] Zund 2 - Statistic.db3 ($([math]::Round($info.Length / 1048576, 2)) MB)" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Zund 2 - DB not accessible" -ForegroundColor Red
}
