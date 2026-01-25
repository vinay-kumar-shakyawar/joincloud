const path = require("path");
const { spawn } = require("child_process");
const waitOn = require("wait-on");
const http = require("http");

const electronBinary =
  process.platform === "win32"
    ? path.join(__dirname, "..", "..", "node_modules", ".bin", "electron.cmd")
    : path.join(__dirname, "..", "..", "node_modules", ".bin", "electron");

const appRoot = path.join(__dirname, "..", "..");

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk.toString();
      });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ statusCode: res.statusCode, body: parsed });
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on("error", reject);
  });
}

async function run() {
  const proc = spawn(electronBinary, [appRoot], {
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: "1",
    },
    stdio: "ignore",
  });

  try {
    await waitOn({
      resources: ["http://127.0.0.1:8787/api/status"],
      timeout: 20000,
    });

    const status = await requestJson("http://127.0.0.1:8787/api/status");
    if (status.statusCode !== 200) {
      throw new Error("Backend did not respond");
    }

    const publicStatus = await requestJson(
      "http://127.0.0.1:8787/api/public-access/status"
    );
    if (publicStatus.statusCode !== 200) {
      throw new Error("Public access status failed");
    }
  } finally {
    proc.kill("SIGTERM");
  }
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message || "Smoke test failed");
    process.exit(1);
  });
