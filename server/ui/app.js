const state = {
  path: "/",
  items: [],
  rawItems: [],
  shares: [],
  requestId: null,
  isAdmin: false,
  sharingEnabled: true,
  fileView: "list",
  fileSort: "name_asc",
  fileSearch: "",
  foldersOnly: false,
  selectedShares: new Set(),
  accessRole: "host",
  deviceId: null,
  deviceName: null,
  deviceFolderRel: null,
};

const els = {
  appLayout: document.getElementById("app-layout"),
  accessGate: document.getElementById("access-gate"),
  accessDeviceNameInput: document.getElementById("access-device-name-input"),
  accessFingerprint: document.getElementById("access-fingerprint"),
  accessStatus: document.getElementById("access-status"),
  requestApproval: document.getElementById("request-approval"),
  pendingBadge: document.getElementById("pending-badge"),
  menuToggle: document.getElementById("menu-toggle"),
  addFileHeader: document.getElementById("add-file-header"),
  toggleSharing: document.getElementById("toggle-sharing"),
  statusDot: document.getElementById("status-dot"),
  status: document.getElementById("node-status"),
  uploadDestinationLabel: document.getElementById("upload-destination-label"),
  headerDisplayName: document.getElementById("header-display-name"),
  storageLabel: document.getElementById("storage-label"),
  ownerMount: document.getElementById("owner-mount"),
  openStorage: document.getElementById("open-storage"),
  cloudUrlInput: document.getElementById("cloud-url-input"),
  copyCloudUrl: document.getElementById("copy-cloud-url"),
  cloudUrlQr: document.getElementById("cloud-url-qr"),
  pendingAccessList: document.getElementById("pending-access-list"),
  pendingAccessCount: document.getElementById("pending-access-count"),
  approvedDevicesList: document.getElementById("approved-devices-list"),
  refreshDevices: document.getElementById("refresh-devices"),
  refreshActivity: document.getElementById("refresh-activity"),
  activitySummary: document.getElementById("activity-summary"),
  metricTotalUploads: document.getElementById("metric-total-uploads"),
  metricTotalDownloads: document.getElementById("metric-total-downloads"),
  metricSharesCreated: document.getElementById("metric-shares-created"),
  metricConnectedDevices: document.getElementById("metric-connected-devices"),
  metricStorageUsed: document.getElementById("metric-storage-used"),
  metricShareDownloads: document.getElementById("metric-share-downloads"),
  activityChart: document.getElementById("activity-chart"),
  fileList: document.getElementById("file-list"),
  fileSearch: document.getElementById("file-search"),
  fileSort: document.getElementById("file-sort"),
  foldersOnly: document.getElementById("folders-only"),
  viewList: document.getElementById("view-list"),
  viewThumb: document.getElementById("view-thumb"),
  myFolderShortcut: document.getElementById("my-folder-shortcut"),
  uploadScopeHint: document.getElementById("upload-scope-hint"),
  uploadButtonLabel: document.getElementById("upload-button-label"),
  shareList: document.getElementById("share-list"),
  breadcrumbs: document.getElementById("breadcrumbs"),
  refreshFiles: document.getElementById("refresh-files"),
  refreshShares: document.getElementById("refresh-shares"),
  revokeSelected: document.getElementById("revoke-selected"),
  revokeAll: document.getElementById("revoke-all"),
  refreshLogs: document.getElementById("refresh-logs"),
  logList: document.getElementById("log-list"),
  networkList: document.getElementById("network-list"),
  telemetryToggle: document.getElementById("telemetry-toggle"),
  networkNameSuffix: document.getElementById("network-name-suffix"),
  saveNetworkName: document.getElementById("save-network-name"),
  networkVisibility: document.getElementById("network-visibility"),
  networkVisibilityNetwork: document.getElementById("network-visibility-network"),
  navButtons: document.querySelectorAll(".nav-button"),
  sections: document.querySelectorAll(".section"),
  backButton: document.getElementById("back-button"),
  uploadInput: document.getElementById("upload-input"),
  dropZone: document.getElementById("drop-zone"),
  shareModal: document.getElementById("share-modal"),
  sharePath: document.getElementById("share-path"),
  sharePermission: document.getElementById("share-permission"),
  shareTtl: document.getElementById("share-ttl"),
  shareTtlCustom: document.getElementById("share-ttl-custom"),
  createShare: document.getElementById("create-share"),
  closeModal: document.getElementById("close-modal"),
  cancelShare: document.getElementById("cancel-share"),
  shareResult: document.getElementById("share-result"),
  copyShare: document.getElementById("copy-share"),
  stopModal: document.getElementById("sharing-stop-modal"),
  closeStopModal: document.getElementById("close-stop-modal"),
  cancelStopModal: document.getElementById("cancel-stop-modal"),
  stopSharingOnly: document.getElementById("stop-sharing-only"),
  closeApplication: document.getElementById("close-application"),
  shareVisitTotal: document.getElementById("share-visit-total"),
  shareVisitToday: document.getElementById("share-visit-today"),
  copyPrivacyPolicy: document.getElementById("copy-privacy-policy"),
  downloadPrivacyPolicy: document.getElementById("download-privacy-policy"),
  privacyPolicyContent: document.getElementById("privacy-policy-content"),
  buildId: document.getElementById("build-id"),
  previewModal: document.getElementById("preview-modal"),
  closePreviewModal: document.getElementById("close-preview-modal"),
  previewTitle: document.getElementById("preview-title"),
  previewBody: document.getElementById("preview-body"),
};

const stateMeta = {
  lanBaseUrl: window.location.origin,
  cloudUrl: window.location.origin,
  fingerprint: getOrCreateFingerprint(),
  sessionToken: localStorage.getItem("joincloud:session-token") || "",
  privacyPolicyRaw: "",
  buildId: "",
  lastPendingCount: 0,
};

