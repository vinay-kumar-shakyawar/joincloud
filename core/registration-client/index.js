"use strict";

const https = require("https");
const fs = require("fs");
const path = require("path");

const REQUEST_TIMEOUT_MS = 2000;
const REGISTRATION_RETRY_BASE_MS = 6 * 60 * 60 * 1000;
const REGISTRATION_RETRY_JITTER = 0.2;

function normalizePlatform(platform) {
  if (platform === "win32") return "windows";
  if (platform === "darwin") return "macos";
  if (platform === "linux") return "linux";
  return String(platform || "unknown").toLowerCase();
}

function parseHost(host) {
  if (!host || typeof host !== "string") return { hostname: "", port: 443 };
  const idx = host.indexOf(":");
  if (idx === -1) return { hostname: host.trim(), port: 443 };
  return {
    hostname: host.slice(0, idx).trim(),
    port: parseInt(host.slice(idx + 1), 10) || 443,
  };
}

function post(host, pathname, payload, timeoutMs) {
  const { hostname, port } = parseHost(host);
  if (!hostname) return Promise.resolve({ ok: false, error: "no host" });
  return new Promise((resolve) => {
    const data = JSON.stringify(payload);
    const req = https.request(
      {
        method: "POST",
        hostname,
        port,
        path: pathname,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
        timeout: timeoutMs,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => {
          const ok = res.statusCode >= 200 && res.statusCode < 300;
          resolve({ ok, statusCode: res.statusCode, body });
        });
      }
    );
    req.on("error", (err) => resolve({ ok: false, error: err.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, error: "timeout" });
    });
    req.write(data);
    req.end();
  });
}

/**
 * Attempt host registration. Non-blocking; on failure queues payload for retry.
 * @param {Object} identity - From device-identity getOrCreateIdentity
 * @param {Object} options
 * @param {string} options.controlPlaneHost - Control plane hostname (e.g. from JOINCLOUD_ADMIN_HOST)
 * @param {string} [options.identityPath] - Path to identity.json for persisting registration_status
 * @param {function} [options.persistIdentity] - (identityPath, identity) => void
 * @param {string} [options.platform] - process.platform (normalized to macos/windows/linux)
 * @param {string} [options.arch] - process.arch
 * @param {function} [options.log] - (msg, meta) => void
 */
async function registerHost(identity, options) {
  const {
    controlPlaneHost,
    identityPath,
    persistIdentity: persistIdentityFn,
    platform = process.platform,
    arch = process.arch,
    log = () => {},
  } = options || {};

  if (!controlPlaneHost || !identity?.host_uuid) {
    if (!controlPlaneHost) log("registration skipped", { reason: "no control plane host" });
    return { success: false };
  }

  const payload = {
    host_uuid: identity.host_uuid,
    installation_id: identity.installation_id,
    version: identity.version || "0.0.0",
    platform: normalizePlatform(platform),
    arch: String(arch),
    first_installed_at: identity.created_at ?? Math.floor(Date.now() / 1000),
  };

  const result = await post(
    controlPlaneHost,
    "/api/v1/hosts/register",
    payload,
    REQUEST_TIMEOUT_MS
  );

  if (result.ok) {
    const updated = { ...identity, registration_status: "registered" };
    if (identityPath && typeof persistIdentityFn === "function") {
      try {
        persistIdentityFn(identityPath, updated);
      } catch (_) {}
    }
    log("registration success", { host_uuid_truncated: (identity.host_uuid || "").slice(0, 8) + "…" });
    clearPendingPayload(pendingPath(identityPath));
    return { success: true };
  }

  log("registration failed", { statusCode: result.statusCode, error: result.error });
  savePendingPayload(pendingPath(identityPath), payload);
  return { success: false };
}

/**
 * Send heartbeat. Non-blocking; no retry queue.
 */
