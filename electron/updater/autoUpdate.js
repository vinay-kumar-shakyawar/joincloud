const { autoUpdater } = require("electron-updater");
const electron = require("electron");
const log = require("electron-log");

const { app, ipcMain } = electron;

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.logger = log;

let mainWindow = null;
let initialCheckTimer = null;

function emit(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function normalizeReleaseNotes(info) {
  const n = info && info.releaseNotes;
  if (n == null) return "Bug fixes and improvements";
  if (typeof n === "string") return n;
  if (Array.isArray(n)) {
    const first = n.find((x) => typeof x === "string" && x.trim());
    if (first) return first;
    const note = n[0];
    if (note && typeof note === "object" && typeof note.note === "string") return note.note;
  }
  return "Bug fixes and improvements";
}

autoUpdater.on("update-available", (info) => {
  emit("update:available", {
    version: info.version,
    releaseDate: info.releaseDate,
    releaseNotes: info.releaseNotes ?? "Bug fixes and improvements",
    releaseNotesLine: normalizeReleaseNotes(info),
  });
});

autoUpdater.on("update-not-available", () => {
  emit("update:none", {});
});

autoUpdater.on("download-progress", (p) => {
  emit("update:progress", {
    percent: Math.round(p.percent),
    bytesPerSecond: p.bytesPerSecond,
    transferred: p.transferred,
    total: p.total,
  });
});

autoUpdater.on("update-downloaded", (info) => {
  emit("update:ready", { version: info.version });
});

autoUpdater.on("error", (err) => {
  emit("update:error", { message: err.message });
  log.error("Updater error:", err);
});

function registerAutoUpdaterIpc() {
  ipcMain.on("update:check", () => {
    autoUpdater.checkForUpdates().catch((e) => log.error("checkForUpdates", e));
  });
  ipcMain.on("update:download", () => {
    autoUpdater.downloadUpdate().catch((e) => log.error("downloadUpdate", e));
  });
  ipcMain.on("update:install", () => {
    autoUpdater.quitAndInstall(false, true);
  });
  ipcMain.on("get-app-version", (event) => {
    event.returnValue = app.getVersion();
  });
}

registerAutoUpdaterIpc();

function initAutoUpdater(win) {
  if (initialCheckTimer) {
    clearTimeout(initialCheckTimer);
    initialCheckTimer = null;
  }
  mainWindow = win;
  initialCheckTimer = setTimeout(() => {
    initialCheckTimer = null;
    autoUpdater.checkForUpdates().catch((e) => log.error("initial checkForUpdates", e));
  }, 3000);
}

module.exports = { initAutoUpdater };
