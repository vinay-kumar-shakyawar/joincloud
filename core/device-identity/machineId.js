"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const os = require("os");

function getMachineIdRaw() {
  const platform = os.platform();
  try {
    if (platform === "win32") {
      try {
        const out = execSync("wmic csproduct get uuid", { encoding: "utf8", timeout: 2000 });
        const uuid = (out || "").split("\n")[1]?.trim();
        if (uuid) return uuid;
      } catch (_) {}
      try {
        const out = execSync("reg query HKLM\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid", { encoding: "utf8", timeout: 2000 });
        const m = (out || "").match(/MachineGuid\s+REG_SZ\s+(\S+)/);
        if (m && m[1]) return m[1];
      } catch (_) {}
      return os.hostname() + "-" + (process.env.COMPUTERNAME || "win");
    }
    if (platform === "darwin") {
      const out = execSync("ioreg -rd1 -c IOPlatformExpertDevice", { encoding: "utf8", timeout: 2000 });
      const m = (out || "").match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
      if (m && m[1]) return m[1];
      return os.hostname() + "-mac";
    }
    if (platform === "linux") {
      const p = "/etc/machine-id";
      if (fs.existsSync(p)) {
        const id = fs.readFileSync(p, "utf8").trim();
        if (id) return id;
      }
      const p2 = "/var/lib/dbus/machine-id";
      if (fs.existsSync(p2)) {
        const id = fs.readFileSync(p2, "utf8").trim();
        if (id) return id;
      }
      return os.hostname() + "-linux";
    }
  } catch (_) {}
  return os.hostname() + "-" + platform + "-" + (process.getuid ? String(process.getuid()) : "0");
}

function getMachineIdHashed() {
  const raw = getMachineIdRaw();
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

module.exports = {
  getMachineIdHashed,
  getMachineIdRaw,
};
