let electron = null;
try {
  electron = require("electron");
} catch (error) {
  console.error("Electron runtime unavailable");
  process.exit(1);
}

const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const dialog = electron.dialog;
const ipcMain = electron.ipcMain;
const shell = electron.shell;
const path = require("path");
const fs = require("fs");
const net = require("net");
const { spawn } = require("child_process");
const http = require("http");

let backendProcess = null;
let mainWindow = null;
let logPath = null;
let healthTimer = null;
let restartTimer = null;
let consecutiveHealthFailures = 0;
let restartHistory = [];
let backendState = "healthy";
let isStopping = false;

const HEALTH_URL = "http://127.0.0.1:8787/api/v1/health";
const BACKEND_URL = "http://127.0.0.1:8787";
const BACKEND_PORT = "8787";
const SHARE_PORT = "8788";
const HEALTH_INTERVAL_MS = 12000;
const HEALTH_FAILURE_THRESHOLD = 2;
const RESTART_WINDOW_MS = 10 * 60 * 1000;
const MAX_RESTARTS_IN_WINDOW = 3;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

function initLogging() {
  const userData = app.getPath("userData");
  const dir = userData;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  logPath = path.join(dir, "startup.log");
  fs.appendFileSync(logPath, `${new Date().toISOString()} App start\n`);
  console.log(`[joincloud-electron] log file: ${logPath}`);
}

function logLine(message) {
  const line = `${new Date().toISOString()} ${message}`;
  console.log(`[joincloud-electron] ${message}`);
  if (!logPath) return;
  fs.appendFileSync(logPath, `${line}\n`);
}

function formatError(error) {
  if (!error) return "unknown error";
  if (typeof error === "string") return error;
  return error.stack || error.message || JSON.stringify(error);
}

function showInitFailure(reason, error) {
  const details = error ? `\n${formatError(error)}` : "";
  const logHint = logPath ? `\n\nSee log:\n${logPath}` : "";
  const message = `App failed to initialize.\n\nReason: ${reason}${details}${logHint}`;
  logLine(`Initialization failure: ${reason}${details ? ` | ${details}` : ""}`);
  showBackendError(message);
}

function getBackendScriptPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "server", "index.js");
  }
  return path.join(__dirname, "..", "server", "index.js");
}

function getBackendCwd() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "server");
  }
  return path.join(__dirname, "..", "server");
}

function getStoragePath() {
  return path.join(app.getPath("userData"), "storage");
}

function startBackend() {
  if (backendProcess) return;

  // Native modules used by backend that require Electron rebuilds: sqlite3.
  const backendScript = getBackendScriptPath();
  const backendCwd = getBackendCwd();
  if (!fs.existsSync(backendScript)) {
    throw new Error(`Backend script not found: ${backendScript}`);
  }
  logLine(`Backend start ${backendScript}`);
  const env = {
    ...process.env,
    NODE_ENV: app.isPackaged ? "production" : "development",
    ELECTRON_RUN_AS_NODE: "1",
    JOINCLOUD_HOST: "0.0.0.0",
    JOINCLOUD_PORT: BACKEND_PORT,
    JOINCLOUD_SHARE_PORT: SHARE_PORT,
    PORT: BACKEND_PORT,
    SHARE_PORT,
    JOINCLOUD_STORAGE_ROOT: getStoragePath(),
    PATH: process.env.PATH || "",
  };
  if (app.isPackaged && process.resourcesPath) {
    env.JOINCLOUD_RESOURCES_PATH = process.resourcesPath;
  } else {
    delete env.JOINCLOUD_RESOURCES_PATH;
  }

  backendProcess = spawn(process.execPath, [backendScript], {
    env,
    cwd: backendCwd,
    stdio: ["ignore", "pipe", "pipe"],
  });
  logLine(`Backend pid ${backendProcess.pid}`);

  backendProcess.stdout.on("data", (chunk) => {
    logLine(chunk.toString().trim());
  });

  backendProcess.stderr.on("data", (chunk) => {
    logLine(chunk.toString().trim());
  });
  backendProcess.on("error", (error) => {
    logLine(`Backend process error: ${formatError(error)}`);
  });

  const startTime = Date.now();
  backendProcess.on("exit", (code, signal) => {
    const elapsedMs = Date.now() - startTime;
    logLine(`Backend exit code=${code ?? "null"} signal=${signal ?? "null"}`);
    if (elapsedMs < 5000) {
      logLine("Backend exit within 5s");
    }
    backendProcess = null;
    if (!isStopping) {
      checkBackend().then((healthy) => {
        if (healthy) {
          logLine("Backend process exited, but another backend instance is healthy");
          setBackendState("healthy", "existing instance");
          return;
        }
        scheduleBackendRestart("backend exit");
      });
    }
  });
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill("SIGTERM");
    backendProcess = null;
    logLine("Backend stop");
  }
}

