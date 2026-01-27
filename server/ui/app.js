const state = {
  path: "/",
  items: [],
  shares: [],
  messages: [],
};

const els = {
  status: document.getElementById("node-status"),
  statusIndicator: document.getElementById("status-indicator"),
  statusText: document.getElementById("status-text"),
  heartbeatIndicator: document.getElementById("heartbeat-indicator"),
  heartbeatNote: document.getElementById("heartbeat-note"),
  stopServer: document.getElementById("stop-server"),
  storageLabel: document.getElementById("storage-label"),
  ownerMount: document.getElementById("owner-mount"),
  publicStatus: document.getElementById("public-status"),
  publicUrl: document.getElementById("public-url"),
  publicReason: document.getElementById("public-reason"),
  togglePublic: document.getElementById("toggle-public"),
  retryPublic: document.getElementById("retry-public"),
  switchLan: document.getElementById("switch-lan"),
  openStorage: document.getElementById("open-storage"),
  fileList: document.getElementById("file-list"),
  shareList: document.getElementById("share-list"),
  breadcrumbs: document.getElementById("breadcrumbs"),
  refreshFiles: document.getElementById("refresh-files"),
  refreshShares: document.getElementById("refresh-shares"),
  refreshLogs: document.getElementById("refresh-logs"),
  logList: document.getElementById("log-list"),
  refreshNetwork: document.getElementById("refresh-network"),
  networkList: document.getElementById("network-list"),
  uploadButton: document.getElementById("upload-button"),
  telemetryToggle: document.getElementById("telemetry-toggle"),
  networkName: document.getElementById("network-name"),
  saveNetworkName: document.getElementById("save-network-name"),
  networkVisibility: document.getElementById("network-visibility"),
  navButtons: document.querySelectorAll(".nav-button"),
  sections: document.querySelectorAll(".section"),
  backButton: document.getElementById("back-button"),
  uploadInput: document.getElementById("upload-input"),
  dropZone: document.getElementById("drop-zone"),
  shareModal: document.getElementById("share-modal"),
  sharePath: document.getElementById("share-path"),
  sharePermission: document.getElementById("share-permission"),
  shareScope: document.getElementsByName("share-scope"),
  shareTtl: document.getElementById("share-ttl"),
  shareTtlCustom: document.getElementById("share-ttl-custom"),
  createShare: document.getElementById("create-share"),
  closeModal: document.getElementById("close-modal"),
  cancelShare: document.getElementById("cancel-share"),
  shareResult: document.getElementById("share-result"),
  copyShare: document.getElementById("copy-share"),
  messageThread: document.getElementById("message-thread"),
  messageInput: document.getElementById("message-input"),
  messageSend: document.getElementById("message-send"),
  messagesBadge: document.getElementById("messages-badge"),
  messagesStatus: document.getElementById("messages-status"),
  // Task 1: System info elements
  sysUserId: document.getElementById("sys-user-id"),
  sysOs: document.getElementById("sys-os"),
  sysArch: document.getElementById("sys-arch"),
  sysVersion: document.getElementById("sys-version"),
  sysStatus: document.getElementById("sys-status"),
  copyUserId: document.getElementById("copy-user-id"),
  sysDeviceUuid: document.getElementById("sys-device-uuid"),
  copyDeviceUuid: document.getElementById("copy-device-uuid"),
};

const stateMeta = {
  lanBaseUrl: window.location.origin,
  publicDomain: "share.joincloud.in",
};

const messageMeta = {
  lastSeenAt: 0,
  unreadCount: 0,
  pollTimer: null,
};

const heartbeatMeta = {
  failures: 0,
  timer: null,
  lastState: "unknown",
  isInternetAvailable: navigator.onLine,
  adminReachable: false,
};

const HEARTBEAT_POLL_MS = 10 * 60 * 1000;
const HEARTBEAT_BACKOFF_BASE_MS = 30 * 1000;
const HEARTBEAT_BACKOFF_MAX_MS = 10 * 60 * 1000;
const MESSAGES_POLL_MS = 45 * 1000;
const MESSAGES_CACHE_KEY = "joincloud_messages_cache_v1";
const MESSAGES_LAST_SEEN_KEY = "joincloud_messages_last_seen_v1";

