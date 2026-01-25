const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const os = require("os");
const https = require("https");
const { spawnSync } = require("child_process");

const BIN_ROOT = path.resolve(__dirname, "..", "bin", "tunnel");

const targets = [
  {
    key: "darwin-arm64",
    url:
      "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz",
    archLabel: "arm64",
  },
  {
    key: "darwin-x64",
    url:
      "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz",
    archLabel: "x86_64",
  },
];

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "pipe", ...options });
  return {
    code: result.status,
    stdout: result.stdout ? result.stdout.toString() : "",
    stderr: result.stderr ? result.stderr.toString() : "",
    error: result.error || null,
  };
}

function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);
    const request = (targetUrl, redirectCount = 0) => {
      if (redirectCount > 5) {
        reject(new Error("Failed to download relay binary"));
        return;
      }
      https
        .get(
          targetUrl,
          { headers: { "User-Agent": "JoinCloud" } },
          (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              request(res.headers.location, redirectCount + 1);
              return;
            }
            if (res.statusCode !== 200) {
              reject(new Error("Failed to download relay binary"));
              return;
            }
            res.pipe(file);
            file.on("finish", () => {
              file.close(resolve);
            });
          }
        )
        .on("error", (err) => {
          reject(err);
        });
    };
    request(url);
  });
}

async function findBinaryInDir(dir) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const result = await findBinaryInDir(fullPath);
      if (result) return result;
    } else if (entry.isFile() && entry.name === "cloudflared") {
      return fullPath;
    }
  }
  return null;
}

async function extractArchive(archivePath, destination) {
  await ensureDir(destination);
  const result = runCommand("tar", ["-xzf", archivePath, "-C", destination]);
  if (result.code !== 0 || result.error) {
    throw new Error("Failed to extract relay archive");
  }
}

async function ensureExecutable(binaryPath) {
  try {
    await fsp.chmod(binaryPath, 0o755);
  } catch (error) {
    throw new Error("Unable to set executable permissions");
  }
}

async function validateArchitecture(binaryPath, archLabel) {
  const result = runCommand("file", [binaryPath]);
  if (result.code !== 0 || result.error) {
    throw new Error("Unable to validate relay architecture");
  }
  if (!result.stdout.includes(archLabel)) {
    throw new Error("Relay architecture mismatch");
  }
}

async function smokeTest(binaryPath, archLabel) {
  const result = runCommand(binaryPath, ["--version"]);
  if (result.code !== 0 || result.error) {
    throw new Error("Relay binary failed to execute");
  }
}

async function prepareBinary(target, shouldSmokeTest) {
  const binDir = path.join(BIN_ROOT, target.key);
  const finalPath = path.join(binDir, process.platform === "win32" ? "tunnel.exe" : "tunnel");

  await ensureDir(binDir);

  const exists = fs.existsSync(finalPath);
  if (!exists) {
    const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "joincloud-relay-"));
    const archivePath = path.join(tempDir, "relay.tgz");
    await downloadFile(target.url, archivePath);
    await extractArchive(archivePath, tempDir);
    const extracted = await findBinaryInDir(tempDir);
    if (!extracted) {
      throw new Error("Relay binary not found in archive");
    }
    await fsp.copyFile(extracted, finalPath);
  }

  await ensureExecutable(finalPath);
  await validateArchitecture(finalPath, target.archLabel);
  if (shouldSmokeTest) {
    await smokeTest(finalPath, target.archLabel);
  }
}

async function run() {
  const hostArch = process.arch === "arm64" ? "arm64" : "x86_64";
  for (const target of targets) {
    await prepareBinary(target, target.archLabel === hostArch);
  }
  console.log("macOS tunnel binaries installed and verified");
}

run().catch((error) => {
  console.error(error.message || "Public sharing is temporarily unavailable on this system");
  process.exit(1);
});
