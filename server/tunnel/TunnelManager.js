const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { resolveTunnelBinaryPath } = require("./resolveBinary");
const https = require("https");

class TunnelManager {
  constructor({ url, onStatus, logger, credentialsFile = null, tunnelName = null, publicUrl = null }) {
    this.url = url;
    this.onStatus = onStatus;
    this.logger = logger;
    this.credentialsFile = credentialsFile || null;
    this.tunnelName = tunnelName || null;
    this.configuredPublicUrl = publicUrl || null;
    this.process = null;
    this.publicUrl = null;
    this.status = "stopped";
    this.lastError = null;
    this.lastReason = null;
    this.startTimeout = null;
    this.restartHistory = [];
    this.restartTimer = null;
    this.desiredActive = false;
    this.restartWindowMs = 10 * 60 * 1000;
    this.maxRestartsInWindow = 3;
  }

  setCredentials(credentialsFile, tunnelName) {
    this.credentialsFile = credentialsFile;
    this.tunnelName = tunnelName;
    if (credentialsFile) {
      try {
        const configPath = path.join(path.dirname(credentialsFile), "config.json");
        if (fs.existsSync(configPath)) {
          const raw = fs.readFileSync(configPath, "utf8");
          const config = JSON.parse(raw);
          if (config.publicUrl) this.configuredPublicUrl = config.publicUrl;
        }
      } catch (_) {}
    }
  }

  parsePublicUrl(output) {
    const match = output.match(/https:\/\/[^\s]+/);
    return match ? match[0] : null;
  }

  emitStatus() {
    if (this.onStatus) {
      this.onStatus(this.getStatus());
    }
  }

