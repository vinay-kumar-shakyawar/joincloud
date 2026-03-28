/**
 * socketClient.js
 *
 * Connects the JoinCloud desktop app to the JoinCloud Admin Socket.IO server.
 * Handles:
 *   - Real-time license / plan updates  → updates local entitlement cache
 *   - Support chat (admin → device)     → pushed to React UI via SSE
 *   - Admin presence in support chat    → triggers animation via SSE
 *   - Typing indicators                 → forwarded via SSE
 *
 * The server process cannot communicate directly with Electron's main process,
 * so license updates are signalled by printing the marker line that main.js
 * already watches on stdout.  All other UI events go via the local SSE endpoint
 * (/api/sse/events) that the React frontend subscribes to.
 */

const { io } = require("socket.io-client");

let _socket = null;

// Active SSE response objects waiting for push events
let _sseClients = [];

// Whether an admin currently has this support thread open
let _adminActive = false;

// ─── SSE helpers ─────────────────────────────────────────────────────────────

/**
 * Register a new SSE response object.  Called from the /api/sse/events route.
 */
function addSseClient(res) {
  _sseClients.push(res);
  res.on("close", () => {
    _sseClients = _sseClients.filter((c) => c !== res);
  });
}

function pushSse(eventType, data) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of _sseClients) {
    try {
      res.write(payload);
    } catch (_) {
      /* client disconnected mid-write */
    }
  }
}

// ─── Connection ───────────────────────────────────────────────────────────────

/**
 * Connect to the admin Socket.IO server.
 *
 * @param {object} opts
 * @param {string}   opts.adminHost          Base URL of the admin server
 * @param {string}   opts.hostUuid           This device's hostUuid
 * @param {function} opts.writeEntitlements  writeSignedEntitlements(data) from index.js
 * @param {function} opts.getCache           () => controlPlaneConfigCache
 * @param {function} opts.setCache           (val) => { controlPlaneConfigCache = val }
 */
function connectToAdmin({ adminHost, hostUuid, socketPort, writeEntitlements, getCache, setCache }) {
  if (_socket) return; // already connected

  const baseUrl = adminHost.replace(/\/$/, "");
  // If a dedicated socket port is provided, swap in that port
  let url = baseUrl;
  if (socketPort && socketPort !== 80 && socketPort !== 443) {
    try {
      const parsed = new URL(baseUrl.indexOf("://") === -1 ? `https://${baseUrl}` : baseUrl);
      parsed.port = String(socketPort);
      url = parsed.toString().replace(/\/$/, "");
    } catch (_) {
      url = baseUrl;
    }
  }

  _socket = io(`${url}/device`, {
    reconnection: true,
    reconnectionDelay: 3000,
    reconnectionDelayMax: 30000,
    auth: { hostUuid },
    transports: ["websocket", "polling"],
  });

  _socket.on("connect", () => {
    console.log(`[realtime] connected to admin (hostUuid=${hostUuid})`);
  });

  _socket.on("connect_error", (err) => {
    console.warn(`[realtime] connect error: ${err.message}`);
  });

  _socket.on("disconnect", (reason) => {
    console.log(`[realtime] disconnected: ${reason}`);
  });

  // ─── License / plan updated ───────────────────────────────────────────────
  _socket.on("license:updated", (data) => {
    console.log("[realtime] license:updated", data);

    // Update in-memory config cache so API endpoints reflect new limits instantly
    const cache = getCache() || {};
    cache.license = Object.assign({}, cache.license, {
      state: data.state,
      tier: data.tier,
      expires_at: data.expiresAt,
      ...(data.deviceLimit != null && { device_limit: data.deviceLimit }),
    });
    if (data.shareLimitMonthly !== undefined && cache.entitlements) {
      cache.entitlements = Object.assign({}, cache.entitlements, {
        shareLimitMonthly: data.shareLimitMonthly,
      });
    }
    setCache(cache);

    // Persist to signed entitlements file
    try {
      writeEntitlements({
        licenseState: data.state,
        entitlements: {
          shareLimitMonthly: data.shareLimitMonthly ?? null,
          deviceLimit: data.deviceLimit ?? null,
        },
      });
    } catch (e) {
      console.warn("[realtime] failed to persist entitlements:", e.message);
    }

    // Signal main.js to send 'license-updated' IPC to the renderer window
    console.log("[joincloud-auth-callback] license-updated");
  });

  // ─── Support: admin sends message to this device ──────────────────────────
  _socket.on("support:message", (data) => {
    pushSse("support:message", data.message || data);
  });

  // ─── Support: admin opened this device's thread (show animation) ─────────
  _socket.on("support:admin_joined", (data) => {
    _adminActive = true;
    pushSse("support:admin_joined", { adminId: data.adminId || null });
  });

  // ─── Support: admin closed this device's thread (hide animation) ─────────
  _socket.on("support:admin_left", () => {
    _adminActive = false;
    pushSse("support:admin_left", {});
  });

  // ─── Support: admin typing indicator ─────────────────────────────────────
  _socket.on("support:typing", (data) => {
    pushSse("support:typing", { isTyping: data.isTyping });
  });

  // ─── Support: admin resolved the case ─────────────────────────────────────
  _socket.on("support:resolved", () => {
    pushSse("support:resolved", {});
  });
}

// ─── Outgoing events (device → admin) ────────────────────────────────────────

/** Send a support message text to the admin. */
function sendSupportMessage(text) {
  if (!_socket || !_socket.connected) return false;
  _socket.emit("support:message", { text });
  return true;
}

/** Send typing indicator to admin. */
function sendTyping(isTyping) {
  if (!_socket || !_socket.connected) return;
  _socket.emit("support:typing", { isTyping });
}

function isAdminActive() {
  return _adminActive;
}

function isConnected() {
  return !!(_socket && _socket.connected);
}

module.exports = {
  connectToAdmin,
  addSseClient,
  sendSupportMessage,
  sendTyping,
  isAdminActive,
  isConnected,
};