function nextHeartbeatDelay() {
  const attempt = Math.min(heartbeatMeta.failures, 10);
  return Math.min(
    HEARTBEAT_BACKOFF_MAX_MS,
    HEARTBEAT_BACKOFF_BASE_MS * Math.pow(2, attempt)
  );
}

function setHeartbeatState(state, tooltip, note) {
  if (!els.heartbeatIndicator) return;
  if (heartbeatMeta.lastState === state) {
    if (tooltip) els.heartbeatIndicator.title = tooltip;
    if (els.heartbeatNote) {
      els.heartbeatNote.textContent = note || "";
    }
    return;
  }
  heartbeatMeta.lastState = state;
  els.heartbeatIndicator.classList.remove("connected", "degraded", "offline");
  if (state === "connected") {
    els.heartbeatIndicator.classList.add("connected");
  } else if (state === "degraded") {
    els.heartbeatIndicator.classList.add("degraded");
  } else if (state === "offline") {
    els.heartbeatIndicator.classList.add("offline");
  }
  if (tooltip) {
    els.heartbeatIndicator.title = tooltip;
  }
  if (els.heartbeatNote) {
    els.heartbeatNote.textContent = note || "";
  }
}

async function checkConnectivity() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch("/api/v1/admin/health", { signal: controller.signal });
    clearTimeout(timer);
    const data = await res.json();
    return {
      internetAvailable: data.internetAvailable === false ? false : true,
      adminReachable: !!data.adminReachable,
    };
  } catch (error) {
    return null;
  }
}

function scheduleHeartbeatCheck(delayMs) {
  if (heartbeatMeta.timer) {
    clearTimeout(heartbeatMeta.timer);
  }
  heartbeatMeta.timer = setTimeout(runHeartbeatCheck, delayMs);
}

function recomputeHeartbeatIndicator() {
  if (heartbeatMeta.isInternetAvailable === false) {
    setHeartbeatState("offline", "No internet connection", "Check your internet connectivity");
    return;
  }
  if (heartbeatMeta.adminReachable === false) {
    setHeartbeatState("degraded", "Admin temporarily unreachable");
    return;
  }
  setHeartbeatState("connected", "Connected");
}

async function runHeartbeatCheck() {
  const result = await checkConnectivity();
  if (!result) {
    heartbeatMeta.failures += 1;
    heartbeatMeta.adminReachable = false;
    heartbeatMeta.isInternetAvailable = navigator.onLine;
    recomputeHeartbeatIndicator();
    scheduleHeartbeatCheck(nextHeartbeatDelay());
    return;
  }

  heartbeatMeta.isInternetAvailable = result.internetAvailable;
  heartbeatMeta.adminReachable = result.adminReachable;
  if (result.internetAvailable && result.adminReachable) {
    heartbeatMeta.failures = 0;
    recomputeHeartbeatIndicator();
    scheduleHeartbeatCheck(HEARTBEAT_POLL_MS);
    return;
  }

  heartbeatMeta.failures += 1;
  recomputeHeartbeatIndicator();
  scheduleHeartbeatCheck(nextHeartbeatDelay());
}

function startHeartbeatMonitor() {
  setHeartbeatState("degraded", "Checking connectivity");
  window.addEventListener("online", () => {
    heartbeatMeta.isInternetAvailable = true;
    scheduleHeartbeatCheck(0);
  });
  window.addEventListener("offline", () => {
    heartbeatMeta.isInternetAvailable = false;
    heartbeatMeta.adminReachable = false;
    recomputeHeartbeatIndicator();
  });
  runHeartbeatCheck().catch(() => {});
}

function getMessageKey(message) {
  if (message.id) return `id:${message.id}`;
  const stamp = message.timestamp || 0;
  return `fallback:${message.sender}:${stamp}:${message.text}`;
}

