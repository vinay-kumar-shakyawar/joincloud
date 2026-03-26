const electron = require("electron");
const fs = require("fs");
const path = require("path");
let mainWindow = null;

function setVersionInstallerWindow(win) {
  mainWindow = win;
}

function emitProgress(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("version:progress", payload);
  }
}

function platformDownloadKey() {
  if (process.platform === "win32") return "win";
  if (process.platform === "darwin") return "mac";
  return "linux";
}

function extensionForPlatform() {
  if (process.platform === "win32") return ".exe";
  if (process.platform === "darwin") return ".dmg";
  return ".AppImage";
}

function registerVersionInstallerHandlers() {
  const { ipcMain, app, shell } = electron;

  ipcMain.handle("versions:install", async (_event, versionObj) => {
    if (!versionObj || typeof versionObj.version !== "string") {
      return { error: "Invalid version object" };
    }
    const key = platformDownloadKey();
    const downloads = versionObj.downloads || {};
    const url = downloads[key];
    if (!url || typeof url !== "string") {
      return { error: `No download URL for platform key "${key}"` };
    }

    const ver = versionObj.version.replace(/[^0-9.a-zA-Z-]+/g, "_");
    const fileName = `JoinCloud-${ver}${extensionForPlatform()}`;
    const destPath = path.join(app.getPath("temp"), fileName);

    try {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) {
        return { error: `Download failed: HTTP ${res.status}` };
      }
      const total = parseInt(res.headers.get("content-length") || "0", 10);
      const body = res.body;
      if (!body) {
        return { error: "No response body" };
      }

      await fs.promises.rm(destPath, { force: true });
      const writeStream = fs.createWriteStream(destPath);
      let transferred = 0;

      const reader = body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        transferred += value.length;
        if (total > 0) {
          emitProgress({
            pct: Math.min(100, Math.round((transferred / total) * 100)),
            version: versionObj.version,
          });
        } else {
          emitProgress({ pct: 0, version: versionObj.version });
        }
        await new Promise((resolve, reject) => {
          writeStream.write(Buffer.from(value), (err) => (err ? reject(err) : resolve()));
        });
      }

      await new Promise((resolve, reject) => {
        writeStream.end((err) => (err ? reject(err) : resolve()));
      });

      emitProgress({ pct: 100, version: versionObj.version });

      if (process.platform === "linux") {
        try {
          await fs.promises.chmod(destPath, 0o755);
        } catch (_) {}
      }

      const openResult = await shell.openPath(destPath);
      if (openResult) {
        return { error: openResult };
      }
      return { success: true };
    } catch (err) {
      return { error: err && err.message ? err.message : String(err) };
    }
  });
}

registerVersionInstallerHandlers();

module.exports = {
  registerVersionInstallerHandlers,
  setVersionInstallerWindow,
};
