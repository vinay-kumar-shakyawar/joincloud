const { spawn } = require("child_process");
const http = require("http");

const HEALTH_URL = "http://127.0.0.1:3000/api/v1/health";
const START_TIMEOUT_MS = 15000;

let backendProcess = null;
let stopping = false;
let restartAttempted = false;
const statusListeners = new Set();

function emitStatus(running) {
  statusListeners.forEach((listener) => listener(running));
}

function onBackendStatusChange(listener) {
  if (typeof listener !== "function") return;
  statusListeners.add(listener);
}

function isBackendRunning() {
  return !!backendProcess;
}

function waitForHealthy(timeoutMs = START_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const started = Date.now();
    const probe = () => {
      const req = http.get(HEALTH_URL, (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      });
      req.on("error", () => {
        if (Date.now() - started >= timeoutMs) {
          resolve(false);
          return;
        }
        setTimeout(probe, 400);
      });
      req.setTimeout(1000, () => {
        req.destroy();
      });
    };
    probe();
  });
}

async function startBackend({ scriptPath, cwd, env } = {}) {
  if (backendProcess) return true;
  stopping = false;
  restartAttempted = false;

  const nodeBinary = process.env.JOINCLOUD_NODE_PATH || "node";
  backendProcess = spawn(nodeBinary, [scriptPath], {
    env: { ...process.env, ...env },
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
  });

  emitStatus(true);
  console.log("[backend] started");

  backendProcess.stdout.on("data", (chunk) => {
    const message = chunk.toString().trim();
    if (message) console.log(`[backend] ${message}`);
  });

  backendProcess.stderr.on("data", (chunk) => {
    const message = chunk.toString().trim();
    if (message) console.log(`[backend] ${message}`);
  });

  backendProcess.on("exit", () => {
    backendProcess = null;
    emitStatus(false);
    if (stopping) {
      console.log("[backend] stopped");
      return;
    }
    if (!restartAttempted) {
      restartAttempted = true;
      console.log("[backend] crashed, restarting");
      startBackend({ scriptPath, cwd, env }).catch(() => {});
      return;
    }
    console.log("[backend] crashed, not restarting");
  });

  const ok = await waitForHealthy();
  if (!ok) {
    console.log("[backend] failed to start");
    await stopBackend();
  }
  return ok;
}

async function stopBackend() {
  stopping = true;
  if (!backendProcess) return;
  backendProcess.kill("SIGTERM");
}

module.exports = {
  startBackend,
  stopBackend,
  isBackendRunning,
  onBackendStatusChange,
};