function parseMessageTimestamp(value) {
  if (!value) return Date.now();
  if (typeof value === "number") {
    return value < 1e12 ? value * 1000 : value;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function normalizeMessage(raw) {
  if (!raw) return null;
  const text = `${raw.text || raw.message || raw.body || raw.content || ""}`.trim();
  if (!text) return null;
  const senderRaw = `${raw.sender || raw.from || raw.role || raw.author || raw.direction || raw.type || ""}`.toLowerCase();
  let sender = "admin";
  if (senderRaw.includes("user") || senderRaw.includes("you") || senderRaw.includes("client")) {
    sender = "user";
  }
  if (senderRaw.includes("out")) {
    sender = "user";
  }
  if (senderRaw.includes("admin") || senderRaw.includes("support")) {
    sender = "admin";
  }
  if (raw.isAdmin === true) {
    sender = "admin";
  }
  if (raw.isAdmin === false) {
    sender = "user";
  }
  const timestamp = parseMessageTimestamp(raw.timestamp || raw.createdAt || raw.sentAt || raw.time);
  const id = raw.id || raw.messageId || raw._id || null;
  return {
    id,
    sender,
    text,
    timestamp,
    status: raw.status || "sent",
  };
}

function loadCachedMessages() {
  try {
    const cached = localStorage.getItem(MESSAGES_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        state.messages = parsed;
      }
    }
    const lastSeen = Number(localStorage.getItem(MESSAGES_LAST_SEEN_KEY));
    if (!Number.isNaN(lastSeen) && lastSeen > 0) {
      messageMeta.lastSeenAt = lastSeen;
    }
  } catch (error) {
    // silent
  }
}

function saveCachedMessages() {
  try {
    const trimmed = state.messages.slice(-200);
    localStorage.setItem(MESSAGES_CACHE_KEY, JSON.stringify(trimmed));
    localStorage.setItem(MESSAGES_LAST_SEEN_KEY, String(messageMeta.lastSeenAt || 0));
  } catch (error) {
    // silent
  }
}

function mergeMessages(incoming) {
  const existingKeys = new Set(state.messages.map(getMessageKey));
  incoming.forEach((message) => {
    const key = getMessageKey(message);
    if (existingKeys.has(key)) return;
    state.messages.push(message);
    existingKeys.add(key);
  });
  state.messages.sort((a, b) => a.timestamp - b.timestamp);
}

function formatMessageTime(timestamp) {
  try {
    return new Date(timestamp).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "--";
  }
}

function renderMessages() {
  if (!els.messageThread) return;
  els.messageThread.innerHTML = "";
  if (!state.messages.length) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.innerHTML = `
      <div class="empty-state-title">No messages yet</div>
      <div class="empty-state-sub">Support replies will appear here</div>
    `;
    els.messageThread.appendChild(emptyState);
    return;
  }
  state.messages.forEach((message) => {
    const row = document.createElement("div");
    const isYou = message.sender === "user";
    row.className = `message-item ${isYou ? "you" : "admin"}`;

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.textContent = message.text;
    row.appendChild(bubble);

    const meta = document.createElement("div");
    meta.className = "message-meta";
    const senderLabel = document.createElement("span");
    senderLabel.textContent = isYou ? "You" : "Admin";
    const timeLabel = document.createElement("span");
    timeLabel.textContent = formatMessageTime(message.timestamp);
    meta.appendChild(senderLabel);
    meta.appendChild(timeLabel);
    if (message.status === "sending") {
      const status = document.createElement("span");
      status.className = "message-status-tag";
      status.textContent = "Sending…";
      meta.appendChild(status);
    } else if (message.status === "failed") {
      const status = document.createElement("span");
      status.className = "message-status-tag failed";
      status.textContent = "Failed";
      meta.appendChild(status);
    }
    row.appendChild(meta);

    els.messageThread.appendChild(row);
  });
}

function scrollMessagesToBottom() {
  if (!els.messageThread) return;
  els.messageThread.scrollTop = els.messageThread.scrollHeight;
}

function updateUnreadCount() {
  const unread = state.messages.filter(
    (message) => message.sender === "admin" && message.timestamp > messageMeta.lastSeenAt
  );
  messageMeta.unreadCount = unread.length;
  if (els.messagesBadge) {
    if (messageMeta.unreadCount > 0) {
      els.messagesBadge.textContent = `${messageMeta.unreadCount}`;
      els.messagesBadge.classList.remove("hidden");
    } else {
      els.messagesBadge.classList.add("hidden");
    }
  }
}

