# Orchestrator: backend (PyInstaller) → frontend+electron → NSIS installer
# REQUIRES: Windows + Node 20+ + Python 3.11
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

Write-Host "========================================"
Write-Host " Invoice Maker — full Windows build"
Write-Host "========================================"

& (Join-Path $PSScriptRoot "build-backend.ps1")
& (Join-Path $PSScriptRoot "build-frontend.ps1")
& (Join-Path $PSScriptRoot "build-installer.ps1")

Write-Host ""
Write-Host "All build steps finished."