async function sendHeartbeat(identity, options) {
  const {
    controlPlaneHost,
    uptimeSeconds = 0,
    log = () => {},
  } = options || {};

  if (!controlPlaneHost || !identity?.host_uuid) return { success: false };

  const payload = {
    host_uuid: identity.host_uuid,
    version: identity.version || "0.0.0",
    uptime_seconds: Math.max(0, Math.floor(uptimeSeconds)),
  };

  const result = await post(
    controlPlaneHost,
    "/api/v1/hosts/heartbeat",
    payload,
    REQUEST_TIMEOUT_MS
  );

  if (result.ok) {
    log("heartbeat ok", { host_uuid_truncated: (identity.host_uuid || "").slice(0, 8) + "…" });
    return { success: true };
  }
  log("heartbeat failed", { statusCode: result.statusCode, error: result.error });
  return { success: false };
}

function pendingPath(identityPath) {
  if (!identityPath) return null;
  const dir = path.dirname(identityPath);
  return path.join(dir, "pending-registration.json");
}

function savePendingPayload(pendingFilePath, payload) {
  if (!pendingFilePath) return;
  try {
    const dir = path.dirname(pendingFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(pendingFilePath, JSON.stringify(payload, null, 0), "utf8");
  } catch (_) {}
}

function readPendingPayload(pendingFilePath) {
  if (!pendingFilePath || !fs.existsSync(pendingFilePath)) return null;
  try {
    const data = fs.readFileSync(pendingFilePath, "utf8");
    return JSON.parse(data);
  } catch (_) {
    return null;
  }
}

function clearPendingPayload(pendingFilePath) {
  if (!pendingFilePath) return;
  try {
    if (fs.existsSync(pendingFilePath)) fs.unlinkSync(pendingFilePath);
  } catch (_) {}
}

/**
 * Retry pending registration if a pending payload exists. Call from a timer (e.g. every 6h).
 * @param {Object} options - Same as registerHost plus identityPath, persistIdentity, getIdentity (() => identity)
 */
async function retryPendingRegistration(options) {
  const { identityPath, getIdentity, ...rest } = options || {};
  const pendingFilePath = pendingPath(identityPath);
  const payload = readPendingPayload(pendingFilePath);
  if (!payload) return { success: true, skipped: true };

  const identity = typeof getIdentity === "function" ? getIdentity() : null;
  if (!identity) return { success: false, skipped: false };

  const result = await post(
    rest.controlPlaneHost,
    "/api/v1/hosts/register",
    payload,
    REQUEST_TIMEOUT_MS
  );

  if (result.ok) {
    const updated = { ...identity, registration_status: "registered" };
    if (identityPath && typeof rest.persistIdentity === "function") {
      try {
        rest.persistIdentity(identityPath, updated);
      } catch (_) {}
    }
    clearPendingPayload(pendingFilePath);
    if (rest.log) rest.log("registration retry success", {});
    return { success: true };
  }
  return { success: false, skipped: false };
}

/**
 * Create a registration scheduler: runs register once immediately (fire-and-forget), then retries pending every 6h ± jitter.
 */
function createRegistrationScheduler(options) {
  const {
    identityPath,
    getIdentity,
    persistIdentity,
    controlPlaneHost,
    log = () => {},
  } = options || {};

  let retryTimer = null;

  function scheduleRetry() {
    if (retryTimer) return;
    const jitter = 1 + (Math.random() * 2 - 1) * REGISTRATION_RETRY_JITTER;
    const delay = REGISTRATION_RETRY_BASE_MS * jitter;
    retryTimer = setTimeout(async () => {
      retryTimer = null;
      const result = await retryPendingRegistration({
        identityPath,
        getIdentity,
        persistIdentity,
        controlPlaneHost,
        log,
      });
      if (!result.success && !result.skipped) scheduleRetry();
    }, delay);
  }

  function start() {
    const identity = typeof getIdentity === "function" ? getIdentity() : null;
    if (!identity || !controlPlaneHost) return;
    registerHost(identity, {
      controlPlaneHost,
      identityPath,
      persistIdentity,
      log,
    }).then((r) => {
      if (!r.success) scheduleRetry();
    });
  }

  function stop() {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  return { start, stop, scheduleRetry };
}

module.exports = {
  registerHost,
  sendHeartbeat,
  retryPendingRegistration,
  createRegistrationScheduler,
  readPendingPayload,
  pendingPath,
};
