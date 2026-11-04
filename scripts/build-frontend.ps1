# Production Vite build → frontend\dist\
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

Write-Host "==> Installing frontend deps (if needed)..."
if (-not (Test-Path ".\frontend\node_modules")) {
  npm install --prefix frontend
}

Write-Host "==> Building Electron main (TypeScript)..."
npm run build:electron

Write-Host "==> Building frontend (tsc + vite)..."
npm run build:frontend

$Index = Join-Path $Root "frontend\dist\index.html"
if (-not (Test-Path $Index)) {
  throw "Frontend build missing: $Index"
}

Write-Host ""
Write-Host "Frontend + electron build OK:"
Write-Host "  $Index"
Write-Host "  $(Join-Path $Root 'dist-electron\main.js')"
