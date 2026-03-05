"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const STATES = {
  UNREGISTERED: "UNREGISTERED",
  TRIAL_ACTIVE: "TRIAL_ACTIVE",
  ACTIVE: "ACTIVE",
  GRACE: "GRACE",
  EXPIRED: "EXPIRED",
  REVOKED: "REVOKED",
};

/**
 * Create a license engine that loads and validates a signed license from a file.
 * @param {Object} opts
 * @param {string} opts.licensePath - Full path to license.json
 * @param {string} [opts.publicKeyPem] - Ed25519 public key PEM for signature verification (or process.env.JOINCLOUD_LICENSE_PUBLIC_KEY)
 */
function createLicenseEngine(opts = {}) {
  const licensePath = opts.licensePath;
  const publicKeyPem = opts.publicKeyPem || process.env.JOINCLOUD_LICENSE_PUBLIC_KEY;

  let publicKey = null;
  if (publicKeyPem && typeof publicKeyPem === "string") {
    try {
      publicKey = crypto.createPublicKey({
        key: publicKeyPem,
        format: "pem",
        type: "spki",
      });
    } catch (_) {
      publicKey = null;
    }
  }

  function payloadString(payload) {
    return JSON.stringify({
      license_id: payload.license_id,
      account_id: payload.account_id,
      tier: payload.tier,
      device_limit: payload.device_limit,
      issued_at: payload.issued_at,
      expires_at: payload.expires_at,
      state: payload.state,
      grace_ends_at: payload.grace_ends_at ?? null,
      features: payload.features || {},
    });
  }

  function verifySignature(payload, signatureBase64) {
    if (!publicKey) return false;
    try {
      const message = payloadString(payload);
      const sig = Buffer.from(signatureBase64, "base64");
      return crypto.verify(null, Buffer.from(message, "utf8"), publicKey, sig);
    } catch (_) {
      return false;
    }
  }

  /**
   * Load license from file and validate. Returns { license, state } or { license: null, state: 'UNREGISTERED' }.
   */
  function loadAndValidate() {
    if (!licensePath) return { license: null, state: STATES.UNREGISTERED };
    let raw;
    try {
      raw = fs.readFileSync(licensePath, "utf8");
    } catch (_) {
      return { license: null, state: STATES.UNREGISTERED };
    }
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (_) {
      return { license: null, state: STATES.UNREGISTERED };
    }
    if (!payload || !payload.license_id || !payload.signature) {
      return { license: null, state: STATES.UNREGISTERED };
    }
    if (!verifySignature(payload, payload.signature)) {
      return { license: null, state: STATES.REVOKED };
    }
    const now = Math.floor(Date.now() / 1000);
    const stateFromPayload = payload.state || "active";
    if (stateFromPayload === "revoked") {
      return { license: payload, state: STATES.REVOKED };
    }
    if (payload.expires_at < now) {
      return { license: payload, state: STATES.EXPIRED };
    }
    if (stateFromPayload === "grace") {
      const graceEndsAt = payload.grace_ends_at != null ? Number(payload.grace_ends_at) : 0;
      if (graceEndsAt > 0 && now <= graceEndsAt) {
        return { license: payload, state: STATES.GRACE };
      }
      return { license: payload, state: STATES.EXPIRED };
    }
    if (stateFromPayload === "trial_active" || stateFromPayload === "active") {
      return { license: payload, state: stateFromPayload === "trial_active" ? STATES.TRIAL_ACTIVE : STATES.ACTIVE };
    }
    if (stateFromPayload === "expired") {
      return { license: payload, state: STATES.EXPIRED };
    }
    return { license: payload, state: STATES.ACTIVE };
  }

  function getLicenseState() {
    const { state } = loadAndValidate();
    return state;
  }

  function getLicense() {
    const { license } = loadAndValidate();
    return license;
  }

  /**
   * Check if the app can add new devices (not expired/revoked).
   */
  function canAddDevice() {
    const state = getLicenseState();
    return state === STATES.TRIAL_ACTIVE || state === STATES.ACTIVE || state === STATES.GRACE;
  }

  /**
   * Check if full functionality (including premium) is available.
   */
  function hasFullAccess() {
    const state = getLicenseState();
    return state === STATES.TRIAL_ACTIVE || state === STATES.ACTIVE || state === STATES.GRACE;
  }

  return {
    getLicenseState,
    getLicense,
    loadAndValidate,
    canAddDevice,
    hasFullAccess,
    STATES,
  };
}

module.exports = {
  createLicenseEngine,
  STATES,
};