function markMessagesRead() {
  const latest = state.messages
    .filter((message) => message.sender === "admin")
    .reduce((max, message) => Math.max(max, message.timestamp || 0), messageMeta.lastSeenAt);
  messageMeta.lastSeenAt = latest;
  updateUnreadCount();
  saveCachedMessages();
}

async function fetchMessages() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch("/api/v1/messages", { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return;
    const payload = await res.json();
    const list = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.messages)
        ? payload.messages
        : Array.isArray(payload.items)
          ? payload.items
          : [];
    const incoming = list.map(normalizeMessage).filter(Boolean);
    if (!incoming.length) return;
    mergeMessages(incoming);
    saveCachedMessages();
    renderMessages();
    if (document.querySelector('.section[data-section="messages"]')?.classList.contains("active")) {
      markMessagesRead();
    } else {
      updateUnreadCount();
    }
  } catch (error) {
    // silent
  }
}

function startMessagesPolling() {
  if (messageMeta.pollTimer) {
    clearInterval(messageMeta.pollTimer);
  }
  fetchMessages();
  messageMeta.pollTimer = setInterval(fetchMessages, MESSAGES_POLL_MS);
}

async function sendMessage() {
  if (!els.messageInput || !els.messageSend) return;
  const text = els.messageInput.value.trim();
  if (!text) return;
  const draft = {
    id: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    sender: "user",
    text,
    timestamp: Date.now(),
    status: "sending",
  };
  state.messages.push(draft);
  renderMessages();
  scrollMessagesToBottom();
  updateUnreadCount();
  saveCachedMessages();
  els.messageInput.value = "";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch("/api/v1/messages/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, sender: "user" }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      draft.status = "failed";
    } else {
      const data = await res.json().catch(() => ({}));
      draft.status = data.ok === false ? "failed" : "sent";
    }
  } catch (error) {
    draft.status = "failed";
  }
  renderMessages();
  scrollMessagesToBottom();
  saveCachedMessages();
}

function setStatusDisplay(statusValue) {
  const normalized = (statusValue || "").toLowerCase();
  const label = normalized ? normalized[0].toUpperCase() + normalized.slice(1) : "--";
  if (els.statusText) {
    els.statusText.textContent = `Status: ${label}`;
  }
  if (els.statusIndicator) {
    els.statusIndicator.classList.remove("running", "error");
    if (normalized === "running" || normalized === "healthy") {
      els.statusIndicator.classList.add("running");
    } else if (normalized && normalized !== "--") {
      els.statusIndicator.classList.add("error");
    }
  }
}

async function fetchStatus() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    setStatusDisplay(data.status);
    els.storageLabel.textContent = data.storageLabel || "Local storage";
    els.ownerMount.textContent = data.ownerBasePath;
    if (data.lanBaseUrl) {
      stateMeta.lanBaseUrl = data.lanBaseUrl;
    }
  } catch (error) {
    setStatusDisplay("offline");
  }
}

function formatBytes(bytes) {
  if (!bytes) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  return `${size.toFixed(1)} ${units[idx]}`;
}

function renderBreadcrumbs() {
  const parts = state.path.split("/").filter(Boolean);
  els.breadcrumbs.innerHTML = "";
  const homeButton = document.createElement("button");
  homeButton.textContent = "Home";
  homeButton.onclick = () => loadFiles("/");
  els.breadcrumbs.appendChild(homeButton);
  let current = "";
  parts.forEach((part) => {
    const span = document.createElement("span");
    span.textContent = " / ";
    els.breadcrumbs.appendChild(span);
    current += `/${part}`;
    const button = document.createElement("button");
    button.textContent = part;
    button.onclick = () => loadFiles(current);
    els.breadcrumbs.appendChild(button);
  });
}

