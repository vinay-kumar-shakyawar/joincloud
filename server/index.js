const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const http = require("http");
const https = require("https");
const fs = require("fs/promises");
const fsSync = require("fs");
const os = require("os");
const stream = require("stream");
const { pipeline } = require("stream/promises");
const express = require("express");
const mime = require("mime-types");
const bonjour = require("bonjour")();
const archiver = require("archiver");
const Busboy = require("busboy");

const config = require("./config/default");
const { createOwnerServer } = require("./webdav/ownerServer");
const { createShareServer } = require("./webdav/shareServer");
const { createMountManager } = require("./webdav/mountManager");
const { ShareService } = require("./sharing/shareService");
const { ExpiryManager } = require("./sharing/expiryManager");
const { resolveOwnerPath } = require("./security/pathGuard");
const { TunnelManager } = require("./tunnel/TunnelManager");
const { createLogger } = require("./utils/logger");
const { createTelemetryStore } = require("./telemetry/store");
const { createTelemetrySync } = require("./telemetry/sync");
const { createUsageAggregation } = require("./usage-aggregation");
const { AccessControlStore } = require("./accessControl");
const { RuntimeTelemetryStore } = require("./runtimeTelemetry");
const { getBestLanIp, getNetworkEndpoints, getAllLanIps, createNetworkManager } = require("./network/networkManager");
const { createDiscoveryManager, shortDeviceId } = require("./discovery/DiscoveryManager");
const { TeamsStore } = require("./teams/TeamsStore");
const crypto = require("crypto");
const dns = require("dns");

async function ensureOwnerStorage(rootPath) {
  await fs.mkdir(rootPath, { recursive: true });
}

async function ensureShareStore(storagePath) {
  if (!storagePath) return;
  await fs.mkdir(path.dirname(storagePath), { recursive: true });
}

async function ensureLogDir(logDir) {
  await fs.mkdir(logDir, { recursive: true });
}

async function ensureUserConfig(configPath) {
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  try {
    const raw = await fs.readFile(configPath, "utf8");
    const parsed = JSON.parse(raw);
    let changed = false;
    if (typeof parsed.telemetry_enabled !== "boolean") {
      parsed.telemetry_enabled = true;
      changed = true;
    }
    const normalizedDisplayName = normalizeDisplayName(parsed.display_name);
    if (normalizedDisplayName !== parsed.display_name) {
      parsed.display_name = normalizedDisplayName;
      changed = true;
    }
    if (typeof parsed.network_visibility !== "boolean") {
      parsed.network_visibility = true;
      changed = true;
    }
    if (changed) {
      await fs.writeFile(configPath, JSON.stringify(parsed, null, 2));
    }
    return parsed;
  } catch (error) {
    const userId = `jc_${crypto.randomUUID()}`;
    const payload = {
      user_id: userId,
      created_at: new Date().toISOString(),
      telemetry_enabled: true,
      telemetry_last_sync: null,
      display_name: normalizeDisplayName(generateDisplayName()),
      network_visibility: true,
    };
    await fs.writeFile(configPath, JSON.stringify(payload, null, 2));
    return payload;
  }
}

async function updateUserConfig(configPath, payload) {
  await fs.writeFile(configPath, JSON.stringify(payload, null, 2));
}

let controlPlaneConfigCache = null;

function getHostUuidForConfig() {
  try {
    const userData = process.env.JOINCLOUD_USER_DATA;
    if (!userData) return null;
    const hostUuidPath = path.join(userData, "JoinCloud", "system", "host_uuid");
    if (!fsSync.existsSync(hostUuidPath)) return null;
    const uuid = fsSync.readFileSync(hostUuidPath, "utf8").trim();
    return uuid.length >= 8 && uuid.length <= 128 ? uuid : null;
  } catch (_) {
    return null;
  }
}

function getActivationPaths() {
  const userData = process.env.JOINCLOUD_USER_DATA;
  if (!userData) return null;
  const systemDir = path.join(userData, "JoinCloud", "system");
  return {
    systemDir,
    authPath: path.join(systemDir, "auth.json"),
    licensePath: path.join(systemDir, "license.json"),
  };
}

/** Fire-and-forget: if license expires within 48h or is in grace, try to refresh from Control Plane. */
function tryRefreshLicense() {
  const adminHost = config.telemetry?.adminHost;
  if (!adminHost) return;
  const paths = getActivationPaths();
  const hostUuid = getHostUuidForConfig();
  if (!paths || !hostUuid) return;
  setImmediate(() => {
    let license;
    try {
      if (!fsSync.existsSync(paths.licensePath)) return;
      const raw = fsSync.readFileSync(paths.licensePath, "utf8");
      license = JSON.parse(raw);
    } catch (_) {
      return;
    }
    if (!license || !license.license_id) return;
    const now = Math.floor(Date.now() / 1000);
    const expiresIn48h = now + 48 * 3600;
    if (license.expires_at > expiresIn48h && license.state !== "grace") return;
    controlPlanePost(adminHost, "/api/v1/license/validate", { license, host_uuid: hostUuid }, null, (err, result) => {
      if (err || !result?.data?.license) return;
      const newLicense = result.data.license;
      const tmpPath = paths.licensePath + ".tmp." + Date.now();
      fs.writeFile(tmpPath, JSON.stringify(newLicense, null, 2), "utf8")
        .then(() => fs.rename(tmpPath, paths.licensePath))
        .then(() => {
          if (controlPlaneConfigCache) {
            controlPlaneConfigCache.license = { state: newLicense.state || "active", ...newLicense };
          }
          logger.info("license refreshed from Control Plane");
        })
        .catch((e) => logger.warn("license refresh write failed", { error: e.message }));
    });
  });
}

/** After config is served: fetch latest license from Control Plane and update file/cache if changed (e.g. plan upgrade). */
function refreshLicenseFromControlPlane(hostUuid) {
  const adminHost = config.telemetry?.adminHost;
  if (!adminHost || !hostUuid || hostUuid.length < 8) return;
  const paths = getActivationPaths();
  if (!paths) return;
  setImmediate(() => {
    controlPlaneGet(adminHost, `/api/v1/config?host_uuid=${encodeURIComponent(hostUuid)}`, (err, result) => {
      if (err || result?.statusCode !== 200 || !result?.data?.license) return;
      const remote = result.data.license;
      if (remote.state === "UNREGISTERED") return;
      let current = null;
      try {
        if (fsSync.existsSync(paths.licensePath)) {
          const raw = fsSync.readFileSync(paths.licensePath, "utf8");
          current = JSON.parse(raw);
        }
      } catch (_) {}
      const changed = !current || current.tier !== remote.tier || current.state !== remote.state ||
        (current.expires_at !== remote.expires_at);
      if (!changed) return;
      const toWrite = {
        ...current,
        state: remote.state,
        tier: remote.tier,
        device_limit: remote.device_limit,
        expires_at: remote.expires_at,
        grace_ends_at: remote.grace_ends_at,
        features: remote.features || (current && current.features) || {},
        account_id: remote.account_id || (current && current.account_id),
      };
      if (result.data.account_email) toWrite.account_email = result.data.account_email;
      else if (current && current.account_email) toWrite.account_email = current.account_email;
      const tmpPath = paths.licensePath + ".tmp." + Date.now();
      fs.writeFile(tmpPath, JSON.stringify(toWrite, null, 2), "utf8")
        .then(() => fs.rename(tmpPath, paths.licensePath))
        .then(() => {
          if (controlPlaneConfigCache) {
            controlPlaneConfigCache.license = { state: toWrite.state || "active", ...toWrite };
            if (toWrite.account_email) controlPlaneConfigCache.account_email = toWrite.account_email;
          }
          logger.info("license refreshed from Control Plane (config sync)");
        })
        .catch((e) => logger.warn("license config sync write failed", { error: e.message }));
    });
  });
}

function controlPlanePost(adminHost, apiPath, body, bearerToken, callback) {
  const parsed = parseAdminHost(adminHost);
  if (!parsed) {
    callback(new Error("Control Plane not configured"), null);
    return;
  }
  const lib = parsed.isHttps ? https : http;
  const bodyStr = JSON.stringify(body || {});
  const opts = {
    hostname: parsed.hostname,
    port: parsed.port,
    path: apiPath,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(bodyStr, "utf8"),
    },
    timeout: 15000,
  };
  if (bearerToken) opts.headers.Authorization = `Bearer ${bearerToken}`;
  const req = lib.request(opts, (res) => {
    let data = "";
    res.on("data", (chunk) => { data += chunk; });
    res.on("end", () => {
      let json = null;
      try {
        json = data ? JSON.parse(data) : {};
      } catch (_) {}
      callback(null, { statusCode: res.statusCode, data: json });
    });
  });
  req.on("error", (err) => callback(err, null));
  req.setTimeout(15000, () => req.destroy());
  req.end(bodyStr);
}

function controlPlaneGet(adminHost, apiPath, callback) {
  const parsed = parseAdminHost(adminHost);
  if (!parsed) {
    callback(new Error("Control Plane not configured"), null);
    return;
  }
  const lib = parsed.isHttps ? https : http;
  const req = lib.request(
    {
      hostname: parsed.hostname,
      port: parsed.port,
      path: apiPath,
      method: "GET",
      timeout: 10000,
    },
    (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        let json = null;
        try {
          json = data ? JSON.parse(data) : {};
        } catch (_) {}
        callback(null, { statusCode: res.statusCode, data: json });
      });
    }
  );
  req.on("error", (err) => callback(err, null));
  req.setTimeout(10000, () => req.destroy());
  req.end();
}

function parseAdminHost(adminHost) {
  if (!adminHost || typeof adminHost !== "string") return null;
  const withProtocol = adminHost.indexOf("://") === -1 ? `https://${adminHost}` : adminHost;
  try {
    const u = new URL(withProtocol);
    return {
      hostname: u.hostname,
      port: u.port ? parseInt(u.port, 10) : (u.protocol === "https:" ? 443 : 80),
      protocol: u.protocol,
      isHttps: u.protocol === "https:",
    };
  } catch (_) {
    const idx = adminHost.indexOf(":");
    return {
      hostname: idx === -1 ? adminHost : adminHost.slice(0, idx),
      port: idx === -1 ? 443 : parseInt(adminHost.slice(idx + 1), 10) || 443,
      isHttps: true,
    };
  }
}

function fetchControlPlaneConfigAndApplyTelemetry(adminHost, userConfigPath, updateUserConfigFn, logger) {
  const parsed = parseAdminHost(adminHost);
  if (!parsed) return;
  const lib = parsed.isHttps ? https : http;
  const hostUuid = getHostUuidForConfig();
  const configPath = hostUuid ? `/api/v1/config?host_uuid=${encodeURIComponent(hostUuid)}` : "/api/v1/config";
  const req = lib.request(
    {
      hostname: parsed.hostname,
      port: parsed.port,
      path: configPath,
      method: "GET",
      timeout: 3000,
    },
    (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        try {
          const data = JSON.parse(body);
          controlPlaneConfigCache = {
            license: data.license || {},
            activation: data.activation || {},
            telemetry: data.telemetry || {},
            subscription: data.subscription || null,
            account_id: data.account_id || null,
            account_email: data.account_email || null,
          };
          if (!data.telemetry || typeof data.telemetry.default_enabled === "undefined") return;
          fs.readFile(userConfigPath, "utf8")
            .then((raw) => {
              const userConfig = JSON.parse(raw);
              if (userConfig.control_plane_telemetry_default_applied) return;
              userConfig.telemetry_enabled = !!data.telemetry.default_enabled;
              userConfig.control_plane_telemetry_default_applied = true;
              return updateUserConfigFn(userConfigPath, userConfig);
            })
            .then(() => {
              if (logger) logger.info("control plane config applied", { telemetry_default: true });
            })
            .catch(() => {});
        } catch (_) {}
      });
    }
  );
  req.on("error", () => {});
  req.setTimeout(3000, () => req.destroy());
  req.end();
}

function getControlPlaneConfig() {
  return controlPlaneConfigCache;
}

function toPosixPath(input) {
  const value = input ? input.replace(/\\/g, "/") : "/";
  return value.startsWith("/") ? value : `/${value}`;
}

function getAppVersion() {
  try {
    const rootPath = path.resolve(__dirname, "..", "package.json");
    const raw = require(rootPath);
    return raw.version || "0.1.0";
  } catch (error) {
    return "0.1.0";
  }
}

const BUILD_STAMP = new Date().toISOString();
const BUILD_ID = `v${getAppVersion()} ${BUILD_STAMP}`;

function generateDisplayName() {
  return "Join";
}

function normalizeDisplayName(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "Join";
  if (raw.toLowerCase() === "join") return "Join";
  if (!raw.toLowerCase().startsWith("join")) return `Join ${raw}`.trim();
  const suffix = raw.slice(4).trim();
  return suffix ? `Join ${suffix}` : "Join";
}




function isValidDisplayName(value) {
  if (!value || typeof value !== "string") return false;
  if (!value.startsWith("Join")) return false;
  if (value.length > 48) return false;
  return /^Join(?:[A-Za-z0-9 _-]*)$/.test(value);
}

function startUptimeTracker(telemetry) {
  let lastTick = Date.now();
  return setInterval(() => {
    const now = Date.now();
    const deltaMs = now - lastTick;
    lastTick = now;
    if (deltaMs > 5000) {
      return;
    }
    const seconds = Math.floor(deltaMs / 1000);
    if (seconds > 0) {
      telemetry.addUptime(seconds);
    }
  }, 1000);
}

function getLanAddress() {
  return getBestLanIp();
}

