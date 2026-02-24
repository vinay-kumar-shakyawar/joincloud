const fs = require("fs/promises");
const path = require("path");

const FLUSH_DEBOUNCE_MS = 400;

function defaultState() {
  return {
    total_app_starts: 0,
    total_uploads: 0,
    total_shares_created: 0,
    total_shares_revoked: 0,
    share_page_visits: 0,
    total_downloads: 0,
    bytes_uploaded: 0,
    bytes_downloaded: 0,
    device_requests: 0,
    devices_approved: 0,
    devices_denied: 0,
    devices_removed: 0,
    sharing_stop_count: 0,
    sharing_start_count: 0,
    updated_at: new Date().toISOString(),
  };
}

class RuntimeTelemetryStore {
  constructor({ storagePath }) {
    this.storagePath = storagePath;
    this.state = defaultState();
    this.flushTimer = null;
  }

  async init() {
    await fs.mkdir(path.dirname(this.storagePath), { recursive: true });
    try {
      const raw = await fs.readFile(this.storagePath, "utf8");
      const parsed = JSON.parse(raw);
      this.state = { ...defaultState(), ...parsed };
    } catch (_error) {
      this.state = defaultState();
      await this.persist();
    }
  }

  scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.persist().catch(() => {});
    }, FLUSH_DEBOUNCE_MS);
  }

  async persist() {
    this.state.updated_at = new Date().toISOString();
    await fs.writeFile(this.storagePath, JSON.stringify(this.state, null, 2));
  }

  increment(counter, by = 1) {
    if (!Object.prototype.hasOwnProperty.call(this.state, counter)) return;
    const next = Number(this.state[counter] || 0) + Number(by || 0);
    this.state[counter] = next < 0 ? 0 : next;
    this.scheduleFlush();
  }

  getSummary() {
    return {
      total_app_starts: Number(this.state.total_app_starts || 0),
      total_uploads: Number(this.state.total_uploads || 0),
      total_shares_created: Number(this.state.total_shares_created || 0),
      total_shares_revoked: Number(this.state.total_shares_revoked || 0),
      share_page_visits: Number(this.state.share_page_visits || 0),
      total_downloads: Number(this.state.total_downloads || 0),
      bytes_uploaded: Number(this.state.bytes_uploaded || 0),
      bytes_downloaded: Number(this.state.bytes_downloaded || 0),
      device_requests: Number(this.state.device_requests || 0),
      devices_approved: Number(this.state.devices_approved || 0),
      devices_denied: Number(this.state.devices_denied || 0),
      devices_removed: Number(this.state.devices_removed || 0),
      sharing_stop_count: Number(this.state.sharing_stop_count || 0),
      sharing_start_count: Number(this.state.sharing_start_count || 0),
      updated_at: this.state.updated_at,
    };
  }
}

module.exports = {
  RuntimeTelemetryStore,
};
