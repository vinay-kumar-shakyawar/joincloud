"use strict";

function defaultHasDevice(deviceId) {
  return Boolean(deviceId);
}

function defaultValidateHostToken(token) {
  return Boolean(token);
}

function detectTransferMode(req, options = {}) {
  const headers = req?.headers || {};
  const origin = String(headers["x-transfer-origin"] || "").trim().toLowerCase();
  const deviceId = String(headers["x-paired-device-id"] || "").trim();
  const hostToken = String(headers["x-host-session-token"] || "").trim();
  const hasDevice = options.hasDevice || defaultHasDevice;
  const isValidHostToken = options.isValidHostToken || defaultValidateHostToken;

  if (origin === "paired-device" && deviceId && hasDevice(deviceId)) {
    return "CHUNKED";
  }
  if (origin === "electron-host" && hostToken && isValidHostToken(hostToken)) {
    return "DIRECT";
  }
  return "CHUNKED";
}

module.exports = { detectTransferMode };
