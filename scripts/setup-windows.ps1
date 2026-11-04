# Install Node + Python deps for Invoice Maker (Windows PowerShell)
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

Write-Host "==> Installing root npm packages (Electron)..."
npm install

Write-Host "==> Installing frontend npm packages..."
Push-Location frontend; npm install; Pop-Location

Write-Host "==> Creating Python 3.11 venv in backend\..."
Set-Location (Join-Path $Root "backend")

if (-not (Test-Path ".\.venv")) {
  py -3.11 -m venv .venv
}

Write-Host "==> Installing Python requirements..."
& .\.venv\Scripts\python.exe -m pip install --upgrade pip
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt

Write-Host "==> Running Alembic migrations..."
& .\.venv\Scripts\python.exe -m alembic upgrade head

Write-Host ""
Write-Host "Setup complete."
Write-Host "Next:  npm run dev   (Electron + Vite + sidecar)"
Write-Host "Or:    .\scripts\dev-backend.ps1   (API only on :8000)"
