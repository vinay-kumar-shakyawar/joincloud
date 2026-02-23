const http = require("http");
const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
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

  const handler = createMountManager({
    ownerServer,
    shareService,
    shareServerFactory: createShareServer,
    config,
    telemetry,
    logger,
  });

  const app = express();
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

  const runtimeTelemetry = new RuntimeTelemetryStore({
    storagePath: config.storage.runtimeTelemetryPath,
  });
  await runtimeTelemetry.init();
  runtimeTelemetry.increment("total_app_starts");
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

  app.get("/api/v1/diagnostics/info", (_req, res) => {
    const uptimeMs = Date.now() - (global.SERVER_START_TIME || Date.now());
    const displayName = userConfig?.display_name || "Join";
    const endpoints = getNetworkEndpoints(displayName, config.server.port, config.server.shareBasePath);
    res.json({
      version: getAppVersion(),
      build_id: BUILD_ID,
      lan_ip: getLanAddress(),
      best_lan_ip: endpoints.bestLanIp,
      port: config.server.port,
      share_port: config.server.sharePort,
      uptime_seconds: Math.floor(uptimeMs / 1000),
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

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", () => {
      if (!res.headersSent) {
        res.status(500).end("zip_failed");
      } else {
        res.destroy();
      }
    });
    archive.pipe(res);
    if (!selected.length) {
      archive.directory(share.targetPath, false);
    } else {
      for (const relPath of selected) {
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
      uptime_seconds: Math.floor(uptimeMs / 1000),
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
    const { teamName } = req.body || {};
    const team = teamsStore.createTeam({
      teamName: String(teamName || "").trim() || "Unnamed Team",
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
    const offlineCount = 0;
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
    res.json({ success: true });
  });

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
    res.json({ enabled: !!userConfig.telemetry_enabled });
  });

  app.post("/api/v1/telemetry/settings", async (req, res) => {
    const access = getRequestContext(req);
    if (access.role !== "host") {
      res.status(403).json({ error: "remote_devices_cannot_modify_host_settings" });
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

  const shutdown = () => {
    expiryManager.stop();
    tunnelManager.stop();
    networkManager?.stop?.();
    telemetrySync.flush().catch(() => {});
    telemetrySync.stop();
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
