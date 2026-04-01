"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const { decryptMetadata } = require("./metaDecrypt");
const { parseRangeHeader } = require("./DirectStream");

test("decryptMetadata decrypts valid payload", () => {
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const payload = Buffer.from(JSON.stringify({ fileName: "a.txt", fileSize: 12 }), "utf8");
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const out = decryptMetadata(
    {
      encryptedMeta: encrypted.toString("base64"),
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
    },
    key
  );
  assert.equal(out.fileName, "a.txt");
  assert.equal(out.fileSize, 12);
});

test("decryptMetadata throws for invalid auth tag", () => {
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const payload = Buffer.from(JSON.stringify({ fileName: "a.txt" }), "utf8");
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  const authTag = Buffer.alloc(16, 1);
  assert.throws(
    () =>
      decryptMetadata(
        {
          encryptedMeta: encrypted.toString("base64"),
          iv: iv.toString("base64"),
          authTag: authTag.toString("base64"),
        },
        key
      ),
    /authentication failed|decrypt failed/i
  );
});

test("parseRangeHeader parses open and bounded ranges", () => {
  assert.deepEqual(parseRangeHeader("bytes=10-20", 100), { start: 10, end: 20, size: 11 });
  assert.deepEqual(parseRangeHeader("bytes=10-", 100), { start: 10, end: 99, size: 90 });
});

test("parseRangeHeader handles invalid/unsatisfiable ranges", () => {
  assert.deepEqual(parseRangeHeader("bytes=a-b", 100), { error: "malformed_range" });
  assert.deepEqual(parseRangeHeader("bytes=100-120", 100), { error: "unsatisfiable_range" });
});
