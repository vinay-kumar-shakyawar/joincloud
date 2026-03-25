"use strict";

const crypto = require("crypto");

function decodeBase64(name, value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required`);
  }
  try {
    return Buffer.from(value, "base64");
  } catch (_) {
    throw new Error(`${name} must be valid base64`);
  }
}

function decryptMetadata(payload, rawKeyBuffer) {
  if (!rawKeyBuffer || !Buffer.isBuffer(rawKeyBuffer) || rawKeyBuffer.length !== 32) {
    throw new Error("invalid metadata key");
  }
  const encryptedMeta = decodeBase64("encryptedMeta", payload?.encryptedMeta);
  const iv = decodeBase64("iv", payload?.iv);
  const authTag = decodeBase64("authTag", payload?.authTag);
  if (iv.length !== 12) throw new Error("iv must be 12 bytes");
  if (authTag.length !== 16) throw new Error("authTag must be 16 bytes");

  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", rawKeyBuffer, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encryptedMeta), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8"));
  } catch (error) {
    const message = String(error?.message || "");
    if (/auth/i.test(message) || /unable to authenticate/i.test(message)) {
      throw new Error("metadata authentication failed");
    }
    throw new Error(`metadata decrypt failed: ${message || "unknown_error"}`);
  }
}

module.exports = { decryptMetadata };
