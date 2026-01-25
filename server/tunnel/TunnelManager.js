const { spawn } = require("child_process");
const { resolveTunnelBinaryPath } = require("./resolveBinary");
const https = require("https");

class TunnelManager {
  constructor({ url, onStatus, logger }) {
    this.url = url;
    this.onStatus = onStatus;
    this.logger = logger;
    this.process = null;
    this.publicUrl = null;
    this.status = "stopped";
    this.lastError = null;
    this.lastReason = null;
    this.startTimeout = null;
    this.restartAttempts = 0;
    this.maxRestarts = 3;
    this.desiredActive = false;
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

  async start() {
    if (this.status === "active" || this.status === "starting") {
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

    this.process = spawn(binaryPath, ["tunnel", "--url", this.url, "--no-autoupdate"]);

    this.startTimeoutWatch();

    this.process.stdout.on("data", async (data) => {
      const text = data.toString();
      const found = this.parsePublicUrl(text);
      if (!found || this.publicUrl) return;
      if (!found.startsWith("https://")) return;
      if (found.includes("cloudflare.com/")) return;
      const ok = await this.verifyPublicUrl(found);
      if (!ok) return;
      this.publicUrl = found;
      this.status = "active";
      this.clearTimeoutWatch();
      this.restartAttempts = 0;
      this.lastReason = null;
      if (this.logger) this.logger.info("public access active");
      this.emitStatus();
    });

    this.process.stderr.on("data", async (data) => {
      const text = data.toString();
      const found = this.parsePublicUrl(text);
      if (!found || this.publicUrl) return;
      if (!found.startsWith("https://")) return;
      if (found.includes("cloudflare.com/")) return;
      const ok = await this.verifyPublicUrl(found);
      if (!ok) return;
      this.publicUrl = found;
      this.status = "active";
      this.clearTimeoutWatch();
      this.restartAttempts = 0;
      this.lastReason = null;
      if (this.logger) this.logger.info("public access active");
      this.emitStatus();
      if (text.trim()) {
        this.lastError = "Public sharing is unavailable on this system";
        this.lastReason = "Tunnel exited";
      }
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

      if (this.restartAttempts < this.maxRestarts) {
        this.restartAttempts += 1;
        this.status = "restarting";
        if (this.logger) this.logger.info("public access restarting");
        this.emitStatus();
        setTimeout(() => {
          this.start();
        }, 1000);
      } else {
        this.status = "failed";
        this.lastError = "Public sharing is unavailable on this system";
        this.lastReason = "Tunnel exited";
        if (this.logger) this.logger.error("public access failed", { reason: this.lastReason });
        this.emitStatus();
      }
    });

    return this.getStatus();
  }

  stop() {
    this.desiredActive = false;
    this.restartAttempts = 0;
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
          ? "Public sharing is unavailable on this system"
          : null,
    };
  }
}

module.exports = {
  TunnelManager,
};
