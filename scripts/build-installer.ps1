# Build Windows NSIS installer with electron-builder.
# Prerequisites: run build-backend.ps1 and build-frontend.ps1 first (or use build-all.ps1).
# REQUIRES: Windows (NSIS target). Does NOT wipe %APPDATA%\InvoiceMaker on install/upgrade.
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

$BackendExe = Join-Path $Root "backend\dist\invoice-maker-backend\invoice-maker-backend.exe"
$FrontendIndex = Join-Path $Root "frontend\dist\index.html"
$ElectronMain = Join-Path $Root "dist-electron\main.js"

if (-not (Test-Path $BackendExe)) {
  throw "Missing backend exe. Run .\scripts\build-backend.ps1 first.`n  Expected: $BackendExe"
}
if (-not (Test-Path $FrontendIndex)) {
  throw "Missing frontend dist. Run .\scripts\build-frontend.ps1 first.`n  Expected: $FrontendIndex"
}
if (-not (Test-Path $ElectronMain)) {
  throw "Missing Electron main. Run .\scripts\build-frontend.ps1 (includes build:electron)."
}

Write-Host "==> Ensuring electron-builder is installed..."
npm install

Write-Host "==> electron-builder --win nsis..."
npx electron-builder --win nsis --config electron-builder.yml

Write-Host ""
Write-Host "Installer output under: $(Join-Path $Root 'release')"
Get-ChildItem (Join-Path $Root "release") -Filter "*.exe" | ForEach-Object { Write-Host "  $($_.FullName)" }
Write-Host ""
Write-Host "NOTE: Installer/upgrade does NOT touch %APPDATA%\InvoiceMaker (db, backups, signatures)."
Write-Host "After Settings → Restore DB, restart the app so the API reloads connections."