function getFileIcon(item) {
  if (item.type === "folder") return "📁";
  const ext = item.name.split(".").pop()?.toLowerCase();
  const iconMap = {
    jpg: "🖼️", jpeg: "🖼️", png: "🖼️", gif: "🖼️", webp: "🖼️", svg: "🖼️",
    pdf: "📄", doc: "📄", docx: "📄", txt: "📄",
    mp3: "🎵", wav: "🎵", flac: "🎵",
    mp4: "🎬", mov: "🎬", avi: "🎬", mkv: "🎬",
    zip: "📦", rar: "📦", tar: "📦", gz: "📦",
    js: "📜", ts: "📜", py: "📜", json: "📜",
  };
  return iconMap[ext] || "📄";
}

function renderFiles() {
  els.fileList.innerHTML = "";
  if (!state.items.length) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.innerHTML = `
      <div class="empty-state-title">No files yet</div>
      <div class="empty-state-sub">Drop files here or click Upload</div>
    `;
    els.fileList.appendChild(emptyState);
    return;
  }
  state.items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "item file-item";

    const icon = document.createElement("span");
    icon.className = "file-icon";
    icon.textContent = getFileIcon(item);
    row.appendChild(icon);

    const info = document.createElement("div");
    info.className = "file-info";
    info.innerHTML = `<div class="item-title">${item.name}</div>
      <div class="item-sub">${item.type === "folder" ? "Folder" : formatBytes(item.size)}</div>`;
    row.appendChild(info);

    const openButton = document.createElement("button");
    openButton.className = "button secondary";
    openButton.textContent = item.type === "folder" ? "Open" : "Share";
    openButton.onclick = () => {
      if (item.type === "folder") {
        loadFiles(item.path);
      } else {
        openShareModal(item.path);
      }
    };
    row.appendChild(openButton);

    if (item.type === "folder") {
      const shareButton = document.createElement("button");
      shareButton.className = "button";
      shareButton.textContent = "Share";
      shareButton.onclick = () => openShareModal(item.path);
      row.appendChild(shareButton);
    }

    els.fileList.appendChild(row);
  });
}

function renderShares() {
  els.shareList.innerHTML = "";
  // Filter to only show active shares (not revoked or expired)
  const activeShares = state.shares.filter((share) => share.status === "active");
  if (!activeShares.length) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.innerHTML = `
      <div class="empty-state-title">No active shares</div>
      <div class="empty-state-sub">When there's no content</div>
    `;
    els.shareList.appendChild(emptyState);
    return;
  }
  activeShares.forEach((share) => {
    const row = document.createElement("div");
    row.className = "item";
    const info = document.createElement("div");
    const expiryText = new Date(share.expiresAt).toLocaleString();
    info.innerHTML = `<div class="item-title">${share.path}</div>
      <div class="item-sub">${share.scope} · ${share.permission} · expires ${expiryText}</div>`;
    row.appendChild(info);

    const statusBadge = document.createElement("span");
    statusBadge.className = "badge badge-active";
    statusBadge.textContent = "Active";
    row.appendChild(statusBadge);

    const copyButton = document.createElement("button");
    copyButton.className = "button secondary";
    copyButton.textContent = "Copy Link";
    const shareUrl = share.url || null;
    copyButton.disabled = !shareUrl;
    copyButton.onclick = async () => {
      if (!shareUrl) return;
      await navigator.clipboard.writeText(shareUrl);
      copyButton.textContent = "Copied!";
      setTimeout(() => (copyButton.textContent = "Copy Link"), 1500);
    };
    row.appendChild(copyButton);

    const revokeButton = document.createElement("button");
    revokeButton.className = "button danger";
    revokeButton.textContent = "Revoke";
    revokeButton.onclick = async () => {
      revokeButton.disabled = true;
      revokeButton.textContent = "Revoking...";
      await revokeShare(share.shareId);
    };
    row.appendChild(revokeButton);

    els.shareList.appendChild(row);
  });
}

async function loadFiles(pathValue) {
  const res = await fetch(`/api/files?path=${encodeURIComponent(pathValue)}`);
  const data = await res.json();
  state.path = data.path;
  state.items = data.items;
  renderBreadcrumbs();
  renderFiles();
}

async function loadShares() {
  els.refreshShares.textContent = "Loading...";
  els.refreshShares.disabled = true;
  const res = await fetch("/api/shares");
  state.shares = await res.json();
  renderShares();
  els.refreshShares.textContent = "Refresh";
  els.refreshShares.disabled = false;
}

