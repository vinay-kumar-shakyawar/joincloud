"use strict";

const KEY = "joincloud.installationSalt";

/**
 * Create a vault that can store/retrieve installationSalt using OS keychain (via injectable encrypt/decrypt).
 * When running in Electron, pass safeStorage.encryptString and safeStorage.decryptString.
 * @param {Object} opts
 * @param {function(string): string|Buffer} [opts.encrypt] - Encrypt plaintext for storage (e.g. safeStorage.encryptString)
 * @param {function(string|Buffer): string} [opts.decrypt] - Decrypt stored value (e.g. safeStorage.decryptString)
 * @returns {{ setInstallationSalt: function(string), getInstallationSalt: function(): string|null }}
 */
function createIdentityVault(opts = {}) {
  const { encrypt, decrypt } = opts;
  let stored = null; // in-memory fallback when no encrypt/decrypt (e.g. server-side)

  function setInstallationSalt(salt) {
    if (typeof salt !== "string" || !salt) return;
    if (encrypt && decrypt) {
      try {
        stored = encrypt(salt);
      } catch (_) {
        stored = null;
      }
    } else {
      stored = salt;
    }
  }

  function getInstallationSalt() {
    if (stored == null) return null;
    if (encrypt && decrypt) {
      try {
        return decrypt(stored);
      } catch (_) {
        return null;
      }
    }
    return typeof stored === "string" ? stored : null;
  }

  /**
   * For Electron: persist to system keychain. Call this with the result of encrypt(salt).
   * The raw value is not stored in this module; Electron stores it via safeStorage.
   * So we need the main process to hold a reference to the encrypted buffer and pass it back.
   * Simplest: main process stores encrypted buffer in a small file in userData (safeStorage already
   * uses keychain for the encryption key). So we don't need to pass encrypt/decrypt if we store
   * the encrypted result in a file in userData - safeStorage.decryptString(encrypted) only needs
   * the encrypted string. So the flow is: encrypt(salt) -> save to file; read file -> decrypt -> salt.
   * So the vault needs read/write of the encrypted blob. So we need:
   * - setInstallationSalt(salt): encrypted = encrypt(salt); writeFile(path, encrypted)
   * - getInstallationSalt(): data = readFile(path); return decrypt(data)
   * So we need vaultPath as well. So createIdentityVault({ encrypt, decrypt, vaultPath }).
   */
  return {
    setInstallationSalt,
    getInstallationSalt,
  };
}

/**
 * Create a file-backed vault that uses encrypt/decrypt for the stored value.
 * Stores encrypted salt at vaultPath (e.g. userData/system/vault.dat).
 */
function createFileBackedVault(opts) {
  const fs = require("fs");
  const path = require("path");
  const { encrypt, decrypt, vaultPath } = opts;
  if (!vaultPath || typeof encrypt !== "function" || typeof decrypt !== "function") {
    return createIdentityVault({});
  }

  function setInstallationSalt(salt) {
    if (typeof salt !== "string" || !salt) return;
    try {
      const encrypted = encrypt(salt);
      const dir = path.dirname(vaultPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (Buffer.isBuffer(encrypted)) {
        fs.writeFileSync(vaultPath, encrypted);
      } else {
        fs.writeFileSync(vaultPath, String(encrypted), "utf8");
      }
    } catch (_) {}
  }

  function getInstallationSalt() {
    try {
      if (!fs.existsSync(vaultPath)) return null;
      const data = fs.readFileSync(vaultPath);
      const decoded = Buffer.isBuffer(data) ? data : data.trim();
      if (!decoded || (typeof decoded === "string" && !decoded.length)) return null;
      return decrypt(decoded);
    } catch (_) {
      return null;
    }
  }

  return {
    setInstallationSalt,
    getInstallationSalt,
  };
}

module.exports = {
  createIdentityVault,
  createFileBackedVault,
  KEY,
};
