#!/usr/bin/env node
"use strict";

/**
 * mDNS resolution integration test.
 * Verifies that join-<id>.local resolves on the local machine when JoinCloud is running.
 *
 * Usage:
 *   node scripts/test-mdns-resolution.js
 *   # Or with base URL if server runs elsewhere:
 *   BASE_URL=http://192.168.1.100:8787 node scripts/test-mdns-resolution.js
 *
 * Prerequisites: JoinCloud backend must be running (npm run backend:dev or npm run dev).
 */

const dns = require("dns");
const http = require("http");
const { promisify } = require("util");

const dnsLookup = promisify(dns.lookup);
const TIMEOUT_MS = 10000;
const POLL_INTERVAL_MS = 500;

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error("Invalid JSON"));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
  });
}

async function getStatus(baseUrl) {
  const data = await fetchJson(`${baseUrl}/api/status`);
  return {
    mdnsHostname: data.mdns_hostname,
    bestLanIp: data.bestLanIp,
    port: data.port || 8787,
    lanBaseUrl: data.lanBaseUrl,
  };
}

function resolveWithTimeout(hostname, timeoutMs) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`Resolution timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    dns.lookup(hostname, { all: false }, (err, address) => {
      clearTimeout(t);
      if (err) reject(err);
      else resolve(address);
    });
  });
}

async function main() {
  const baseUrl = process.env.BASE_URL || "http://127.0.0.1:8787";
  console.log("mDNS resolution test");
  console.log("Base URL:", baseUrl);
  console.log("");

  let status;
  try {
    status = await getStatus(baseUrl);
  } catch (err) {
    console.error("FAIL: Could not fetch status. Is JoinCloud running?");
    console.error(err.message);
    process.exit(1);
  }

  const { mdnsHostname, bestLanIp, port } = status;
  if (!mdnsHostname) {
    console.error("FAIL: No mdns_hostname in status response");
    process.exit(1);
  }

  console.log("Hostname to resolve:", mdnsHostname);
  console.log("Expected LAN IP:", bestLanIp);
  console.log("Waiting up to", TIMEOUT_MS / 1000, "seconds for mDNS advertisement...");
  console.log("");

  const start = Date.now();
  let resolvedIp = null;

  while (Date.now() - start < TIMEOUT_MS) {
    try {
      resolvedIp = await resolveWithTimeout(mdnsHostname, 3000);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }

  if (!resolvedIp) {
    console.error("FAIL: Could not resolve", mdnsHostname, "within", TIMEOUT_MS / 1000, "seconds");
    console.error("");
    console.error("Verification commands:");
    console.error("  ping", mdnsHostname);
    console.error("  curl -I http://" + mdnsHostname + ":" + port + "/");
    process.exit(1);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log("PASS: Resolved", mdnsHostname, "->", resolvedIp, "in", elapsed, "s");

  if (bestLanIp && resolvedIp !== bestLanIp) {
    console.warn("WARN: Resolved IP", resolvedIp, "differs from bestLanIp", bestLanIp);
    console.warn("      (This may be OK if multiple interfaces)");
  }

  try {
    const res = await new Promise((resolve, reject) => {
      const url = `http://${mdnsHostname}:${port}/api/v1/health`;
      http.get(url, (r) => resolve(r)).on("error", reject);
    });
    if (res.statusCode === 200) {
      console.log("PASS: Cloud UI reachable at http://" + mdnsHostname + ":" + port + "/");
    } else {
      console.warn("WARN: Cloud UI returned", res.statusCode);
    }
  } catch (err) {
    console.warn("WARN: Could not reach Cloud UI via hostname:", err.message);
  }

  console.log("");
  console.log("All checks passed.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
