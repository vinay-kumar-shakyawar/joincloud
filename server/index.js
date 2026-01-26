const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const express = require("express");
const multer = require("multer");
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
    if (typeof parsed.telemetry_enabled !== "boolean") {
      parsed.telemetry_enabled = true;
    }
    if (!parsed.display_name) {
      parsed.display_name = generateDisplayName();
    }
    if (typeof parsed.network_visibility !== "boolean") {
      parsed.network_visibility = true;
    }
    return parsed;
  } catch (error) {
    const userId = `jc_${crypto.randomUUID()}`;
    const payload = {
      user_id: userId,
      created_at: new Date().toISOString(),
      telemetry_enabled: true,
      telemetry_last_sync: null,
      display_name: generateDisplayName(),
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

function generateDisplayName() {
  const names = [
    "Orion",
    "Nebula",
    "Andromeda",
    "Aquila",
    "Cosmos",
    "Lyra",
    "Phoenix",
    "Nova",
    "Pulsar",
    "Vega",
  ];
  const pick = names[Math.floor(Math.random() * names.length)];
  return `join_${pick}`;
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
  if (value.length > 32) return false;
  return /^[A-Za-z0-9_]+$/.test(value);
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
  app.use("/", express.static(path.join(__dirname, "ui")));
  app.get("/privacy", (_req, res) => {
    res.sendFile(path.join(__dirname, "..", "docs", "privacy.md"));
  });

  app.get("/api/status", (_req, res) => {
    const lanIp = getLanAddress();
    res.json({
      status: "running",
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
      const { path: sharePath, permission, ttlMs, scope } = req.body || {};
      if (!sharePath) {
        res.status(400).json({ error: "path is required" });
        return;
      }
      const targetPath = resolveOwnerPath(config.storage.ownerRoot, toPosixPath(sharePath));
      const share = await shareService.createShare({ targetPath, permission, ttlMs, scope });
      const host = req.headers.host || `127.0.0.1:${config.server.port}`;
      logger.info("share link generated", { scope: share.scope });
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
    const ok = await shareService.revokeShare(req.params.shareId);
    res.json({ revoked: ok });
  });

  app.post("/api/upload", upload.array("files"), async (req, res) => {
    try {
      const target = req.body?.path || req.body?.parentPath || "/";
      const targetPath = resolveOwnerPath(config.storage.ownerRoot, toPosixPath(target));
      logger.info("upload started", {
        count: (req.files || []).length,
        target: toPosixPath(target),
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
      logger.info("upload completed", { count: stored.length });
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

  app.get("/api/public-access/status", (_req, res) => {
    res.json(tunnelManager.getStatus());
  });

  app.post("/api/public-access/start", async (_req, res) => {
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

  app.post("/api/public-access/stop", (_req, res) => {
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
    if (!isValidDisplayName(newName)) return false;
    userConfig.display_name = newName;
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
    const enabled = !!req.body?.enabled;
    userConfig.telemetry_enabled = enabled;
    await updateUserConfig(config.storage.userConfigPath, userConfig);
    logger.info("telemetry setting updated", { enabled });
    res.json({ enabled });
  });

  const server = http.createServer((req, res) => {
    const url = req.url || "/";
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

  const shareOnlyServer = http.createServer((req, res) => {
    const url = req.url || "/";
    if (url === config.server.shareBasePath || url.startsWith(`${config.server.shareBasePath}/`)) {
      handler(req, res);
      return;
    }
    res.statusCode = 404;
    res.end();
  });
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
    shareOnlyServer.close(() => {
      server.close(() => process.exit(0));
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  return { shareService };
}

bootstrap().catch((error) => {
  console.error("[joincloud] Fatal error", error);
  process.exit(1);
});
