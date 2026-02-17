const http = require("http");
const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
const os = require("os");
const express = require("express");
const multer = require("multer");
const mime = require("mime-types");
const bonjour = require("bonjour")();

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
const crypto = require("crypto");

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
      parsed.network_visibility = false;
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
      network_visibility: false,
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



function startPresenceService({ displayName, port }) {
  const service = bonjour.publish({
    name: displayName,
    type: "joincloud",
    protocol: "tcp",
    port,
    txt: {
      display_name: displayName,
      protocol: "v1",
    },
  });
  return service;
}

function startPresenceBrowser(onUpdate) {
  const peers = new Map();
  const browser = bonjour.find({ type: "joincloud" });

  function emit() {
    onUpdate(Array.from(peers.values()));
  }

  browser.on("up", (service) => {
    const displayName = service.txt?.display_name;
    if (!displayName) return;
    peers.set(service.fqdn, { display_name: displayName, status: "online" });
    emit();
  });

  browser.on("down", (service) => {
    peers.delete(service.fqdn);
    emit();
  });

  return { browser, peers };
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
  const interfaces = os.networkInterfaces();
  for (const list of Object.values(interfaces)) {
    for (const net of list || []) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "127.0.0.1";
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
  return String(headerValue || "").trim();
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
  return String(tokenHeader || "").trim();
}

function resolveUiRoot() {
  if (process.env.JOINCLOUD_UI_ROOT) {
    return process.env.JOINCLOUD_UI_ROOT;
  }
  const resourcesPath = process.env.JOINCLOUD_RESOURCES_PATH || process.resourcesPath;
  if (resourcesPath) {
    const candidates = [
      path.join(resourcesPath, "app.asar", "server", "ui"),
      path.join(resourcesPath, "server", "ui"),
    ];
    for (const candidate of candidates) {
      if (fsSync.existsSync(candidate)) {
        return candidate;
      }
    }
    return candidates[1];
  }
  return path.join(__dirname, "ui");
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
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name.startsWith("._")) {
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
  const upload = multer({ storage: multer.memoryStorage() });
  const accessControl = new AccessControlStore({
    storagePath: config.storage.accessControlPath,
    logger,
  });
  await accessControl.init();
  const runtimeTelemetry = new RuntimeTelemetryStore({
    storagePath: config.storage.runtimeTelemetryPath,
  });
  await runtimeTelemetry.init();
  runtimeTelemetry.increment("total_app_starts");
  let sharingEnabled = true;
  const deviceRootRel = "/_devices";
  const deviceRootAbs = resolveOwnerPath(config.storage.ownerRoot, deviceRootRel);
  await fs.mkdir(deviceRootAbs, { recursive: true });

  async function ensureDeviceFolderForSession(session) {
    if (!session || !session.device_folder_rel) return null;
    const safeFolderRel = toPosixPath(session.device_folder_rel);
    const resolved = resolveOwnerPath(config.storage.ownerRoot, safeFolderRel);
    await fs.mkdir(resolved, { recursive: true });
    return { rel: safeFolderRel, abs: resolved };
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
    if (!context || context.role === "host") return true;
    if (!context.device_folder_rel) return false;
    try {
      const targetAbs = resolveOwnerPath(config.storage.ownerRoot, toPosixPath(requestedPath || "/"));
      const deviceAbs = resolveOwnerPath(config.storage.ownerRoot, toPosixPath(context.device_folder_rel));
      return isPathWithin(deviceAbs, targetAbs);
    } catch (_error) {
      return false;
    }
  }
  const uiRoot = resolveUiRoot();
  const hasUiRoot = fsSync.existsSync(uiRoot);
  if (hasUiRoot) {
    logger.info("ui root resolved", { uiRoot });
    app.use("/", express.static(uiRoot));
  } else {
    logger.error("ui root missing, static UI not mounted", { uiRoot });
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

  app.get("/api/v1/status", (_req, res) => {
    res.json({ running: !!sharingEnabled, sharing_enabled: !!sharingEnabled });
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
      device_folder_rel: validation.session.device_folder_rel,
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
      role: "remote",
      device_id: validation.session.device_id || sanitizePathSegment(validation.session.fingerprint),
      device_name: validation.session.device_name || "Unknown Device",
      device_folder_rel: toPosixPath(validation.session.device_folder_rel || `${deviceRootRel}/unknown-device`),
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
      res.status(403).json({ error: "admin access required" });
      return;
    }
    next();
  }

  app.post("/api/v1/sharing/stop", ensureAdmin, (_req, res) => {
    sharingEnabled = false;
    logger.info("sharing stopped by admin");
    runtimeTelemetry.increment("sharing_stop_count");
    res.json({ running: false, sharing_enabled: false });
  });

  app.post("/api/v1/sharing/start", ensureAdmin, (_req, res) => {
    sharingEnabled = true;
    logger.info("sharing started by admin");
    runtimeTelemetry.increment("sharing_start_count");
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
      device_folder_rel: approved.request.device_folder_rel,
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
      name,
      size,
      downloadUrl: isFile
        ? `/share/${encodeURIComponent(share.shareId)}/download`
        : null,
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
      res.json(listing);
    } catch (error) {
      logger.error("folder share listing failed", { error: error.message });
      res.status(400).json({ error: error.message || "failed_to_list_folder" });
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
      res.setHeader("Content-Type", contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
      );
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "no-store");

      const stream = fsSync.createReadStream(filePath);
      stream.on("error", () => {
        if (!res.headersSent) {
          res.status(500).send("download_failed");
          return;
        }
        res.destroy();
      });
      stream.pipe(res);
      logger.info("share download served");
      runtimeTelemetry.increment("total_downloads");
    } catch (error) {
      res.status(400).send(error.message || "download_failed");
    }
  });

  app.use("/api", async (req, res, next) => {
    const publicApiPaths = new Set([
      "/v1/health",
      "/v1/status",
      "/v1/cloud/url",
      "/v1/access/session",
      "/v1/access/me",
      "/v1/access/request",
      "/v1/access/status",
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
      device_folder_rel: toPosixPath(validation.session.device_folder_rel || `${deviceRootRel}/unknown-device`),
    };
    next();
  });

  app.get("/privacy", (_req, res) => {
    res.sendFile(path.join(__dirname, "..", "docs", "privacy.md"));
  });

  app.get("/api/status", (_req, res) => {
    const lanIp = getLanAddress();
    res.json({
      status: sharingEnabled ? "running" : "stopped",
      sharing_enabled: !!sharingEnabled,
      ownerBasePath: config.server.ownerBasePath,
      shareBasePath: config.server.shareBasePath,
      lanBaseUrl: `http://${lanIp}:${config.server.port}`,
      publicBaseUrl: config.server.publicBaseUrl,
      storageLabel: "Local storage",
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
      const host = req.headers.host || `127.0.0.1:${config.server.port}`;
      logger.info("share link generated", { scope: share.scope });
      runtimeTelemetry.increment("total_shares_created");
      res.json({
        shareId: share.shareId,
        url: `http://${host}${config.server.shareBasePath}/${share.shareId}`,
        expiresAt: share.expiryTime,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/shares", (req, res) => {
    const host = req.headers.host || `127.0.0.1:${config.server.port}`;
    const shares = shareService.listShares().map((share) => {
      const relativePath = formatSharePath(config.storage.ownerRoot, share.targetPath);
      const fileName = path.posix.basename(relativePath || "/");
      const isActive = share.status === "active";
      const url = isActive
        ? `http://${host}${config.server.shareBasePath}/${share.shareId}`
        : null;
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

  app.post("/api/upload", upload.array("files"), async (req, res) => {
    try {
      const access = getRequestContext(req);
      const hostRequestedTarget = req.body?.path || req.body?.parentPath || "/";
      const forcedRemoteTarget = access.role === "remote" ? access.device_folder_rel : null;
      const target = forcedRemoteTarget || hostRequestedTarget;
      const targetPath = resolveOwnerPath(config.storage.ownerRoot, toPosixPath(target));
      if (!canWritePathForContext(access, target)) {
        res.status(403).json({ error: "write_outside_device_folder_denied" });
        return;
      }
      if (access.role === "remote") {
        await fs.mkdir(targetPath, { recursive: true });
      }
      logger.info("upload started", {
        count: (req.files || []).length,
        target: toPosixPath(target),
        role: access.role,
        device_id: access.device_id || null,
      });
      await fs.mkdir(targetPath, { recursive: true });
      const stored = [];
      let totalBytes = 0;
      for (const file of req.files || []) {
        const cleanName = file.originalname || "upload";
        const destination = path.join(targetPath, cleanName);
        await fs.writeFile(destination, file.buffer);
        stored.push(cleanName);
        totalBytes += file.buffer.length;
      }
      if (access.role === "remote") {
        logger.info("remote upload completed", {
          device_id: access.device_id,
          count: stored.length,
          bytes: totalBytes,
          target: toPosixPath(target),
        });
      } else {
        logger.info("upload completed", { count: stored.length });
      }
      telemetry.trackEvent("file_uploaded", {
        user_id: userConfig.user_id,
        count: stored.length,
        bytes: totalBytes,
      });
      res.json({ success: true });
    } catch (error) {
      logger.error("upload failed", { error: error.message });
      res.status(400).json({ error: error.message });
    }
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
    res.json({ status: "ok" });
  });

  let presenceList = [];
  let presenceService = null;
  let presenceBrowser = null;

  function updatePresenceList(list) {
    presenceList = list.filter((peer) => peer.display_name !== userConfig.display_name);
  }

  function startBroadcast() {
    if (presenceService) return;
    presenceService = startPresenceService({
      displayName: userConfig.display_name,
      port: config.server.port,
    });
  }

  function stopBroadcast() {
    if (!presenceService) return;
    presenceService.stop();
    presenceService = null;
  }

  function startDiscovery() {
    if (presenceBrowser) return;
    presenceBrowser = startPresenceBrowser(updatePresenceList);
  }

  function stopDiscovery() {
    if (!presenceBrowser) return;
    presenceBrowser.browser.stop();
    presenceBrowser = null;
    presenceList = [];
  }

  function updateDisplayName(newName) {
    const normalized = normalizeDisplayName(newName);
    if (!isValidDisplayName(normalized)) return false;
    userConfig.display_name = normalized;
    stopBroadcast();
    if (userConfig.network_visibility) {
      startBroadcast();
    }
    return true;
  }

  if (userConfig.network_visibility) {
    startBroadcast();
    startDiscovery();
  }

  app.get("/api/v1/network", (_req, res) => {
    res.json(presenceList);
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
      if (requestedVisibility) {
        startBroadcast();
        startDiscovery();
      } else {
        stopBroadcast();
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
    const shareViewPath = new RegExp(`^${config.server.shareBasePath}/[^/]+(?:/(meta|files|download))?$`);
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

  shareOnlyServer = http.createServer((req, res) => {
    const url = req.url || "/";
    if (url === config.server.shareBasePath || url.startsWith(`${config.server.shareBasePath}/`)) {
      handler(req, res);
      return;
    }
    res.statusCode = 404;
    res.end();
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
    telemetrySync.flush().catch(() => {});
    telemetrySync.stop();
    stopDiscovery();
    stopBroadcast();
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
