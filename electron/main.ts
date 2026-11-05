/**
 * Electron main process — spawns FastAPI sidecar on 127.0.0.1 with a free port,
 * health-checks it, exposes API base URL to the renderer, and kills it on quit.
 *
 * Production: spawns bundled invoice-maker-backend(.exe) from extraResources.
 * Dev: spawns uvicorn via backend/.venv
 *   - Windows: prefer py -3.11
 *   - macOS/Linux: prefer python3.11 (Homebrew paths on Mac)
 */

import { app, BrowserWindow, ipcMain, shell } from "electron";
import { ChildProcess, spawn } from "node:child_process";
import { createServer } from "node:net";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;
let apiBaseUrl = "";

const isDev = !app.isPackaged;

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address && typeof address === "object") {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error("Could not allocate a free port")));
      }
    });
    server.on("error", reject);
  });
}

function healthCheck(baseUrl: string, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`${baseUrl}/health`, { timeout: timeoutMs }, (res) => {
      resolve(res.statusCode === 200);
      res.resume();
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForHealthy(baseUrl: string, attempts = 80, delayMs = 500): Promise<boolean> {
  // Packaged first launch may run Alembic + cold start — allow ~40s.
  for (let i = 0; i < attempts; i += 1) {
    if (await healthCheck(baseUrl)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

/** Prefer Python 3.11 on macOS (Homebrew arm64/x64) then generic python3. */
function resolvePosixPython(): string {
  const candidates = [
    "/opt/homebrew/bin/python3.11",
    "/usr/local/bin/python3.11",
    "/opt/homebrew/bin/python3",
    "/usr/local/bin/python3",
    "python3.11",
    "python3",
  ];
  for (const c of candidates) {
    if (c.startsWith("/") && fs.existsSync(c)) {
      return c;
    }
  }
  // PATH lookups (python3.11 / python3)
  return fs.existsSync("/usr/bin/python3.11") ? "python3.11" : "python3";
}

function resolveBackendCommand(): { command: string; args: string[]; cwd: string } {
  const projectRoot = path.join(__dirname, "..");
  const backendDir = path.join(projectRoot, "backend");

  if (app.isPackaged) {
    // electron-builder extraResources → resources/backend/invoice-maker-backend(.exe)
    const exeName =
      process.platform === "win32" ? "invoice-maker-backend.exe" : "invoice-maker-backend";
    const exePath = path.join(process.resourcesPath, "backend", exeName);
    if (!fs.existsSync(exePath)) {
      console.error(`[electron] Packaged backend missing at ${exePath}`);
    } else if (process.platform !== "win32") {
      try {
        fs.chmodSync(exePath, 0o755);
      } catch (err) {
        console.warn("[electron] Could not chmod backend binary:", err);
      }
    }
    return { command: exePath, args: [], cwd: path.dirname(exePath) };
  }

  const venvPython =
    process.platform === "win32"
      ? path.join(backendDir, ".venv", "Scripts", "python.exe")
      : path.join(backendDir, ".venv", "bin", "python");

  let command = venvPython;
  if (!fs.existsSync(venvPython)) {
    command = process.platform === "win32" ? "py" : resolvePosixPython();
  }

  // Windows `py` launcher: pin 3.11 when available.
  const args =
    command === "py"
      ? ["-3.11", "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1"]
      : ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1"];

  return { command, args, cwd: backendDir };
}

async function startBackend(): Promise<string> {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const { command, args, cwd } = resolveBackendCommand();

  const fullArgs = app.isPackaged
    ? ["--host", "127.0.0.1", "--port", String(port)]
    : [...args, "--port", String(port)];

  console.log(`[electron] Starting backend: ${command} ${fullArgs.join(" ")}`);

  const useDetached = process.platform !== "win32";

  backendProcess = spawn(command, fullArgs, {
    cwd,
    env: {
      ...process.env,
      PYTHONUNBUFFERED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    // Own process group on macOS/Linux so we can SIGTERM the tree on quit.
    detached: useDetached,
  });

  backendProcess.stdout?.on("data", (chunk: Buffer) => {
    console.log(`[backend] ${chunk.toString().trimEnd()}`);
  });
  backendProcess.stderr?.on("data", (chunk: Buffer) => {
    console.error(`[backend] ${chunk.toString().trimEnd()}`);
  });
  backendProcess.on("exit", (code, signal) => {
    console.log(`[electron] Backend exited code=${code} signal=${signal}`);
    backendProcess = null;
  });

  const healthy = await waitForHealthy(baseUrl);
  if (!healthy) {
    throw new Error(`Backend failed health check at ${baseUrl}`);
  }

  apiBaseUrl = baseUrl;
  return baseUrl;
}

function stopBackend(): void {
  if (!backendProcess) {
    return;
  }

  const child = backendProcess;
  backendProcess = null;
  const pid = child.pid;

  if (process.platform === "win32") {
    if (pid) {
      spawn("taskkill", ["/pid", String(pid), "/f", "/t"], {
        windowsHide: true,
        stdio: "ignore",
      });
    }
    return;
  }

  // macOS / Linux: kill process group when detached.
  if (pid) {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      try {
        child.kill("SIGTERM");
      } catch {
        /* already gone */
      }
    }
    setTimeout(() => {
      try {
        process.kill(-pid, "SIGKILL");
      } catch {
        try {
          child.kill("SIGKILL");
        } catch {
          /* already gone */
        }
      }
    }, 2000);
  }
}

function rendererIndexHtml(): string {
  // Packaged: files live next to dist-electron inside asar (or app root).
  return path.join(__dirname, "..", "frontend", "dist", "index.html");
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    title: "IMEI Data Maker",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  if (isDev) {
    const viteUrl = process.env.VITE_DEV_SERVER_URL || "http://127.0.0.1:5174";
    await mainWindow.loadURL(viteUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    await mainWindow.loadFile(rendererIndexHtml());
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

ipcMain.handle("get-api-base-url", () => apiBaseUrl);

ipcMain.handle("open-path", async (_event, targetPath: string) => {
  if (!targetPath || !fs.existsSync(targetPath)) {
    return { ok: false, error: "Path does not exist" };
  }
  const result = await shell.openPath(targetPath);
  return { ok: result === "", error: result || null };
});

ipcMain.handle("show-item-in-folder", (_event, targetPath: string) => {
  if (!targetPath || !fs.existsSync(targetPath)) {
    return { ok: false, error: "Path does not exist" };
  }
  shell.showItemInFolder(targetPath);
  return { ok: true, error: null };
});

ipcMain.handle("print-pdf-url", async (_event, pdfUrl: string) => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true },
  });
  try {
    await win.loadURL(pdfUrl);
    await new Promise<void>((resolve) => {
      win.webContents.print({ silent: false, printBackground: true }, () => resolve());
    });
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    win.destroy();
  }
});

app.whenReady().then(async () => {
  try {
    await startBackend();
  } catch (err) {
    console.error("[electron] Failed to start backend:", err);
    apiBaseUrl = "";
  }

  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // macOS: keep app alive until Cmd+Q (dock activate recreates window).
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopBackend();
});

app.on("will-quit", () => {
  stopBackend();
});