function stopBackendGracefully(timeoutMs = 5000) {
  return new Promise((resolve) => {
    if (!backendProcess) {
      resolve();
      return;
    }
    const proc = backendProcess;
    let settled = false;

    const finalize = () => {
      if (settled) return;
      settled = true;
      backendProcess = null;
      resolve();
    };

    const timer = setTimeout(() => {
      try {
        proc.kill("SIGKILL");
      } catch (error) {
        // ignore
      }
      finalize();
    }, timeoutMs);

    proc.once("exit", () => {
      clearTimeout(timer);
      finalize();
    });

    try {
      proc.kill("SIGTERM");
    } catch (error) {
      clearTimeout(timer);
      finalize();
    }
  });
}

function showBackendError(message) {
  dialog.showErrorBox("JoinCloud", message);
}

function checkPortFree() {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (err) => {
      if (err.code === "EADDRINUSE") {
        resolve(false);
      } else {
        resolve(false);
      }
    });
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(8787, "127.0.0.1");
  });
}

function checkBackend() {
  return new Promise((resolve) => {
    const req = http.get(HEALTH_URL, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function setBackendState(state, reason) {
  if (backendState === state) return;
  backendState = state;
  logLine(`Backend state ${state}${reason ? ` (${reason})` : ""}`);
}

function recordRestartAttempt() {
  const now = Date.now();
  restartHistory = restartHistory.filter((ts) => now - ts < RESTART_WINDOW_MS);
  restartHistory.push(now);
  return restartHistory.length;
}

function shouldThrottleRestarts() {
  const now = Date.now();
  restartHistory = restartHistory.filter((ts) => now - ts < RESTART_WINDOW_MS);
  return restartHistory.length >= MAX_RESTARTS_IN_WINDOW;
}

async function attemptBackendRestart(reason) {
  if (isStopping) return;
  if (shouldThrottleRestarts()) {
    setBackendState("degraded", "restart limit exceeded");
    logLine(`Backend restart suppressed (${reason})`);
    return;
  }

  const attempt = recordRestartAttempt();
  const backoffMs = Math.min(30000, 1000 * Math.pow(2, attempt - 1));
  setBackendState("recovering", reason);
  logLine(`Backend restart scheduled in ${backoffMs}ms`);

  if (restartTimer) return;
  restartTimer = setTimeout(async () => {
    restartTimer = null;
    if (isStopping) return;
    if (backendProcess) {
      await stopBackendGracefully();
    }
    const portFree = await checkPortFree();
    if (!portFree) {
      setBackendState("degraded", "port in use");
      logLine("Backend restart failed: port in use");
      return;
    }
    startBackend();
    const ok = await waitForBackend(15000);
    if (ok) {
      consecutiveHealthFailures = 0;
      setBackendState("healthy", "restart succeeded");
      return;
    }
    logLine("Backend restart failed: health check");
    attemptBackendRestart("health check failed after restart");
  }, backoffMs);
}

function scheduleBackendRestart(reason) {
  if (isStopping) return;
  attemptBackendRestart(reason).catch(() => {});
}

async function waitForBackend(timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ok = await checkBackend();
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function ensureBackend() {
  const existing = await waitForBackend(1000);
  if (existing) {
    logLine("Backend already running");
    setBackendState("healthy", "existing");
    return true;
  }

  const portFree = await checkPortFree();
  if (!portFree) {
    logLine("Port 8787 in use, checking existing backend health");
    const existingOnBusyPort = await waitForBackend(10000);
    if (existingOnBusyPort) {
      logLine("Reusing existing backend on 8787");
      setBackendState("healthy", "existing on occupied port");
      return true;
    }
    showInitFailure("Backend port 8787 is already in use and no healthy backend responded");
    setBackendState("degraded", "port in use no healthy backend");
    return false;
  }

  try {
    startBackend();
  } catch (error) {
    showInitFailure("Failed to spawn backend", error);
    return false;
  }
  const ok = await waitForBackend(15000);
  if (!ok) {
    logLine("Backend did not respond");
    showInitFailure("Backend health check failed at /api/v1/health");
    stopBackend();
    setBackendState("degraded", "init failed");
    return false;
  }
  setBackendState("healthy", "init ok");
  return true;
}

async function loadRenderer(window) {
  logLine(`Loading backend renderer at ${BACKEND_URL}`);
  await window.loadURL(BACKEND_URL);
}

function startHealthMonitor() {
  if (healthTimer) return;
  healthTimer = setInterval(async () => {
    const ok = await checkBackend();
    if (!ok) {
      consecutiveHealthFailures += 1;
      logLine(`Backend health failed (${consecutiveHealthFailures})`);
      if (consecutiveHealthFailures >= HEALTH_FAILURE_THRESHOLD) {
        scheduleBackendRestart("health check failed");
      }
      return;
    }
    consecutiveHealthFailures = 0;
    if (backendState !== "healthy") {
      setBackendState("healthy", "health check ok");
    }
  }, HEALTH_INTERVAL_MS);
}

function stopHealthMonitor() {
  if (healthTimer) {
    clearInterval(healthTimer);
    healthTimer = null;
  }
}

async function createWindow() {
  initLogging();
  logLine("UI init");
  try {
    const resolver = require(path.join(__dirname, "..", "server", "tunnel", "resolveBinary"));
    resolver.resolveTunnelBinaryPath();
    logLine("Tunnel binary resolved");
  } catch (error) {
    logLine(`Tunnel binary unavailable: ${formatError(error)}`);
  }

  const ok = await ensureBackend();
  if (!ok) {
    logLine("Backend init failed");
    app.quit();
    return;
  }
  startHealthMonitor();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, "..", "assets", "icons.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  mainWindow.webContents.on("did-fail-load", (_event, code, description, url) => {
    logLine(`Renderer failed to load code=${code} url=${url} reason=${description}`);
  });

  try {
    await loadRenderer(mainWindow);
  } catch (error) {
    logLine(`UI load failed: ${formatError(error)}`);
    showInitFailure("Renderer URL could not be loaded", error);
    stopBackend();
    app.quit();
    return;
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

if (!app || !BrowserWindow) {
  console.error("Electron runtime unavailable");
  process.exit(1);
}

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.focus();
});

if (gotLock) {
  app.whenReady().then(createWindow);
}

ipcMain.handle("joincloud-open-storage", async () => {
  const storagePath = getStoragePath();
  await shell.openPath(storagePath);
});

ipcMain.handle("joincloud-select-files", async () => {
  if (!mainWindow) return [];
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile", "multiSelections"],
  });
  if (result.canceled) return [];
  return result.filePaths || [];
});

ipcMain.handle("joincloud-quit-app", async () => {
  app.quit();
  return { ok: true };
});

app.on("window-all-closed", () => {
  isStopping = true;
  stopHealthMonitor();
  stopBackendGracefully().finally(() => app.quit());
});

app.on("before-quit", (event) => {
  if (isStopping) return;
  isStopping = true;
  stopHealthMonitor();
  event.preventDefault();
  stopBackendGracefully().finally(() => app.quit());
});