function openShareModal(pathValue) {
  els.shareResult.textContent = "";
  els.copyShare.style.display = "none";
  els.sharePath.value = pathValue;
  els.shareModal.classList.add("active");
}

function closeShareModal() {
  els.shareModal.classList.remove("active");
}

async function createShare() {
  const pathValue = els.sharePath.value;
  const selectedScope = Array.from(els.shareScope).find((el) => el.checked)?.value || "local";
  const permission = els.sharePermission.value;
  const ttlSelection = els.shareTtl.value;
  if (ttlSelection === "custom" && !els.shareTtlCustom.value) {
    els.shareResult.textContent = "Enter expiry in minutes.";
    return;
  }
  const ttlMs =
    ttlSelection === "custom"
      ? Number(els.shareTtlCustom.value) * 60 * 1000
      : Number(ttlSelection);

  const res = await fetch("/api/share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: pathValue, permission, ttlMs, scope: selectedScope }),
  });
  const data = await res.json();
  if (!res.ok) {
    els.shareResult.textContent = data.error || "Failed to create share";
    return;
  }
  const shareUrl = data.url || `https://${data.shareId}.${stateMeta.publicDomain}`;
  els.shareResult.textContent = `Share created: ${shareUrl}`;
  els.copyShare.style.display = "inline-flex";
  els.copyShare.onclick = async () => {
    await navigator.clipboard.writeText(shareUrl);
    els.copyShare.textContent = "Copied!";
    setTimeout(() => (els.copyShare.textContent = "Copy Link"), 1500);
  };
  await loadShares();
  await loadLogs();
}

async function revokeShare(shareId) {
  state.shares = state.shares.filter((share) => share.shareId !== shareId);
  renderShares();
  await fetch(`/api/share/${shareId}`, { method: "DELETE" });
  await loadShares();
  await loadLogs();
}

async function refreshPublicAccess() {
  const res = await fetch("/api/public-access/status");
  const data = await res.json();
  stateMeta.publicDomain = data.domain || stateMeta.publicDomain;
  els.publicStatus.textContent = "Public sharing via VPS";
  els.publicUrl.textContent = `https://<share-id>.${stateMeta.publicDomain}`;
  els.publicReason.textContent = "";
  if (els.togglePublic) {
    els.togglePublic.classList.add("hidden");
  }
  if (els.retryPublic) {
    els.retryPublic.classList.add("hidden");
  }
  if (els.switchLan) {
    els.switchLan.classList.add("hidden");
  }
}

els.refreshFiles.onclick = () => loadFiles(state.path);
els.refreshShares.onclick = () => loadShares();
els.refreshNetwork.onclick = () => loadNetwork();
els.closeModal.onclick = closeShareModal;
els.cancelShare.onclick = closeShareModal;
els.createShare.onclick = createShare;
if (els.uploadButton) {
  els.uploadButton.onclick = () => {
    els.uploadInput?.click();
  };
}
els.backButton.onclick = () => {
  if (state.path === "/") return;
  const parts = state.path.split("/").filter(Boolean);
  parts.pop();
  const parent = `/${parts.join("/")}` || "/";
  loadFiles(parent);
};

els.shareTtl.onchange = () => {
  if (els.shareTtl.value === "custom") {
    els.shareTtlCustom.style.display = "block";
  } else {
    els.shareTtlCustom.style.display = "none";
  }
};
if (els.togglePublic) {
  els.togglePublic.onclick = () => {};
}
els.openStorage.onclick = async () => {
  if (window.joincloud && window.joincloud.openStorageFolder) {
    await window.joincloud.openStorageFolder();
  } else {
    alert("Storage folder is available in the desktop app only.");
  }
};

if (els.stopServer) {
  if (window.joincloud && window.joincloud.stopServer) {
    els.stopServer.classList.remove("hidden");
    els.stopServer.onclick = async () => {
      const confirmed = confirm("Stop JoinCloud and close the app?");
      if (!confirmed) return;
      els.stopServer.disabled = true;
      await window.joincloud.stopServer();
    };
  } else {
    els.stopServer.classList.add("hidden");
  }
}

