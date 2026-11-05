# IMEI Data Maker — Windows Setup

Step-by-step guide to set up, run and build IMEI Data Maker on Windows 10/11 (x64).

← Back to [README.md](README.md) · macOS guide: [README-macOS.md](README-macOS.md)

---

## 1. Install prerequisites

Install these (accept defaults unless noted):

| Tool | Download | Notes |
|------|----------|-------|
| Node.js 20+ (LTS) | <https://nodejs.org> | Includes `npm` |
| Python **3.11** | <https://www.python.org/downloads/windows/> | Tick **"Add python.exe to PATH"** and keep the **py launcher** option enabled |
| Git | <https://git-scm.com/download/win> | Defaults are fine |

Or with `winget` (PowerShell):

```powershell
winget install OpenJS.NodeJS.LTS
winget install Python.Python.3.11
winget install Git.Git
```

Close and reopen PowerShell, then verify:

```powershell
node -v          # v20 or newer
py -3.11 -V      # Python 3.11.x
git --version
```

## 2. Allow PowerShell scripts (one time)

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Answer **Y**. (Without this, `.ps1` scripts are blocked.)

## 3. Get the code

```powershell
cd $HOME\Desktop
git clone <repo-url> invoice-maker
cd invoice-maker
```

## 4. One-time setup

```powershell
.\scripts\setup-windows.ps1
```

This script:

1. Runs `npm install` (root Electron deps + `frontend\`)
2. Creates `backend\.venv` with `py -3.11`
3. Installs `backend\requirements.txt`
4. Runs Alembic migrations → creates `%APPDATA%\InvoiceMaker\app.db`

## 5. Run in development

```powershell
npm run dev
```

Opens the Electron window with Vite hot-reload (port `5174`). The FastAPI sidecar is started automatically on a free local port.

Log in with **admin / admin** — you'll be asked to change the password.

### Other dev commands

| Task | Command |
|------|---------|
| API only on `http://127.0.0.1:8000` | `.\scripts\dev-backend.ps1` |
| Web UI only (browser) | `npm run dev:web` |
| Apply DB migrations | `.\scripts\migrate.ps1` (or `npm run migrate`) |
| Seed sample companies + Excel | `.\scripts\seed-phase4.ps1` |
| API docs (when backend running) | <http://127.0.0.1:8000/docs> |

## 6. Build the Windows installer (.exe)

Must be run **on Windows** with Python 3.11.

```powershell
.\scripts\build-all.ps1
```

Steps performed (each can also be run alone):

| Step | Script | Output |
|------|--------|--------|
| 1. Bundle backend (PyInstaller) | `.\scripts\build-backend.ps1` | `backend\dist\invoice-maker-backend\invoice-maker-backend.exe` |
| 2. Build Electron + frontend | `.\scripts\build-frontend.ps1` | `dist-electron\`, `frontend\dist\` |
| 3. Create NSIS installer | `.\scripts\build-installer.ps1` | `release\IMEIDataMaker-Setup-<version>-x64.exe` |

## 7. Install & first launch

1. Run `release\IMEIDataMaker-Setup-<version>-x64.exe`.
2. The installer is unsigned, so SmartScreen may warn: click **More info → Run anyway**.
3. Choose an install folder; Desktop and Start Menu shortcuts are created.

## Data location

```
%APPDATA%\InvoiceMaker\
```

Open it: press **Win + R**, type `%APPDATA%\InvoiceMaker`, press Enter.

Uninstalling or upgrading does **not** remove this folder. After **Settings → Restore**, close and reopen the app.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `running scripts is disabled on this system` | Step 2 above, or run once with `powershell -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1` |
| `py` is not recognized | Reinstall Python 3.11 with the **py launcher** option enabled |
| `Python 3.11 required for packaging` | Install 3.11 alongside other versions; `py -0` lists installed versions |
| `Missing backend\.venv` | Re-run `.\scripts\setup-windows.ps1` |
| Antivirus quarantines `invoice-maker-backend.exe` | Add an exclusion for the project's `backend\dist` folder (common false positive with PyInstaller) |
| `EPERM` / file locked during build | Close the running app and any Explorer windows on `release\`, then retry |
| Port 5174 already in use | `netstat -ano \| findstr :5174` then `taskkill /PID <PID> /F` |
| Start over with a clean DB | Close app, then `Remove-Item -Recurse "$env:APPDATA\InvoiceMaker"` (**deletes all data**) |
