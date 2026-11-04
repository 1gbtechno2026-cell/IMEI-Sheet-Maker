# Seed sample companies + Excel files for Phase 4
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Py = Join-Path $Root "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $Py)) {
  Write-Error "Missing backend\.venv. Run scripts\setup-windows.ps1 first."
}
& $Py (Join-Path $Root "scripts\seed_phase4.py")
