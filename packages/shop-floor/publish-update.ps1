#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Build and publish a new Shop Floor update to the LAN update server.

.DESCRIPTION
    1. Bumps the version in tauri.conf.json & Cargo.toml
    2. Builds the Tauri app with signing enabled
    3. Copies the installer + signature to the server's uploads/updates/ directory
    4. Publishes the update manifest so clients auto-detect the new version

.PARAMETER Version
    The new version number (e.g., "1.1.0"). If omitted, bumps the patch number.

.PARAMETER ServerUrl
    The ERP server URL (default: http://192.168.1.100:8001)

.PARAMETER Notes
    Release notes for this update.

.EXAMPLE
    .\publish-update.ps1 -Version "1.1.0" -Notes "Bug fixes and performance improvements"
#>

param(
    [string]$Version,
    [string]$ServerUrl = "http://192.168.254.75:8001",
    [string]$Notes = "Shop Floor update",
    [string]$Password = "wildeupdater"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path "$PSScriptRoot\..\.."
$ShopFloorDir = Join-Path $ProjectRoot "packages\shop-floor"
$TauriConf = Join-Path $ShopFloorDir "src-tauri\tauri.conf.json"
$CargoToml = Join-Path $ShopFloorDir "src-tauri\Cargo.toml"
$PrivateKeyPath = Join-Path $ShopFloorDir "src-tauri\keys\update.key"
$UpdatesDir = Join-Path $ProjectRoot "packages\server\uploads\updates"

# ── Step 1: Determine version ──

if (-not $Version) {
    $conf = Get-Content $TauriConf | ConvertFrom-Json
    $parts = $conf.version.Split(".")
    $parts[2] = [int]$parts[2] + 1
    $Version = $parts -join "."
}

Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Publishing Shop Floor v$Version          ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Cyan

# ── Step 2: Update version in config files ──

Write-Host "`n[1/5] Updating version to $Version..." -ForegroundColor Yellow

# Update tauri.conf.json
$confRaw = Get-Content $TauriConf -Raw
$confRaw = $confRaw -replace '"version":\s*"[^"]*"', "`"version`": `"$Version`""
Set-Content $TauriConf $confRaw -NoNewline

Write-Host "  ✓ tauri.conf.json" -ForegroundColor Green

# ── Step 3: Build with signing ──

Write-Host "`n[2/5] Building Tauri app (release mode)..." -ForegroundColor Yellow

$env:TAURI_SIGNING_PRIVATE_KEY_PATH = $PrivateKeyPath
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $Password

Push-Location $ShopFloorDir
try {
    npx tauri build 2>&1 | ForEach-Object {
        if ($_ -match "error|Error") {
            Write-Host "  ✗ $_" -ForegroundColor Red
        } elseif ($_ -match "Finished|Built|bundle") {
            Write-Host "  ✓ $_" -ForegroundColor Green
        }
    }
} finally {
    Pop-Location
}

$BundleDir = Join-Path $ProjectRoot "target\release\bundle"

# ── Step 4: Copy artifacts to updates directory ──

Write-Host "`n[3/5] Copying artifacts to updates directory..." -ForegroundColor Yellow

if (-not (Test-Path $UpdatesDir)) {
    New-Item -ItemType Directory -Path $UpdatesDir -Force | Out-Null
}

# Find the built MSI and NSIS installer
$msi   = Get-ChildItem "$BundleDir\msi\*.msi" -ErrorAction SilentlyContinue | Select-Object -First 1
$nsis  = Get-ChildItem "$BundleDir\nsis\*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
$msiSig  = Get-ChildItem "$BundleDir\msi\*.msi.sig" -ErrorAction SilentlyContinue | Select-Object -First 1
$nsisSig = Get-ChildItem "$BundleDir\nsis\*.exe.sig" -ErrorAction SilentlyContinue | Select-Object -First 1

if ($nsis) {
    Copy-Item $nsis.FullName  (Join-Path $UpdatesDir "shop-floor-$Version-x64-setup.exe") -Force
    Write-Host "  ✓ Copied NSIS installer ($([math]::Round($nsis.Length/1MB,1)) MB)" -ForegroundColor Green
}
if ($nsisSig) {
    Copy-Item $nsisSig.FullName (Join-Path $UpdatesDir "shop-floor-$Version-x64-setup.exe.sig") -Force
    Write-Host "  ✓ Copied NSIS signature" -ForegroundColor Green
}
if ($msi) {
    Copy-Item $msi.FullName   (Join-Path $UpdatesDir "shop-floor-$Version-x64.msi") -Force
    Write-Host "  ✓ Copied MSI installer ($([math]::Round($msi.Length/1MB,1)) MB)" -ForegroundColor Green
}
if ($msiSig) {
    Copy-Item $msiSig.FullName (Join-Path $UpdatesDir "shop-floor-$Version-x64.msi.sig") -Force
    Write-Host "  ✓ Copied MSI signature" -ForegroundColor Green
}

# ── Step 5: Publish update manifest ──

Write-Host "`n[4/5] Publishing update manifest..." -ForegroundColor Yellow

# Read signatures
$msiSigContent  = if ($msiSig)  { Get-Content $msiSig.FullName -Raw } else { "" }
$nsisSigContent = if ($nsisSig) { Get-Content $nsisSig.FullName -Raw } else { "" }

# Build the manifest
# The updater needs the NSIS installer for Windows (it's the auto-update format)
$sigToUse = if ($nsisSig) { $nsisSigContent.Trim() } else { $msiSigContent.Trim() }
$urlToUse = if ($nsis)   { "$ServerUrl/api/v1/updates/download/shop-floor-$Version-x64-setup.exe" } else { "$ServerUrl/api/v1/updates/download/shop-floor-$Version-x64.msi" }

$manifest = @{
    version   = $Version
    notes     = $Notes
    pub_date  = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    platforms = @{
        "windows-x86_64" = @{
            signature = $sigToUse
            url       = $urlToUse
        }
    }
} | ConvertTo-Json -Depth 5

# Write manifest locally
Set-Content (Join-Path $UpdatesDir "latest.json") $manifest
Set-Content (Join-Path $UpdatesDir "$Version.json") $manifest

Write-Host "  ✓ Manifest written to uploads/updates/latest.json" -ForegroundColor Green

# Also POST to the API (in case server is on a different machine)
try {
    $response = Invoke-WebRequest -Uri "$ServerUrl/api/v1/updates/publish" `
        -Method POST `
        -ContentType "application/json" `
        -Body $manifest `
        -ErrorAction SilentlyContinue
    Write-Host "  ✓ Published to $ServerUrl" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ Could not reach $ServerUrl — manifest saved locally" -ForegroundColor Yellow
}

# ── Summary ──

Write-Host "`n[5/5] Done!" -ForegroundColor Green
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Shop Floor v$Version published successfully!            ║" -ForegroundColor Cyan
Write-Host "╟──────────────────────────────────────────────────────────╢" -ForegroundColor Cyan
if ($nsis) {
    Write-Host "║  NSIS: shop-floor-$Version-x64-setup.exe" -ForegroundColor White
}
if ($msi) {
    Write-Host "║  MSI:  shop-floor-$Version-x64.msi" -ForegroundColor White
}
Write-Host "║  Files: uploads/updates/" -ForegroundColor White
Write-Host "║" -ForegroundColor Cyan
Write-Host "║  Clients will auto-detect the update on next check." -ForegroundColor White
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
