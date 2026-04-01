"use strict";

const path = require("path");
const fs = require("fs/promises");
const fsSync = require("fs");
const crypto = require("crypto");

function getSafeStorage() {
  try {
    // eslint-disable-next-line global-require
    const electron = require("electron");
    return electron?.safeStorage || null;
  } catch (_) {
    return null;
  }
}

function fallbackEncrypt(text) {
  const secret = process.env.JOINCLOUD_KEYSTORE_SECRET || "joincloud-key-store-v1";
  const key = crypto.createHash("sha256").update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(text, "utf8")), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function fallbackDecrypt(encoded) {
  const secret = process.env.JOINCLOUD_KEYSTORE_SECRET || "joincloud-key-store-v1";
  const key = crypto.createHash("sha256").update(secret).digest();
  const raw = Buffer.from(String(encoded || ""), "base64");
  if (raw.length < 28) throw new Error("invalid keystore payload");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

class KeyStore {
  constructor(options = {}) {
    this.filePath =
      options.filePath ||
      path.join(process.env.JOINCLOUD_USER_DATA || process.cwd(), "JoinCloud", "system", "paired_keys.enc.json");
    this.keys = new Map();
    this.safeStorage = options.safeStorage || getSafeStorage();
  }

  setKey(id, buf) {
    if (!id) throw new Error("device id is required");
    if (!Buffer.isBuffer(buf) || buf.length !== 32) {
      throw new Error("key buffer must be 32 bytes");
    }
    this.keys.set(String(id), Buffer.from(buf));
  }

  getKey(id) {
    const key = this.keys.get(String(id || ""));
    return key ? Buffer.from(key) : null;
  }

  deleteKey(id) {
    return this.keys.delete(String(id || ""));
  }

  hasDevice(id) {
    return this.keys.has(String(id || ""));
  }

  async persistKeys() {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    const list = [];
    for (const [id, key] of this.keys.entries()) {
      list.push({ id, key: key.toString("base64") });
    }
    const payload = JSON.stringify({ version: 1, keys: list });
    let encrypted;
    if (this.safeStorage && this.safeStorage.isEncryptionAvailable()) {
      encrypted = this.safeStorage.encryptString(payload).toString("base64");
    } else {
      encrypted = fallbackEncrypt(payload);
    }
    await fs.writeFile(this.filePath, JSON.stringify({ encrypted }, null, 2), "utf8");
  }

  async loadKeys() {
    if (!fsSync.existsSync(this.filePath)) return;
    const raw = await fs.readFile(this.filePath, "utf8");
    const parsed = JSON.parse(raw || "{}");
    if (!parsed.encrypted) return;
    let decrypted;
    if (this.safeStorage && this.safeStorage.isEncryptionAvailable()) {
      decrypted = this.safeStorage.decryptString(Buffer.from(parsed.encrypted, "base64"));
    } else {
      decrypted = fallbackDecrypt(parsed.encrypted);
    }
    const payload = JSON.parse(decrypted);
    this.keys.clear();
    for (const entry of payload.keys || []) {
      if (!entry?.id || !entry?.key) continue;
      const keyBuffer = Buffer.from(entry.key, "base64");
      if (keyBuffer.length === 32) this.keys.set(String(entry.id), keyBuffer);
    }
  }
}

module.exports = { KeyStore };
