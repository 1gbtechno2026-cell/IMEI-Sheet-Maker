# Apply Alembic migrations (creates %APPDATA%\InvoiceMaker\app.db)
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..\backend")

if (-not (Test-Path ".\.venv\Scripts\python.exe")) {
  Write-Error "Missing backend\.venv. Run scripts\setup-windows.ps1 first."
}

& .\.venv\Scripts\python.exe -m alembic upgrade head
Write-Host "Migrations applied. DB should exist under %APPDATA%\InvoiceMaker\app.db"