async function uploadFiles(files) {
  if (!files || files.length === 0) return;
  const formData = new FormData();
  Array.from(files).forEach((file) => formData.append("files", file));
  formData.append("path", state.path);
  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });
  if (res.ok) {
    await loadFiles(state.path);
    await loadLogs();
  }
}

els.uploadInput.onchange = (event) => {
  uploadFiles(event.target.files);
  els.uploadInput.value = "";
};

els.dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  els.dropZone.classList.add("active");
});

els.dropZone.addEventListener("dragleave", () => {
  els.dropZone.classList.remove("active");
});

els.dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  els.dropZone.classList.remove("active");
  uploadFiles(event.dataTransfer.files);
});

function formatLogTime(timestamp) {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return timestamp;
  }
}

function getLogIcon(level, message) {
  const msg = message.toLowerCase();
  if (msg.includes("upload")) return "📤";
  if (msg.includes("download")) return "📥";
  if (msg.includes("share")) return "🔗";
  if (msg.includes("revoke")) return "🚫";
  if (msg.includes("started") || msg.includes("app started")) return "🚀";
  if (msg.includes("telemetry")) return "📊";
  if (msg.includes("visibility")) return "👁️";
  if (msg.includes("display name")) return "✏️";
  if (level === "error") return "❌";
  if (level === "warn") return "⚠️";
  return "ℹ️";
}

function renderLogs(entries) {
  els.logList.innerHTML = "";
  if (!entries.length) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.innerHTML = `
      <div class="empty-state-title">No logs yet</div>
      <div class="empty-state-sub">Activity will appear here</div>
    `;
    els.logList.appendChild(emptyState);
    return;
  }
  entries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = `log-item log-${entry.level}`;
    const icon = getLogIcon(entry.level, entry.message);
    const time = formatLogTime(entry.timestamp);
    row.innerHTML = `
      <span class="log-icon">${icon}</span>
      <span class="log-time">${time}</span>
      <span class="log-message">${entry.message}</span>
    `;
    els.logList.appendChild(row);
  });
}

async function loadLogs() {
  els.refreshLogs.textContent = "Loading...";
  els.refreshLogs.disabled = true;
  const res = await fetch("/api/v1/logs");
  const data = await res.json();
  renderLogs(data);
  els.refreshLogs.textContent = "Refresh";
  els.refreshLogs.disabled = false;
}

function renderNetwork(entries) {
  els.networkList.innerHTML = "";
  if (!entries.length) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.innerHTML = `
      <div class="empty-state-title">No available devices found</div>
      <div class="empty-state-sub">No other JoinCloud users detected on this network</div>
    `;
    els.networkList.appendChild(emptyState);
    return;
  }
  entries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "item network-item";
    const info = document.createElement("div");
    info.innerHTML = `<div class="item-title">${entry.display_name}</div>`;
    row.appendChild(info);
    const statusBadge = document.createElement("span");
    statusBadge.className = `badge ${entry.status === "online" ? "badge-public" : "badge-private"}`;
    statusBadge.textContent = entry.status === "online" ? "Online" : "Offline";
    row.appendChild(statusBadge);
    els.networkList.appendChild(row);
  });
}

// Task 3: Network refresh with feedback
async function loadNetwork() {
  els.refreshNetwork.textContent = "Searching...";
  els.refreshNetwork.disabled = true;
  
  // Show searching state
  els.networkList.innerHTML = "";
  const searchingState = document.createElement("div");
  searchingState.className = "empty-state";
  searchingState.innerHTML = `
    <div class="empty-state-title">Searching for devices…</div>
    <div class="empty-state-sub">Looking for JoinCloud users on your network</div>
  `;
  els.networkList.appendChild(searchingState);
  
  // Wait a bounded delay for discovery
  await new Promise((r) => setTimeout(r, 2000));
  
  const res = await fetch("/api/v1/network");
  const data = await res.json();
  renderNetwork(data);
  els.refreshNetwork.textContent = "Refresh";
  els.refreshNetwork.disabled = false;
}

