# FedEx Credential Finder - Run on WS-FEDEX1
# Searches for database credentials in FedEx config files

$ErrorActionPreference = "Continue"
$OutputFile = "C:\ProgramData\FedEx\FSM\DATABASE\exports\credential_search.txt"

"Credential Search - $(Get-Date)" | Out-File $OutputFile
"=" * 60 | Out-File $OutputFile -Append

# Search common FedEx install locations
$SearchPaths = @(
    "C:\Program Files (x86)\FedEx",
    "C:\Program Files\FedEx",
    "C:\ProgramData\FedEx",
    "C:\FedEx"
)

# Search for config/ini/xml files
foreach ($path in $SearchPaths) {
    if (Test-Path $path) {
        "`n`nSearching: $path" | Out-File $OutputFile -Append
        "-" * 40 | Out-File $OutputFile -Append
        
        $configFiles = Get-ChildItem -Path $path -Recurse -Include *.ini,*.cfg,*.config,*.xml,*.properties,*.conf,*.setting* -ErrorAction SilentlyContinue
        
        foreach ($file in $configFiles) {
            $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
            if ($content -match "password|pwd|uid|user|dba|credential|connection|database" -and $content -notmatch "Binary") {
                "`n>>> $($file.FullName)" | Out-File $OutputFile -Append
                $content | Out-File $OutputFile -Append
            }
        }
    }
}

# Check the existing DSN configuration in registry
"`n`n" + "=" * 60 | Out-File $OutputFile -Append
"ODBC DSN Registry Settings" | Out-File $OutputFile -Append
"=" * 60 | Out-File $OutputFile -Append

# 32-bit DSN (most likely for SQL Anywhere)
$dsnPath32 = "HKLM:\SOFTWARE\WOW6432Node\ODBC\ODBC.INI\shipnet"
if (Test-Path $dsnPath32) {
    "`nDSN 'shipnet' (32-bit) settings:" | Out-File $OutputFile -Append
    Get-ItemProperty -Path $dsnPath32 | Out-File $OutputFile -Append
}

# 64-bit DSN
$dsnPath64 = "HKLM:\SOFTWARE\ODBC\ODBC.INI\shipnet"
if (Test-Path $dsnPath64) {
    "`nDSN 'shipnet' (64-bit) settings:" | Out-File $OutputFile -Append
    Get-ItemProperty -Path $dsnPath64 | Out-File $OutputFile -Append
}

# Check for stored passwords in FedEx user data
"`n`n" + "=" * 60 | Out-File $OutputFile -Append
"FedEx User Data Files" | Out-File $OutputFile -Append
"=" * 60 | Out-File $OutputFile -Append

$userDataPaths = @(
    "C:\Users\*\AppData\Local\FedEx",
    "C:\Users\*\AppData\Roaming\FedEx"
)

foreach ($pattern in $userDataPaths) {
    $paths = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue
    foreach ($path in $paths) {
        "`nUser data at: $($path.FullName)" | Out-File $OutputFile -Append
        Get-ChildItem $path.FullName -Recurse -ErrorAction SilentlyContinue | 
            Where-Object { $_.Extension -in ".ini",".cfg",".config",".xml" } |
            ForEach-Object {
                "  - $($_.Name)" | Out-File $OutputFile -Append
            }
    }
}

# Search for dbisql or other SQL Anywhere utilities that might have saved connections
"`n`n" + "=" * 60 | Out-File $OutputFile -Append
"SQL Anywhere Utilities Found" | Out-File $OutputFile -Append
"=" * 60 | Out-File $OutputFile -Append

Get-ChildItem "C:\Program Files*" -Recurse -Include "dbisql.exe","dbinit.exe","dbsrv*.exe","dbeng*.exe" -ErrorAction SilentlyContinue | 
    ForEach-Object { "  $($_.FullName)" | Out-File $OutputFile -Append }

"`n`nSearch complete. Check: $OutputFile" | Out-File $OutputFile -Append

Write-Host "Search complete. Results saved to:"
Write-Host $OutputFile
Write-Host "`nPress any key..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
