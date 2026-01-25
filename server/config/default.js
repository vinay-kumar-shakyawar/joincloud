const path = require("path");
const os = require("os");

const ROOT_DIR = path.resolve(__dirname, "..");
const HOME_DIR = os.homedir();
const APP_SUPPORT_DIR = path.join(HOME_DIR, "Library", "Application Support", "JoinCloud");

module.exports = {
  server: {
    host: process.env.JOINCLOUD_HOST || "0.0.0.0",
    port: Number(process.env.JOINCLOUD_PORT || 8787),
    ownerBasePath: "/dav",
    shareBasePath: "/share",
    sharePort: Number(process.env.JOINCLOUD_SHARE_PORT || 8788),
    publicBaseUrl: process.env.JOINCLOUD_PUBLIC_BASE_URL || null,
  },
  auth: {
    realm: process.env.JOINCLOUD_REALM || "JoinCloud",
    username: process.env.JOINCLOUD_USERNAME || "joincloud",
    password: process.env.JOINCLOUD_PASSWORD || "joincloud",
  },
  storage: {
    ownerRoot:
      process.env.JOINCLOUD_STORAGE_ROOT ||
      path.join(APP_SUPPORT_DIR, "storage"),
    shareStorePath:
      process.env.JOINCLOUD_SHARE_STORE ||
      path.join(APP_SUPPORT_DIR, "storage", "shares.json"),
    logDir:
      process.env.JOINCLOUD_LOG_DIR ||
      path.join(APP_SUPPORT_DIR, "logs"),
  },
  share: {
    defaultPermission: "read-only",
    defaultTtlMs: 24 * 60 * 60 * 1000,
  },
  expiry: {
    sweepIntervalMs: 60 * 1000,
  },
  tunnel: {},
};
