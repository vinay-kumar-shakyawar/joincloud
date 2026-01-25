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

function initLogging() {
  const userData = app.getPath("userData");
  const dir = userData;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  logPath = path.join(dir, "startup.log");
  fs.appendFileSync(logPath, `${new Date().toISOString()} App start\n`);
}

function logLine(message) {
  if (!logPath) return;
  fs.appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`);
}

function getBackendScriptPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "server", "index.js");
  }
  return path.join(__dirname, "..", "server", "index.js");
}

function getStoragePath() {
  return path.join(app.getPath("userData"), "storage");
}

function startBackend() {
  if (backendProcess) return;

  const backendScript = getBackendScriptPath();
  logLine(`Backend start ${backendScript}`);
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    JOINCLOUD_HOST: "0.0.0.0",
    JOINCLOUD_STORAGE_ROOT: getStoragePath(),
    JOINCLOUD_RESOURCES_PATH: process.resourcesPath || "",
  };

  backendProcess = spawn(process.execPath, [backendScript], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  backendProcess.stdout.on("data", (chunk) => {
    logLine(chunk.toString().trim());
  });

  backendProcess.stderr.on("data", (chunk) => {
    logLine(chunk.toString().trim());
  });

  backendProcess.on("exit", () => {
    logLine("Backend exit");
    backendProcess = null;
  });
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill("SIGTERM");
    backendProcess = null;
    logLine("Backend stop");
  }
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
    const req = http.get("http://127.0.0.1:8787/api/status", (res) => {
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
    return true;
  }

  const portFree = await checkPortFree();
  if (!portFree) {
    logLine("Port 8787 in use");
    showBackendError("App failed to initialize.");
    return false;
  }

  startBackend();
  const ok = await waitForBackend(15000);
  if (!ok) {
    logLine("Backend did not respond");
    showBackendError("App failed to initialize.");
    stopBackend();
    return false;
  }
  return true;
}

async function createWindow() {
  initLogging();
  logLine("UI init");
  try {
    const resolver = require(path.join(__dirname, "..", "server", "tunnel", "resolveBinary"));
    resolver.resolveTunnelBinaryPath();
    logLine("Tunnel binary resolved");
  } catch (error) {
    logLine("Tunnel binary unavailable");
  }

  const ok = await ensureBackend();
  if (!ok) {
    logLine("Backend init failed");
    app.quit();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  try {
    await mainWindow.loadURL("http://127.0.0.1:8787/");
  } catch (error) {
    logLine("UI load failed");
    showBackendError("App failed to initialize.");
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

app.whenReady().then(createWindow);

ipcMain.handle("joincloud-open-storage", async () => {
  const storagePath = getStoragePath();
  await shell.openPath(storagePath);
});

app.on("window-all-closed", () => {
  stopBackend();
  app.quit();
});

app.on("before-quit", () => {
  stopBackend();
});
