const path = require("path");
const fs = require("fs");
const { getPlatformKey } = require("./platform");

function resolveTunnelBinaryPath() {
  const platformKey = getPlatformKey();
  const binaryName = platformKey.startsWith("win32") ? "tunnel.exe" : "tunnel";
  const basePath = process.env.JOINCLOUD_RESOURCES_PATH
    ? path.resolve(process.env.JOINCLOUD_RESOURCES_PATH)
    : process.versions && process.versions.electron && process.resourcesPath
      ? path.resolve(process.resourcesPath)
      : path.resolve(__dirname, "..");

  const binaryPath = path.resolve(basePath, "bin", "tunnel", platformKey, binaryName);

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
