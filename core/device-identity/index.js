"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { getMachineIdHashed } = require("./machineId");

function randomUUID() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const hex = crypto.randomBytes(16).toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    "4" + hex.slice(13, 16),
    ((parseInt(hex.slice(16, 18), 16) & 0x3) | 0x8).toString(16) + hex.slice(18, 20),
    hex.slice(20, 32),
  ].join("-");
}

function computeHostUuid(machineIdHex, installationSalt) {
  return crypto
    .createHash("sha256")
    .update(machineIdHex + installationSalt, "utf8")
    .digest("hex");
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readIdentity(identityPath) {
  try {
    const data = fs.readFileSync(identityPath, "utf8");
    return JSON.parse(data);
  } catch (_) {
    return null;
  }
}

function writeIdentity(identityPath, identity) {
  const dir = path.dirname(identityPath);
  ensureDir(dir);
  fs.writeFileSync(identityPath, JSON.stringify(identity, null, 0), "utf8");
}

/**
 * Get or create device identity. Identity is stored at identityPath (e.g. ~/.joincloud/system/identity.json).
 * If opts.vault is provided (e.g. from identity-vault), and identity file is missing, tries to recover
 * installationSalt from keychain and recompute same host_uuid (anti-reinstall bypass).
 * @param {Object} opts
 * @param {string} opts.appVersion - Application version string
 * @param {string} opts.identityPath - Full path to identity.json
 * @param {{ setInstallationSalt: function(string), getInstallationSalt: function(): string|null }} [opts.vault] - Optional keychain vault for installationSalt
 * @returns {Object} Identity { host_uuid, installation_id, created_at, last_seen_at, version, registration_status }
 */
function getOrCreateIdentity(opts) {
  const { appVersion = "0.0.0", identityPath, vault } = opts;
  if (!identityPath) {
    throw new Error("identityPath is required");
  }

  const existing = readIdentity(identityPath);
  if (existing && existing.host_uuid && existing.installation_id) {
    const updated = {
      ...existing,
      version: appVersion,
      last_seen_at: Math.floor(Date.now() / 1000),
    };
    setImmediate(() => {
      try {
        writeIdentity(identityPath, updated);
      } catch (_) {}
    });
    return updated;
  }

  const machineIdHex = getMachineIdHashed();
  let installationSalt;
  const recoveredSalt = vault && typeof vault.getInstallationSalt === "function" ? vault.getInstallationSalt() : null;
  if (recoveredSalt && typeof recoveredSalt === "string") {
    installationSalt = recoveredSalt;
  } else {
    installationSalt = randomUUID();
    if (vault && typeof vault.setInstallationSalt === "function") {
      try {
        vault.setInstallationSalt(installationSalt);
      } catch (_) {}
    }
  }

  const host_uuid = computeHostUuid(machineIdHex, installationSalt);
  const now = Math.floor(Date.now() / 1000);
  const identity = {
    host_uuid,
    installation_id: existing?.installation_id || randomUUID(),
    created_at: existing?.created_at || now,
    last_seen_at: now,
    version: appVersion,
    registration_status: existing?.registration_status || "pending",
  };
  writeIdentity(identityPath, identity);
  return identity;
}

/**
 * Persist identity after registration success (updates registration_status and optionally last_seen_at).
 * @param {string} identityPath
 * @param {Object} identity - Identity object to write
 */
function persistIdentity(identityPath, identity) {
  ensureDir(path.dirname(identityPath));
  writeIdentity(identityPath, identity);
}

module.exports = {
  getOrCreateIdentity,
  persistIdentity,
  computeHostUuid,
  readIdentity,
};
