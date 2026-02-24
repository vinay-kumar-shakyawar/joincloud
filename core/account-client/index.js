"use strict";

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

function request(baseUrl, method, pathname, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(pathname || "/", baseUrl);
    const isHttps = u.protocol === "https:";
    const lib = isHttps ? https : http;
    const data = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      "Content-Type": "application/json",
      ...headers,
    };
    if (data) reqHeaders["Content-Length"] = Buffer.byteLength(data);
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port || (isHttps ? 443 : 80),
        path: u.pathname + u.search,
        method,
        headers: reqHeaders,
        timeout: 15000,
      },
      (res) => {
        let buf = "";
        res.on("data", (ch) => { buf += ch; });
        res.on("end", () => {
          let json = null;
          try {
            json = buf ? JSON.parse(buf) : null;
          } catch (_) {}
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, data: json });
          } else {
            reject(new Error(json?.message || `HTTP ${res.statusCode}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
    if (data) req.write(data);
    req.end();
  });
}

/**
 * Create account client for register, login, and license activation.
 * @param {Object} opts
 * @param {string} opts.baseUrl - Control Plane base URL (e.g. https://admin.example.com)
 * @param {string} opts.licensePath - Path to write signed license (license.json)
 * @param {string} opts.tokenPath - Path to store JWT token
 * @param {function(): { host_uuid: string }} opts.getIdentity - Returns current identity with host_uuid
 * @param {function(string)} [opts.log] - Optional log function
 */
function createAccountClient(opts) {
  const { baseUrl, licensePath, tokenPath, getIdentity, log } = opts;

  function readToken() {
    try {
      if (fs.existsSync(tokenPath)) {
        return fs.readFileSync(tokenPath, "utf8").trim();
      }
    } catch (_) {}
    return null;
  }

  function writeToken(token) {
    try {
      const dir = path.dirname(tokenPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(tokenPath, token, "utf8");
    } catch (e) {
      if (log) log("Failed to write token", { error: String(e) });
    }
  }

  function writeLicense(license) {
    try {
      const dir = path.dirname(licensePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(licensePath, JSON.stringify(license, null, 0), "utf8");
    } catch (e) {
      if (log) log("Failed to write license", { error: String(e) });
    }
  }

  async function register(email, password) {
    const res = await request(baseUrl, "POST", "/api/v1/auth/register", { email, password });
    const data = res.data;
    if (data && data.token) {
      writeToken(data.token);
    }
    return data;
  }

  async function login(email, password) {
    const res = await request(baseUrl, "POST", "/api/v1/auth/login", { email, password });
    const data = res.data;
    if (data && data.token) {
      writeToken(data.token);
    }
    return data;
  }

  async function activate() {
    const identity = getIdentity && getIdentity();
    if (!identity || !identity.host_uuid) {
      throw new Error("No host identity");
    }
    const token = readToken();
    if (!token) {
      throw new Error("Not logged in");
    }
    const res = await request(baseUrl, "POST", "/api/v1/license/activate", { host_uuid: identity.host_uuid }, {
      Authorization: "Bearer " + token,
    });
    const license = res.data;
    if (license) {
      writeLicense(license);
    }
    return license;
  }

  function getStoredToken() {
    return readToken();
  }

  function clearToken() {
    try {
      if (fs.existsSync(tokenPath)) fs.unlinkSync(tokenPath);
    } catch (_) {}
  }

  return {
    register,
    login,
    activate,
    getStoredToken,
    clearToken,
  };
}

module.exports = {
  createAccountClient,
  request,
};
