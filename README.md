# Invoice Maker (v0.9 — Windows + macOS)

Offline desktop invoicing app: **Electron** + **React / Vite / TypeScript / Tailwind** + **FastAPI** sidecar + **SQLite / SQLAlchemy 2 / Alembic**.

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
| Windows `.exe` | every push to `main` | **Actions** tab → latest "Build installers" run → **Artifacts** → `InvoiceMaker-Windows` |
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
