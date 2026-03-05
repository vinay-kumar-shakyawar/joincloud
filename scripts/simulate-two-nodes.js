#!/usr/bin/env node
/**
 * Integration test: simulates two JoinCloud nodes on one machine.
 * Uses mocked discovery (manual-connect) since mDNS across one host is unreliable.
 *
 * Validates:
 * - Connect request sent -> approval accepted -> user appears in Connected Users
 * - Revoke/remove works
 *
 * Run: node scripts/simulate-two-nodes.js
 */

const { spawn } = require("child_process");
const path = require("path");
const os = require("os");
const fs = require("fs");

const PORT_A = 8790;
const PORT_B = 8791;
const SHARE_PORT_A = 8792;
const SHARE_PORT_B = 8793;
const TEST_DIR = path.join(os.tmpdir(), "joincloud-integration-test-" + Date.now());

function mkdirSync(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
  }
}

function getEnvForNode(port, sharePort, label) {
  const base = path.join(TEST_DIR, label);
  mkdirSync(path.join(base, "storage"));
  mkdirSync(path.join(base, "config"));
  mkdirSync(path.join(base, "logs"));
  mkdirSync(path.join(base, "data"));
  return {
    ...process.env,
    JOINCLOUD_APP_SUPPORT_DIR: base,
    JOINCLOUD_PORT: String(port),
    JOINCLOUD_SHARE_PORT: String(sharePort),
  };
}

async function waitFor(url, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

async function run() {
  console.log("[test] Creating test dir:", TEST_DIR);
  mkdirSync(TEST_DIR);

  const serverPath = path.join(__dirname, "..", "server", "index.js");
  const nodeA = spawn(process.execPath, [serverPath], {
    env: getEnvForNode(PORT_A, SHARE_PORT_A, "nodeA"),
    stdio: ["ignore", "pipe", "pipe"],
  });
  const nodeB = spawn(process.execPath, [serverPath], {
    env: getEnvForNode(PORT_B, SHARE_PORT_B, "nodeB"),
    stdio: ["ignore", "pipe", "pipe"],
  });

  nodeA.stderr?.on("data", (d) => process.stderr.write(`[A] ${d}`));
  nodeB.stderr?.on("data", (d) => process.stderr.write(`[B] ${d}`));

  const cleanup = () => {
    nodeA.kill("SIGTERM");
    nodeB.kill("SIGTERM");
    try {
      fs.rmSync(TEST_DIR, { recursive: true });
    } catch (_) {}
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  console.log("[test] Waiting for servers...");
  const aReady = await waitFor(`http://127.0.0.1:${PORT_A}/api/v1/status`);
  const bReady = await waitFor(`http://127.0.0.1:${PORT_B}/api/v1/status`);
  if (!aReady || !bReady) {
    console.error("[test] Servers failed to start");
    cleanup();
    process.exit(1);
  }
  console.log("[test] Both servers ready");

  const baseA = `http://127.0.0.1:${PORT_A}`;
  const baseB = `http://127.0.0.1:${PORT_B}`;

  try {
    const peerA = await fetch(`${baseA}/api/v1/peer`).then((r) => r.json());
    const peerB = await fetch(`${baseB}/api/v1/peer`).then((r) => r.json());
    console.log("[test] Node A:", peerA.deviceId, peerA.displayName);
    console.log("[test] Node B:", peerB.deviceId, peerB.displayName);

    const fingerprintB = "test-fp-" + Date.now();
    console.log("[test] Step 1: B sends connect request to A");
    const reqRes = await fetch(`${baseA}/api/v1/access/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-JoinCloud-Fingerprint": fingerprintB },
      body: JSON.stringify({ device_name: "Test Device B", fingerprint: fingerprintB }),
    });
    const reqData = await reqRes.json();
    if (!reqRes.ok) {
      throw new Error("Request failed: " + JSON.stringify(reqData));
    }
    const requestId = reqData.request_id;
    console.log("[test] Request created:", requestId);

    const pending = await fetch(`${baseA}/api/v1/access/pending`, {
      headers: { "X-JoinCloud-Fingerprint": fingerprintB },
    }).then((r) => r.json());
    if (!pending.length) throw new Error("Pending list empty");
    console.log("[test] Pending requests on A:", pending.length);

    console.log("[test] Step 2: A approves request");
    const approveRes = await fetch(`${baseA}/api/v1/access/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request_id: requestId }),
    });
    if (!approveRes.ok) throw new Error("Approve failed: " + await approveRes.text());

    const devices = await fetch(`${baseA}/api/v1/access/devices`).then((r) => r.json());
    if (!devices.length) throw new Error("Connected Users list empty after approve");
    console.log("[test] Connected Users on A:", devices.length);

    const fpToRemove = devices[0].fingerprint;
    console.log("[test] Step 3: A revokes/removes device");
    const removeRes = await fetch(`${baseA}/api/v1/access/devices/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fingerprint: fpToRemove }),
    });
    if (!removeRes.ok) throw new Error("Remove failed");

    const devicesAfter = await fetch(`${baseA}/api/v1/access/devices`).then((r) => r.json());
    if (devicesAfter.length !== 0) throw new Error("Device still in list after remove");
    console.log("[test] Revoke verified: list is empty");

    console.log("[test] All checks passed.");
  } catch (err) {
    console.error("[test] FAILED:", err.message);
    cleanup();
    process.exit(1);
  }

  cleanup();
  process.exit(0);
}

run();