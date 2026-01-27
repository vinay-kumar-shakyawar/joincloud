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
const { startBackend, stopBackend, isBackendRunning, onBackendStatusChange } = require("./main/backendManager");
const { startTunnel, stopTunnel, isTunnelActive, onTunnelStatusChange } = require("./main/tunnelManager");

const healthState = {
  backendRunning: false,
  tunnelActive: false,
};

onBackendStatusChange((running) => {
  healthState.backendRunning = running;
});

onTunnelStatusChange((active) => {
  healthState.tunnelActive = active;
});

let mainWindow = null;
let logPath = null;
let isStopping = false;

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

function getBackendCwd() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "server");
  }
  return path.join(__dirname, "..", "server");
}

function getStoragePath() {
  return path.join(app.getPath("userData"), "storage");
}

function showBackendError(message) {
  dialog.showErrorBox("JoinCloud", message);
}


async function createWindow() {
  initLogging();
  logLine("UI init");
  const iconPath = path.join(__dirname, "..", "assets", "icon", "icon.png");
  if (app.dock && typeof app.dock.setIcon === "function") {
    try {
      app.dock.setIcon(iconPath);
    } catch (error) {
      logLine("Dock icon unavailable");
    }
  }
  const backendOk = await startBackend({
    scriptPath: getBackendScriptPath(),
    cwd: getBackendCwd(),
    env: {
      PORT: "3000",
      JOINCLOUD_HOST: "127.0.0.1",
      JOINCLOUD_STORAGE_ROOT: getStoragePath(),
      JOINCLOUD_RESOURCES_PATH: process.resourcesPath || "",
      NODE_ENV: app.isPackaged ? "production" : "development",
    },
  });
  if (!backendOk) {
    logLine("Backend init failed");
    app.quit();
    return;
  }
  await startTunnel();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  try {
    await mainWindow.loadURL("http://127.0.0.1:3000");
  } catch (error) {
    logLine("UI load failed");
    showBackendError("App failed to initialize.");
    await stopTunnel();
    await stopBackend();
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

ipcMain.handle("joincloud-stop-server", async () => {
  if (isStopping) return true;
  isStopping = true;
  await stopTunnel();
  await stopBackend();
  app.quit();
  return true;
});

app.on("window-all-closed", () => {
  isStopping = true;
  stopTunnel().finally(() => stopBackend().finally(() => app.quit()));
});

app.on("before-quit", (event) => {
  if (isStopping) return;
  isStopping = true;
  event.preventDefault();
  stopTunnel().finally(() => stopBackend().finally(() => app.quit()));
});
