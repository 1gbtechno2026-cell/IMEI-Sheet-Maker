# IMEI Data Maker — macOS Setup

Step-by-step guide to set up, run and build IMEI Data Maker on a Mac (Apple Silicon or Intel).

← Back to [README.md](README.md) · Windows guide: [README-Windows.md](README-Windows.md)

---

## 1. Install prerequisites

Install [Homebrew](https://brew.sh) if you don't have it:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Then install Node, Python 3.11 and Git:

```bash
brew install node python@3.11 git
```

Verify:

```bash
node -v          # v20 or newer
python3.11 -V    # Python 3.11.x
git --version
```

> Python **3.11** is required. The setup script looks for it at `/opt/homebrew/bin/python3.11`, `/usr/local/bin/python3.11`, or on your `PATH`. To use a different one:
> `PYTHON_BIN=/path/to/python3.11 ./scripts/setup-macos.sh`

## 2. Get the code

```bash
cd ~/Desktop
git clone <repo-url> invoice-maker
cd invoice-maker
```

## 3. One-time setup

```bash
chmod +x scripts/*.sh        # only needed if scripts aren't executable
./scripts/setup-macos.sh
```

This script:

1. Runs `npm install` (root Electron deps + `frontend/`)
2. Creates `backend/.venv` with Python 3.11
3. Installs `backend/requirements.txt`
4. Runs Alembic migrations → creates `~/Library/Application Support/InvoiceMaker/app.db`

## 4. Run in development

```bash
npm run dev
```

Opens the Electron window with Vite hot-reload (port `5174`). The FastAPI sidecar is started automatically on a free local port.

Log in with **admin / admin** — you'll be asked to change the password.

### Other dev commands

| Task | Command |
|------|---------|
| API only on `http://127.0.0.1:8000` | `./scripts/dev-backend.sh` |
| Web UI only (browser) | `npm run dev:web` |
| Apply DB migrations | `npm run migrate:posix` |
| Seed sample companies + Excel | `./scripts/seed-phase4.sh` |
| API docs (when backend running) | <http://127.0.0.1:8000/docs> |

## 5. Build the macOS app (.dmg / .zip)

Must be run **on a Mac**.

```bash
./scripts/build-macos.sh
```

Steps performed:

1. PyInstaller bundles the backend → `backend/dist/invoice-maker-backend/`
2. Builds Electron main (`dist-electron/`) and frontend (`frontend/dist/`)
3. `electron-builder` creates the installer

Output:

```
release/IMEIDataMaker-<version>-mac-arm64.dmg   (Apple Silicon)
release/IMEIDataMaker-<version>-mac-x64.dmg     (Intel)
+ matching .zip files
```

By default it builds only for your Mac's architecture. To build both:

```bash
ELECTRON_BUILDER_ARCH=all ./scripts/build-macos.sh
```

## 6. Install & first launch

1. Open the `.dmg` and drag **IMEI Data Maker** into **Applications**.
2. The build is unsigned, so the first time: **right-click the app → Open → Open**.
   If macOS still blocks it: **System Settings → Privacy & Security → Open Anyway**.

## Data location

```
~/Library/Application Support/InvoiceMaker/
```

Open it in Finder: `open ~/Library/Application\ Support/InvoiceMaker`

Uninstalling (deleting the app) does **not** remove this folder. After **Settings → Restore**, quit and relaunch the app.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `permission denied: ./scripts/setup-macos.sh` | `chmod +x scripts/*.sh` |
| `Python 3.11 not found` | `brew install python@3.11` |
| `Missing .venv` | Re-run `./scripts/setup-macos.sh` |
| `bad interpreter: /bin/bash^M` | Script got Windows line endings — run `git checkout -- scripts/` (the repo's `.gitattributes` keeps `.sh` as LF) |
| Port 5174 already in use | `lsof -i :5174` then `kill <PID>` |
| "App is damaged / can't be opened" | `xattr -cr "/Applications/IMEI Data Maker.app"` then open again |
| Start over with a clean DB | Quit app, then `rm -rf ~/Library/Application\ Support/InvoiceMaker` (**deletes all data**) |
