# Start FastAPI sidecar alone on 127.0.0.1:8000 (Windows PowerShell)
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..\backend")

if (-not (Test-Path ".\.venv\Scripts\python.exe")) {
  Write-Error "Missing backend\.venv. Run scripts\setup-windows.ps1 first."
}

& .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
