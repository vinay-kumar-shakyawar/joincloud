const fs = require("fs/promises");
const path = require("path");

function createEmptyState() {
  return {
    total_visits: 0,
    by_share: {},
    by_date: {},
    updated_at: new Date().toISOString(),
  };
}

class ShareTelemetryStore {
  constructor({ storagePath }) {
    this.storagePath = storagePath;
    this.state = createEmptyState();
  }

  async init() {
    await fs.mkdir(path.dirname(this.storagePath), { recursive: true });
    try {
      const raw = await fs.readFile(this.storagePath, "utf8");
      const parsed = JSON.parse(raw);
      this.state = {
        total_visits: Number(parsed.total_visits || 0),
        by_share: parsed.by_share && typeof parsed.by_share === "object" ? parsed.by_share : {},
        by_date: parsed.by_date && typeof parsed.by_date === "object" ? parsed.by_date : {},
        updated_at: parsed.updated_at || new Date().toISOString(),
      };
    } catch (_error) {
      this.state = createEmptyState();
      await this.persist();
    }
  }

  async persist() {
    this.state.updated_at = new Date().toISOString();
    await fs.writeFile(this.storagePath, JSON.stringify(this.state, null, 2));
  }

  async recordSharePageVisit(shareId) {
    if (!shareId) return;
    const dayKey = new Date().toISOString().slice(0, 10);
    this.state.total_visits += 1;
    this.state.by_share[shareId] = Number(this.state.by_share[shareId] || 0) + 1;
    this.state.by_date[dayKey] = Number(this.state.by_date[dayKey] || 0) + 1;
    await this.persist();
  }

  getSummary() {
    const dayKey = new Date().toISOString().slice(0, 10);
    return {
      total_visits: Number(this.state.total_visits || 0),
      today_visits: Number(this.state.by_date[dayKey] || 0),
      top_shares: Object.entries(this.state.by_share)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([share_id, visits]) => ({ share_id, visits })),
      updated_at: this.state.updated_at,
    };
  }
}

module.exports = {
  ShareTelemetryStore,
};
