const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const PENDING_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function nowIso() {
  return new Date().toISOString();
}

function toMs(value) {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

function ensureShape(raw) {
  return {
    requests: raw && typeof raw.requests === "object" ? raw.requests : {},
    sessions: raw && typeof raw.sessions === "object" ? raw.sessions : {},
  };
}

class AccessControlStore {
  constructor({ storagePath, logger }) {
    this.storagePath = storagePath;
    this.logger = logger;
    this.state = ensureShape();
  }

  async init() {
    await fs.mkdir(path.dirname(this.storagePath), { recursive: true });
    try {
      const raw = await fs.readFile(this.storagePath, "utf8");
      this.state = ensureShape(JSON.parse(raw));
    } catch (error) {
      this.state = ensureShape();
      await this.persist();
    }
    await this.cleanupExpired();
  }

  async persist() {
    await fs.writeFile(this.storagePath, JSON.stringify(this.state, null, 2));
  }

  async cleanupExpired() {
    const now = Date.now();
    let changed = false;

    for (const [requestId, request] of Object.entries(this.state.requests)) {
      const createdAtMs = toMs(request.created_at);
      if (request.status === "pending" && now - createdAtMs > PENDING_TTL_MS) {
        delete this.state.requests[requestId];
        changed = true;
      }
      if (
        request.status === "approved" &&
        request.approved_at &&
        now - toMs(request.approved_at) > SESSION_TTL_MS
      ) {
        delete this.state.requests[requestId];
        changed = true;
      }
    }

    for (const [token, session] of Object.entries(this.state.sessions)) {
      if (session.expires_at && now > toMs(session.expires_at)) {
        delete this.state.sessions[token];
        changed = true;
      }
    }

    if (changed) {
      await this.persist();
    }
  }

  async createRequest({ device_name, fingerprint, user_agent, ip }) {
    await this.cleanupExpired();
    const requestId = crypto.randomUUID();
    this.state.requests[requestId] = {
      request_id: requestId,
      status: "pending",
      device_name: device_name || "Unknown Device",
      fingerprint,
      user_agent: user_agent || "",
      ip: ip || "",
      created_at: nowIso(),
      approved_at: null,
      denied_at: null,
      session_token: null,
    };
    await this.persist();
    return this.state.requests[requestId];
  }

  async getRequest(requestId) {
    await this.cleanupExpired();
    return this.state.requests[requestId] || null;
  }

  async getPending() {
    await this.cleanupExpired();
    return Object.values(this.state.requests)
      .filter((request) => request.status === "pending")
      .sort((a, b) => toMs(b.created_at) - toMs(a.created_at));
  }

  async approveRequest(requestId) {
    await this.cleanupExpired();
    const request = this.state.requests[requestId];
    if (!request || request.status !== "pending") {
      return null;
    }
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    request.status = "approved";
    request.approved_at = nowIso();
    request.session_token = sessionToken;

    this.state.sessions[sessionToken] = {
      request_id: requestId,
      fingerprint: request.fingerprint,
      device_name: request.device_name || "Unknown Device",
      created_at: nowIso(),
      approved_at: request.approved_at,
      last_seen_at: null,
      expires_at: expiresAt,
    };
    await this.persist();
    return {
      request,
      session_token: sessionToken,
      expires_at: expiresAt,
    };
  }

  async denyRequest(requestId) {
    await this.cleanupExpired();
    const request = this.state.requests[requestId];
    if (!request || request.status !== "pending") {
      return null;
    }
    request.status = "denied";
    request.denied_at = nowIso();
    await this.persist();
    return request;
  }

  async validateSession({ token, fingerprint }) {
    await this.cleanupExpired();
    const session = token ? this.state.sessions[token] : null;
    if (!session) {
      return { authorized: false, reason: "missing_or_invalid_token" };
    }
    if (!session.fingerprint || session.fingerprint !== fingerprint) {
      return { authorized: false, reason: "fingerprint_mismatch" };
    }
    session.last_seen_at = nowIso();
    this.state.sessions[token] = session;
    await this.persist();
    return { authorized: true, session };
  }

  async listApprovedDevices() {
    await this.cleanupExpired();
    const grouped = new Map();
    for (const session of Object.values(this.state.sessions)) {
      const key = session.fingerprint || "unknown";
      const existing = grouped.get(key) || {
        fingerprint: key,
        device_name: session.device_name || "Unknown Device",
        approved_at: session.approved_at || session.created_at || null,
        last_seen_at: session.last_seen_at || null,
        session_count: 0,
      };
      existing.session_count += 1;
      const approvedAt = toMs(existing.approved_at) > toMs(session.approved_at) ? existing.approved_at : (session.approved_at || existing.approved_at);
      existing.approved_at = approvedAt;
      const lastSeen = toMs(existing.last_seen_at) > toMs(session.last_seen_at) ? existing.last_seen_at : (session.last_seen_at || existing.last_seen_at);
      existing.last_seen_at = lastSeen;
      grouped.set(key, existing);
    }
    return Array.from(grouped.values()).sort((a, b) => toMs(b.approved_at) - toMs(a.approved_at));
  }

  async removeApprovedDevice(fingerprint) {
    if (!fingerprint) return { removed_sessions: 0 };
    let removedSessions = 0;
    let changed = false;
    for (const [token, session] of Object.entries(this.state.sessions)) {
      if (session.fingerprint === fingerprint) {
        delete this.state.sessions[token];
        removedSessions += 1;
        changed = true;
      }
    }
    for (const request of Object.values(this.state.requests)) {
      if (request.fingerprint === fingerprint && request.status === "approved") {
        request.status = "denied";
        request.denied_at = nowIso();
        request.session_token = null;
        changed = true;
      }
    }
    if (changed) {
      await this.persist();
    }
    return { removed_sessions: removedSessions };
  }
}

module.exports = {
  AccessControlStore,
};