function getCloudUrl() {
  return `http://${getLanAddress()}:${config.server.port}/`;
}

function hashDeviceId(value) {
  return crypto.createHash("sha256").update(String(value || "joincloud")).digest("hex");
}

function getClientIp(req) {
  const raw = req.ip || req.socket?.remoteAddress || "";
  if (!raw) return "";
  return raw.startsWith("::ffff:") ? raw.slice(7) : raw;
}

function isLocalhostRequest(req) {
  const ip = getClientIp(req);
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1" || ip === "";
}

function getRequestFingerprint(req) {
  const headerValue = req.headers["x-joincloud-fingerprint"];
  if (Array.isArray(headerValue)) {
    return String(headerValue[0] || "").trim();
  }
  const direct = String(headerValue || "").trim();
  if (direct) return direct;
  if (req.method === "GET" && req.path === "/v1/file/content") {
    return String(req.query?.fp || "").trim();
  }
  return "";
}

function getRequestToken(req) {
  const authHeader = req.headers.authorization || "";
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }
  const tokenHeader = req.headers["x-joincloud-token"];
  if (Array.isArray(tokenHeader)) {
    return String(tokenHeader[0] || "").trim();
  }
  const direct = String(tokenHeader || "").trim();
  if (direct) return direct;
  if (req.method === "GET" && req.path === "/v1/file/content") {
    return String(req.query?.token || "").trim();
  }
  return "";
}

function hasRequiredUiAssets(rootPath) {
  if (!rootPath) return false;
  const required = ["index.html", "app.js", "styles.css"];
  return required.every((fileName) => fsSync.existsSync(path.join(rootPath, fileName)));
}

function resolveUiRoot() {
  const candidates = [];
  const envRoot = process.env.UI_ROOT || process.env.JOINCLOUD_UI_ROOT;
  if (envRoot) {
    candidates.push({ root: envRoot, source: "env" });
  }
  const resourcesPath = process.env.JOINCLOUD_RESOURCES_PATH || process.resourcesPath;
  if (resourcesPath) {
    candidates.push({
      root: path.join(resourcesPath, "app.asar.unpacked", "server", "ui"),
      source: "resources:app.asar.unpacked",
    });
    candidates.push({
      root: path.join(resourcesPath, "server", "ui"),
      source: "resources:server",
    });
    candidates.push({
      root: path.join(resourcesPath, "app.asar", "server", "ui"),
      source: "resources:app.asar",
    });
  }
  candidates.push({ root: path.join(__dirname, "ui"), source: "dev:__dirname" });

  for (const candidate of candidates) {
    if (hasRequiredUiAssets(candidate.root)) {
      return {
        uiRoot: candidate.root,
        uiRootExists: true,
        source: candidate.source,
        checked: candidates.map((entry) => entry.root),
      };
    }
  }
  return {
    uiRoot: candidates[0] ? candidates[0].root : path.join(__dirname, "ui"),
    uiRootExists: false,
    source: candidates[0] ? candidates[0].source : "fallback",
    checked: candidates.map((entry) => entry.root),
  };
}

async function listDirectory(ownerRoot, requestedPath) {
  const safePath = toPosixPath(requestedPath || "/");
  const resolved = resolveOwnerPath(ownerRoot, safePath);
  const stats = await fs.stat(resolved);
  if (!stats.isDirectory()) {
    throw new Error("Path is not a directory");
  }

  const entries = await fs.readdir(resolved, { withFileTypes: true });
  const results = [];
  const hiddenSystemFiles = new Set(["shares.json"]);
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name.startsWith("._")) {
      continue;
    }
    if (hiddenSystemFiles.has(entry.name)) {
      continue;
    }
    if (entry.isSymbolicLink()) {
      continue;
    }
    const entryPath = path.join(resolved, entry.name);
    const entryStats = await fs.stat(entryPath);
    results.push({
      name: entry.name,
      type: entry.isDirectory() ? "folder" : "file",
      size: entry.isDirectory() ? 0 : entryStats.size,
      modifiedAt: entryStats.mtime.toISOString(),
      path: toPosixPath(path.posix.join(safePath, entry.name)),
    });
  }
  return results;
}

async function getStorageStats(ownerRoot) {
  let fileCount = 0;
  let folderCount = 0;
  let usedBytes = 0;

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name.startsWith("._")) {
        continue;
      }
      if (entry.isSymbolicLink()) {
        continue;
      }
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        folderCount += 1;
        await walk(entryPath);
        continue;
      }
      const stats = await fs.stat(entryPath);
      fileCount += 1;
      usedBytes += stats.size;
    }
  }

  await walk(ownerRoot);

  return {
    usedBytes,
    totalBytes: 10 * 1024 * 1024 * 1024,
    fileCount,
    folderCount,
  };
}

function formatSharePath(ownerRoot, targetPath) {
  const rel = path.relative(ownerRoot, targetPath);
  const posixRel = rel.replace(/\\/g, "/");
  if (posixRel.startsWith("..")) {
    return `/${path.basename(targetPath)}`;
  }
  return posixRel.startsWith("/") ? posixRel : `/${posixRel}`;
}

function toSafeRelative(inputPath) {
  const value = String(inputPath || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!value || value === ".") return "";
  if (value.includes("..")) {
    throw new Error("Invalid shared path");
  }
  return value;
}

function ensureWithinShareRoot(shareRoot, candidatePath) {
  const root = path.resolve(shareRoot);
  const candidate = path.resolve(candidatePath);
  const normalizedRoot = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (candidate !== root && !candidate.startsWith(normalizedRoot)) {
    throw new Error("Requested path escapes shared root");
  }
  return candidate;
}

