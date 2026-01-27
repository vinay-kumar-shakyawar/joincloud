class ExpiryManager {
  constructor({ shareService, intervalMs, onSweep }) {
    this.shareService = shareService;
    this.intervalMs = intervalMs;
    this.onSweep = onSweep;
    this.timer = null;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.shareService.expireShares();
      if (typeof this.onSweep === "function") {
        this.onSweep();
      }
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

module.exports = {
  ExpiryManager,
};
