const path = require("path");
const fs = require("fs");
const { getPlatformKey } = require("./platform");

let isPackaged = false;
try {
  isPackaged = require("electron").app?.isPackaged ?? false;
} catch (_) {
  // not in Electron
}
// Server runs as a Node subprocess; Electron app.isPackaged may be false there.
// JOINCLOUD_RESOURCES_PATH is only set by the main process when packaged.
if (!isPackaged && process.env.JOINCLOUD_RESOURCES_PATH) {
  isPackaged = true;
}

function resolveTunnelBinaryPath() {
  console.log("[tunnel] platform:", process.platform, "arch:", process.arch);

  const platformKey = getPlatformKey();
  const binaryName = platformKey.startsWith("win32") ? "cloudflared.exe" : "cloudflared";
  const basePath = process.env.JOINCLOUD_RESOURCES_PATH
    ? path.resolve(process.env.JOINCLOUD_RESOURCES_PATH)
    : process.versions && process.versions.electron && isPackaged
      ? path.resolve(process.resourcesPath)
      : path.resolve(__dirname, "..");

  console.log("[tunnel] isPackaged:", isPackaged);
  console.log("[tunnel] basePath:", basePath);

  const binaryPath = path.resolve(basePath, "bin", "tunnel", platformKey, binaryName);
  console.log("[tunnel] binary path attempt:", binaryPath);
  console.log("[tunnel] resourcesPath:", process.resourcesPath);
  console.log("[tunnel] __dirname:", __dirname);

  if (!fs.existsSync(binaryPath)) {
    throw new Error("Public sharing is unavailable on this system");
  }

  if (!platformKey.startsWith("win32")) {
    try {
      fs.accessSync(binaryPath, fs.constants.X_OK);
    } catch (error) {
      throw new Error("Public sharing is unavailable on this system");
    }
  }

  return binaryPath;
}

module.exports = {
  resolveTunnelBinaryPath,
};