function sanitizeDownloadFileName(input) {
  const raw = String(input || "download");
  const normalized = raw.replace(/[\\/:*?"<>|]/g, "_").replace(/[\r\n\t]/g, " ").trim();
  return normalized || "download";
}

function isPreviewableFile(fileName) {
  const mimeType = mime.lookup(fileName) || "";
  return mimeType.startsWith("image/") || mimeType.startsWith("video/") || mimeType === "application/pdf";
}

function sanitizePathSegment(input) {
  const value = String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
  return value || "device";
}

function isPathWithin(rootPath, candidatePath) {
  const root = path.resolve(rootPath);
  const candidate = path.resolve(candidatePath);
  if (candidate === root) return true;
  const normalizedRoot = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  return candidate.startsWith(normalizedRoot);
}

function renderMessagePage({ title, message }) {
  const safeTitle = String(title || "JoinCloud");
  const safeMessage = String(message || "");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      body { margin:0; background:#0A0A0F; color:#fff; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
      .wrap { min-height:100vh; display:grid; place-items:center; padding:20px; }
      .card { width:min(680px,100%); border:1px solid #2A2A35; background:#12121A; border-radius:12px; padding:20px; }
      .brand { color:#2FB7FF; font-weight:700; margin-bottom:10px; }
      h1 { margin:0 0 8px; font-size:24px; }
      p { margin:0; color:#A1A1AA; }
    </style>
  </head>
  <body>
    <main class="wrap">
      <section class="card">
        <div class="brand">JoinCloud</div>
        <h1>${safeTitle}</h1>
        <p>${safeMessage}</p>
      </section>
    </main>
  </body>
</html>`;
}

async function listSharedFolderFiles(shareRoot, subPath = "") {
  const safeSubPath = toSafeRelative(subPath);
  const basePath = ensureWithinShareRoot(shareRoot, path.join(shareRoot, safeSubPath));
  const entries = await fs.readdir(basePath, { withFileTypes: true });
  const items = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name.startsWith("._") || entry.isSymbolicLink()) {
      continue;
    }
    const fullPath = path.join(basePath, entry.name);
    const stats = await fs.stat(fullPath);
    items.push({
      name: entry.name,
      type: entry.isDirectory() ? "folder" : "file",
      size: entry.isDirectory() ? 0 : stats.size,
      modifiedAt: stats.mtime.toISOString(),
      relativePath: path.posix.join(safeSubPath, entry.name).replace(/\\/g, "/"),
    });
  }
  items.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return { folderPath: safeSubPath, items };
}

async function bootstrap() {
  await ensureOwnerStorage(config.storage.ownerRoot);
  await ensureShareStore(config.storage.shareStorePath);
  await ensureLogDir(config.storage.logDir);
  const logger = createLogger(config.storage.logDir);
  logger.info("storage initialized");
  const userConfig = await ensureUserConfig(config.storage.userConfigPath);
  logger.info("user initialized", { user_id: userConfig.user_id });
  const telemetry = createTelemetryStore(config.storage.telemetryPath);
  telemetry.trackEvent("app_started", { user_id: userConfig.user_id });
  const telemetrySync = createTelemetrySync({
    telemetryStore: telemetry,
    userConfig,
    updateUserConfig: (payload) => updateUserConfig(config.storage.userConfigPath, payload),
    adminHost: config.telemetry.adminHost,
    appVersion: getAppVersion(),
    logger,
  });
  telemetrySync.start();

  fetchControlPlaneConfigAndApplyTelemetry(
    config.telemetry.adminHost,
    config.storage.userConfigPath,
    updateUserConfig,
    logger
  );
  const uptimeTimer = startUptimeTracker(telemetry);

  const ownerServer = createOwnerServer({
    ownerRoot: config.storage.ownerRoot,
    realm: config.auth.realm,
    username: config.auth.username,
    password: config.auth.password,
  });

  const shareService = new ShareService({
    ownerRoot: config.storage.ownerRoot,
    defaultPermission: config.share.defaultPermission,
    defaultTtlMs: config.share.defaultTtlMs,
    storagePath: config.storage.shareStorePath,
    logger,
    telemetry,
  });
  await shareService.init();

  const expiryManager = new ExpiryManager({
    shareService,
    intervalMs: config.expiry.sweepIntervalMs,
  });

  expiryManager.start();

  const tunnelManager = new TunnelManager({
    url: `http://127.0.0.1:${config.server.sharePort}`,
    logger,
  });

  const runtimeTelemetry = new RuntimeTelemetryStore({
    storagePath: config.storage.runtimeTelemetryPath,
  });
  await runtimeTelemetry.init();
  runtimeTelemetry.increment("total_app_starts");

  const usageAggregation = createUsageAggregation({
    userDataPath: process.env.JOINCLOUD_USER_DATA,
    adminHost: config.telemetry.adminHost,
    getTelemetryStore: () => telemetry,
    getRuntimeTelemetry: () => runtimeTelemetry.getSummary(),
    getUptimeSeconds: () => Math.floor(process.uptime()),
    logger,
  });
  usageAggregation.start();

  const handler = createMountManager({
    ownerServer,
    shareService,
    shareServerFactory: createShareServer,
    config,
    telemetry,
    runtimeTelemetry,
    usageAggregation,
    logger,
  });

  const app = express();
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const isPrivateOrigin = origin && (
      origin.startsWith("http://127.0.0.1") ||
      origin.startsWith("http://[::1]") ||
      /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin) ||
      /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin) ||
      /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin)
    );
    if (isPrivateOrigin) res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-JoinCloud-Fingerprint, X-JoinCloud-Token");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  app.use(express.json());
  const accessControl = new AccessControlStore({
    storagePath: config.storage.accessControlPath,
    logger,
  });
  await accessControl.init();
  const teamsStore = new TeamsStore({
    storagePath: config.storage.teamsPath ||
      path.join(path.dirname(config.storage.accessControlPath), "teams.json"),
    logger,
  });
  await teamsStore.init();

  function getCurrentDeviceId(req) {
    const access = getRequestContext(req);
    if (access.role === "host") return userConfig?.user_id || "host";
    return access.device_id || "unknown";
  }

  let sharingEnabled = true;

  async function ensureDeviceFolderForSession(session) {
    return null;
  }

  function getRequestContext(req) {
    if (req.joincloudAccess) return req.joincloudAccess;
    if (isLocalhostRequest(req)) {
      return {
        role: "host",
        can_upload: true,
        is_admin: true,
      };
    }
    return {
      role: "remote",
      can_upload: false,
      is_admin: false,
    };
  }

  function canWritePathForContext(context, requestedPath) {
    return true;
  }
  const uiResolution = resolveUiRoot();
  const uiRoot = uiResolution.uiRoot;
  const hasUiRoot = uiResolution.uiRootExists;
  logger.info("ui root resolved", {
    uiRoot,
    exists: hasUiRoot,
    source: uiResolution.source,
  });
  if (hasUiRoot) {
    app.use("/", express.static(uiRoot));
  } else {
    logger.error("ui root missing, static UI not mounted", {
      uiRoot,
      checked: uiResolution.checked,
    });
    app.get("/", (_req, res) => {
      res
        .status(503)
        .send(
          renderMessagePage({
            title: "UI Unavailable",
            message: "JoinCloud UI assets were not found. API is running; reinstall the app package.",
          })
        );
    });
  }
  app.get("/api/v1/cloud/url", (_req, res) => {
    res.json({ url: getCloudUrl() });
  });

  app.post("/api/auth/register", async (req, res) => {
    const adminHost = config.telemetry.adminHost;
    if (!adminHost) {
      res.status(503).json({ message: "Control Plane not configured. Set JOINCLOUD_ADMIN_HOST." });
      return;
    }
    const paths = getActivationPaths();
    if (!paths) {
      res.status(503).json({ message: "Activation not available in this environment." });
      return;
    }
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ message: "Email and password required" });
      return;
    }
    controlPlanePost(adminHost, "/api/v1/auth/register", { email, password }, null, async (err, result) => {
      if (err) {
        logger.warn("auth register proxy error", { error: err.message });
        res.status(502).json({ message: "Could not reach Control Plane" });
        return;
      }
      if (result.statusCode !== 201 || !result.data.token) {
        res.status(result.statusCode || 400).json(result.data || { message: "Registration failed" });
        return;
      }
      try {
        await fs.mkdir(paths.systemDir, { recursive: true });
        await fs.writeFile(paths.authPath, JSON.stringify({ token: result.data.token }, null, 2), "utf8");
      } catch (e) {
        logger.error("write auth.json failed", { error: e.message });
        res.status(500).json({ message: "Failed to save session" });
        return;
      }
      res.status(201).json(result.data);
    });
  });

  app.post("/api/auth/login", async (req, res) => {
    const adminHost = config.telemetry.adminHost;
    if (!adminHost) {
      res.status(503).json({ message: "Control Plane not configured. Set JOINCLOUD_ADMIN_HOST." });
      return;
    }
    const paths = getActivationPaths();
    if (!paths) {
      res.status(503).json({ message: "Activation not available in this environment." });
      return;
    }
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ message: "Email and password required" });
      return;
    }
    controlPlanePost(adminHost, "/api/v1/auth/login", { email, password }, null, async (err, result) => {
      if (err) {
        logger.warn("auth login proxy error", { error: err.message });
        res.status(502).json({ message: "Could not reach Control Plane" });
        return;
      }
      if (result.statusCode !== 200 || !result.data.token) {
        res.status(result.statusCode || 401).json(result.data || { message: "Login failed" });
        return;
      }
      try {
        await fs.mkdir(paths.systemDir, { recursive: true });
        await fs.writeFile(paths.authPath, JSON.stringify({ token: result.data.token }, null, 2), "utf8");
      } catch (e) {
        logger.error("write auth.json failed", { error: e.message });
        res.status(500).json({ message: "Failed to save session" });
        return;
      }
      res.json(result.data);
    });
  });

  app.post("/api/license/activate", async (req, res) => {
    const adminHost = config.telemetry.adminHost;
    if (!adminHost) {
      res.status(503).json({ message: "Control Plane not configured. Set JOINCLOUD_ADMIN_HOST." });
      return;
    }
    const paths = getActivationPaths();
    if (!paths) {
      res.status(503).json({ message: "Activation not available in this environment." });
      return;
    }
    const hostUuid = getHostUuidForConfig();
    if (!hostUuid) {
      res.status(400).json({ message: "Device not registered. Restart the app and try again." });
      return;
    }
    controlPlanePost(adminHost, "/api/v1/license/activate-device", { host_uuid: hostUuid }, null, async (err, result) => {
      if (err) {
        logger.warn("license activate proxy error", { error: err.message });
        res.status(502).json({ message: "Could not reach Control Plane" });
        return;
      }
      if (result.statusCode !== 200) {
        res.status(result.statusCode || 403).json(result.data || { message: "Activation failed" });
        return;
      }
      const license = result.data;
      if (!license || !license.license_id) {
        res.status(502).json({ message: "Invalid license response" });
        return;
      }
      try {
        await fs.writeFile(paths.licensePath, JSON.stringify(license, null, 2), "utf8");
      } catch (e) {
        logger.error("write license.json failed", { error: e.message });
        res.status(500).json({ message: "Failed to save license" });
        return;
      }
      controlPlaneConfigCache = {
        license: { state: license.state || "active", ...license },
        activation: { required: false },
        telemetry: (controlPlaneConfigCache && controlPlaneConfigCache.telemetry) || {},
      };
      res.json(license);
    });
  });

  app.get("/api/support/messages", (req, res) => {
    const adminHost = config.telemetry.adminHost;
    if (!adminHost) {
      res.status(503).json({ message: "Control Plane not configured.", messages: [] });
      return;
    }
    const deviceUUID = userConfig.user_id;
    if (!deviceUUID) {
      res.status(400).json({ message: "Device not identified.", messages: [] });
      return;
    }
    controlPlaneGet(adminHost, `/api/messages/${encodeURIComponent(deviceUUID)}`, (err, result) => {
      if (err) {
        logger.warn("support messages proxy error", { error: err.message });
        res.status(502).json({ message: "Could not reach Control Plane.", messages: [] });
        return;
      }
      const messages = result.data?.messages ?? [];
      res.json({ messages });
    });
  });

  app.post("/api/support/send", (req, res) => {
    const adminHost = config.telemetry.adminHost;
    if (!adminHost) {
      res.status(503).json({ message: "Control Plane not configured." });
      return;
    }
    const deviceUUID = userConfig.user_id;
    if (!deviceUUID) {
      res.status(400).json({ message: "Device not identified." });
      return;
    }
    const text = req.body?.text != null ? String(req.body.text).trim() : "";
    if (!text) {
      res.status(400).json({ message: "Message text required." });
      return;
    }
    controlPlanePost(adminHost, `/api/messages/${encodeURIComponent(deviceUUID)}/reply`, { sender: "device", text }, null, (err, result) => {
      if (err) {
        logger.warn("support send proxy error", { error: err.message });
        res.status(502).json({ message: "Could not reach Control Plane." });
        return;
      }
      if (result.statusCode < 200 || result.statusCode >= 300) {
        res.status(result.statusCode || 500).json(result.data || { message: "Send failed." });
        return;
      }
      res.status(201).json(result.data || {});
    });
  });

  app.get("/api/v1/build", (_req, res) => {
    res.json({
      build_id: BUILD_ID,
      version: getAppVersion(),
      started_at: BUILD_STAMP,
      ui_root: uiRoot,
      ui_root_exists: hasUiRoot,
    });
  });

  app.get("/api/v1/diagnostics/ping", (req, res) => {
    const bytes = Math.min(
      Math.max(parseInt(req.query.bytes, 10) || 1048576, 1),
      524288000
    );
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", String(bytes));
    res.setHeader("Cache-Control", "no-store");
    const chunkSize = 65536;
    let remaining = bytes;
    const randomStream = new stream.Readable({
      read() {
        if (remaining <= 0) {
          this.push(null);
          return;
        }
        const toSend = Math.min(chunkSize, remaining);
        remaining -= toSend;
        this.push(crypto.randomBytes(toSend));
      },
    });
    randomStream.pipe(res);
  });

  app.get("/api/v1/diagnostics/info", async (_req, res) => {
    const uptimeMs = Date.now() - (global.SERVER_START_TIME || Date.now());
    const currentUptimeSeconds = Math.floor(uptimeMs / 1000);
    let dailyAverageSeconds = null;
    try {
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - 30);
      const rows = await telemetry.listDailyMetrics(sinceDate.toISOString().slice(0, 10));
      const total = rows.reduce((s, r) => s + (r.uptime_seconds || 0), 0);
      dailyAverageSeconds = rows.length > 0 ? Math.round(total / rows.length) : null;
    } catch (_) {}
    const displayName = userConfig?.display_name || "Join";
    const endpoints = getNetworkEndpoints(displayName, config.server.port, config.server.shareBasePath);
    res.json({
      version: getAppVersion(),
      build_id: BUILD_ID,
      lan_ip: getLanAddress(),
      best_lan_ip: endpoints.bestLanIp,
      port: config.server.port,
      share_port: config.server.sharePort,
      uptime_seconds: currentUptimeSeconds,
      uptime_daily_average_seconds: dailyAverageSeconds,
    });
  });

  app.get("/api/v1/technical-config", (req, res) => {
    if (!isLocalhostRequest(req)) {
      res.status(403).json({ error: "host_only" });
      return;
    }
    res.json({
      host_id: userConfig?.user_id || null,
      device_id: null,
      local_ips: getAllLanIps(),
      port: config.server.port,
      share_port: config.server.sharePort,
      app_version: getAppVersion(),
      license_state: null,
    });
  });

  app.get("/api/v1/status", (_req, res) => {
    res.json({ running: !!sharingEnabled, sharing_enabled: !!sharingEnabled });
  });

  app.get("/api/v1/peer", (_req, res) => {
    const hostId = userConfig?.user_id || "host";
    const displayName = userConfig?.display_name || "Join";
    res.json({
      deviceId: hostId,
      displayName,
      port: config.server.port,
      hostname: `join-${shortDeviceId(hostId)}.local`,
      bestLanIp: getBestLanIp(),
    });
  });

  app.get("/api/v1/access/session", async (req, res) => {
    if (isLocalhostRequest(req)) {
      res.json({ authorized: true, role: "admin", cloud_url: getCloudUrl() });
      return;
    }
    if (!sharingEnabled) {
      res.status(423).json({
        authorized: false,
        reason: "sharing_stopped",
        message: "Sharing is currently stopped by the admin.",
      });
      return;
    }
    const fingerprint = getRequestFingerprint(req);
    const token = getRequestToken(req);
    const validation = await accessControl.validateSession({ token, fingerprint });
    if (!validation.authorized) {
      res.status(401).json({ authorized: false, reason: validation.reason });
      return;
    }
    await ensureDeviceFolderForSession(validation.session);
    res.json({
      authorized: true,
      role: "remote",
      cloud_url: getCloudUrl(),
      device_id: validation.session.device_id,
      device_name: validation.session.device_name,
      device_folder_rel: null,
    });
  });

  app.get("/api/v1/access/me", async (req, res) => {
    if (isLocalhostRequest(req)) {
      res.json({
        role: "host",
        device_id: "host",
        device_name: "Host",
        device_folder_rel: null,
        can_upload: true,
      });
      return;
    }
    const fingerprint = getRequestFingerprint(req);
    const token = getRequestToken(req);
    const validation = await accessControl.validateSession({ token, fingerprint });
    if (!validation.authorized) {
      res.status(401).json({ error: "approval_required", reason: validation.reason });
      return;
    }
    await ensureDeviceFolderForSession(validation.session);
    res.json({
      role: "device",
      device_id: validation.session.device_id || sanitizePathSegment(validation.session.fingerprint),
      device_name: validation.session.device_name || "Unknown Device",
      device_folder_rel: null,
      can_upload: true,
    });
  });

  app.post("/api/v1/access/request", async (req, res) => {
    if (!sharingEnabled && !isLocalhostRequest(req)) {
      res.status(423).json({ error: "sharing_stopped", message: "Sharing is currently stopped by the admin." });
      return;
    }
    const body = req.body || {};
    const fingerprint = String(body.fingerprint || getRequestFingerprint(req) || "").trim();
    if (!fingerprint) {
      res.status(400).json({ error: "fingerprint is required" });
      return;
    }
    const created = await accessControl.createRequest({
      device_name: String(body.device_name || "").trim(),
      fingerprint,
      user_agent: String(body.user_agent || req.headers["user-agent"] || ""),
      ip: getClientIp(req),
    });
    addServerNotification({
      type: "connect_request",
      title: "Connect request",
      body: `${String(body.device_name || "Unknown").trim() || "A device"} wants to connect`,
      deviceId: fingerprint,
      targetRoute: "home",
    });
    logger.info("device access request created");
    runtimeTelemetry.increment("device_requests");
    res.json({ request_id: created.request_id, status: created.status });
  });

  app.get("/api/v1/access/status", async (req, res) => {
    const requestId = String(req.query.request_id || "").trim();
    if (!requestId) {
      res.status(400).json({ error: "request_id is required" });
      return;
    }
    const request = await accessControl.getRequest(requestId);
    if (!request) {
      res.status(404).json({ status: "expired" });
      return;
    }
    const fingerprint = getRequestFingerprint(req);
    if (!fingerprint || request.fingerprint !== fingerprint) {
      res.status(403).json({ status: "denied" });
      return;
    }
    if (request.status === "approved" && request.session_token) {
      res.json({
        status: "approved",
        session_token: request.session_token,
      });
      return;
    }
    res.json({ status: request.status });
  });

  function ensureAdmin(req, res, next) {
    if (!isLocalhostRequest(req)) {
      logger.warn("blocked host-only action from remote", {
        path: req.path,
        ip: getClientIp(req),
      });
      res.status(403).json({ error: "admin access required" });
      return;
    }
    next();
  }

  app.post("/api/v1/sharing/stop", ensureAdmin, (_req, res) => {
    sharingEnabled = false;
    logger.info("sharing stopped by admin");
    runtimeTelemetry.increment("sharing_stop_count");
    stopDiscovery();
    res.json({ running: false, sharing_enabled: false });
  });

  app.post("/api/v1/sharing/start", ensureAdmin, (_req, res) => {
    sharingEnabled = true;
    logger.info("sharing started by admin");
    runtimeTelemetry.increment("sharing_start_count");
    startDiscovery();
    res.json({ running: true, sharing_enabled: true });
  });

  app.post("/api/v1/app/quit", ensureAdmin, (_req, res) => {
    logger.info("app quit requested");
    res.json({ ok: true });
    setTimeout(() => process.kill(process.pid, "SIGTERM"), 20);
  });

  app.get("/api/v1/access/pending", ensureAdmin, async (_req, res) => {
    const pending = await accessControl.getPending();
    res.json(pending);
  });

  app.get("/api/v1/access/devices", ensureAdmin, async (_req, res) => {
    const devices = await accessControl.listApprovedDevices();
    res.json(devices);
  });

  app.post("/api/v1/access/approve", ensureAdmin, async (req, res) => {
    const requestId = String(req.body?.request_id || "").trim();
    if (!requestId) {
      res.status(400).json({ error: "request_id is required" });
      return;
    }
    const approved = await accessControl.approveRequest(requestId);
    if (!approved) {
      res.status(404).json({ error: "pending request not found" });
      return;
    }
    await ensureDeviceFolderForSession(approved.request);
    logger.info("device request approved");
    runtimeTelemetry.increment("devices_approved");
    res.json({
      status: "approved",
      request_id: requestId,
      device_id: approved.request.device_id,
      device_folder_rel: null,
    });
  });

  app.post("/api/v1/access/deny", ensureAdmin, async (req, res) => {
    const requestId = String(req.body?.request_id || "").trim();
    if (!requestId) {
      res.status(400).json({ error: "request_id is required" });
      return;
    }
    const denied = await accessControl.denyRequest(requestId);
    if (!denied) {
      res.status(404).json({ error: "pending request not found" });
      return;
    }
    logger.info("device request denied");
    runtimeTelemetry.increment("devices_denied");
    res.json({ status: "denied", request_id: requestId });
  });

  app.post("/api/v1/access/devices/remove", ensureAdmin, async (req, res) => {
    const fingerprint = String(req.body?.fingerprint || "").trim();
    if (!fingerprint) {
      res.status(400).json({ error: "fingerprint is required" });
      return;
    }
    const result = await accessControl.removeApprovedDevice(fingerprint);
    logger.info("approved device removed");
    runtimeTelemetry.increment("devices_removed");
    res.json({ status: "removed", fingerprint, ...result });
  });

  app.get("/api/v1/telemetry/summary", ensureAdmin, (_req, res) => {
    res.json(runtimeTelemetry.getSummary());
  });

  app.get("/api/v1/activity/summary", ensureAdmin, async (_req, res) => {
    const pending = await accessControl.getPending();
    const devices = await accessControl.listApprovedDevices();
    const telemetrySummary = runtimeTelemetry.getSummary();
    const storageStats = await getStorageStats(config.storage.ownerRoot);
    const totalUploads = devices.reduce((sum, device) => sum + Number(device.uploads || 0), 0);
    const totalDownloads = devices.reduce((sum, device) => sum + Number(device.downloads || 0), 0);
    res.json({
      build_id: BUILD_ID,
      pending_count: pending.length,
      connected_devices: devices.length,
      devices,
      telemetry: telemetrySummary,
      metrics: {
        total_uploads: Number(telemetrySummary.total_uploads || totalUploads),
        total_downloads: totalDownloads,
        total_shares_created: Number(telemetrySummary.total_shares_created || 0),
        total_share_downloads: Number(telemetrySummary.total_downloads || 0),
        storage_used_bytes: Number(storageStats.usedBytes || 0),
      },
    });
  });

  app.get("/share/:shareId", (req, res) => {
    if (!sharingEnabled) {
      res
        .status(423)
        .send(
          renderMessagePage({
            title: "Sharing Stopped",
            message: "Sharing is currently stopped by the admin. Please try again later.",
          })
        );
      return;
    }
    const share = shareService.getShare(req.params.shareId);
    if (!share) {
      const record = shareService.getShareRecord(req.params.shareId);
      if (record && record.revoked) {
        res
          .status(410)
          .send(
            renderMessagePage({
              title: "Share Revoked",
              message: "This share link has been revoked.",
            })
          );
        return;
      }
      res.status(404).send(renderMessagePage({ title: "Share Not Found", message: "This share link is invalid or expired." }));
      return;
    }
    runtimeTelemetry.increment("share_page_visits");
    logger.info("share page visited");
    res.sendFile(path.join(uiRoot, "share.html"));
  });

  app.get("/share/:shareId/meta", (req, res) => {
    if (!sharingEnabled) {
      res.status(423).json({ error: "sharing_stopped", message: "Sharing is currently stopped by the admin." });
      return;
    }
    const share = shareService.getShare(req.params.shareId);
    if (!share) {
      res.status(404).json({ error: "share_not_found" });
      return;
    }
    const name = path.basename(share.targetPath) || "Shared Item";
    const isFile = (share.targetType || "file") === "file";
    let size = null;
    try {
      const stats = fsSync.statSync(share.targetPath);
      size = stats.isFile() ? stats.size : null;
    } catch (_error) {
      size = null;
    }
    const deviceHash = hashDeviceId(userConfig.user_id);
    const marketingUrl = `https://joincloud.in/?utm_source=share&utm_medium=link&utm_content=${deviceHash}`;
    res.json({
      shareId: share.shareId,
      targetType: share.targetType || "file",
      permission: share.permission || "read-only",
      name,
      size,
      downloadUrl: isFile
        ? `/share/${encodeURIComponent(share.shareId)}/download`
        : null,
      previewUrl: isFile && isPreviewableFile(name)
        ? `/share/${encodeURIComponent(share.shareId)}/preview`
        : null,
      zipUrl: !isFile ? `/share/${encodeURIComponent(share.shareId)}/download.zip` : null,
      marketingUrl,
      expiresAt: share.expiryTime,
    });
  });

  app.get("/share/:shareId/files", async (req, res) => {
    if (!sharingEnabled) {
      res.status(423).json({ error: "sharing_stopped", message: "Sharing is currently stopped by the admin." });
      return;
    }
    const share = shareService.getShare(req.params.shareId);
    if (!share) {
      res.status(404).json({ error: "share_not_found" });
      return;
    }
    if ((share.targetType || "file") !== "folder") {
      res.status(400).json({ error: "share_is_not_folder" });
      return;
    }
    try {
      const listing = await listSharedFolderFiles(share.targetPath, req.query.path || "");
      const payload = {
        ...listing,
        items: listing.items.map((item) => ({
          ...item,
          previewUrl:
            item.type === "file" && isPreviewableFile(item.name)
              ? `/share/${encodeURIComponent(share.shareId)}/preview?path=${encodeURIComponent(item.relativePath)}`
              : null,
          downloadUrl:
            item.type === "file"
              ? `/share/${encodeURIComponent(share.shareId)}/download?path=${encodeURIComponent(item.relativePath)}`
              : null,
        })),
      };
      res.json(payload);
    } catch (error) {
      logger.error("folder share listing failed", { error: error.message });
      res.status(400).json({ error: error.message || "failed_to_list_folder" });
    }
  });

  app.get("/share/:shareId/preview", async (req, res) => {
    if (!sharingEnabled) {
      res.status(423).send("sharing_stopped");
      return;
    }
    const share = shareService.getShare(req.params.shareId);
    if (!share) {
      res.status(404).send("share_not_found");
      return;
    }
    try {
      let filePath = share.targetPath;
      if ((share.targetType || "file") === "folder") {
        const relativePath = toSafeRelative(req.query.path || "");
        if (!relativePath) {
          res.status(400).send("file path is required");
          return;
        }
        filePath = ensureWithinShareRoot(share.targetPath, path.join(share.targetPath, relativePath));
      }
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        res.status(400).send("not_a_file");
        return;
      }
      const fileName = sanitizeDownloadFileName(path.basename(filePath));
      if (!isPreviewableFile(fileName)) {
        res.status(415).send("preview_not_supported");
        return;
      }
      const contentType = mime.lookup(fileName) || "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
      );
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Content-Length", String(stats.size));
      res.flushHeaders();
      const readStream = fsSync.createReadStream(filePath, { highWaterMark: 2 * 1024 * 1024 });
      const passThrough = new stream.PassThrough({ highWaterMark: 8 * 1024 * 1024 });
      pipeline(readStream, passThrough, res).catch((err) => {
        if (err.code !== "ERR_STREAM_PREMATURE_CLOSE" && !err.message?.includes("aborted")) {
          logger.error("share preview error", { error: err.message });
        }
        if (!res.headersSent) res.status(500).send("preview_failed");
        else res.destroy();
      });
    } catch (error) {
      res.status(400).send(error.message || "preview_failed");
    }
  });

  app.get("/share/:shareId/download.zip", async (req, res) => {
    if (!sharingEnabled) {
      res.status(423).send("sharing_stopped");
      return;
    }
    const share = shareService.getShare(req.params.shareId);
    if (!share) {
      res.status(404).send("share_not_found");
      return;
    }
    if ((share.targetType || "file") !== "folder") {
      res.status(400).send("share_is_not_folder");
      return;
    }
    const selectionRaw = String(req.query.paths || "").trim();
    const selected = selectionRaw
      ? selectionRaw
          .split(",")
          .map((part) => toSafeRelative(part))
          .filter(Boolean)
      : [];
    const archiveName = `${sanitizeDownloadFileName(path.basename(share.targetPath) || "shared-folder")}.zip`;
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${archiveName}"; filename*=UTF-8''${encodeURIComponent(archiveName)}`
    );
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");

    const zipLevel = Number(process.env.JOINCLOUD_ZIP_LEVEL) || 0;
    const archive = archiver("zip", { zlib: { level: zipLevel } });
    const startTime = Date.now();
    let bytesWritten = 0;
    let lastLogAt = startTime;

    const clientIp = getClientIp(req);
    req.on("aborted", () => {
      try {
        if (typeof archive.abort === "function") archive.abort();
        else archive.destroy();
      } catch (_) {}
      if (!res.destroyed) res.destroy();
      const durationMs = Date.now() - startTime;
      const mbPerSec = durationMs > 0 ? bytesWritten / (1024 * 1024) / (durationMs / 1000) : 0;
      logger.info("zip download aborted", { client_ip: clientIp, bytes_written: bytesWritten, duration_ms: durationMs, mb_per_sec: mbPerSec.toFixed(2) });
    });

    res.on("drain", () => {
      const now = Date.now();
      if (now - lastLogAt > 10000 && bytesWritten > 0) {
        lastLogAt = now;
        const durationMs = now - startTime;
        const mbPerSec = durationMs > 0 ? bytesWritten / (1024 * 1024) / (durationMs / 1000) : 0;
        logger.info("zip download progress", { bytes_written: bytesWritten, duration_ms: durationMs, mb_per_sec: mbPerSec.toFixed(2) });
      }
    });

    const countingStream = new stream.PassThrough({ highWaterMark: 2 * 1024 * 1024 });
    countingStream.on("data", (chunk) => {
      bytesWritten += chunk.length;
    });

    archive.on("error", (err) => {
      logger.error("zip archive error", { error: err?.message });
      if (!res.headersSent) {
        res.status(500).end("zip_failed");
      } else if (!res.destroyed) {
        res.destroy();
      }
    });
    
    archive.pipe(countingStream);
    pipeline(countingStream, res).catch((err) => {
      const isAbort = err.code === "ERR_STREAM_PREMATURE_CLOSE" || err.message?.includes("aborted");
      if (!isAbort) logger.error("zip download stream error", { error: err?.message });
      if (!res.headersSent) res.status(500).end("zip_failed");
      else if (!res.destroyed) res.destroy();
    });

    try {
      if (!selected.length) {
        archive.directory(share.targetPath, false);
      } else {
        for (const relPath of selected) {
          if (req.destroyed || res.destroyed) break;
          const fullPath = ensureWithinShareRoot(share.targetPath, path.join(share.targetPath, relPath));
          const stats = await fs.stat(fullPath);
          if (stats.isDirectory()) {
            archive.directory(fullPath, relPath);
          } else if (stats.isFile()) {
            archive.file(fullPath, { name: relPath });
          }
        }
      }
      await archive.finalize();
      const durationMs = Date.now() - startTime;
      const mbPerSec = durationMs > 0 ? bytesWritten / (1024 * 1024) / (durationMs / 1000) : 0;
      logger.info("zip download complete", { bytes_written: bytesWritten, duration_ms: durationMs, mb_per_sec: mbPerSec.toFixed(2), client_ip: clientIp });
    } catch (err) {
      logger.error("zip download error", { error: err?.message });
      if (!res.headersSent) res.status(500).end("zip_failed");
      else if (!res.destroyed) res.destroy();
    }
  });

  app.get("/share/:shareId/download", async (req, res) => {
    if (!sharingEnabled) {
      res
        .status(423)
        .send(
          renderMessagePage({
            title: "Sharing Stopped",
            message: "Sharing is currently stopped by the admin. Please try again later.",
          })
        );
      return;
    }
    const share = shareService.getShare(req.params.shareId);
    if (!share) {
      const record = shareService.getShareRecord(req.params.shareId);
      if (record && record.revoked) {
        res
          .status(410)
          .send(
            renderMessagePage({
              title: "Share Revoked",
              message: "This share link has been revoked.",
            })
          );
        return;
      }
      res.status(404).send(renderMessagePage({ title: "Share Not Found", message: "This share link is invalid or expired." }));
      return;
    }
    try {
      let filePath = share.targetPath;
      if ((share.targetType || "file") === "folder") {
        const relativePath = toSafeRelative(req.query.path || "");
        if (!relativePath) {
          res.status(400).send("file path is required");
          return;
        }
        filePath = ensureWithinShareRoot(share.targetPath, path.join(share.targetPath, relativePath));
      }
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        res.status(400).send("not a file");
        return;
      }
      const fileName = sanitizeDownloadFileName(path.basename(filePath));
      const contentType = mime.lookup(fileName) || "application/octet-stream";
      const fileSize = stats.size;
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Length", String(fileSize));
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
      );
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "no-store");

      res.flushHeaders();

      const clientIp = getClientIp(req);
      const startTime = Date.now();
      logger.info("share download start", { path: filePath, size: fileSize, client_ip: clientIp });

      const READ_HWM = 2 * 1024 * 1024;
      const PASS_HWM = 8 * 1024 * 1024;
      const readStream = fsSync.createReadStream(filePath, { highWaterMark: READ_HWM });
      const passThrough = new stream.PassThrough({ highWaterMark: PASS_HWM });

      req.on("aborted", () => {
        readStream.destroy();
        passThrough.destroy();
        if (!res.destroyed) res.destroy();
        logger.info("share download aborted", { client_ip: clientIp });
      });

      runtimeTelemetry.increment("total_downloads");

      pipeline(readStream, passThrough, res).then(() => {
        const durationMs = Date.now() - startTime;
        const mbPerSec = durationMs > 0 ? (fileSize / (1024 * 1024)) / (durationMs / 1000) : 0;
        logger.info("share download end", {
          bytes_sent: fileSize,
          duration_ms: durationMs,
          mb_per_sec: mbPerSec.toFixed(2),
        });
      }).catch((err) => {
        const isAbort = err.code === "ERR_STREAM_PREMATURE_CLOSE" || err.message?.includes("aborted");
        if (isAbort) {
          logger.info("share download aborted", { client_ip: clientIp });
        } else {
          logger.error("share download error", { error: err.message });
        }
        if (!res.headersSent) {
          res.status(500).send("download_failed");
        } else {
          res.destroy();
        }
      });
    } catch (error) {
      res.status(400).send(error.message || "download_failed");
    }
  });

  app.post("/share/:shareId/upload", async (req, res) => {
    if (!sharingEnabled) {
      res.status(423).json({ error: "sharing_stopped", message: "Sharing is currently stopped." });
      return;
    }
    const share = shareService.getShare(req.params.shareId);
    if (!share) {
      res.status(404).json({ error: "share_not_found" });
      return;
    }
    if ((share.targetType || "file") !== "folder") {
      res.status(400).json({ error: "share_is_not_folder" });
      return;
    }
    if ((share.permission || "read-only") !== "read-write") {
      res.status(403).json({ error: "read_only_share", message: "This share is read-only." });
      return;
    }
    const contentType = req.headers["content-type"] || "";
    if (!contentType.includes("multipart/form-data")) {
      res.status(400).json({ error: "multipart form data required" });
      return;
    }
    const fields = {};
    const stored = [];
    let targetDir = share.targetPath;
    const busboy = Busboy({ headers: { "content-type": contentType } });
    busboy.on("field", (name, value) => {
      fields[name] = value;
      if (name === "path" && value) {
        const parentRel = toSafeRelative(value) || "";
        if (parentRel) {
          try {
            targetDir = ensureWithinShareRoot(share.targetPath, path.join(share.targetPath, parentRel));
          } catch (_e) {
            targetDir = null;
          }
        }
      }
    });
    busboy.on("file", (fieldname, file, info) => {
      if (!targetDir) {
        file.resume();
        return;
      }
      const { filename } = info;
      const cleanName = (filename || "upload").replace(/[\\/:*?"<>|]/g, "_").trim() || "upload";
      const dest = path.join(targetDir, cleanName);
      const destDir = path.dirname(dest);
      fs.mkdir(destDir, { recursive: true }).catch(() => {});
      const writeStream = fsSync.createWriteStream(dest, { flags: "w" });
      file.pipe(writeStream);
      writeStream.on("finish", () => {
        stored.push(cleanName);
      });
      writeStream.on("error", (err) => {
        logger.error("share upload write failed", { file: cleanName, error: err.message });
      });
    });
    busboy.on("finish", async () => {
      const parentRel = toSafeRelative(fields.path || "") || "";
      res.json({ success: true, saved_to: parentRel || "/", uploaded: stored.length, files: stored });
    });
    busboy.on("error", (err) => {
      logger.error("share upload parse failed", { error: err.message });
      if (!res.headersSent) res.status(400).json({ error: err.message || "upload_failed" });
    });
    req.pipe(busboy);
  });

  app.use("/api", async (req, res, next) => {
    const publicApiPaths = new Set([
      "/v1/health",
      "/v1/build",
      "/v1/status",
      "/v1/cloud/url",
      "/v1/diagnostics/ping",
      "/v1/diagnostics/info",
      "/v1/access/session",
      "/v1/access/me",
      "/v1/access/request",
      "/v1/access/status",
      "/v1/peer",
      "/v1/teams/invite/receive",
    ]);
    if (publicApiPaths.has(req.path)) {
      next();
      return;
    }
    if (isLocalhostRequest(req)) {
      req.joincloudAccess = {
        role: "host",
        can_upload: true,
        is_admin: true,
      };
      next();
      return;
    }
    if (!sharingEnabled) {
      res.status(423).json({ error: "sharing_stopped", message: "Sharing is currently stopped by the admin." });
      return;
    }
    const fingerprint = getRequestFingerprint(req);
    const token = getRequestToken(req);
    const validation = await accessControl.validateSession({ token, fingerprint });
    if (!validation.authorized) {
      res.status(401).json({ error: "approval_required", reason: validation.reason });
      return;
    }
    await ensureDeviceFolderForSession(validation.session);
    req.joincloudAccess = {
      role: "remote",
      can_upload: true,
      is_admin: false,
      token,
      fingerprint,
      device_id: validation.session.device_id,
      device_name: validation.session.device_name,
      device_folder_rel: null,
    };
    next();
  });

  app.get("/privacy", (_req, res) => {
    res.sendFile(path.join(__dirname, "..", "docs", "privacy.md"));
  });

  const mdnsHostname = `join-${shortDeviceId(userConfig?.user_id || "host")}.local`;

  function checkMdnsResolvable(hostname) {
    return new Promise((resolve) => {
      const t = setTimeout(() => resolve(false), 3000);
      dns.lookup(hostname, { all: false }, (err, addr) => {
        clearTimeout(t);
        resolve(!err && addr);
      });
    });
  }

  app.get("/api/status", async (_req, res) => {
    const displayName = userConfig?.display_name || "Join";
    const endpoints = getNetworkEndpoints(displayName, config.server.port, config.server.shareBasePath);
    const lanIp = endpoints.bestLanIp;
    const uptimeMs = Date.now() - (global.SERVER_START_TIME || Date.now());
    const currentUptimeSeconds = Math.floor(uptimeMs / 1000);
    let dailyAverageSeconds = null;
    try {
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - 30);
      const rows = await telemetry.listDailyMetrics(sinceDate.toISOString().slice(0, 10));
      const total = rows.reduce((s, r) => s + (r.uptime_seconds || 0), 0);
      dailyAverageSeconds = rows.length > 0 ? Math.round(total / rows.length) : null;
    } catch (_) {}
    const mdnsResolvable = sharingEnabled ? await checkMdnsResolvable(mdnsHostname) : false;
    res.json({
      status: sharingEnabled ? "running" : "stopped",
      sharing_enabled: !!sharingEnabled,
      ownerBasePath: config.server.ownerBasePath,
      shareBasePath: config.server.shareBasePath,
      lanBaseUrl: `http://${lanIp}:${config.server.port}`,
      shareLinkUrls: {
        ip: endpoints.ipUrl,
      },
      publicBaseUrl: config.server.publicBaseUrl,
      storageLabel: "Local storage",
      bestLanIp: lanIp,
      port: config.server.port,
      uptime_seconds: currentUptimeSeconds,
      uptime_daily_average_seconds: dailyAverageSeconds,
      network_changed_at: lastNetworkChangeAt || null,
      mdns_hostname: mdnsHostname,
      mdns_resolvable: mdnsResolvable,
    });
  });

  app.get("/api/storage", async (_req, res) => {
    try {
      const stats = await getStorageStats(config.storage.ownerRoot);
      res.json({
        ...stats,
        storageLabel: "Local storage",
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to load storage stats" });
    }
  });

  app.get("/api/files", async (req, res) => {
    try {
      const requestedPath = req.query.path || "/";
      const items = await listDirectory(config.storage.ownerRoot, requestedPath);
      res.json({ path: toPosixPath(requestedPath), items });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/v1/file", async (req, res) => {
    const rawPath = req.query.path;
    if (!rawPath || typeof rawPath !== "string") {
      res.status(400).json({ error: "path query parameter required" });
      return;
    }
    const requestedPath = toPosixPath(rawPath.trim() || "/");
    const access = getRequestContext(req);
    if (!canWritePathForContext(access, requestedPath)) {
      res.status(403).json({ error: "write_outside_device_folder_denied" });
      return;
    }
    let fullPath;
    try {
      fullPath = resolveOwnerPath(config.storage.ownerRoot, requestedPath);
    } catch (err) {
      res.status(400).json({ error: err.message || "invalid_path" });
      return;
    }
    try {
      const stats = await fs.stat(fullPath);
      if (stats.isDirectory()) {
        await fs.rm(fullPath, { recursive: true });
      } else {
        await fs.unlink(fullPath);
      }
      logger.info("file deleted", { path: requestedPath });
      res.json({ success: true, path: requestedPath });
    } catch (err) {
      if (err.code === "ENOENT") {
        res.status(404).json({ error: "not_found" });
        return;
      }
      logger.error("delete failed", { path: requestedPath, error: err.message });
      res.status(500).json({ error: err.message || "delete_failed" });
    }
  });

  app.get("/api/v1/file/content", async (req, res) => {
    try {
      const requestedPath = req.query.path || "/";
      const resolvedPath = resolveOwnerPath(config.storage.ownerRoot, toPosixPath(requestedPath));
      const stats = await fs.stat(resolvedPath);
      if (!stats.isFile()) {
        res.status(400).json({ error: "not_a_file" });
        return;
      }
      const fileName = sanitizeDownloadFileName(path.basename(resolvedPath));
      const contentType = mime.lookup(fileName) || "application/octet-stream";
      const fileSize = stats.size;
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Length", String(fileSize));
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
      );
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "no-store");
      const access = getRequestContext(req);
      if (access.role === "remote" && access.fingerprint) {
        await accessControl.incrementDeviceStat(access.fingerprint, "downloads", 1);
      }
      res.flushHeaders();

      const clientIp = getClientIp(req);
      const startTime = Date.now();
      logger.info("file content download start", { path: resolvedPath, size: fileSize, client_ip: clientIp });

      const readStream = fsSync.createReadStream(resolvedPath, { highWaterMark: 2 * 1024 * 1024 });
      const passThrough = new stream.PassThrough({ highWaterMark: 8 * 1024 * 1024 });

      pipeline(readStream, passThrough, res).then(() => {
        const durationMs = Date.now() - startTime;
        const mbPerSec = durationMs > 0 ? (fileSize / (1024 * 1024)) / (durationMs / 1000) : 0;
        logger.info("file content download end", {
          bytes_sent: fileSize,
          duration_ms: durationMs,
          mb_per_sec: mbPerSec.toFixed(2),
        });
      }).catch((err) => {
        if (err.code !== "ERR_STREAM_PREMATURE_CLOSE" && !err.message?.includes("aborted")) {
          logger.error("file content download error", { error: err.message });
        }
        if (!res.headersSent) res.status(500).json({ error: "download_failed" });
        else res.destroy();
      });
    } catch (error) {
      res.status(400).json({ error: error.message || "preview_failed" });
    }
  });

  app.post("/api/share", async (req, res) => {
    try {
      const access = getRequestContext(req);
      if (access.role !== "host") {
        res.status(403).json({ error: "remote_devices_are_read_only_for_sharing" });
        return;
      }
      const { path: sharePath, permission, ttlMs, scope } = req.body || {};
      if (!sharePath) {
        res.status(400).json({ error: "path is required" });
        return;
      }
      const targetPath = resolveOwnerPath(config.storage.ownerRoot, toPosixPath(sharePath));
      const share = await shareService.createShare({ targetPath, permission, ttlMs, scope });
      const displayName = userConfig?.display_name || "Join";
      const endpoints = getNetworkEndpoints(displayName, config.server.port, config.server.shareBasePath);
      logger.info("share link generated", { scope: share.scope });
      runtimeTelemetry.increment("total_shares_created");
      res.json({
        shareId: share.shareId,
        url: `${endpoints.ipUrl}/${share.shareId}`,
        urlIp: `${endpoints.ipUrl}/${share.shareId}`,
        expiresAt: share.expiryTime,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/shares", (req, res) => {
    const displayName = userConfig?.display_name || "Join";
    const endpoints = getNetworkEndpoints(displayName, config.server.port, config.server.shareBasePath);
    const sharePath = config.server.shareBasePath;
    const shares = shareService.listShares().map((share) => {
      const relativePath = formatSharePath(config.storage.ownerRoot, share.targetPath);
      const fileName = path.posix.basename(relativePath || "/");
      const isActive = share.status === "active";
      const base = `${sharePath}/${share.shareId}`;
      const url = isActive ? `${endpoints.ipUrl}/${share.shareId}` : null;
      const urlIp = isActive ? `${endpoints.ipUrl}/${share.shareId}` : null;
      return {
        shareId: share.shareId,
        id: share.shareId,
        path: relativePath,
        fileName,
        permission: share.permission,
        targetType: share.targetType || "file",
        expiresAt: share.expiryTime,
        createdAt: share.createdAt,
        status: share.status,
        isActive,
        scope: share.scope || "local",
        url,
        urlIp,
        tunnelUrl: url,
        downloadCount: 0,
        maxDownloads: null,
        passwordHash: null,
      };
    });
    res.json(shares);
  });

  app.delete("/api/share/:shareId", async (req, res) => {
    const access = getRequestContext(req);
    if (access.role !== "host") {
      res.status(403).json({ error: "remote_devices_are_read_only_for_sharing" });
      return;
    }
    const ok = await shareService.revokeShare(req.params.shareId);
    if (ok) {
      logger.info("share revoked");
      runtimeTelemetry.increment("total_shares_revoked");
    }
    res.json({ revoked: ok });
  });

  app.post("/api/v1/shares/revoke", ensureAdmin, async (req, res) => {
    const tokens = Array.isArray(req.body?.tokens) ? req.body.tokens.map((value) => String(value || "").trim()).filter(Boolean) : [];
    if (!tokens.length) {
      res.status(400).json({ error: "tokens array is required" });
      return;
    }
    const revoked = await shareService.revokeMany(tokens);
    if (revoked > 0) {
      logger.info("shares revoked by selection", { count: revoked });
      runtimeTelemetry.increment("total_shares_revoked", revoked);
    }
    res.json({ revoked });
  });

  app.post("/api/v1/shares/revoke_all", ensureAdmin, async (_req, res) => {
    const revoked = await shareService.revokeAll();
    if (revoked > 0) {
      logger.info("all shares revoked", { count: revoked });
      runtimeTelemetry.increment("total_shares_revoked", revoked);
    }
    res.json({ revoked });
  });

  app.post("/api/upload", (req, res) => {
    req.setTimeout(60 * 60 * 1000);
    if (req.socket) {
      req.socket.setNoDelay(true);
      try {
        if (typeof req.socket.setRecvBufferSize === "function") {
          req.socket.setRecvBufferSize(1024 * 1024);
        }
      } catch (_e) {}
    }
    const contentType = req.headers["content-type"] || "";
    if (!contentType.includes("multipart/form-data")) {
      res.status(400).json({ error: "multipart form data required" });
      return;
    }
    const access = getRequestContext(req);
    const fields = {};
    let targetPath = null;
    let lastFileRelPath = null;
    const stored = [];
    let totalBytes = 0;
    let uploadStartTime = null;
    const clientIp = getClientIp(req);
    let pendingWrites = 0;
    const destCounts = new Map();

    function sanitizeRelPath(rel) {
      if (!rel || typeof rel !== "string") return "";
      const parts = rel.replace(/\\/g, "/").split("/").filter(Boolean);
      const safe = parts.map((p) => p.replace(/[\\/:*?"<>|]/g, "_").replace(/^\.+$/, "_")).filter(Boolean);
      return safe.join("/");
    }

    const busboy = Busboy({ headers: { "content-type": contentType } });

    busboy.on("field", (name, value) => {
      fields[name] = value;
      if (name === "fileRelPath") lastFileRelPath = value;
      if ((name === "path" || name === "parentPath") && value) {
        try {
          const target = String(value || "/").trim() || "/";
          if (canWritePathForContext(access, target)) {
            targetPath = resolveOwnerPath(config.storage.ownerRoot, toPosixPath(target));
          }
        } catch (_e) {
          targetPath = null;
        }
      }
    });

    busboy.on("file", (fieldname, file, info) => {
      const { filename } = info;
      const relPath = lastFileRelPath ? sanitizeRelPath(lastFileRelPath) : null;
      lastFileRelPath = null;
      let cleanName = (filename || "upload").replace(/[\\/:*?"<>|]/g, "_").trim() || "upload";
      const effectiveName = relPath || cleanName;
      const count = (destCounts.get(effectiveName) || 0) + 1;
      destCounts.set(effectiveName, count);
      if (count > 1 && !relPath) {
        const ext = path.extname(cleanName);
        const base = path.basename(cleanName, ext) || cleanName;
        cleanName = `${base} (${count})${ext}`;
      } else if (count > 1 && relPath) {
        const ext = path.extname(relPath);
        const base = path.basename(relPath, ext) || relPath;
        const dir = path.dirname(relPath);
        cleanName = dir && dir !== "." ? `${dir}/${base} (${count})${ext}` : `${base} (${count})${ext}`;
      } else if (relPath) {
        cleanName = relPath;
      }
      if (!targetPath) {
        const target = fields.path || fields.parentPath || "/";
        if (!canWritePathForContext(access, target)) {
          file.resume();
          return;
        }
        try {
          targetPath = resolveOwnerPath(config.storage.ownerRoot, toPosixPath(target));
        } catch (_e) {
          file.resume();
          return;
        }
      }
      const destDir = path.dirname(path.join(targetPath, cleanName));
      fs.mkdir(destDir, { recursive: true }).catch(() => {});
      if (!uploadStartTime) {
        uploadStartTime = Date.now();
        logger.info("upload start", {
          filename: cleanName,
          client_ip: clientIp,
        });
      }
      pendingWrites += 1;
      const destination = path.join(targetPath, cleanName);
      const writeStream = fsSync.createWriteStream(destination, {
        flags: "w",
        highWaterMark: 1024 * 1024,
      });
      let bytesWritten = 0;
      file.on("data", (chunk) => {
        bytesWritten += chunk.length;
      });
      file.pipe(writeStream);
      writeStream.on("finish", () => {
        stored.push(cleanName);
        totalBytes += bytesWritten;
        pendingWrites -= 1;
      });
      writeStream.on("error", (err) => {
        logger.error("upload write failed", { file: cleanName, error: err.message });
        file.resume();
        pendingWrites -= 1;
      });
    });

    busboy.on("finish", () => {
      const target = fields.path || fields.parentPath || "/";
      const checkDone = () => {
        if (pendingWrites > 0) {
          setTimeout(checkDone, 50);
          return;
        }
        try {
          if (!targetPath) {
            res.status(403).json({ error: "write_outside_device_folder_denied" });
            return;
          }
          const durationMs = uploadStartTime ? Date.now() - uploadStartTime : 0;
          const mbPerSec = durationMs > 0 && totalBytes > 0
            ? (totalBytes / (1024 * 1024)) / (durationMs / 1000)
            : 0;
          logger.info("upload end", {
            bytes_written: totalBytes,
            duration_ms: durationMs,
            mb_per_sec: mbPerSec.toFixed(2),
            files: stored.length,
          });
          if (access.role === "remote" && access.fingerprint) {
            accessControl.incrementDeviceStat(access.fingerprint, "uploads", stored.length).catch(() => {});
          }
          runtimeTelemetry.increment("total_uploads", stored.length);
          runtimeTelemetry.increment("bytes_uploaded", totalBytes);
          if (usageAggregation && typeof usageAggregation.recordTransferActivity === "function") {
            usageAggregation.recordTransferActivity();
          }
          telemetry.trackEvent("file_uploaded", {
            user_id: userConfig.user_id,
            count: stored.length,
            bytes: totalBytes,
          });
          res.json({
            success: true,
            saved_to: toPosixPath(target),
            uploaded: stored.length,
            bytes: totalBytes,
          });
        } catch (error) {
          logger.error("upload failed", { error: error.message });
          res.status(400).json({ error: error.message });
        }
      };
      checkDone();
    });

    busboy.on("error", (err) => {
      logger.error("upload parse failed", { error: err.message });
      if (!res.headersSent) {
        res.status(400).json({ error: err.message || "upload_failed" });
      }
    });

    req.pipe(busboy);
  });

  app.put("/api/v1/file/raw", (req, res) => {
    req.setTimeout(60 * 60 * 1000);
    if (req.socket) {
      req.socket.setNoDelay(true);
      try {
        if (typeof req.socket.setRecvBufferSize === "function") {
          req.socket.setRecvBufferSize(1024 * 1024);
        }
      } catch (_e) {}
    }
    const rawPath = req.query.path;
    if (!rawPath || typeof rawPath !== "string") {
      res.status(400).json({ error: "path query parameter required" });
      return;
    }
    const requestedPath = toPosixPath(rawPath.trim() || "/");
    const access = getRequestContext(req);
    if (!canWritePathForContext(access, requestedPath)) {
      res.status(403).json({ error: "write_outside_device_folder_denied" });
      return;
    }
    let fullPath;
    try {
      fullPath = resolveOwnerPath(config.storage.ownerRoot, requestedPath);
    } catch (err) {
      res.status(400).json({ error: err.message || "invalid_path" });
      return;
    }
    const parentDir = path.dirname(fullPath);
    const clientIp = getClientIp(req);
    const startTime = Date.now();
    let bytesReceived = 0;

    const countStream = new stream.Transform({
      transform(chunk, enc, cb) {
        bytesReceived += chunk.length;
        cb(null, chunk);
      },
    });

    req.on("aborted", () => {
      countStream.destroy();
      logger.info("raw upload aborted", { client_ip: clientIp });
    });

    fs.mkdir(parentDir, { recursive: true })
      .then(() => {
        const writeStream = fsSync.createWriteStream(fullPath, {
          flags: "w",
          highWaterMark: 1024 * 1024,
        });
        return pipeline(req, countStream, writeStream);
      })
      .then(() => {
        const durationMs = Date.now() - startTime;
        const mbPerSec =
          durationMs > 0 && bytesReceived > 0
            ? (bytesReceived / (1024 * 1024)) / (durationMs / 1000)
            : 0;
        logger.info("raw upload complete", {
          bytes_received: bytesReceived,
          duration_ms: durationMs,
          mb_per_sec: mbPerSec.toFixed(2),
          path: requestedPath,
          client_ip: clientIp,
        });
        if (access.role === "remote" && access.fingerprint) {
          accessControl.incrementDeviceStat(access.fingerprint, "uploads", 1).catch(() => {});
        }
        runtimeTelemetry.increment("total_uploads", 1);
        res.json({
          success: true,
          bytes: bytesReceived,
          path: requestedPath,
        });
      })
      .catch((err) => {
        logger.error("raw upload failed", { error: err.message, path: requestedPath });
        if (!res.headersSent) {
          res.status(500).json({ error: err.message || "upload_failed" });
        }
      });
  });

  app.post("/api/v1/files/import", ensureAdmin, async (req, res) => {
    try {
      const target = req.body?.path || "/";
      const sourcePaths = Array.isArray(req.body?.sourcePaths) ? req.body.sourcePaths : [];
      if (!sourcePaths.length) {
        res.status(400).json({ error: "sourcePaths is required" });
        return;
      }
      const targetPath = resolveOwnerPath(config.storage.ownerRoot, toPosixPath(target));
      await fs.mkdir(targetPath, { recursive: true });
      const imported = [];
      for (const sourcePath of sourcePaths) {
        const source = path.resolve(String(sourcePath || ""));
        const sourceStats = await fs.stat(source);
        if (!sourceStats.isFile()) {
          continue;
        }
        const fileName = path.basename(source);
        const destination = path.join(targetPath, fileName);
        await fs.copyFile(source, destination);
        imported.push(fileName);
      }
      logger.info("file(s) added via native picker", { count: imported.length });
      res.json({ imported });
    } catch (error) {
      logger.error("native file import failed", { error: error.message });
      res.status(400).json({ error: error.message || "import_failed" });
    }
  });

  app.get("/api/public-access/status", (_req, res) => {
    res.json(tunnelManager.getStatus());
  });

  app.post("/api/public-access/start", ensureAdmin, async (_req, res) => {
    try {
      const status = await tunnelManager.start();
      res.json(status);
    } catch (error) {
      res.json({
        status: "failed",
        reason: "Network blocked",
        message: "Public sharing is unavailable on this system",
      });
    }
  });

  app.post("/api/public-access/stop", ensureAdmin, (_req, res) => {
    const status = tunnelManager.stop();
    res.json(status);
  });

  app.get("/api/logs", async (_req, res) => {
    try {
      res.json(logger.getBuffer());
    } catch (error) {
      res.json([]);
    }
  });

  app.get("/api/v1/logs", async (_req, res) => {
    try {
      res.json(logger.getBuffer());
    } catch (error) {
      res.json([]);
    }
  });

  app.get("/api/v1/health", (_req, res) => {
    res.json({ status: "ok", build_id: BUILD_ID, version: getAppVersion() });
  });

  const hostId = userConfig?.user_id || "host";
  let lastNetworkChangeAt = null;
  const discoveryManager = createDiscoveryManager({
    bonjour,
    hostId,
    displayName: userConfig.display_name,
    port: config.server.port,
    appVersion: getAppVersion(),
    logger,
  });

  let presenceList = [];

  discoveryManager.on("peers", (peers) => {
    presenceList = peers;
  });

  function startDiscovery() {
    if (sharingEnabled) {
      discoveryManager.startAdvertise();
      discoveryManager.startBrowse();
    }
  }

  function stopDiscovery() {
    discoveryManager.stopAdvertise();
    discoveryManager.stopBrowse();
  }

  function updateDisplayName(newName) {
    const normalized = normalizeDisplayName(newName);
    if (!isValidDisplayName(normalized)) return false;
    userConfig.display_name = normalized;
    try {
      discoveryManager.restartAdvertise(normalized);
    } catch (err) {
      logger.warn("mDNS advertise restart failed, IP fallback available", { error: err?.message });
    }
    return true;
  }

  if (sharingEnabled) {
    startDiscovery();
  }

  const networkManager = createNetworkManager({
    displayName: userConfig.display_name,
    port: config.server.port,
    shareBasePath: config.server.shareBasePath,
    pollIntervalMs: 5000,
    logger,
  });
  networkManager.on("change", ({ changed }) => {
    if (changed && discoveryManager && sharingEnabled) {
      lastNetworkChangeAt = Date.now();
      try {
        discoveryManager.restartAdvertise();
      } catch (_) {}
      logger.info("network changed — discovery/links updated");
    }
  });

  app.get("/api/v1/network", (_req, res) => {
    const peers = discoveryManager.getPeers().map((p) => ({
      deviceId: p.deviceId,
      display_name: p.displayName,
      status: p.status,
      bestIp: p.bestIp,
      hostname: p.hostname,
      port: p.port,
      source: p.source,
    }));
    res.json(peers);
  });
  app.get("/api/v1/network/display-names", async (_req, res) => {
    const map = {};
    map[userConfig?.user_id || "host"] = userConfig?.display_name || "Join";
    for (const p of discoveryManager.getPeers()) {
      if (p.deviceId) map[p.deviceId] = p.displayName || p.display_name || "Unknown device";
    }
    const approved = await accessControl.listApprovedDevices();
    for (const d of approved) {
      if (d.device_id) map[d.device_id] = d.device_name || map[d.device_id] || "Unknown device";
    }
    res.json(map);
  });

  app.post("/api/v1/network/search", async (req, res) => {
    const waitMs = Math.min(5000, Math.max(2000, Number(req.query.wait) || 4000));
    await new Promise((r) => setTimeout(r, waitMs));
    const peers = discoveryManager.getPeers().map((p) => ({
      deviceId: p.deviceId,
      display_name: p.displayName,
      status: p.status,
      bestIp: p.bestIp,
      hostname: p.hostname,
      port: p.port,
      source: p.source,
    }));
    res.json(peers);
  });


  app.post("/api/v1/network/manual-connect", async (req, res) => {
    const access = getRequestContext(req);
    if (access.role !== "host") {
      res.status(403).json({ error: "host_only" });
      return;
    }
    const { ip, port: peerPort } = req.body || {};
    const targetPort = peerPort || config.server.port;
    if (!ip || typeof ip !== "string") {
      res.status(400).json({ error: "ip required" });
      return;
    }
    const trimmedIp = ip.trim();
    if (!trimmedIp) {
      res.status(400).json({ error: "ip required" });
      return;
    }
    try {
      const baseUrl = `http://${trimmedIp}:${targetPort}`;
      const peerRes = await fetch(`${baseUrl}/api/v1/peer`, { signal: AbortSignal.timeout(5000) });
      if (!peerRes.ok) {
        res.status(502).json({ error: "peer_unreachable", message: "Could not fetch peer info" });
        return;
      }
      const peerInfo = await peerRes.json();
      const { deviceId, displayName: name } = peerInfo;
      if (!deviceId) {
        res.status(502).json({ error: "invalid_peer_response" });
        return;
      }
      discoveryManager.addManualPeer({
        deviceId,
        displayName: name || "Manual",
        ip: trimmedIp,
        port: targetPort,
      });
      res.json({ success: true, deviceId, displayName: name });
    } catch (err) {
      logger.warn("manual connect failed", { ip: trimmedIp, error: err?.message });
      res.status(502).json({ error: "peer_unreachable", message: err?.message || "Connection failed" });
    }
  });

  app.get("/api/v1/network/settings", (_req, res) => {
    res.json({
      display_name: userConfig.display_name,
      network_visibility: !!userConfig.network_visibility,
    });
  });

  app.post("/api/v1/network/settings", async (req, res) => {
    const access = getRequestContext(req);
    if (access.role !== "host") {
      res.status(403).json({ error: "remote_devices_cannot_modify_host_settings" });
      return;
    }
    const requestedName = req.body?.display_name;
    const requestedVisibility = req.body?.network_visibility;
    let updated = false;

    if (typeof requestedName === "string") {
      if (isValidDisplayName(requestedName)) {
        updateDisplayName(requestedName);
        updated = true;
      }
    }

    if (typeof requestedVisibility === "boolean") {
      userConfig.network_visibility = requestedVisibility;
      if (requestedVisibility && sharingEnabled) {
        startDiscovery();
      } else {
        stopDiscovery();
      }
      updated = true;
    }

    if (updated) {
      await updateUserConfig(config.storage.userConfigPath, userConfig);
    }

    res.json({
      display_name: userConfig.display_name,
      network_visibility: !!userConfig.network_visibility,
    });
  });

  app.get("/api/v1/teams", async (req, res) => {
    const deviceId = getCurrentDeviceId(req);
    const teams = teamsStore.listTeamsForDevice(deviceId);
    const invites = teamsStore.getPendingInvitesForDevice(deviceId);
    res.json({ teams, invites });
  });

  app.post("/api/v1/teams", async (req, res) => {
    const deviceId = getCurrentDeviceId(req);
    const { teamName, department } = req.body || {};
    const team = teamsStore.createTeam({
      teamName: String(teamName || "").trim() || "Unnamed Team",
      department: String(department || "").trim(),
      createdByDeviceId: deviceId,
    });
    res.json(team);
  });

  app.get("/api/v1/teams/:teamId", (req, res) => {
    const deviceId = getCurrentDeviceId(req);
    const team = teamsStore.getTeam(req.params.teamId);
    if (!team || !team.members.includes(deviceId)) {
      res.status(404).json({ error: "team_not_found" });
      return;
    }
    res.json(team);
  });

  app.post("/api/v1/teams/:teamId/invite", async (req, res) => {
    const deviceId = getCurrentDeviceId(req);
    const { toDeviceId } = req.body || {};
    if (!toDeviceId) {
      res.status(400).json({ error: "toDeviceId required" });
      return;
    }
    const invite = teamsStore.createInvite({
      teamId: req.params.teamId,
      fromDeviceId: deviceId,
      toDeviceId: String(toDeviceId).trim(),
    });
    if (!invite) {
      res.status(400).json({ error: "invite_failed", message: "Team full or already a member" });
      return;
    }
    const peer = discoveryManager?.getPeer?.(invite.toDeviceId);
    if (peer?.bestIp) {
      const baseUrl = `http://${peer.bestIp}:${peer.port || config.server.port}`;
      try {
        await fetch(`${baseUrl}/api/v1/teams/invite/receive`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(invite),
        }).catch(() => {});
      } catch (_) {}
    }
    res.json(invite);
  });

  app.post("/api/v1/teams/invite/receive", async (req, res) => {
    const { inviteId, teamId, teamName, fromDeviceId, toDeviceId } = req.body || {};
    if (!teamId || !fromDeviceId || !toDeviceId) {
      res.status(400).json({ error: "invalid_invite" });
      return;
    }
    const myDeviceId = userConfig?.user_id || "host";
    if (toDeviceId !== myDeviceId) {
      res.status(403).json({ error: "invite_not_for_you" });
      return;
    }
    const id = inviteId || crypto.randomUUID();
    if (!teamsStore.state.invites[id]) {
      teamsStore.state.invites[id] = {
        inviteId: id,
        teamId,
        teamName: teamName || "Team",
        fromDeviceId,
        toDeviceId,
        status: "pending",
        createdAt: req.body.createdAt || new Date().toISOString(),
      };
      teamsStore.persist();
    }
    res.json({ success: true });
  });

  app.post("/api/v1/teams/invites/:inviteId/accept", async (req, res) => {
    const deviceId = getCurrentDeviceId(req);
    const team = teamsStore.acceptInvite(req.params.inviteId, deviceId);
    if (!team) {
      res.status(404).json({ error: "invite_not_found" });
      return;
    }
    res.json(team);
  });

  app.post("/api/v1/teams/message", async (req, res) => {
    const deviceId = getCurrentDeviceId(req);
    const { teamId, type, payload } = req.body || {};
    if (!teamId) {
      res.status(400).json({ error: "teamId required" });
      return;
    }
    const msg = teamsStore.addMessage({
      teamId,
      senderDeviceId: deviceId,
      type: type || "text",
      payload: payload || {},
    });
    if (!msg) {
      res.status(403).json({ error: "not_a_member" });
      return;
    }
    const team = teamsStore.getTeam(teamId);
    let offlineCount = 0;
    const otherMembers = (team?.members || []).filter((m) => m !== deviceId);
    for (const memberId of otherMembers) {
      const peer = discoveryManager?.getPeer?.(memberId);
      if (peer?.bestIp) {
        const baseUrl = `http://${peer.bestIp}:${peer.port || config.server.port}`;
        try {
          const r = await fetch(`${baseUrl}/api/v1/teams/receive`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              teamId,
              senderDeviceId: deviceId,
              messageId: msg.messageId,
              timestamp: msg.timestamp,
              type: msg.type,
              payload: msg.payload,
            }),
          });
          if (!r.ok) offlineCount++;
        } catch (_) {
          offlineCount++;
        }
      } else {
        offlineCount++;
      }
    }
    res.json({ message: msg, offlineCount });
  });

  app.post("/api/v1/teams/receive", async (req, res) => {
    const deviceId = getCurrentDeviceId(req);
    const { teamId, senderDeviceId, messageId, timestamp, type, payload } = req.body || {};
    if (!teamId || !senderDeviceId) {
      res.status(400).json({ error: "teamId and senderDeviceId required" });
      return;
    }
    const team = teamsStore.getTeam(teamId);
    if (!team || !team.members.includes(deviceId)) {
      res.status(404).json({ error: "team_not_found" });
      return;
    }
    if (!team.members.includes(senderDeviceId)) {
      res.status(403).json({ error: "sender_not_member" });
      return;
    }
    if (!teamsStore.state.messages[teamId]) teamsStore.state.messages[teamId] = [];
    teamsStore.state.messages[teamId].push({
      messageId: messageId || crypto.randomUUID(),
      teamId,
      senderDeviceId,
      timestamp: timestamp || new Date().toISOString(),
      type: type || "text",
      payload: payload || {},
    });
    teamsStore.persist();
    const teamName = team?.name || team?.teamName || "Team";
    const fn = type === "file" && payload?.filename ? payload.filename : null;
    const bodyText = fn ? `shared '${fn}'` : "sent a message";
    addServerNotification({
      type: "team_message",
      title: `New message in ${teamName}`,
      body: fn ? `${bodyText} in ${teamName}` : `New message in ${teamName}`,
      teamId,
      deviceId: senderDeviceId,
      targetRoute: `teams?team=${teamId}`,
    });
    res.json({ success: true });
  });

  app.post("/api/v1/share/notify", async (req, res) => {
    const { fromDeviceId, fromDisplayName, shareUrl, filename } = req.body || {};
    if (!shareUrl) {
      res.status(400).json({ error: "shareUrl required" });
      return;
    }
    logger.info("share notification received", { from: fromDisplayName || fromDeviceId });
    addServerNotification({
      type: "share",
      title: "File shared",
      body: `${fromDisplayName || "Someone"} shared ${filename || "a file"}`,
      deviceId: fromDeviceId,
      targetRoute: "shares",
    });
    if (typeof global.__shareNotifications === "undefined") global.__shareNotifications = [];
    global.__shareNotifications.push({
      fromDeviceId,
      fromDisplayName: fromDisplayName || "Unknown",
      shareUrl,
      filename: filename || "file",
      receivedAt: new Date().toISOString(),
    });
    if (global.__shareNotifications.length > 50) global.__shareNotifications.shift();
    res.json({ success: true });
  });

  app.get("/api/v1/share/notifications", (_req, res) => {
    const list = global.__shareNotifications || [];
    res.json(list);
  });

  if (typeof global.__notifications === "undefined") global.__notifications = [];
  app.get("/api/v1/notifications", (_req, res) => {
    const list = (global.__notifications || []).slice(0, 50);
    res.json({ notifications: list, unreadCount: list.filter((n) => !n.read).length });
  });
  app.post("/api/v1/notifications/clear", (_req, res) => {
    global.__notifications = [];
    res.json({ cleared: true });
  });
  app.post("/api/v1/notifications/:id/read", (req, res) => {
    const n = (global.__notifications || []).find((x) => x.id === req.params.id);
    if (n) n.read = true;
    res.json({ ok: true });
  });
  app.delete("/api/v1/notifications/:id", (req, res) => {
    const list = global.__notifications || [];
    const idx = list.findIndex((x) => x.id === req.params.id);
    if (idx >= 0) list.splice(idx, 1);
    res.json({ ok: true });
  });
  app.post("/api/v1/notifications/mark-team-read/:teamId", (req, res) => {
    const teamId = req.params.teamId;
    (global.__notifications || []).forEach((n) => {
      if (n.teamId === teamId) n.read = true;
    });
    res.json({ ok: true });
  });
  function addServerNotification({ type, title, body, teamId, deviceId, targetRoute }) {
    const list = global.__notifications || [];
    list.unshift({
      id: crypto.randomUUID(),
      type: type || "info",
      title: title || "Notification",
      body: body || "",
      timestamp: new Date().toISOString(),
      read: false,
      teamId: teamId || null,
      deviceId: deviceId || null,
      targetRoute: targetRoute || null,
    });
    if (list.length > 100) list.pop();
    global.__notifications = list;
  }

  app.get("/api/v1/teams/:teamId/messages", (req, res) => {
    const deviceId = getCurrentDeviceId(req);
    const team = teamsStore.getTeam(req.params.teamId);
    if (!team || !team.members.includes(deviceId)) {
      res.status(404).json({ error: "team_not_found" });
      return;
    }
    const messages = teamsStore.getMessages(req.params.teamId, deviceId);
    res.json({ messages });
  });

  app.get("/api/v1/telemetry/settings", (_req, res) => {
    const cp = getControlPlaneConfig();
    const configurableByUser = cp?.telemetry?.configurable_by_user !== false;
    res.json({
      enabled: !!userConfig.telemetry_enabled,
      configurable_by_user: configurableByUser,
    });
  });

  app.get("/api/v1/control-plane-config", (req, res) => {
    const hostUuidForCfg = getHostUuidForConfig ? getHostUuidForConfig() : null;
    const adminHost = config.telemetry?.adminHost;

    function sendResponse(cp) {
      const out = cp || { license: {}, activation: {}, telemetry: {} };
      out.upgrade_url = process.env.JOINCLOUD_UPGRADE_URL || "";
      out.web_url = process.env.JOINCLOUD_WEB_URL || "https://joincloud.com";
      if (out.trial_days == null) out.trial_days = 7;
      const cached = getControlPlaneConfig();
      if (cached && cached.subscription) out.subscription = cached.subscription;
      if (hostUuidForCfg) out.host_uuid = hostUuidForCfg;
      if (out.license && out.license.account_id) out.account_id = out.license.account_id;
      if (out.license && out.license.account_email) out.account_email = out.license.account_email;
      if (cached && cached.account_email) out.account_email = out.account_email || cached.account_email;
      if (cached && cached.account_id) out.account_id = out.account_id || cached.account_id;
      tryRefreshLicense();
      refreshLicenseFromControlPlane(hostUuidForCfg);
      res.json(out);
    }

    function applyConfigFromControlPlane() {
      let cp = getControlPlaneConfig();
      if (!cp || !cp.license || !cp.license.state) {
        const paths = getActivationPaths();
        if (paths && fsSync.existsSync(paths.licensePath)) {
          try {
            const raw = fsSync.readFileSync(paths.licensePath, "utf8");
            const license = JSON.parse(raw);
            cp = {
              license: { state: license.state || "active", ...license },
              activation: { required: false },
              telemetry: (cp && cp.telemetry) || {},
            };
          } catch (_) {}
        }
      }
      return cp;
    }

    // When we have host_uuid and Control Plane, fetch config on-demand so activation persists across restarts
    if (adminHost && hostUuidForCfg && hostUuidForCfg.length >= 8 && hostUuidForCfg.length <= 128) {
      controlPlaneGet(adminHost, `/api/v1/config?host_uuid=${encodeURIComponent(hostUuidForCfg)}`, (err, result) => {
        if (!err && result && result.statusCode === 200 && result.data) {
          if (result.data.logout_requested) {
            const paths = getActivationPaths();
            if (paths) {
              try {
                if (fsSync.existsSync(paths.authPath)) fsSync.unlinkSync(paths.authPath);
                if (fsSync.existsSync(paths.licensePath)) fsSync.unlinkSync(paths.licensePath);
              } catch (e) {
                logger && logger.warn("logout_requested cleanup failed", { error: e.message });
              }
            }
            controlPlaneConfigCache = null;
            sendResponse({ license: {}, activation: { required: true }, telemetry: {} });
            return;
          }
          if (result.data.license && result.data.license.state && result.data.license.state !== "UNREGISTERED") {
            controlPlaneConfigCache = {
              license: result.data.license || {},
              activation: result.data.activation || {},
              telemetry: result.data.telemetry || {},
              subscription: result.data.subscription || null,
              account_id: result.data.account_id || null,
              account_email: result.data.account_email || null,
            };
            sendResponse(controlPlaneConfigCache);
            return;
          }
        }
        const cp = applyConfigFromControlPlane();
        sendResponse(cp);
      });
      return;
    }

    let cp = getControlPlaneConfig();
    if (!cp || !cp.license || !cp.license.state) {
      const paths = getActivationPaths();
      if (paths && fsSync.existsSync(paths.licensePath)) {
        try {
          const raw = fsSync.readFileSync(paths.licensePath, "utf8");
          const license = JSON.parse(raw);
          cp = {
            license: { state: license.state || "active", ...license },
            activation: { required: false },
            telemetry: (cp && cp.telemetry) || {},
          };
        } catch (_) {}
      }
    }
    sendResponse(cp);
  });

  // Desktop auth: verify one-time token from website deep-link flow
  app.post("/api/desktop/verify", (req, res) => {
    const adminHost = config.telemetry.adminHost;
    if (!adminHost) {
      res.status(503).json({ message: "Control Plane not configured" });
      return;
    }
    const token = req.body && typeof req.body.token === "string" ? req.body.token : null;
    if (!token) {
      res.status(400).json({ message: "token required" });
      return;
    }
    controlPlanePost(adminHost, "/api/desktop/verify", { token }, null, (err, result) => {
      if (err) {
        res.status(502).json({ message: "Could not reach Control Plane" });
        return;
      }
      if (result.statusCode !== 200) {
        res.status(result.statusCode || 401).json(result.data || { message: "Token invalid or expired" });
        return;
      }
      const data = result.data || {};
      try {
        const systemDir = require("path").join(
          process.env.JOINCLOUD_USER_DATA || require("os").homedir(),
          "JoinCloud", "system"
        );
        const fsSync = require("fs");
        if (!fsSync.existsSync(systemDir)) fsSync.mkdirSync(systemDir, { recursive: true });
        if (data.jwt) {
          fsSync.writeFileSync(require("path").join(systemDir, "auth.json"), JSON.stringify({ token: data.jwt }, null, 2), "utf8");
        }
        if (data.license && typeof data.license === "object") {
          const licenseToSave = { ...data.license };
          if (data.email) licenseToSave.account_email = data.email;
          fsSync.writeFileSync(require("path").join(systemDir, "license.json"), JSON.stringify(licenseToSave, null, 2), "utf8");
          controlPlaneConfigCache = {
            license: { state: data.license.state || "active", ...licenseToSave },
            activation: { required: false },
            telemetry: (controlPlaneConfigCache && controlPlaneConfigCache.telemetry) || {},
            account_email: data.email || (controlPlaneConfigCache && controlPlaneConfigCache.account_email) || null,
            account_id: data.account_id || (controlPlaneConfigCache && controlPlaneConfigCache.account_id) || null,
          };
        }
      } catch (_) {}
      res.json(data);
    });
  });

  app.post("/api/v1/auth/logout", (req, res) => {
    const fromLocalhost = isLocalhostRequest(req);
    const hostHeader = (req.get && req.get("host")) || (req.headers && req.headers.host) || "";
    const hostIsLocal = typeof hostHeader === "string" && (hostHeader.includes("127.0.0.1") || hostHeader.includes("localhost"));
    if (!fromLocalhost && !hostIsLocal) {
      res.status(403).json({ message: "Logout is only allowed from the local app" });
      return;
    }
    const paths = getActivationPaths();
    if (paths) {
      try {
        const fsSync = require("fs");
        if (fsSync.existsSync(paths.authPath)) fsSync.unlinkSync(paths.authPath);
        if (fsSync.existsSync(paths.licensePath)) fsSync.unlinkSync(paths.licensePath);
      } catch (e) {
        logger && logger.warn("logout file cleanup failed", { error: e.message });
      }
    }
    controlPlaneConfigCache = null;
    res.json({ success: true });
  });

  app.get("/api/v1/billing/invoices", (req, res) => {
    const adminHost = config.telemetry.adminHost;
    if (!adminHost) {
      res.status(503).json({ message: "Control Plane not configured" });
      return;
    }
    const hostUuid = getHostUuidForConfig();
    if (!hostUuid) {
      res.status(400).json({ message: "Device not registered" });
      return;
    }
    const path = `/api/v1/billing/invoices?host_uuid=${encodeURIComponent(hostUuid)}`;
    controlPlaneGet(adminHost, path, (err, result) => {
      if (err) {
        res.status(502).json({ message: "Could not reach Control Plane" });
        return;
      }
      if (result.statusCode !== 200) {
        res.status(result.statusCode || 502).json(result.data || { message: "Failed to load invoice history" });
        return;
      }
      res.json(Array.isArray(result.data) ? result.data : []);
    });
  });

  app.post("/api/v1/billing/portal", (req, res) => {
    const adminHost = config.telemetry.adminHost;
    if (!adminHost) {
      res.status(503).json({ message: "Control Plane not configured" });
      return;
    }
    const hostUuid = getHostUuidForConfig();
    if (!hostUuid) {
      res.status(400).json({ message: "Device not registered" });
      return;
    }
    const returnUrl = req.body && typeof req.body.return_url === "string" ? req.body.return_url : undefined;
    const body = returnUrl ? { host_uuid: hostUuid, return_url: returnUrl } : { host_uuid: hostUuid };
    controlPlanePost(adminHost, "/api/v1/billing/portal", body, null, (err, result) => {
      if (err) {
        res.status(502).json({ message: "Could not reach Control Plane" });
        return;
      }
      if (result.statusCode !== 200) {
        res.status(result.statusCode || 400).json(result.data || { message: "Billing portal unavailable" });
        return;
      }
      res.json(result.data || {});
    });
  });

  app.post("/api/v1/telemetry/settings", async (req, res) => {
    const access = getRequestContext(req);
    if (access.role !== "host") {
      res.status(403).json({ error: "remote_devices_cannot_modify_host_settings" });
      return;
    }
    const cp = getControlPlaneConfig();
    if (cp?.telemetry?.configurable_by_user === false) {
      res.status(403).json({ error: "telemetry_setting_controlled_by_admin" });
      return;
    }
    const enabled = !!req.body?.enabled;
    userConfig.telemetry_enabled = enabled;
    await updateUserConfig(config.storage.userConfigPath, userConfig);
    logger.info("telemetry setting updated", { enabled });
    res.json({ enabled });
  });

  let server = null;
  let shareOnlyServer = null;

  server = http.createServer((req, res) => {
    const url = req.url || "/";
    const pathname = url.split("?")[0];
    const shareViewPath = new RegExp(`^${config.server.shareBasePath}/[^/]+(?:/(meta|files|download|preview|download\\.zip))?$`);
    if (req.method === "GET" && shareViewPath.test(pathname)) {
      app(req, res);
      return;
    }
    if (
      url === config.server.ownerBasePath ||
      url.startsWith(`${config.server.ownerBasePath}/`) ||
      url === config.server.shareBasePath ||
      url.startsWith(`${config.server.shareBasePath}/`)
    ) {
      handler(req, res);
      return;
    }
    app(req, res);
  });

  server.on("connection", (socket) => {
    socket.setNoDelay(true);
  });
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  shareOnlyServer = http.createServer((req, res) => {
    const url = req.url || "/";
    if (url === config.server.shareBasePath || url.startsWith(`${config.server.shareBasePath}/`)) {
      handler(req, res);
      return;
    }
    res.statusCode = 404;
    res.end();
  });

  shareOnlyServer.on("connection", (socket) => {
    socket.setNoDelay(true);
  });
  shareOnlyServer.keepAliveTimeout = 65000;
  shareOnlyServer.headersTimeout = 66000;

  function handleListenError(name, host, port, error) {
    if (error && error.code === "EADDRINUSE") {
      logger.error(`${name} port is already in use`, { host, port });
      console.error(
        `[joincloud] ${name} failed to start: ${host}:${port} is already in use. ` +
          "Stop the existing JoinCloud process or change JOINCLOUD_PORT/JOINCLOUD_SHARE_PORT."
      );
    } else {
      logger.error(`${name} failed to start`, {
        host,
        port,
        error: error?.message || String(error),
      });
    }
    process.exit(1);
  }

  if (shareOnlyServer) {
    shareOnlyServer.on("error", (error) =>
      handleListenError("Share server", "127.0.0.1", config.server.sharePort, error)
    );
  }
  if (server) {
    server.on("error", (error) =>
      handleListenError("Main server", config.server.host, config.server.port, error)
    );
  }

  global.SERVER_START_TIME = Date.now();
  shareOnlyServer.listen(config.server.sharePort, "127.0.0.1");
  server.listen(config.server.port, config.server.host, () => {
    const publicHost = config.server.host === "0.0.0.0" ? "127.0.0.1" : config.server.host;
    logger.info("app started", {
      host: config.server.host,
      port: config.server.port,
      sharePort: config.server.sharePort,
    });
    console.log("[joincloud] WebDAV owner mounted", {
      path: config.server.ownerBasePath,
      root: config.storage.ownerRoot,
    });
    console.log("[joincloud] Share endpoint ready", {
      path: path.join(config.server.shareBasePath, "<token>"),
    });

    const lanIp = getBestLanIp();
    console.log("[joincloud] mDNS verification checklist:");
    console.log("  Hostname:", mdnsHostname);
    console.log("  IP fallback:", `${lanIp}:${config.server.port}`);
    console.log("  Commands:");
    console.log(`    ping ${mdnsHostname}`);
    console.log(`    curl -I http://${mdnsHostname}:${config.server.port}/`);
    console.log(`    curl -I http://${lanIp}:${config.server.port}/`);

    const target = process.env.JOINCLOUD_SHARE_TARGET;
    if (target) {
      const permission = process.env.JOINCLOUD_SHARE_PERMISSION;
      const ttlMs = process.env.JOINCLOUD_SHARE_TTL_MS
        ? Number(process.env.JOINCLOUD_SHARE_TTL_MS)
        : undefined;
      shareService
        .createShare({ targetPath: target, permission, ttlMs })
        .then((share) => {
          console.log("[joincloud] Share created", {
            shareId: share.shareId,
            targetPath: share.targetPath,
            permission: share.permission,
            expiryTime: share.expiryTime,
            url: `http://${publicHost}:${config.server.port}${config.server.shareBasePath}/${share.shareId}`,
          });
        })
        .catch((error) => {
          console.error("[joincloud] Share create failed", error.message);
        });
    }
  });

  const shutdown = async () => {
    expiryManager.stop();
    tunnelManager.stop();
    networkManager?.stop?.();
    telemetrySync.flush().catch(() => {});
    telemetrySync.stop();
    if (usageAggregation && typeof usageAggregation.stop === "function") {
      await usageAggregation.stop().catch(() => {});
    }
    stopDiscovery();
    bonjour.destroy();
    clearInterval(uptimeTimer);
    if (shareOnlyServer && server) {
      shareOnlyServer.close(() => {
        server.close(() => process.exit(0));
      });
      return;
    }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  return { shareService };
}

bootstrap().catch((error) => {
  console.error("[joincloud] Fatal error", error);
  process.exit(1);
});