function getOrCreateFingerprint() {
  const key = "joincloud:device-fingerprint";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const fp = (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : `fp_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  localStorage.setItem(key, fp);
  return fp;
}

function setHeaderDisplayName(value) {
  els.headerDisplayName.textContent = value && value.trim() ? value : "Join";
}

function displayNameToSuffix(fullName) {
  const normalized = String(fullName || "").trim();
  if (!normalized) return "";
  if (normalized === "Join") return "";
  if (!normalized.toLowerCase().startsWith("join")) return normalized;
  return normalized.slice(4).trimStart();
}

function buildDisplayNameFromSuffix(suffix) {
  const trimmed = String(suffix || "").trim();
  return trimmed ? `Join ${trimmed}` : "Join";
}

function getSuggestedDeviceName() {
  const ua = String(navigator.userAgent || "").toLowerCase();
  if (ua.includes("iphone")) return "iPhone";
  if (ua.includes("ipad")) return "iPad";
  if (ua.includes("android")) return "Android";
  if (ua.includes("windows")) return "Windows Device";
  if (ua.includes("mac")) return "Mac Device";
  return "My Device";
}

function isHostRole() {
  return state.accessRole === "host" || state.isAdmin;
}

function isRemoteRole() {
  return state.accessRole === "remote" || state.accessRole === "device";
}

function isInMyFolder(pathValue) {
  return true;
}

function isPreviewableName(fileName) {
  const lower = String(fileName || "").toLowerCase();
  return /\.(png|jpe?g|gif|webp|svg|pdf|mp4|webm|mov|m4v)$/i.test(lower);
}

function withAuthHeaders(extra = {}) {
  const headers = { ...extra, "x-joincloud-fingerprint": stateMeta.fingerprint };
  if (stateMeta.sessionToken) {
    headers.Authorization = `Bearer ${stateMeta.sessionToken}`;
  }
  return headers;
}

async function apiFetch(url, options = {}, allowUnauthorized = false) {
  const init = { ...options };
  init.headers = withAuthHeaders(options.headers || {});
  const res = await fetch(url, init);
  if (res.status === 423 && !allowUnauthorized) {
    showAccessGate("Sharing is currently stopped by the admin.");
    throw new Error("sharing_stopped");
  }
  if (res.status === 401 && !allowUnauthorized) {
    showAccessGate("Approval required for this device.");
    throw new Error("approval_required");
  }
  return res;
}

function showAccessGate(statusText) {
  els.appLayout.style.display = "none";
  els.accessGate.style.display = "grid";
  els.accessStatus.textContent = statusText || "Waiting to request access.";
  state.accessRole = "pending";
  updateAdminUi();
}

function showMainApp() {
  els.accessGate.style.display = "none";
  els.appLayout.style.display = "grid";
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

function formatLogTime(timestamp) {
  try {
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return timestamp;
  }
}

function getLogIcon(level, message) {
  const msg = String(message || "").toLowerCase();
  if (msg.includes("upload")) return "📤";
  if (msg.includes("download")) return "📥";
  if (msg.includes("share")) return "🔗";
  if (msg.includes("revoke")) return "🚫";
  if (msg.includes("started")) return "🚀";
  if (level === "error") return "❌";
  if (level === "warn") return "⚠️";
  return "ℹ️";
}

function drawActivityChart(entries) {
  if (!els.activityChart) return;
  const canvas = els.activityChart;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const width = canvas.clientWidth || 640;
  const height = Number(canvas.getAttribute("height") || 180);
  canvas.width = width;
  canvas.height = height;
  ctx.clearRect(0, 0, width, height);

  const values = entries.map((entry) => Number(entry.value || 0));
  const maxValue = Math.max(1, ...values);
  const gap = 12;
  const barWidth = Math.max(32, Math.floor((width - gap * (entries.length + 1)) / entries.length));
  const baseline = height - 26;
  const drawHeight = height - 52;

  entries.forEach((entry, index) => {
    const x = gap + index * (barWidth + gap);
    const value = Number(entry.value || 0);
    const h = Math.max(3, Math.round((value / maxValue) * drawHeight));
    const y = baseline - h;
    ctx.fillStyle = "#2fb7ff";
    ctx.fillRect(x, y, barWidth, h);
    ctx.fillStyle = "#a1a1aa";
    ctx.font = "11px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(entry.label, x + barWidth / 2, height - 8);
  });
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

function getFileExtension(name) {
  const ext = String(name || "").split(".").pop()?.toLowerCase();
  return ext && ext !== String(name || "").toLowerCase() ? ext : "";
}

function compareBySort(a, b, sortKey) {
  if (sortKey === "name_desc") {
    return b.name.localeCompare(a.name);
  }
  if (sortKey === "modified_desc") {
    return new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime();
  }
  if (sortKey === "modified_asc") {
    return new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime();
  }
  if (sortKey === "ext_asc") {
    return getFileExtension(a.name).localeCompare(getFileExtension(b.name)) || a.name.localeCompare(b.name);
  }
  if (sortKey === "ext_desc") {
    return getFileExtension(b.name).localeCompare(getFileExtension(a.name)) || a.name.localeCompare(b.name);
  }
  return a.name.localeCompare(b.name);
}

function getVisibleItems() {
  const keyword = state.fileSearch.trim().toLowerCase();
  const filtered = state.rawItems.filter((item) => {
    if (state.foldersOnly && item.type !== "folder") return false;
    if (keyword && !String(item.name || "").toLowerCase().includes(keyword)) return false;
    return true;
  });

  const folders = filtered.filter((item) => item.type === "folder").sort((a, b) => compareBySort(a, b, state.fileSort));
  const files = filtered.filter((item) => item.type !== "folder").sort((a, b) => compareBySort(a, b, state.fileSort));
  return [...folders, ...files];
}

function updateFileViewButtons() {
  els.fileList.dataset.view = state.fileView;
  els.viewList.classList.toggle("active", state.fileView === "list");
  els.viewThumb.classList.toggle("active", state.fileView === "thumb");
}

function renderFiles() {
  state.items = getVisibleItems();
  els.fileList.innerHTML = "";
  updateFileViewButtons();
  if (!state.items.length) {
    const message = state.rawItems.length
      ? "No items match current filters."
      : "Drop files here or click Upload";
    els.fileList.innerHTML = `<div class="empty-state"><div class="empty-state-title">No files yet</div><div class="empty-state-sub">${message}</div></div>`;
    return;
  }

  state.items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "item file-item";
    const fileExt = getFileExtension(item.name);
    row.innerHTML = `
      <span class="file-icon">${getFileIcon(item)}</span>
      <div class="file-info">
        <div class="item-title">${item.name}</div>
        <div class="item-sub">${item.type === "folder" ? "Folder" : `${fileExt || "file"} · ${formatBytes(item.size)}`}</div>
      </div>
    `;
    const openButton = document.createElement("button");
    openButton.className = "button secondary";
    if (item.type === "folder") {
      openButton.textContent = "Open";
      openButton.onclick = () => loadFiles(item.path);
      row.appendChild(openButton);
    } else if (isHostRole()) {
      openButton.textContent = "Share";
      openButton.onclick = () => openShareModal(item.path);
      row.appendChild(openButton);
    }

    if (item.type === "file" && isPreviewableName(item.name)) {
      const previewButton = document.createElement("button");
      previewButton.className = "button secondary";
      previewButton.textContent = "Preview";
      previewButton.onclick = () => openPreviewModal(item);
      row.appendChild(previewButton);
    }

    if (item.type === "folder" && isHostRole()) {
      const shareButton = document.createElement("button");
      shareButton.className = "button";
      shareButton.textContent = "Share";
      shareButton.onclick = () => openShareModal(item.path);
      row.appendChild(shareButton);
    }
    els.fileList.appendChild(row);
  });
  refreshRemoteUploadUi();
}

function renderShares() {
  els.shareList.innerHTML = "";
  const updateBulkButtons = () => {
    els.revokeSelected.disabled = state.selectedShares.size === 0;
  };
  const activeShares = state.shares.filter((share) => share.status === "active");
  if (!activeShares.length) {
    state.selectedShares.clear();
    updateBulkButtons();
    els.shareList.innerHTML = '<div class="empty-state"><div class="empty-state-title">No active shares</div><div class="empty-state-sub">No shares created yet</div></div>';
    return;
  }
  const activeIds = new Set(activeShares.map((share) => share.shareId));
  state.selectedShares = new Set(Array.from(state.selectedShares).filter((id) => activeIds.has(id)));
  updateBulkButtons();
  activeShares.forEach((share) => {
    const row = document.createElement("div");
    row.className = "item";
    const shareUrl = `${stateMeta.lanBaseUrl}/share/${share.shareId}`;
    row.innerHTML = `
      <div>
        <div class="item-title">${share.path}</div>
        <div class="item-sub">${share.permission} · expires ${new Date(share.expiresAt).toLocaleString()}</div>
      </div>
      <span class="badge badge-active">Active</span>
    `;
    if (isHostRole()) {
      const checkboxWrap = document.createElement("label");
      checkboxWrap.className = "item-check";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = state.selectedShares.has(share.shareId);
      checkbox.onchange = () => {
        if (checkbox.checked) state.selectedShares.add(share.shareId);
        else state.selectedShares.delete(share.shareId);
        updateBulkButtons();
      };
      checkboxWrap.appendChild(checkbox);
      row.appendChild(checkboxWrap);
    }
    const copyButton = document.createElement("button");
    copyButton.className = "button secondary";
    copyButton.textContent = "Copy Link";
    copyButton.onclick = async () => {
      const ok = await copyToClipboard(shareUrl);
      if (ok) {
        copyButton.textContent = "Copied!";
        setTimeout(() => (copyButton.textContent = "Copy Link"), 2000);
      } else {
        showCopyFallback(shareUrl, copyButton);
      }
    };
    row.appendChild(copyButton);

    if (isHostRole()) {
      const revokeButton = document.createElement("button");
      revokeButton.className = "button danger";
      revokeButton.textContent = "Revoke";
      revokeButton.onclick = async () => {
        revokeButton.disabled = true;
        revokeButton.textContent = "Revoking...";
        await revokeShare(share.shareId);
      };
      row.appendChild(revokeButton);
    }
    els.shareList.appendChild(row);
  });
}

function renderLogs(entries) {
  els.logList.innerHTML = "";
  if (!entries.length) {
    els.logList.innerHTML = '<div class="empty-state"><div class="empty-state-title">No logs yet</div><div class="empty-state-sub">Activity will appear here</div></div>';
    return;
  }
  entries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = `log-item log-${entry.level}`;
    row.innerHTML = `
      <span class="log-icon">${getLogIcon(entry.level, entry.message)}</span>
      <span class="log-time">${formatLogTime(entry.timestamp)}</span>
      <span class="log-message">${entry.message}</span>
    `;
    els.logList.appendChild(row);
  });
}

function renderNetwork() {
  els.networkList.innerHTML = '<div class="empty-state"><div class="empty-state-title">Coming Soon</div><div class="empty-state-sub">Network discovery will be available in a future release.</div></div>';
}

function closePreviewModal() {
  if (!els.previewModal) return;
  els.previewModal.classList.remove("active");
  if (els.previewBody) {
    els.previewBody.innerHTML = "";
  }
}

function openPreviewModal(item) {
  if (!item || item.type !== "file" || !isPreviewableName(item.name)) return;
  if (!els.previewModal || !els.previewBody || !els.previewTitle) return;
  const params = new URLSearchParams({
    path: item.path,
    fp: stateMeta.fingerprint,
  });
  if (stateMeta.sessionToken) {
    params.set("token", stateMeta.sessionToken);
  }
  const previewUrl = `/api/v1/file/content?${params.toString()}`;
  const lower = String(item.name || "").toLowerCase();
  els.previewTitle.textContent = `Preview: ${item.name}`;
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(lower)) {
    els.previewBody.innerHTML = `<img src="${previewUrl}" alt="${item.name}" class="preview-image" />`;
  } else if (/\.pdf$/i.test(lower)) {
    els.previewBody.innerHTML = `<object data="${previewUrl}" type="application/pdf" class="preview-frame"><iframe src="${previewUrl}" class="preview-frame" title="${item.name}"></iframe></object>`;
  } else if (/\.(mp4|webm|mov|m4v)$/i.test(lower)) {
    els.previewBody.innerHTML = `<video controls class="preview-video" src="${previewUrl}"></video>`;
  } else {
    return;
  }
  els.previewModal.classList.add("active");
}

function shortenFingerprint(value) {
  const text = String(value || "");
  if (text.length <= 16) return text;
  return `${text.slice(0, 8)}...${text.slice(-6)}`;
}

function renderCloudQr(url) {
  if (!window.QRious || !els.cloudUrlQr) return;
  new window.QRious({
    element: els.cloudUrlQr,
    value: url,
    size: 220,
    level: "M",
    background: "white",
    foreground: "#000000",
  });
}

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_err) {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch (_e) {
    return false;
  }
}

function showCopyFallback(text, triggerEl) {
  const wrap = document.createElement("div");
  wrap.className = "copy-fallback";
  wrap.style.marginTop = "8px";
  wrap.innerHTML = '<div class="value value-muted" style="margin-bottom:4px">Tap and hold to copy:</div>';
  const input = document.createElement("input");
  input.type = "text";
  input.className = "input mono";
  input.value = text;
  input.readOnly = true;
  input.style.width = "100%";
  input.onclick = () => input.select();
  wrap.appendChild(input);
  const parent = triggerEl.closest(".item") || triggerEl.parentElement;
  const existing = parent.querySelector(".copy-fallback");
  if (existing) existing.remove();
  parent.appendChild(wrap);
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatInline(text) {
  const escaped = escapeHtml(text);
  return escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function renderPrivacyMarkdown(markdownText) {
  const lines = String(markdownText || "").split(/\r?\n/);
  const html = [];
  let paragraph = [];
  let inList = false;

  function flushParagraph() {
    if (!paragraph.length) return;
    const text = paragraph.join(" ");
    html.push(`<p>${formatInline(text)}</p>`);
    paragraph = [];
  }

  function closeList() {
    if (!inList) return;
    html.push("</ul>");
    inList = false;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      closeList();
      continue;
    }
    if (line.startsWith("### ")) {
      flushParagraph();
      closeList();
      html.push(`<h3>${formatInline(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith("## ")) {
      flushParagraph();
      closeList();
      html.push(`<h2>${formatInline(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith("# ")) {
      flushParagraph();
      closeList();
      html.push(`<h1>${formatInline(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith("• ")) {
      flushParagraph();
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${formatInline(line.slice(2))}</li>`);
      continue;
    }
    closeList();
    paragraph.push(line);
  }

  flushParagraph();
  closeList();
  return html.join("");
}

async function loadPrivacyPolicy() {
  try {
    const response = await fetch("/privacy-policy.md");
    if (!response.ok) {
      throw new Error("policy_not_found");
    }
    const markdown = await response.text();
    stateMeta.privacyPolicyRaw = markdown;
    els.privacyPolicyContent.innerHTML = renderPrivacyMarkdown(markdown);
  } catch (_error) {
    stateMeta.privacyPolicyRaw = "";
    els.privacyPolicyContent.innerHTML = "<p>Unable to load privacy policy.</p>";
  }
}

async function loadCloudUrl() {
  const res = await apiFetch("/api/v1/cloud/url");
  const data = await res.json();
  stateMeta.cloudUrl = String(data.url || window.location.origin);
  els.cloudUrlInput.value = stateMeta.cloudUrl;
  renderCloudQr(`${stateMeta.cloudUrl}?pair=1`);
}

async function loadAccessMe() {
  const res = await apiFetch("/api/v1/access/me", {}, true);
  if (!res.ok) {
    state.accessRole = state.isAdmin ? "host" : "remote";
    return;
  }
  const data = await res.json();
  state.accessRole = data.role === "host" ? "host" : "device";
  state.deviceId = data.device_id || null;
  state.deviceName = data.device_name || null;
  state.deviceFolderRel = null;
}

async function loadBuildInfo() {
  try {
    const res = await fetch("/api/v1/build");
    if (!res.ok) return;
    const data = await res.json();
    stateMeta.buildId = String(data.build_id || "");
    if (els.buildId) {
      els.buildId.textContent = `BUILD: ${stateMeta.buildId || "unknown"}`;
    }
  } catch (_error) {
    if (els.buildId) {
      els.buildId.textContent = "BUILD: unavailable";
    }
  }
}

async function fetchStatus() {
  const res = await apiFetch("/api/status");
  const data = await res.json();
  const running = data.status === "running";
  updateHeaderStatus(running);
  els.storageLabel.textContent = data.storageLabel || "Local storage";
  els.ownerMount.textContent = data.ownerBasePath;
  if (data.lanBaseUrl) stateMeta.lanBaseUrl = data.lanBaseUrl;
}

function updateHeaderStatus(running) {
  state.sharingEnabled = !!running;
  els.status.innerHTML = `<span class="status-dot ${running ? "running" : "stopped"}" id="status-dot"></span> Status: ${running ? "Running" : "Stopped"}`;
  els.statusDot = document.getElementById("status-dot");
  if (els.toggleSharing) {
    els.toggleSharing.textContent = running ? "Stop" : "Start";
  }
}

async function loadRuntimeStatus() {
  const res = await apiFetch("/api/v1/status", {}, true);
  if (!res.ok) return;
  const data = await res.json();
  updateHeaderStatus(!!data.running);
}

async function loadFiles(pathValue) {
  const res = await apiFetch(`/api/files?path=${encodeURIComponent(pathValue)}`);
  const data = await res.json();
  state.path = data.path;
  state.rawItems = Array.isArray(data.items) ? data.items : [];
  renderBreadcrumbs();
  renderFiles();
}

async function loadShares() {
  els.refreshShares.disabled = true;
  const res = await apiFetch("/api/shares");
  state.shares = await res.json();
  renderShares();
  els.refreshShares.disabled = false;
}

async function loadLogs() {
  els.refreshLogs.disabled = true;
  const res = await apiFetch("/api/v1/logs");
  renderLogs(await res.json());
  els.refreshLogs.disabled = false;
}

async function loadShareVisitSummary() {
  if (!state.isAdmin) {
    els.shareVisitTotal.textContent = "Total: host only";
    els.shareVisitToday.textContent = "Today: host only";
    return;
  }
  const res = await apiFetch("/api/v1/telemetry/summary");
  const data = await res.json();
  els.shareVisitTotal.textContent = `Total: ${Number(data.share_page_visits || 0)}`;
  els.shareVisitToday.textContent = `Downloads: ${Number(data.total_downloads || 0)}`;
}

async function loadNetwork() {
  renderNetwork();
}

async function loadTelemetrySettings() {
  const res = await apiFetch("/api/v1/telemetry/settings");
  const data = await res.json();
  els.telemetryToggle.checked = !!data.enabled;
}

async function updateTelemetrySettings(enabled) {
  await apiFetch("/api/v1/telemetry/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
}

async function loadNetworkSettings() {
  const res = await apiFetch("/api/v1/network/settings");
  const data = await res.json();
  const currentName = String(data.display_name || "Join");
  const normalized = currentName.toLowerCase().startsWith("join") ? currentName : `Join ${currentName}`.trim();
  if (normalized !== currentName) {
    await apiFetch("/api/v1/network/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: normalized }),
    });
  }
  setHeaderDisplayName(normalized);
  els.networkNameSuffix.value = displayNameToSuffix(normalized);
  els.networkVisibility.checked = false;
  els.networkVisibility.disabled = true;
  if (els.networkVisibilityNetwork) {
    els.networkVisibilityNetwork.checked = false;
    els.networkVisibilityNetwork.disabled = true;
  }
}

async function saveNetworkName() {
  const displayName = buildDisplayNameFromSuffix(els.networkNameSuffix.value);
  const res = await apiFetch("/api/v1/network/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ display_name: displayName }),
  });
  const data = await res.json();
  const savedName = String(data.display_name || "Join");
  setHeaderDisplayName(savedName);
  els.networkNameSuffix.value = displayNameToSuffix(savedName);
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
  const ttlSelection = els.shareTtl.value;
  if (ttlSelection === "custom" && !els.shareTtlCustom.value) {
    els.shareResult.textContent = "Enter expiry in minutes.";
    return;
  }
  const ttlMs = ttlSelection === "custom" ? Number(els.shareTtlCustom.value) * 60 * 1000 : Number(ttlSelection);
  const res = await apiFetch("/api/share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: pathValue, permission: els.sharePermission.value, ttlMs, scope: "local" }),
  });
  const data = await res.json();
  if (!res.ok) {
    els.shareResult.textContent = data.error || "Failed to create share";
    return;
  }
  const shareUrl = `${stateMeta.lanBaseUrl}/share/${data.shareId}`;
  els.shareResult.textContent = `Share created: ${shareUrl}`;
  els.copyShare.style.display = "inline-flex";
  els.copyShare.onclick = async () => {
    const ok = await copyToClipboard(shareUrl);
    if (ok) {
      els.copyShare.textContent = "Copied!";
      setTimeout(() => (els.copyShare.textContent = "Copy Link"), 2000);
    } else {
      showCopyFallback(shareUrl, els.copyShare);
    }
  };
  await loadShares();
  await loadLogs();
}

async function revokeShare(shareId) {
  state.shares = state.shares.filter((share) => share.shareId !== shareId);
  state.selectedShares.delete(shareId);
  renderShares();
  await apiFetch(`/api/share/${shareId}`, { method: "DELETE" });
  await loadShares();
  await loadLogs();
}

async function revokeSelectedShares() {
  const tokens = Array.from(state.selectedShares);
  if (!tokens.length) return;
  await apiFetch("/api/v1/shares/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tokens }),
  });
  state.selectedShares.clear();
  await loadShares();
  await loadLogs();
}

async function revokeAllShares() {
  await apiFetch("/api/v1/shares/revoke_all", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  state.selectedShares.clear();
  await loadShares();
  await loadLogs();
}

function openStopModal() {
  if (els.stopModal) {
    els.stopModal.classList.add("active");
  }
}

function closeStopModal() {
  if (els.stopModal) {
    els.stopModal.classList.remove("active");
  }
}

async function stopSharing() {
  await apiFetch("/api/v1/sharing/stop", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  closeStopModal();
  await loadRuntimeStatus();
  await loadLogs();
}

async function startSharing() {
  await apiFetch("/api/v1/sharing/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  await loadRuntimeStatus();
  await loadLogs();
}

async function addFileViaNativePicker() {
  if (!window.joincloud || !window.joincloud.selectFiles) {
    if (els.uploadInput && !els.uploadInput.disabled) {
      els.uploadInput.click();
    }
    return;
  }
  if (isRemoteRole() && state.deviceFolderRel && !isInMyFolder(state.path)) {
    await loadFiles(state.deviceFolderRel);
  }
  const selectedPaths = await window.joincloud.selectFiles();
  if (!selectedPaths || !selectedPaths.length) return;
  const importTarget = state.path;
  await apiFetch("/api/v1/files/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: importTarget, sourcePaths: selectedPaths }),
  });
  await loadFiles(importTarget);
  await loadLogs();
}

async function uploadFiles(files) {
  if (!files || files.length === 0) return;
  const formData = new FormData();
  Array.from(files).forEach((file) => formData.append("files", file));
  const uploadPath = state.path;
  formData.append("path", uploadPath);
  const res = await apiFetch("/api/upload", { method: "POST", body: formData });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = payload.error || "Upload failed.";
    if (els.uploadScopeHint) {
      els.uploadScopeHint.textContent = reason;
    }
    throw new Error(reason);
  }
  const savedTo = String(payload.saved_to || uploadPath || "/");
  await loadFiles(savedTo);
  await loadLogs();
}

async function loadPendingAccessRequests() {
  if (!state.isAdmin) {
    els.pendingAccessCount.textContent = "0";
    els.pendingAccessList.innerHTML = '<div class="value value-muted">Available only on the host machine.</div>';
    if (els.pendingBadge) els.pendingBadge.style.display = "none";
    return;
  }
  const res = await apiFetch("/api/v1/access/pending");
  const pending = await res.json();
  els.pendingAccessCount.textContent = String(pending.length);
  if (els.pendingBadge) {
    if (pending.length > 0) {
      els.pendingBadge.style.display = "inline-flex";
      els.pendingBadge.textContent = `${pending.length} Pending`;
    } else {
      els.pendingBadge.style.display = "none";
    }
  }
  if (pending.length > stateMeta.lastPendingCount && document.visibilityState === "visible") {
    try {
      if ("Notification" in window) {
        if (Notification.permission === "granted") {
          new Notification("JoinCloud", {
            body: `${pending.length} device request(s) pending approval.`,
          });
        } else if (Notification.permission === "default") {
          Notification.requestPermission().then(() => {});
        }
      }
    } catch (_error) {
      // ignore notification errors
    }
  }
  stateMeta.lastPendingCount = pending.length;
  if (!pending.length) {
    els.pendingAccessList.innerHTML = '<div class="value value-muted">No pending requests.</div>';
    return;
  }
  els.pendingAccessList.innerHTML = "";
  pending.forEach((item) => {
    const row = document.createElement("div");
    row.className = "pending-item";
    row.innerHTML = `
      <div class="pending-item-meta">
        <div class="item-title">${item.device_name || "Unknown Device"}</div>
        <div class="item-sub mono">${item.fingerprint}</div>
        <div class="item-sub">${new Date(item.created_at).toLocaleString()}</div>
      </div>
    `;
    const approveBtn = document.createElement("button");
    approveBtn.className = "button";
    approveBtn.textContent = "Approve";
    approveBtn.onclick = async () => {
      await apiFetch("/api/v1/access/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: item.request_id }),
      });
      await loadPendingAccessRequests();
    };
    const denyBtn = document.createElement("button");
    denyBtn.className = "button secondary";
    denyBtn.textContent = "Deny";
    denyBtn.onclick = async () => {
      await apiFetch("/api/v1/access/deny", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: item.request_id }),
      });
      await loadPendingAccessRequests();
    };
    row.appendChild(approveBtn);
    row.appendChild(denyBtn);
    els.pendingAccessList.appendChild(row);
  });
}

async function loadApprovedDevices() {
  if (!state.isAdmin) {
    els.approvedDevicesList.innerHTML = '<div class="value value-muted">Devices management is available on the host machine only.</div>';
    return;
  }
  const res = await apiFetch("/api/v1/access/devices");
  const devices = await res.json();
  if (!devices.length) {
    els.approvedDevicesList.innerHTML = '<div class="value value-muted">No approved devices.</div>';
    return;
  }
  els.approvedDevicesList.innerHTML = "";
  devices.forEach((device) => {
    const row = document.createElement("div");
    row.className = "pending-item";
    row.innerHTML = `
      <div class="pending-item-meta">
        <div class="item-title">${device.device_name || "Unknown Device"}</div>
        <div class="item-sub mono" title="${device.fingerprint}">${shortenFingerprint(device.fingerprint)}</div>
        <div class="item-sub mono">Folder: ${device.device_folder_rel || "-"}</div>
        <div class="item-sub">Approved: ${device.approved_at ? new Date(device.approved_at).toLocaleString() : "-"}</div>
        <div class="item-sub">Last seen: ${device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : "Never"}</div>
      </div>
    `;
    if (device.device_folder_rel) {
      const openFolderBtn = document.createElement("button");
      openFolderBtn.className = "button secondary";
      openFolderBtn.textContent = "Open Device Folder";
      openFolderBtn.onclick = async () => {
        setActiveSection("files");
        await loadFiles(device.device_folder_rel);
      };
      row.appendChild(openFolderBtn);
    }
    const removeBtn = document.createElement("button");
    removeBtn.className = "button danger";
    removeBtn.textContent = "Remove";
    removeBtn.onclick = async () => {
      await apiFetch("/api/v1/access/devices/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint: device.fingerprint }),
      });
      await loadApprovedDevices();
      await loadPendingAccessRequests();
    };
    row.appendChild(removeBtn);
    els.approvedDevicesList.appendChild(row);
  });
}

async function loadActivitySummary() {
  if (!state.isAdmin) {
    if (els.activitySummary) els.activitySummary.textContent = "Host-only dashboard.";
    return;
  }
  const [activityRes, storageRes] = await Promise.all([
    apiFetch("/api/v1/activity/summary"),
    apiFetch("/api/storage"),
  ]);
  const data = await activityRes.json();
  const storage = await storageRes.json();
  const telemetry = data.telemetry || {};
  const devices = Array.isArray(data.devices) ? data.devices : [];
  const uploadsFromDevices = devices.reduce((sum, device) => sum + Number(device.uploads || 0), 0);
  const downloadsFromDevices = devices.reduce((sum, device) => sum + Number(device.downloads || 0), 0);
  const activeSince = Date.now() - 24 * 60 * 60 * 1000;
  const active24h = devices.filter((device) => {
    const ts = device.last_seen_at ? new Date(device.last_seen_at).getTime() : 0;
    return ts > activeSince;
  }).length;
  const sharesCreated = Number(telemetry.total_shares_created || 0);
  const shareDownloads = Number(telemetry.total_downloads || 0);
  const totalUploads = Number(telemetry.total_uploads || 0) || uploadsFromDevices;
  const totalDownloads = Math.max(downloadsFromDevices, shareDownloads);
  const connectedDevices = Number(data.connected_devices || devices.length || 0);
  const storageUsed = Number(storage.usedBytes || 0);

  if (els.metricTotalUploads) els.metricTotalUploads.textContent = String(totalUploads);
  if (els.metricTotalDownloads) els.metricTotalDownloads.textContent = String(totalDownloads);
  if (els.metricSharesCreated) els.metricSharesCreated.textContent = String(sharesCreated);
  if (els.metricConnectedDevices) els.metricConnectedDevices.textContent = String(connectedDevices);
  if (els.metricStorageUsed) els.metricStorageUsed.textContent = formatBytes(storageUsed);
  if (els.metricShareDownloads) els.metricShareDownloads.textContent = String(shareDownloads);
  if (els.activitySummary) {
    els.activitySummary.textContent = `Pending requests: ${Number(data.pending_count || 0)} | Active (24h): ${active24h} devices`;
  }
  drawActivityChart([
    { label: "Uploads", value: totalUploads },
    { label: "Downloads", value: totalDownloads },
    { label: "Shares", value: sharesCreated },
    { label: "Devices", value: connectedDevices },
    { label: "Share DL", value: shareDownloads },
  ]);
}

async function pollAccessStatus(requestId) {
  const res = await apiFetch(`/api/v1/access/status?request_id=${encodeURIComponent(requestId)}`, {}, true);
  if (!res.ok) return;
  const data = await res.json();
  if (data.status === "approved" && data.session_token) {
    localStorage.setItem("joincloud:session-token", data.session_token);
    stateMeta.sessionToken = data.session_token;
    localStorage.removeItem("joincloud:request-id");
    await bootstrapApp();
  } else if (data.status === "denied") {
    localStorage.removeItem("joincloud:request-id");
    state.requestId = null;
    showAccessGate("Request denied by admin.");
  } else {
    showAccessGate("Waiting for admin approval...");
  }
}

async function requestAccessApproval() {
  const deviceName = String(els.accessDeviceNameInput?.value || "").trim() || getSuggestedDeviceName();
  const body = {
    device_name: deviceName,
    user_agent: navigator.userAgent,
    fingerprint: stateMeta.fingerprint,
  };
  const res = await apiFetch("/api/v1/access/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, true);
  if (!res.ok) {
    showAccessGate("Failed to request access.");
    return;
  }
  const data = await res.json();
  state.requestId = data.request_id;
  localStorage.setItem("joincloud:request-id", state.requestId);
  showAccessGate("Waiting for admin approval...");
}

async function checkSessionAccess() {
  const res = await apiFetch("/api/v1/access/session", {}, true);
  if (res.status === 423) {
    const payload = await res.json().catch(() => ({}));
    return { authorized: false, reason: payload.reason || "sharing_stopped" };
  }
  if (!res.ok) return null;
  return res.json();
}

async function bootstrapApp() {
  const session = await checkSessionAccess();
  if (!session || !session.authorized) {
    state.requestId = localStorage.getItem("joincloud:request-id");
    if (session && session.reason === "sharing_stopped") {
      showAccessGate("Sharing is currently stopped by the admin.");
    } else {
      showAccessGate(state.requestId ? "Waiting for admin approval..." : "This device requires admin approval.");
    }
    return;
  }
  state.isAdmin = session.role === "admin";
  state.accessRole = state.isAdmin ? "host" : "remote";
  showMainApp();
  await loadAccessMe();
  updateAdminUi();
  await loadBuildInfo();

  await fetchStatus();
  await loadRuntimeStatus();
  await loadCloudUrl();
  await loadFiles("/");
  await loadShares();
  await loadLogs();
  await loadNetwork();
  await loadTelemetrySettings();
  await loadNetworkSettings();
  await loadPrivacyPolicy();
  await loadPendingAccessRequests();
  await loadApprovedDevices();
  await loadShareVisitSummary();
  await loadActivitySummary();

  const initial = window.location.hash.replace("#", "") || "home";
  setActiveSection(initial);
}

function setActiveSection(sectionId) {
  const adminOnly = new Set(["devices", "activity"]);
  const safeSection = !state.isAdmin && adminOnly.has(sectionId) ? "home" : sectionId;
  if (window.location.hash !== `#${safeSection}`) window.location.hash = safeSection;
  els.sections.forEach((section) => section.classList.toggle("active", section.dataset.section === safeSection));
  els.navButtons.forEach((button) => button.classList.toggle("active", button.dataset.section === safeSection));
}

function updateAdminUi() {
  const devicesButton = Array.from(els.navButtons).find((button) => button.dataset.section === "devices");
  const devicesSection = Array.from(els.sections).find((section) => section.dataset.section === "devices");
  const activityButton = Array.from(els.navButtons).find((button) => button.dataset.section === "activity");
  const activitySection = Array.from(els.sections).find((section) => section.dataset.section === "activity");
  const pendingRole = state.accessRole === "pending";
  const hostRole = isHostRole();
  const remoteRole = isRemoteRole();
  if (devicesButton) {
    devicesButton.style.display = hostRole ? "" : "none";
  }
  if (devicesSection && !hostRole) {
    devicesSection.classList.remove("active");
  }
  if (activityButton) {
    activityButton.style.display = hostRole ? "" : "none";
  }
  if (activitySection && !hostRole) {
    activitySection.classList.remove("active");
  }
  if (els.addFileHeader) {
    els.addFileHeader.style.display = pendingRole ? "none" : "";
    els.addFileHeader.textContent = remoteRole ? "Add File" : "Add File";
  }
  if (els.toggleSharing) {
    els.toggleSharing.style.display = hostRole && !pendingRole ? "" : "none";
  }
  if (els.revokeAll) {
    els.revokeAll.style.display = hostRole ? "" : "none";
  }
  if (els.revokeSelected) {
    els.revokeSelected.style.display = hostRole ? "" : "none";
  }
  if (els.myFolderShortcut) {
    els.myFolderShortcut.style.display = "none";
  }
}

function refreshRemoteUploadUi() {
  const uploadAllowed = true;
  if (els.uploadInput) {
    els.uploadInput.disabled = !uploadAllowed;
  }
  if (els.uploadButtonLabel) {
    els.uploadButtonLabel.classList.toggle("disabled", !uploadAllowed);
  }
  if (els.dropZone) {
    els.dropZone.classList.toggle("disabled", !uploadAllowed);
    els.dropZone.textContent = "Drag & drop files here";
  }
  if (els.uploadScopeHint) {
    els.uploadScopeHint.textContent = "";
  }
  if (els.uploadDestinationLabel) {
    els.uploadDestinationLabel.textContent = "";
  }
}

els.menuToggle.addEventListener("click", () => {
  document.body.classList.toggle("sidebar-open");
});

els.navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveSection(button.dataset.section);
    document.body.classList.remove("sidebar-open");
  });
});

window.addEventListener("hashchange", () => {
  const target = window.location.hash.replace("#", "");
  if (target) setActiveSection(target);
});

els.copyCloudUrl.addEventListener("click", async () => {
  const ok = await copyToClipboard(`${stateMeta.cloudUrl}?pair=1`);
  if (ok) {
    els.copyCloudUrl.textContent = "Copied!";
    setTimeout(() => (els.copyCloudUrl.textContent = "Copy"), 2000);
  } else {
    showCopyFallback(`${stateMeta.cloudUrl}?pair=1`, els.copyCloudUrl);
  }
});

els.requestApproval.addEventListener("click", async () => {
  await requestAccessApproval();
});

els.addFileHeader.addEventListener("click", async () => {
  await addFileViaNativePicker();
});

els.toggleSharing.addEventListener("click", async () => {
  if (state.sharingEnabled) {
    openStopModal();
    return;
  }
  await startSharing();
});

els.closeStopModal.addEventListener("click", closeStopModal);
els.cancelStopModal.addEventListener("click", closeStopModal);
els.stopSharingOnly.addEventListener("click", async () => {
  await stopSharing();
});
els.closeApplication.addEventListener("click", async () => {
  closeStopModal();
  if (window.joincloud && window.joincloud.quitApp) {
    await window.joincloud.quitApp();
    return;
  }
  await apiFetch("/api/v1/app/quit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
});
if (els.closePreviewModal) {
  els.closePreviewModal.addEventListener("click", closePreviewModal);
}
if (els.previewModal) {
  els.previewModal.addEventListener("click", (event) => {
    if (event.target === els.previewModal) closePreviewModal();
  });
}

els.refreshFiles.onclick = () => loadFiles(state.path);
els.refreshShares.onclick = () => loadShares();
els.revokeSelected.onclick = () => revokeSelectedShares();
els.revokeAll.onclick = () => revokeAllShares();
els.refreshLogs.onclick = () => loadLogs();
els.refreshDevices.onclick = () => loadApprovedDevices();
if (els.refreshActivity) {
  els.refreshActivity.onclick = () => loadActivitySummary();
}
els.closeModal.onclick = closeShareModal;
els.cancelShare.onclick = closeShareModal;
els.createShare.onclick = createShare;
els.shareTtl.onchange = () => {
  els.shareTtlCustom.style.display = els.shareTtl.value === "custom" ? "block" : "none";
};
els.fileSearch.addEventListener("input", (event) => {
  state.fileSearch = String(event.target.value || "");
  renderFiles();
});
els.fileSort.addEventListener("change", (event) => {
  state.fileSort = String(event.target.value || "name_asc");
  renderFiles();
});
els.foldersOnly.addEventListener("change", (event) => {
  state.foldersOnly = !!event.target.checked;
  renderFiles();
});
els.viewList.addEventListener("click", () => {
  state.fileView = "list";
  renderFiles();
});
els.viewThumb.addEventListener("click", () => {
  state.fileView = "thumb";
  renderFiles();
});
if (els.myFolderShortcut) {
  els.myFolderShortcut.addEventListener("click", async () => {
    await loadFiles(state.path);
  });
}
els.backButton.onclick = () => {
  if (state.path === "/") return;
  const parts = state.path.split("/").filter(Boolean);
  parts.pop();
  loadFiles(`/${parts.join("/")}` || "/");
};
els.openStorage.onclick = async () => {
  if (window.joincloud && window.joincloud.openStorageFolder) {
    await window.joincloud.openStorageFolder();
  } else {
    alert("Storage folder is available in the desktop app only.");
  }
};
els.uploadInput.onchange = (event) => {
  uploadFiles(event.target.files);
  els.uploadInput.value = "";
};
els.dropZone.addEventListener("dragover", (event) => {
  if (els.uploadInput?.disabled) return;
  event.preventDefault();
  els.dropZone.classList.add("active");
});
els.dropZone.addEventListener("dragleave", () => els.dropZone.classList.remove("active"));
els.dropZone.addEventListener("drop", (event) => {
  if (els.uploadInput?.disabled) return;
  event.preventDefault();
  els.dropZone.classList.remove("active");
  uploadFiles(event.dataTransfer.files);
});
els.telemetryToggle.addEventListener("change", async (event) => {
  await updateTelemetrySettings(event.target.checked);
});
els.saveNetworkName.addEventListener("click", async () => {
  await saveNetworkName();
});
els.copyPrivacyPolicy.addEventListener("click", async () => {
  if (!stateMeta.privacyPolicyRaw) return;
  await copyToClipboard(stateMeta.privacyPolicyRaw);
  els.copyPrivacyPolicy.textContent = "Copied!";
  setTimeout(() => {
    els.copyPrivacyPolicy.textContent = "Copy";
  }, 1200);
});
els.downloadPrivacyPolicy.addEventListener("click", () => {
  if (!stateMeta.privacyPolicyRaw) return;
  const blob = new Blob([stateMeta.privacyPolicyRaw], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "JoinCloud-Privacy-Policy.md";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

if (els.accessDeviceNameInput) {
  els.accessDeviceNameInput.value = getSuggestedDeviceName();
}
els.accessFingerprint.textContent = stateMeta.fingerprint;
bootstrapApp();

setInterval(async () => {
  if (els.appLayout.style.display !== "none") {
    await loadRuntimeStatus();
    await loadLogs();
    if (state.isAdmin) {
      await loadPendingAccessRequests();
      await loadApprovedDevices();
      await loadShareVisitSummary();
      await loadActivitySummary();
    }
  } else if (state.requestId) {
    await pollAccessStatus(state.requestId);
  }
}, 3000);
