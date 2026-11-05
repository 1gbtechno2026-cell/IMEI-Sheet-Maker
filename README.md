# IMEI Data Maker (v0.9 — Windows + macOS)

Offline desktop app for IMEI data sheets: **Electron** + **React / Vite / TypeScript / Tailwind** + **FastAPI** sidecar + **SQLite / SQLAlchemy 2 / Alembic**.

## How an IMEI sheet is made

1. **Seller & buyer**, then **invoice number & date**.
2. **Generate the data template**: enter each model, its quantity and units per box (plus country of origin for International). The Excel has the summary at the top and one column per model below it, with box numbers already filled in.
3. **Fill in only the IMEIs** (yellow cells) in Excel, e.g. with a barcode gun.
4. **Upload the filled sheet**. Each model must have exactly the quantity in its summary; IMEIs are checked (15 digits, check digit, no duplicates, not on another invoice). Or use **Create by scanning** to scan straight into the app.
5. **Create Excel & PDF**. Both carry the per-model summary. Edits are made from History → Edit (download current data, change it, upload), and every change is listed in the invoice's edit history.

Light and dark themes are switched at the bottom of the sidebar.

One shared codebase for both platforms. Each platform's installer must be built **on that platform** (PyInstaller cannot cross-compile).

## Setup guides

| Platform | Guide | Output |
|----------|-------|--------|
| macOS | **[README-macOS.md](README-macOS.md)** | `.dmg` + `.zip` |
| Windows | **[README-Windows.md](README-Windows.md)** | NSIS `Setup.exe` |

## Download the app (no setup needed)

GitHub builds the installers automatically (`.github/workflows/build.yml`):

| What | When | Where to download |
|------|------|-------------------|
| Windows `.exe` | every push to `main` | **Actions** tab → latest "Build installers" run → **Artifacts** → `IMEIDataMaker-Windows` |
| Windows `.exe` + macOS `.dmg` | push a tag, e.g. `git tag v0.9.1 && git push origin v0.9.1` | **Releases** page |
| Both | **Actions** → "Build installers" → **Run workflow** | Artifacts of that run |

## Quick start (development)

```bash
# macOS
git clone <repo-url> invoice-maker && cd invoice-maker
./scripts/setup-macos.sh
npm run dev
```

```powershell
# Windows (PowerShell)
git clone <repo-url> invoice-maker; cd invoice-maker
.\scripts\setup-windows.ps1
npm run dev
```

## Project layout

```
electron/      main.ts, preload.ts — spawns the FastAPI sidecar, IPC
frontend/      React + Vite + Tailwind UI
backend/       FastAPI app, Alembic migrations, sidecar.py, PyInstaller .spec
scripts/       setup / dev / build scripts (.sh for macOS, .ps1 for Windows)
sample-data/   sample Excel files for import testing
release/       installer output (gitignored)
```

## Requirements

| Tool | Version |
|------|---------|
| Node.js | 20+ |
| Python | 3.11 (required for packaging) |
| Git | any recent |

## App data directory

The database, JWT secret, backups and signatures live **outside** the repo:

| OS | Path |
|----|------|
| Windows | `%APPDATA%\InvoiceMaker\` |
| macOS | `~/Library/Application Support/InvoiceMaker/` |
| Linux | `~/.local/share/InvoiceMaker/` (or `$XDG_DATA_HOME/InvoiceMaker`) |

Override with `INVOICE_MAKER_DATA_DIR=/custom/path`.
Install/upgrade **never** deletes app data. After **Settings → Restore**, restart the app.

## Default login

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `admin` (you are forced to change it on first login) |

## Common npm scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Electron + Vite dev server (sidecar starts automatically) |
| `npm run dev:backend:posix` / `npm run dev:backend` | API only on `:8000` (macOS / Windows) |
| `npm run migrate:posix` / `npm run migrate` | Alembic `upgrade head` (macOS / Windows) |
| `npm run build:macos` | Full macOS build → `release/` |
| `npm run build:all:win` | Full Windows build → `release\` |
