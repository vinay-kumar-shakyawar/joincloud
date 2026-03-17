function getPlatformKey() {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === "darwin") return "darwin-" + (arch === "arm64" ? "arm64" : "x64");
  if (platform === "linux") return "linux-x64";
  if (platform === "win32") return "win32-x64";

  throw new Error("Public sharing is unavailable on this system");
}

module.exports = {
  getPlatformKey,
};
