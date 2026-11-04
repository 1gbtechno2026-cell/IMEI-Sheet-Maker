# Build FastAPI sidecar with PyInstaller → backend\dist\invoice-maker-backend\
# REQUIRES: Windows + Python 3.11 (py -3.11)
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Backend = Join-Path $Root "backend"
Set-Location $Backend

Write-Host "==> Checking Python 3.11..."
$pyVer = & py -3.11 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
if ($pyVer -ne "3.11") {
  throw "Python 3.11 required for packaging (got $pyVer). Install from python.org and retry."
}

if (-not (Test-Path ".\.venv\Scripts\python.exe")) {
  Write-Host "==> Creating .venv with py -3.11..."
  py -3.11 -m venv .venv
}

$Python = ".\.venv\Scripts\python.exe"
Write-Host "==> Installing runtime + build requirements..."
& $Python -m pip install --upgrade pip
& $Python -m pip install -r requirements-build.txt

Write-Host "==> Cleaning previous PyInstaller output..."
Remove-Item -Recurse -Force ".\build\invoice-maker-backend" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force ".\dist\invoice-maker-backend" -ErrorAction SilentlyContinue

Write-Host "==> Running PyInstaller (onedir)..."
& $Python -m PyInstaller --noconfirm ".\invoice-maker-backend.spec"

$Exe = Join-Path $Backend "dist\invoice-maker-backend\invoice-maker-backend.exe"
if (-not (Test-Path $Exe)) {
  throw "Expected backend exe missing: $Exe"
}

Write-Host ""
Write-Host "Backend build OK:"
Write-Host "  $Exe"
Write-Host "Smoke:  & `"$Exe`" --host 127.0.0.1 --port 8765"
Write-Host "Then:   Invoke-RestMethod http://127.0.0.1:8765/health"