  async verifyPublicUrl(url) {
    return new Promise((resolve) => {
      const req = https.get(url, { timeout: 2000 }, (res) => {
        res.resume();
        resolve(res.statusCode && res.statusCode < 500);
      });
      req.on("error", () => resolve(false));
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  startTimeoutWatch() {
    this.clearTimeoutWatch();
    this.startTimeout = setTimeout(() => {
      if (!this.publicUrl && this.status === "starting") {
        this.lastError = "Public sharing is unavailable on this system";
        this.lastReason = "No URL received";
        this.status = "failed";
        this.stopProcess();
        if (this.logger) this.logger.error("public access failed", { reason: this.lastReason });
        this.emitStatus();
        this.scheduleRestart("No URL received");
      }
    }, 10000);
  }

  clearTimeoutWatch() {
    if (this.startTimeout) {
      clearTimeout(this.startTimeout);
      this.startTimeout = null;
    }
  }

  stopProcess() {
    if (!this.process) return;
    const pid = this.process.pid;
    if (!pid) return;
    if (process.platform === "win32") {
      spawn("taskkill", ["/PID", String(pid), "/T", "/F"]);
    } else {
      try {
        process.kill(pid, "SIGTERM");
      } catch (error) {
        // ignore
      }
    }
  }

  recordRestartAttempt() {
    const now = Date.now();
    this.restartHistory = this.restartHistory.filter(
      (ts) => now - ts < this.restartWindowMs
    );
    this.restartHistory.push(now);
    return this.restartHistory.length;
  }

  shouldThrottleRestarts() {
    const now = Date.now();
    this.restartHistory = this.restartHistory.filter(
      (ts) => now - ts < this.restartWindowMs
    );
    return this.restartHistory.length >= this.maxRestartsInWindow;
  }

  scheduleRestart(reason) {
    if (!this.desiredActive) return;
    if (this.restartTimer) return;
    if (this.shouldThrottleRestarts()) {
      this.status = "failed";
      this.lastError = "Public sharing is unavailable on this system";
      this.lastReason = reason || "Tunnel exited";
      if (this.logger) this.logger.error("public access failed", { reason: this.lastReason });
      this.emitStatus();
      return;
    }

    const attempt = this.recordRestartAttempt();
    const backoffMs = Math.min(30000, 1000 * Math.pow(2, attempt - 1));
    this.status = "restarting";
    if (this.logger) this.logger.info("public access restarting");
    this.emitStatus();
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (!this.desiredActive) return;
      this.start();
    }, backoffMs);
  }

  async start() {
    if (this.status === "active" || this.status === "starting") {
      return this.getStatus();
    }

    if (!this.credentialsFile || !this.tunnelName) {
      this.status = "failed";
      this.lastError = "Public sharing not set up yet";
      this.lastReason = "not_configured";
      this.message = "Public sharing not set up yet";
      if (this.logger) this.logger.error("public access failed", { reason: this.lastReason });
      this.emitStatus();
      return this.getStatus();
    }

    if (!fs.existsSync(this.credentialsFile)) {
      this.status = "failed";
      this.lastError = "Public sharing not set up yet";
      this.lastReason = "not_configured";
      this.message = "Public sharing not set up yet";
      if (this.logger) this.logger.error("public access failed", { reason: this.lastReason });
      this.emitStatus();
      return this.getStatus();
    }

    this.desiredActive = true;
    this.lastError = null;
    this.lastReason = null;
    this.status = "starting";
    if (this.logger) this.logger.info("public access starting");
    this.emitStatus();

    let binaryPath;
    try {
      binaryPath = resolveTunnelBinaryPath();
    } catch (error) {
      this.status = "failed";
      this.lastError = "Public sharing is unavailable on this system";
      this.lastReason = "Unsupported platform";
      if (this.logger) this.logger.error("public access failed", { reason: this.lastReason });
      this.emitStatus();
      return this.getStatus();
    }

    const args = [
      "tunnel",
      "--credentials-file", this.credentialsFile,
      "--url", this.url,
      "run", this.tunnelName,
    ];
    this.process = spawn(binaryPath, args);

    this.startTimeoutWatch();

    const onRegisteredTunnel = () => {
      if (this.publicUrl) return;
      this.publicUrl = this.configuredPublicUrl || 'https://share.joincloud.cloud';
      this.status = "active";
      this.clearTimeoutWatch();
      this.restartHistory = [];
      this.lastReason = null;
      if (this.logger) this.logger.info("public access active");
      this.emitStatus();
    };

    this.process.stdout.on("data", (data) => {
      const text = data.toString();
      if (text.includes("Registered tunnel connection")) {
        onRegisteredTunnel();
      }
    });

    this.process.stderr.on("data", (data) => {
      const text = data.toString();
      if (text.includes("Registered tunnel connection")) {
        onRegisteredTunnel();
      }
      if (text.trim() && !this.publicUrl) {
        this.lastError = "Public sharing is unavailable on this system";
        this.lastReason = "Tunnel exited";
      }
    });

    this.process.on("error", () => {
      this.process = null;
      this.publicUrl = null;
      this.clearTimeoutWatch();
      this.lastError = "Public sharing is unavailable on this system";
      this.lastReason = "Tunnel exited";
      this.scheduleRestart("Tunnel error");
    });

    this.process.on("exit", () => {
      this.process = null;
      this.publicUrl = null;
      this.clearTimeoutWatch();

      if (!this.desiredActive) {
        this.status = "stopped";
        if (this.logger) this.logger.info("public access stopped");
        this.emitStatus();
        return;
      }
      this.lastError = "Public sharing is unavailable on this system";
      this.lastReason = "Tunnel exited";
      this.scheduleRestart("Tunnel exited");
    });

    return this.getStatus();
  }

  stop() {
    this.desiredActive = false;
    this.restartHistory = [];
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    this.lastError = null;
    this.lastReason = null;
    this.status = "stopping";
    this.publicUrl = null;
    this.clearTimeoutWatch();
    this.stopProcess();
    this.status = "stopped";
    if (this.logger) this.logger.info("public access stopped");
    this.emitStatus();
    return this.getStatus();
  }

  getStatus() {
    return {
      status: this.status,
      publicUrl: this.publicUrl,
      reason: this.lastReason,
      message:
        this.status === "failed" || this.status === "error"
          ? (this.lastReason === "not_configured" ? "Public sharing not set up yet" : "Public sharing is unavailable on this system")
          : null,
    };
  }

  static setupTunnel(options) {
    const { credentialsJson, tunnelName, credentialsDir } = options;
    const dir = path.resolve(credentialsDir);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const credentialsFile = path.join(dir, "credentials.json");
    const configFile = path.join(dir, "config.json");
    fs.writeFileSync(credentialsFile, typeof credentialsJson === "string" ? credentialsJson : JSON.stringify(credentialsJson), "utf8");
    fs.writeFileSync(configFile, JSON.stringify({ tunnelName }, null, 2), "utf8");
    return { credentialsFile, tunnelName };
  }
}

module.exports = {
  TunnelManager,
};
