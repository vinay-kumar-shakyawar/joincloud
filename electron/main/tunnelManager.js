const { spawn } = require("child_process");

let tunnelProcess = null;
let stopping = false;
let restartTimer = null;
const statusListeners = new Set();

function emitStatus(active) {
  statusListeners.forEach((listener) => listener(active));
}

function onTunnelStatusChange(listener) {
  if (typeof listener !== "function") return;
  statusListeners.add(listener);
}

function isTunnelActive() {
  return !!tunnelProcess;
}

function scheduleRestart() {
  if (restartTimer) return;
  restartTimer = setTimeout(() => {
    restartTimer = null;
    if (stopping) return;
    startTunnel().catch(() => {});
  }, 2000);
}

async function startTunnel() {
  if (tunnelProcess) return;
  stopping = false;

  tunnelProcess = spawn(
    "ssh",
    ["-N", "-R", "7777:localhost:3000", "joincloud@share.joincloud.in"],
    { stdio: ["ignore", "pipe", "pipe"] }
  );

  emitStatus(true);
  console.log("[tunnel] connected");

  tunnelProcess.stdout.on("data", (chunk) => {
    const message = chunk.toString().trim();
    if (message) console.log(`[tunnel] ${message}`);
  });

  tunnelProcess.stderr.on("data", (chunk) => {
    const message = chunk.toString().trim();
    if (message) console.log(`[tunnel] ${message}`);
  });

  tunnelProcess.on("exit", () => {
    tunnelProcess = null;
    emitStatus(false);
    if (stopping) {
      console.log("[tunnel] stopped");
      return;
    }
    console.log("[tunnel] disconnected, retrying");
    scheduleRestart();
  });
}

async function stopTunnel() {
  stopping = true;
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
  if (!tunnelProcess) return;
  tunnelProcess.kill("SIGTERM");
}

module.exports = {
  startTunnel,
  stopTunnel,
  isTunnelActive,
  onTunnelStatusChange,
};