// Task 1: Load system information
async function loadSystemInfo() {
  try {
    const res = await fetch("/api/v1/system");
    const data = await res.json();
    if (els.sysUserId) els.sysUserId.textContent = data.user_id || "--";
    if (els.sysDeviceUuid) els.sysDeviceUuid.textContent = data.device_uuid || "--";
    if (els.sysOs) els.sysOs.textContent = data.os || "--";
    if (els.sysArch) els.sysArch.textContent = data.arch || "--";
    if (els.sysVersion) els.sysVersion.textContent = `v${data.app_version}` || "--";
    if (els.sysStatus) els.sysStatus.textContent = data.backend_status || "--";
  } catch (error) {
    // Silently fail
  }
}

async function loadTelemetrySettings() {
  const res = await fetch("/api/v1/telemetry/settings");
  const data = await res.json();
  els.telemetryToggle.checked = !!data.enabled;
}

async function updateTelemetrySettings(enabled) {
  await fetch("/api/v1/telemetry/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
}

async function loadNetworkSettings() {
  const res = await fetch("/api/v1/network/settings");
  const data = await res.json();
  els.networkName.value = data.display_name || "";
  els.networkVisibility.checked = !!data.network_visibility;
}

async function saveNetworkName() {
  const value = els.networkName.value.trim();
  const res = await fetch("/api/v1/network/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ display_name: value }),
  });
  const data = await res.json();
  els.networkName.value = data.display_name || "";
  await loadNetwork();
}

async function updateNetworkVisibility(enabled) {
  await fetch("/api/v1/network/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ network_visibility: enabled }),
  });
  await loadNetwork();
}

function setActiveSection(sectionId) {
  if (window.location.hash !== `#${sectionId}`) {
    window.location.hash = sectionId;
  }
  els.sections.forEach((section) => {
    section.classList.toggle("active", section.dataset.section === sectionId);
  });
  els.navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.section === sectionId);
  });
  handleSectionChange(sectionId);
}

function handleSectionChange(sectionId) {
  if (sectionId === "messages") {
    renderMessages();
    scrollMessagesToBottom();
    markMessagesRead();
  }
}

els.navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveSection(button.dataset.section);
  });
});

window.addEventListener("hashchange", () => {
  const target = window.location.hash.replace("#", "");
  if (target) {
    setActiveSection(target);
  }
});

fetchStatus();
loadFiles("/");
loadShares();
refreshPublicAccess();
loadLogs();
loadNetwork();
loadTelemetrySettings();
loadNetworkSettings();
loadSystemInfo();
startHeartbeatMonitor();
loadCachedMessages();
renderMessages();
updateUnreadCount();
startMessagesPolling();
const initial = window.location.hash.replace("#", "") || "home";
setActiveSection(initial);

setInterval(() => {
  loadLogs();
}, 10000);

if (els.messageSend) {
  els.messageSend.addEventListener("click", sendMessage);
}

if (els.messageInput) {
  els.messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });
}

// Task 2: Refresh logs after settings changes
els.telemetryToggle.addEventListener("change", async (event) => {
  await updateTelemetrySettings(event.target.checked);
  await loadLogs();
});

els.saveNetworkName.addEventListener("click", async () => {
  await saveNetworkName();
  await loadLogs();
});

els.networkVisibility.addEventListener("change", async (event) => {
  await updateNetworkVisibility(event.target.checked);
  await loadLogs();
});

// Task 1: Copy User ID button
if (els.copyUserId) {
  els.copyUserId.addEventListener("click", async () => {
    const userId = els.sysUserId?.textContent;
    if (userId && userId !== "--") {
      await navigator.clipboard.writeText(userId);
      els.copyUserId.textContent = "✓";
      setTimeout(() => (els.copyUserId.textContent = "📋"), 1500);
    }
  });
}

if (els.copyDeviceUuid) {
  els.copyDeviceUuid.addEventListener("click", async () => {
    const deviceUuid = els.sysDeviceUuid?.textContent;
    if (deviceUuid && deviceUuid !== "--") {
      await navigator.clipboard.writeText(deviceUuid);
      els.copyDeviceUuid.textContent = "✓";
      setTimeout(() => (els.copyDeviceUuid.textContent = "📋"), 1500);
    }
  });
}