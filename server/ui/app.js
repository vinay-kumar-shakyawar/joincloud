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
  licenseState: null,
  licenseGraceEndsAt: null,
  licenseTier: null,
  licenseExpiresAt: null,
  licenseDeviceLimit: null,
  activationRequired: false,
  upgradeUrl: "",
  subscription: null,
  supportMessages: [],
  accountId: null,
  hostUuidFromConfig: null,
  accountEmail: null,
  displayName: "Join",
};

const els = {
  appLayout: document.getElementById("app-layout"),
  accessGate: document.getElementById("access-gate"),
  activationGate: document.getElementById("activation-gate"),
  activationGateSigninWeb: document.getElementById("activation-gate-signin-web"),
  activationGateMessage: document.getElementById("activation-gate-message"),
  activationGateUpgradeWrap: document.getElementById("activation-gate-upgrade-wrap"),
  activationGateUpgradeLink: document.getElementById("activation-gate-upgrade-link"),
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
  teamsList: document.getElementById("teams-list"),
  teamDetail: document.getElementById("team-detail"),
  teamDetailBack: document.getElementById("team-detail-back"),
  teamDetailName: document.getElementById("team-detail-name"),
  teamChatFeed: document.getElementById("team-chat-feed"),
  teamMessageInput: document.getElementById("team-message-input"),
  teamSendBtn: document.getElementById("team-send-btn"),
  teamInviteBtn: document.getElementById("team-invite-btn"),
  createTeamBtn: document.getElementById("create-team-btn"),
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
  graceBanner: document.getElementById("grace-banner"),
  graceEndsDate: document.getElementById("grace-ends-date"),
  settingsProfileRow: document.getElementById("settings-profile-row"),
  settingsProfileValue: document.getElementById("settings-profile-value"),
  settingsProfileCard: document.getElementById("settings-profile-card"),
  settingsProfileEmail: document.getElementById("settings-profile-email"),
  settingsProfilePlan: document.getElementById("settings-profile-plan"),
  settingsProfileStatus: document.getElementById("settings-profile-status"),
  settingsProfileDeviceLimit: document.getElementById("settings-profile-device-limit"),
  settingsProfileExpiry: document.getElementById("settings-profile-expiry"),
  subscriptionCard: document.getElementById("subscription-card"),
  subscriptionPlan: document.getElementById("subscription-plan"),
  subscriptionStatus: document.getElementById("subscription-status"),
  subscriptionRenewal: document.getElementById("subscription-renewal"),
  subscriptionManageBtn: document.getElementById("subscription-manage-btn"),
  subscriptionUpgradeLink: document.getElementById("subscription-upgrade-link"),
  subscriptionOpenDashboardLink: document.getElementById("subscription-open-dashboard-link"),
  settingsOpenDashboardLink: document.getElementById("settings-open-dashboard-link"),
  settingsLogout: document.getElementById("settings-logout"),
  uptimeDisplay: document.getElementById("uptime-display"),
  previewModal: document.getElementById("preview-modal"),
  closePreviewModal: document.getElementById("close-preview-modal"),
  previewTitle: document.getElementById("preview-title"),
  previewBody: document.getElementById("preview-body"),
  activationBlock: document.getElementById("activation-block"),
  activationEmail: document.getElementById("activation-email"),
  activationPassword: document.getElementById("activation-password"),
  activationRegister: document.getElementById("activation-register"),
  activationLogin: document.getElementById("activation-login"),
  activationActivate: document.getElementById("activation-activate"),
  activationSigninWeb: document.getElementById("activation-signin-web"),
  activationMessage: document.getElementById("activation-message"),
  activationUpgradeWrap: document.getElementById("activation-upgrade-wrap"),
  activationUpgradeLink: document.getElementById("activation-upgrade-link"),
  supportMessages: document.getElementById("support-messages"),
  supportMessageInput: document.getElementById("support-message-input"),
  supportSend: document.getElementById("support-send"),
  uploadBanner: document.getElementById("upload-banner"),
  uploadBannerText: document.querySelector(".upload-banner-text"),
  uploadBannerDismiss: document.querySelector(".upload-banner-dismiss"),
  shareQrModal: document.getElementById("share-qr-modal"),
  closeShareQrModal: document.getElementById("close-share-qr-modal"),
  technicalConfigContent: document.getElementById("technical-config-content"),
  mdnsHostname: document.getElementById("mdns-hostname"),
  mdnsIpFallback: document.getElementById("mdns-ip-fallback"),
  mdnsStatusBadge: document.getElementById("mdns-status-badge"),
  mdnsOpenBtn: document.getElementById("mdns-open-btn"),
  manualConnectIp: document.getElementById("manual-connect-ip"),
  manualConnectPort: document.getElementById("manual-connect-port"),
  manualConnectBtn: document.getElementById("manual-connect-btn"),
  manualConnectStatus: document.getElementById("manual-connect-status"),
};

const stateMeta = {
  lanBaseUrl: window.location.origin,
  cloudUrl: window.location.origin,
  shareLinkUrls: { ip: "" },
  lastNetworkChangedAt: 0,
  mdnsUnresolvableToastShown: false,
  fingerprint: getOrCreateFingerprint(),
  sessionToken: localStorage.getItem("joincloud:session-token") || "",
  privacyPolicyRaw: "",
  buildId: "",
  lastPendingCount: 0,
  lastNetworkHash: "",
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

function updateHeaderProfile() {
  if (!els.headerDisplayName) return;
  if (state.accountEmail && state.accountEmail.trim()) {
    els.headerDisplayName.textContent = state.accountEmail.trim();
    els.headerDisplayName.title = "Signed in as " + state.accountEmail.trim();
  } else {
    const name = (state.displayName && state.displayName.trim()) ? state.displayName.trim() : "Join";
    els.headerDisplayName.textContent = name;
    els.headerDisplayName.title = state.accountId ? "Account: " + (state.accountId || "").slice(0, 16) + "…" : "";
  }
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
  if (els.activationGate) els.activationGate.style.display = "none";
  els.accessGate.style.display = "grid";
  els.accessStatus.textContent = statusText || "Waiting to request access.";
  state.accessRole = "pending";
  updateAdminUi();
}

function showActivationGate() {
  els.accessGate.style.display = "none";
  els.appLayout.style.display = "none";
  if (els.activationGate) els.activationGate.style.display = "grid";
  setActivationGateMessage("");
  var webUrl = window.__JOINCLOUD_WEB_URL__ || "https://joincloud.com";
  var deviceId = state.hostUuidFromConfig || state.deviceId || "";
  var accountId = state.accountId || "";
  var billingParams = new URLSearchParams();
  if (accountId) billingParams.set("accountId", accountId);
  if (deviceId) billingParams.set("deviceId", deviceId);
  var billingUrl = billingParams.toString() ? `${webUrl}/billing?${billingParams.toString()}` : (state.upgradeUrl || `${webUrl}/billing`);
  if (els.activationGateUpgradeWrap) {
    els.activationGateUpgradeWrap.style.display = "block";
    if (els.activationGateUpgradeLink) els.activationGateUpgradeLink.href = billingUrl;
  }
}

function setActivationGateMessage(text, isError) {
  if (!els.activationGateMessage) return;
  els.activationGateMessage.textContent = text || "";
  els.activationGateMessage.style.color = isError ? "#ef4444" : "";
}

function showMainApp() {
  els.accessGate.style.display = "none";
  if (els.activationGate) els.activationGate.style.display = "none";
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
    const details = item.type === "folder" ? "Folder" : `${fileExt || "file"} · ${formatBytes(item.size)}`;

    const topRow = document.createElement("div");
    topRow.className = "file-item-top";
    const titleEl = document.createElement("span");
    titleEl.className = "item-title";
    titleEl.textContent = item.name;
    titleEl.title = item.name;
    topRow.innerHTML = `<span class="file-icon">${getFileIcon(item)}</span>`;
    topRow.appendChild(titleEl);

    const actions = document.createElement("div");
    actions.className = "file-item-actions";

    if (item.type === "folder") {
      const openBtn = document.createElement("button");
      openBtn.className = "button secondary";
      openBtn.textContent = "Open";
      openBtn.onclick = () => loadFiles(item.path);
      actions.appendChild(openBtn);
      if (isHostRole()) {
        const shareBtn = document.createElement("button");
        shareBtn.className = "button secondary";
        shareBtn.textContent = "Share";
        shareBtn.onclick = () => openShareModal(item.path);
        actions.appendChild(shareBtn);
      }
    } else {
      if (isHostRole()) {
        const shareBtn = document.createElement("button");
        shareBtn.className = "button secondary";
        shareBtn.textContent = "Share";
        shareBtn.onclick = () => openShareModal(item.path);
        actions.appendChild(shareBtn);
      }
      if (isPreviewableName(item.name)) {
        const previewBtn = document.createElement("button");
        previewBtn.className = "button secondary";
        previewBtn.textContent = "Preview";
        previewBtn.onclick = () => openPreviewModal(item);
        actions.appendChild(previewBtn);
      }
    }

    topRow.appendChild(actions);
    row.appendChild(topRow);

    const detailsRow = document.createElement("div");
    detailsRow.className = "file-item-details";
    detailsRow.innerHTML = `<span class="item-sub">${details}</span>`;
    row.appendChild(detailsRow);

    if (isHostRole()) {
      const bottomRow = document.createElement("div");
      bottomRow.className = "file-item-bottom";
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "button danger button-icon-only";
      deleteBtn.title = "Delete";
      deleteBtn.setAttribute("aria-label", "Delete");
      deleteBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';
      deleteBtn.onclick = () => confirmDeleteItem(item);
      bottomRow.appendChild(deleteBtn);
      row.appendChild(bottomRow);
    }

    if (item.type === "folder" && isHostRole()) {
      const shareButton = document.createElement("button");
      shareButton.className = "button";
      shareButton.textContent = "Share";
      shareButton.onclick = () => openShareModal(item.path);
      row.appendChild(shareButton);
    }
    if (isHostRole()) {
      const deleteButton = document.createElement("button");
      deleteButton.className = "button secondary";
      deleteButton.textContent = "Delete";
      deleteButton.onclick = async () => {
        const label = item.type === "folder" ? "folder" : "file";
        if (!confirm(`Delete this ${label} "${item.name}"? This cannot be undone.`)) return;
        try {
          const res = await apiFetch(`/api/v1/file?path=${encodeURIComponent(item.path)}`, { method: "DELETE" });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            alert(data.error || "Delete failed.");
            return;
          }
          await loadFiles(state.path);
        } catch (_) {
          alert("Delete failed.");
        }
      };
      row.appendChild(deleteButton);
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
    const shareUrl = share.urlIp || share.url || `${stateMeta.lanBaseUrl}/share/${share.shareId}`;
    row.innerHTML = `
      <div style="flex:1;min-width:0">
        <div class="item-title">${escapeHtml(share.path)}</div>
        <div class="item-sub">${share.permission} · expires ${new Date(share.expiresAt).toLocaleString()}</div>
        <div class="share-link-box" style="margin-top:8px;padding:8px 10px;border:1px solid var(--stroke);border-radius:6px;background:var(--bg);font-size:12px;font-family:ui-monospace,monospace;word-break:break-all">${escapeHtml(shareUrl)}</div>
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
    const qrBtn = document.createElement("button");
    qrBtn.className = "button secondary";
    qrBtn.textContent = "QR";
    qrBtn.onclick = () => showShareQrModal(shareUrl);
    row.appendChild(qrBtn);

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

function showShareQrModal(url) {
  if (!window.QRious || !els.shareQrModal) return;
  const canvas = document.getElementById("share-qr-canvas");
  const urlEl = document.getElementById("share-qr-url");
  if (!canvas || !urlEl) return;
  canvas.width = 220;
  canvas.height = 220;
  new window.QRious({
    element: canvas,
    value: url || "",
    size: 220,
    level: "M",
    background: "white",
    foreground: "#000000",
  });
  urlEl.textContent = url || "";
  els.shareQrModal.classList.add("active");
}

function closeShareQrModal() {
  if (els.shareQrModal) els.shareQrModal.classList.remove("active");
}

async function confirmDeleteItem(item) {
  const name = item.name || item.path || "item";
  const typeLabel = item.type === "folder" ? "folder" : "file";
  const msg = item.type === "folder"
    ? `Permanently delete the folder "${name}" and all its contents?`
    : `Permanently delete "${name}"?`;
  if (!confirm(msg)) return;
  try {
    const res = await apiFetch(`/api/v1/file?path=${encodeURIComponent(item.path)}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Delete failed");
    }
    await loadFiles(state.path);
    await loadLogs();
  } catch (err) {
    alert(err.message || "Delete failed");
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

function formatUptime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}H ${m}M`;
  if (m > 0) return `${m}M`;
  return `${seconds}S`;
}

async function loadBuildInfo() {
  try {
    const [buildRes, diagRes] = await Promise.all([
      fetch("/api/v1/build"),
      fetch("/api/v1/diagnostics/info", {}).catch(() => null),
    ]);
    if (buildRes.ok) {
      const data = await buildRes.json();
      stateMeta.buildId = String(data.build_id || "");
      if (els.buildId) {
        els.buildId.textContent = `Build ${stateMeta.buildId || "unknown"}`;
      }
    }
    if (diagRes?.ok && els.uptimeDisplay) {
      const diag = await diagRes.json();
      const sec = Number(diag.uptime_seconds) || 0;
      if (sec > 0) els.uptimeDisplay.textContent = `Uptime: ${formatUptime(sec)}`;
    }
  } catch (_error) {
    if (els.buildId) els.buildId.textContent = "BUILD: unavailable";
  }
}

async function loadControlPlaneConfig() {
  try {
    const res = await fetch("/api/v1/control-plane-config");
    if (!res.ok) return;
    const data = await res.json();
    state.licenseState = data.license?.state || null;
    state.licenseGraceEndsAt = data.license?.grace_ends_at ?? null;
    state.licenseTier = data.license?.tier ?? null;
    state.licenseExpiresAt = data.license?.expires_at ?? null;
    state.licenseDeviceLimit = data.license?.device_limit ?? null;
    state.activationRequired = data.activation?.required === true;
    state.upgradeUrl = data.upgrade_url || "";
    state.subscription = data.subscription || null;
    if (data.web_url) window.__JOINCLOUD_WEB_URL__ = data.web_url;
    if (data.account_id) state.accountId = data.account_id;
    if (data.host_uuid) state.hostUuidFromConfig = data.host_uuid;
    if (data.account_email) state.accountEmail = data.account_email;
    updateGraceBanner();
    updateSubscriptionSection();
    updateHeaderProfile();
  } catch (_) {}
}

function updateGraceBanner() {
  if (!els.graceBanner) return;
  var bannerText = document.getElementById("grace-banner-text");
  var bannerUpgrade = document.getElementById("grace-banner-upgrade");

  if (state.licenseState === "grace" && state.licenseGraceEndsAt) {
    els.graceBanner.style.display = "block";
    var d = new Date(state.licenseGraceEndsAt * 1000);
    if (els.graceEndsDate) els.graceEndsDate.textContent = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    if (bannerText) bannerText.innerHTML = "Payment issue \u2013 please update your payment method. Full access until <span id=\"grace-ends-date\">" + d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) + "</span>.";
    if (bannerUpgrade) bannerUpgrade.style.display = "none";
    return;
  }

  if (state.licenseState === "trial_active" && state.licenseExpiresAt) {
    var now = Math.floor(Date.now() / 1000);
    var remaining = state.licenseExpiresAt - now;
    var daysLeft = Math.ceil(remaining / 86400);
    if (daysLeft <= 3 && daysLeft > 0) {
      els.graceBanner.style.display = "block";
      if (bannerText) bannerText.textContent = "Your free trial expires in " + daysLeft + " day" + (daysLeft !== 1 ? "s" : "") + ". Upgrade to keep using JoinCloud.";
      if (bannerUpgrade) {
        bannerUpgrade.style.display = "inline";
        var webUrl = window.__JOINCLOUD_WEB_URL__ || "https://joincloud.com";
        var params = new URLSearchParams();
        if (state.accountId) params.set("accountId", state.accountId);
        if (state.hostUuidFromConfig || state.deviceId) params.set("deviceId", state.hostUuidFromConfig || state.deviceId);
        bannerUpgrade.href = webUrl + "/billing?" + params.toString();
      }
      return;
    }
  }

  if (state.licenseState === "expired") {
    els.graceBanner.style.display = "block";
    if (bannerText) bannerText.textContent = "Your plan has expired. Upgrade to restore full access.";
    if (bannerUpgrade) {
      bannerUpgrade.style.display = "inline";
      var webUrl2 = window.__JOINCLOUD_WEB_URL__ || "https://joincloud.com";
      var params2 = new URLSearchParams();
      if (state.accountId) params2.set("accountId", state.accountId);
      if (state.hostUuidFromConfig || state.deviceId) params2.set("deviceId", state.hostUuidFromConfig || state.deviceId);
      bannerUpgrade.href = webUrl2 + "/billing?" + params2.toString();
    }
    return;
  }

  els.graceBanner.style.display = "none";
}

function updateSubscriptionSection() {
  const hasLicense = state.licenseState && state.licenseState !== "UNREGISTERED";

  // Populate the richer profile card in Settings
  if (els.settingsProfileCard) {
    if (hasLicense) {
      els.settingsProfileCard.style.display = "block";
      const emailDisplay = (state.accountEmail && state.accountEmail.trim())
        ? state.accountEmail.trim()
        : (state.accountId ? "Account: " + state.accountId.slice(0, 16) + "…" : "Device account");
      if (els.settingsProfileEmail) els.settingsProfileEmail.textContent = emailDisplay;

      const planDisplay = (state.licenseTier || "trial").replace(/^./, (c) => c.toUpperCase());
      if (els.settingsProfilePlan) els.settingsProfilePlan.textContent = planDisplay;

      const rawStatus = state.licenseState || "—";
      const statusDisplay = String(rawStatus).replace(/_/g, " ");
      if (els.settingsProfileStatus) {
        els.settingsProfileStatus.textContent = statusDisplay;
        els.settingsProfileStatus.className = "settings-profile-badge " + (
          rawStatus === "active" ? "badge-active" :
          rawStatus === "trial_active" ? "badge-trial" :
          rawStatus === "grace" ? "badge-grace" : "badge-expired"
        );
      }

      const limit = state.licenseDeviceLimit;
      if (els.settingsProfileDeviceLimit) {
        els.settingsProfileDeviceLimit.textContent = limit ? `${limit} device${limit !== 1 ? "s" : ""}` : "—";
      }

      let expiryDisplay = "—";
      if (state.licenseExpiresAt) {
        try {
          const d = new Date(state.licenseExpiresAt * 1000);
          expiryDisplay = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
        } catch (_) {}
      }
      if (els.settingsProfileExpiry) els.settingsProfileExpiry.textContent = expiryDisplay;
    } else {
      els.settingsProfileCard.style.display = "none";
    }
  }

  // Legacy single-row profile — hide when the rich card is shown
  if (els.settingsProfileRow && els.settingsProfileValue) {
    if (hasLicense && !els.settingsProfileCard) {
      els.settingsProfileRow.style.display = "block";
      if (state.accountEmail && state.accountEmail.trim()) {
        els.settingsProfileValue.textContent = "Signed in as " + state.accountEmail.trim();
      } else {
        const id = (state.accountId || state.hostUuidFromConfig || state.deviceId || "").slice(0, 24);
        els.settingsProfileValue.textContent = id ? "Account: " + id + "…" : "Device account";
      }
    } else {
      els.settingsProfileRow.style.display = "none";
    }
  }

  if (!els.subscriptionCard) return;
  if (!hasLicense) {
    els.subscriptionCard.style.display = "none";
    return;
  }
  els.subscriptionCard.style.display = "block";
  const plan = (state.licenseTier || "trial").replace(/^./, (c) => c.toUpperCase());
  if (els.subscriptionPlan) els.subscriptionPlan.textContent = plan;
  const status = state.subscription?.status || state.licenseState || "—";
  if (els.subscriptionStatus) els.subscriptionStatus.textContent = String(status).replace(/_/g, " ");
  let renewalText = "—";
  if (state.subscription?.renewal_at) {
    try {
      const r = state.subscription.renewal_at;
      const d = typeof r === "string" ? new Date(r) : new Date(r * 1000);
      renewalText = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch (_) {}
  } else if (state.licenseExpiresAt) {
    try {
      const d = new Date(state.licenseExpiresAt * 1000);
      renewalText = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) + " (expires)";
    } catch (_) {}
  }
  if (els.subscriptionRenewal) els.subscriptionRenewal.textContent = renewalText;
  const showManage = !!(state.subscription && (state.subscription.status === "active" || state.subscription.status === "trialing" || state.subscription.status === "past_due"));
  if (els.subscriptionManageBtn) {
    els.subscriptionManageBtn.style.display = showManage ? "inline-flex" : "none";
  }
  const webUrlSub = window.__JOINCLOUD_WEB_URL__ || "https://joincloud.com";
  const accountIdSub = state.accountId || "";
  const deviceIdSub = state.hostUuidFromConfig || state.deviceId || "";
  const billingParamsSub = new URLSearchParams();
  if (accountIdSub) billingParamsSub.set("accountId", accountIdSub);
  if (deviceIdSub) billingParamsSub.set("deviceId", deviceIdSub);
  const billingQuerySub = billingParamsSub.toString() ? `?${billingParamsSub.toString()}` : "";
  const billingWebUrlSub = `${webUrlSub}/billing${billingQuerySub}`;
  const showUpgrade = !!(state.licenseTier === "trial" || !state.subscription?.status);
  if (els.subscriptionUpgradeLink) {
    els.subscriptionUpgradeLink.style.display = showUpgrade ? "inline" : "none";
    els.subscriptionUpgradeLink.href = accountIdSub ? billingWebUrlSub : (state.upgradeUrl || billingWebUrlSub);
    els.subscriptionUpgradeLink.target = "_blank";
    els.subscriptionUpgradeLink.rel = "noopener noreferrer";
  }
  const webUrl = window.__JOINCLOUD_WEB_URL__ || "https://joincloud.com";
  const accountIdSub2 = state.accountId || "";
  const deviceIdSub2 = state.hostUuidFromConfig || state.deviceId || "";
  const dashboardParams = new URLSearchParams();
  if (accountIdSub2) dashboardParams.set("accountId", accountIdSub2);
  if (deviceIdSub2) dashboardParams.set("deviceId", deviceIdSub2);
  const dashboardUrl = `${webUrl}/dashboard${dashboardParams.toString() ? "?" + dashboardParams.toString() : ""}`;
  if (els.subscriptionOpenDashboardLink) {
    els.subscriptionOpenDashboardLink.style.display = hasLicense ? "inline" : "none";
    els.subscriptionOpenDashboardLink.href = dashboardUrl;
    els.subscriptionOpenDashboardLink.target = "_blank";
    els.subscriptionOpenDashboardLink.rel = "noopener noreferrer";
  }
  if (els.settingsOpenDashboardLink) {
    els.settingsOpenDashboardLink.href = dashboardUrl;
    els.settingsOpenDashboardLink.target = "_blank";
    els.settingsOpenDashboardLink.rel = "noopener noreferrer";
  }
}

async function openBillingPortal() {
  const btn = els.subscriptionManageBtn;
  if (btn) btn.disabled = true;
  try {
    const returnUrl = window.location.origin + window.location.pathname;
    const res = await apiFetch("/api/v1/billing/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ return_url: returnUrl }),
    });
    const data = await res.json();
    if (res.ok && data.url) {
      window.open(data.url, "_blank", "noopener,noreferrer");
    } else {
      const msg = data.message || "Could not open billing portal";
      if (els.activationMessage) {
        els.activationMessage.textContent = msg;
        els.activationMessage.style.color = "#c00";
      }
    }
  } catch (_) {
    if (els.activationMessage) {
      els.activationMessage.textContent = "Network error. Try again.";
      els.activationMessage.style.color = "#c00";
    }
  }
  if (els.subscriptionManageBtn) els.subscriptionManageBtn.disabled = false;
}

function canAddDeviceOrCreateShare() {
  if (state.activationRequired || state.licenseState === "UNREGISTERED") return false;
  if (state.licenseState === "expired" || state.licenseState === "revoked") return false;
  return true;
}

function showNetworkToast() {
  const banner = document.getElementById("upload-banner");
  if (!banner) return;
  const textEl = banner.querySelector(".upload-banner-text");
  if (!textEl) return;
  banner.className = "upload-banner upload-banner-loading";
  banner.classList.remove("upload-banner-hidden");
  textEl.textContent = "Network changed — share links updated.";
  setTimeout(() => {
    banner.classList.add("upload-banner-hidden");
  }, 3000);
}

async function fetchStatus() {
  const res = await apiFetch("/api/status");
  const data = await res.json();
  const running = data.status === "running";
  updateHeaderStatus(running);
  els.storageLabel.textContent = data.storageLabel || "Local storage";
  els.ownerMount.textContent = data.ownerBasePath;
  if (data.lanBaseUrl) stateMeta.lanBaseUrl = data.lanBaseUrl;
  await loadControlPlaneConfig();
  if (data.shareLinkUrls) stateMeta.shareLinkUrls = data.shareLinkUrls;
  const networkHash = data.lanBaseUrl || "";
  if (stateMeta.lastNetworkHash && stateMeta.lastNetworkHash !== networkHash) {
    showNetworkToast();
  }
  if (data.network_changed_at && data.network_changed_at !== stateMeta.lastNetworkChangedAt) {
    stateMeta.lastNetworkChangedAt = data.network_changed_at;
    showNetworkToast();
  }
  stateMeta.lastNetworkHash = networkHash;
  if (els.mdnsHostname) els.mdnsHostname.textContent = data.mdns_hostname || "--";
  if (els.mdnsIpFallback) {
    const port = data.port || (data.lanBaseUrl && data.lanBaseUrl.match(/:(\d+)/)?.[1]) || "8787";
    els.mdnsIpFallback.textContent = data.bestLanIp ? `IP fallback: ${data.bestLanIp}:${port}` : "--";
  }
  if (els.mdnsStatusBadge) {
    const resolvable = !!data.mdns_resolvable;
    els.mdnsStatusBadge.textContent = running ? (resolvable ? "Resolvable" : "IP fallback") : "Inactive";
    els.mdnsStatusBadge.className = "badge " + (running ? (resolvable ? "badge-active" : "badge-private") : "badge-private");
    els.mdnsStatusBadge.title = resolvable ? "mDNS hostname resolves" : "mDNS hostname not resolvable; use IP fallback";
  }
  if (els.mdnsOpenBtn) {
    const port = data.port || "8787";
    const resolvable = !!data.mdns_resolvable;
    const openUrl = resolvable && data.mdns_hostname
      ? `http://${data.mdns_hostname}:${port}/`
      : data.lanBaseUrl || (data.bestLanIp ? `http://${data.bestLanIp}:${port}/` : null);
    els.mdnsOpenBtn.href = openUrl || "#";
    els.mdnsOpenBtn.style.display = openUrl && running ? "" : "none";
  }
  if (running && !data.mdns_resolvable && !stateMeta.mdnsUnresolvableToastShown) {
    stateMeta.mdnsUnresolvableToastShown = true;
    showUploadBanner("mDNS hostname not resolvable; using IP fallback.", "loading");
    setTimeout(() => hideUploadBanner(), 3000);
  }
  if (els.uptimeDisplay && Number.isFinite(data.uptime_seconds)) {
    els.uptimeDisplay.textContent = `Uptime: ${formatUptime(data.uptime_seconds)}`;
  }
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
  setRefreshLoading(els.refreshFiles, true);
  try {
    const res = await apiFetch(`/api/files?path=${encodeURIComponent(pathValue)}`);
    const data = await res.json();
    state.path = data.path;
    state.rawItems = Array.isArray(data.items) ? data.items : [];
    renderBreadcrumbs();
    renderFiles();
  } finally {
    setRefreshLoading(els.refreshFiles, false);
  }
}

async function loadShares() {
  setRefreshLoading(els.refreshShares, true);
  try {
    const res = await apiFetch("/api/shares");
    state.shares = await res.json();
    renderShares();
  } finally {
    setRefreshLoading(els.refreshShares, false);
  }
}

async function loadLogs() {
  setRefreshLoading(els.refreshLogs, true);
  try {
    const res = await apiFetch("/api/v1/logs");
    renderLogs(await res.json());
  } finally {
    setRefreshLoading(els.refreshLogs, false);
  }
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

async function loadTechnicalConfig() {
  if (!els.technicalConfigContent || !isHostRole()) return;
  try {
    const res = await apiFetch("/api/v1/technical-config");
    if (!res.ok) {
      els.technicalConfigContent.textContent = "Available on host only.";
      return;
    }
    const data = await res.json();
    const lines = [
      `Host ID: ${data.host_id || "-"}`,
      `Local IPs: ${(data.local_ips || []).join(", ") || "-"}`,
      `Port: ${data.port || "-"}`,
      `App version: ${data.app_version || "-"}`,
    ];
    els.technicalConfigContent.textContent = lines.join("\n");
  } catch (_err) {
    els.technicalConfigContent.textContent = "Failed to load.";
  }
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
  state.displayName = normalized;
  updateHeaderProfile();
  els.networkNameSuffix.value = displayNameToSuffix(normalized);
  const visibility = !!data.network_visibility;
  els.networkVisibility.checked = visibility;
  if (els.networkVisibilityNetwork) els.networkVisibilityNetwork.checked = visibility;
}

async function loadNetwork() {
  if (!els.networkList) return;
  try {
    const res = await apiFetch("/api/v1/network");
    const peers = await res.json();
    if (!peers.length) {
      els.networkList.innerHTML = '<div class="value value-muted">No peers discovered. Use Manual Connect if mDNS is unavailable.</div>';
      return;
    }
    els.networkList.innerHTML = "";
    peers.forEach((p) => {
      const row = document.createElement("div");
      row.className = "pending-item";
      const addr = p.bestIp ? `${p.bestIp}:${p.port || 8787}` : (p.hostname || "-");
      row.innerHTML = `
        <div class="pending-item-meta">
          <div class="item-title">${escapeHtml(p.display_name || "Unknown")}</div>
          <div class="item-sub mono">${escapeHtml(addr)}</div>
          <div class="item-sub">${p.hostname ? escapeHtml(p.hostname) + " · " : ""}${p.status || "online"} ${p.source === "manual" ? "(manual)" : ""}</div>
        </div>
      `;
      if (p.bestIp) {
        const openBtn = document.createElement("button");
        openBtn.className = "button secondary";
        openBtn.textContent = "Open";
        openBtn.onclick = () => window.open(`http://${p.bestIp}:${p.port || 8787}`, "_blank");
        row.appendChild(openBtn);
      }
      els.networkList.appendChild(row);
    });
  } catch (_) {
    els.networkList.innerHTML = '<div class="value value-muted">Failed to load peers.</div>';
  }
}

const stateTeams = { teams: [], invites: [], currentTeamId: null };

async function loadTeams() {
  if (!els.teamsList) return;
  try {
    const res = await apiFetch("/api/v1/teams");
    const data = await res.json();
    stateTeams.teams = data.teams || [];
    stateTeams.invites = data.invites || [];
    renderTeams();
  } catch (_) {
    els.teamsList.innerHTML = '<div class="value value-muted">Failed to load teams.</div>';
  }
}

function renderTeams() {
  if (!els.teamsList) return;
  if (stateTeams.currentTeamId) return;
  els.teamsList.style.display = "";
  if (els.teamDetail) els.teamDetail.style.display = "none";
  if (stateTeams.invites.length > 0) {
    const inviteHtml = stateTeams.invites.map((i) => {
      const teamName = i.teamName || stateTeams.teams.find((t) => t.teamId === i.teamId)?.teamName || "Unknown";
      return `<div class="pending-item"><span>Invite to ${escapeHtml(teamName)}</span><button class="button secondary accept-invite" data-invite-id="${escapeHtml(i.inviteId)}">Accept</button></div>`;
    }).join("");
    els.teamsList.innerHTML = `<div class="label">Pending Invites</div>${inviteHtml}<div class="label" style="margin-top:12px">Your Teams</div>`;
    els.teamsList.querySelectorAll(".accept-invite").forEach((btn) => {
      btn.onclick = async () => {
        await apiFetch(`/api/v1/teams/invites/${btn.dataset.inviteId}/accept`, { method: "POST" });
        await loadTeams();
      };
    });
  } else {
    els.teamsList.innerHTML = '<div class="label">Your Teams</div>';
  }
  if (!stateTeams.teams.length) {
    els.teamsList.innerHTML += '<div class="value value-muted">No teams yet. Create one to get started.</div>';
    return;
  }
  stateTeams.teams.forEach((t) => {
    const row = document.createElement("div");
    row.className = "pending-item";
    row.innerHTML = `<div class="item-title">${escapeHtml(t.teamName)}</div><div class="item-sub">${t.members?.length || 0} members</div>`;
    const openBtn = document.createElement("button");
    openBtn.className = "button secondary";
    openBtn.textContent = "Open";
    openBtn.onclick = () => showTeamDetail(t.teamId);
    row.appendChild(openBtn);
    els.teamsList.appendChild(row);
  });
}

async function showTeamDetail(teamId) {
  stateTeams.currentTeamId = teamId;
  els.teamsList.style.display = "none";
  if (els.teamDetail) els.teamDetail.style.display = "block";
  const team = stateTeams.teams.find((t) => t.teamId === teamId);
  if (els.teamDetailName) els.teamDetailName.textContent = team?.teamName || "Team";
  await loadTeamMessages(teamId);
}

async function loadTeamMessages(teamId) {
  if (!els.teamChatFeed) return;
  try {
    const res = await apiFetch(`/api/v1/teams/${teamId}/messages`);
    const data = await res.json();
    const messages = data.messages || [];
    els.teamChatFeed.innerHTML = messages.map((m) => {
      const text = m.type === "text" ? (m.payload?.text || "") : m.type === "file" ? `[File: ${m.payload?.filename || "?"}]` : m.type === "note" ? `[Note: ${m.payload?.text || ""}]` : "";
      return `<div class="team-message"><span class="team-message-sender">${escapeHtml(m.senderDeviceId?.slice(0, 8) || "?")}</span>: ${escapeHtml(text)}</div>`;
    }).join("") || '<div class="value value-muted">No messages yet.</div>';
    els.teamChatFeed.scrollTop = els.teamChatFeed.scrollHeight;
  } catch (_) {
    els.teamChatFeed.innerHTML = '<div class="value value-muted">Failed to load messages.</div>';
  }
}

async function sendTeamMessage() {
  const teamId = stateTeams.currentTeamId;
  if (!teamId || !els.teamMessageInput) return;
  const text = els.teamMessageInput.value.trim();
  if (!text) return;
  els.teamMessageInput.value = "";
  try {
    await apiFetch("/api/v1/teams/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId, type: "text", payload: { text } }),
    });
    await loadTeamMessages(teamId);
  } catch (_) {}
}

async function inviteToTeam() {
  const teamId = stateTeams.currentTeamId;
  if (!teamId) return;
  const networkRes = await apiFetch("/api/v1/network").catch(() => ({ json: () => [] }));
  const peers = await (networkRes.ok ? networkRes.json() : []);
  const team = stateTeams.teams.find((t) => t.teamId === teamId);
  const existingIds = new Set(team?.members || []);
  const candidates = peers.filter((p) => p.deviceId && !existingIds.has(p.deviceId));
  if (!candidates.length) {
    alert("No peers available to invite. Discover devices in the Network tab first.");
    return;
  }
  const list = candidates.map((c, i) => `${i + 1}. ${c.display_name || c.displayName || c.deviceId} (${c.deviceId})`).join("\n");
  const choice = prompt(`Enter number or device ID to invite:\n${list}`);
  if (!choice) return;
  const num = parseInt(choice, 10);
  const peer = Number.isFinite(num) && num >= 1 && num <= candidates.length
    ? candidates[num - 1]
    : candidates.find((c) => c.deviceId === choice.trim() || (c.display_name || c.displayName) === choice.trim());
  if (!peer) {
    alert("Invalid selection.");
    return;
  }
  try {
    await apiFetch(`/api/v1/teams/${teamId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toDeviceId: peer.deviceId }),
    });
    alert("Invite sent to " + (peer.display_name || peer.displayName || peer.deviceId) + ".");
  } catch (e) {
    alert("Failed to send invite.");
  }
}

async function createTeam() {
  const name = prompt("Team name?", "My Team") || "My Team";
  try {
    await apiFetch("/api/v1/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamName: name }),
    });
    await loadTeams();
  } catch (_) {
    alert("Failed to create team.");
  }
}

async function manualConnect() {
  if (!els.manualConnectBtn || !els.manualConnectIp) return;
  const ip = els.manualConnectIp.value.trim();
  const port = parseInt(els.manualConnectPort?.value || "8787", 10) || 8787;
  if (!ip) {
    if (els.manualConnectStatus) els.manualConnectStatus.textContent = "Enter IP address.";
    return;
  }
  els.manualConnectBtn.disabled = true;
  if (els.manualConnectStatus) els.manualConnectStatus.textContent = "Connecting...";
  try {
    const res = await apiFetch("/api/v1/network/manual-connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ip, port }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      if (els.manualConnectStatus) els.manualConnectStatus.textContent = `Added ${data.displayName || data.deviceId}.`;
      await loadNetwork();
    } else {
      if (els.manualConnectStatus) els.manualConnectStatus.textContent = data.message || data.error || "Connection failed.";
    }
  } catch (_) {
    if (els.manualConnectStatus) els.manualConnectStatus.textContent = "Connection failed.";
  } finally {
    els.manualConnectBtn.disabled = false;
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
  state.displayName = savedName;
  updateHeaderProfile();
  els.networkNameSuffix.value = displayNameToSuffix(savedName);
}

function openShareModal(pathValue) {
  els.shareResult.textContent = "";
  els.copyShare.style.display = "none";
  els.sharePath.value = pathValue;
  const needActivation = !canAddDeviceOrCreateShare();
  if (els.activationBlock) {
    els.activationBlock.style.display = needActivation ? "block" : "none";
  }
  if (els.activationMessage) els.activationMessage.textContent = "";
  const upgradeUrl = (state.upgradeUrl || "").trim();
  if (els.activationUpgradeWrap) {
    els.activationUpgradeWrap.style.display = needActivation && upgradeUrl ? "block" : "none";
  }
  if (els.activationUpgradeLink && upgradeUrl) {
    els.activationUpgradeLink.href = upgradeUrl;
  }
  els.shareModal.classList.add("active");
}

function closeShareModal() {
  els.shareModal.classList.remove("active");
}

function setActivationMessage(msg, isError) {
  if (!els.activationMessage) return;
  els.activationMessage.textContent = msg || "";
  els.activationMessage.style.color = isError ? "#c00" : "";
}

async function activationRegister() {
  const email = (els.activationEmail && els.activationEmail.value || "").trim();
  const password = els.activationPassword && els.activationPassword.value;
  if (!email || !password) {
    setActivationMessage("Enter email and password.", true);
    return;
  }
  setActivationMessage("Registering…");
  try {
    const res = await apiFetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setActivationMessage(data.message || "Registration failed", true);
      return;
    }
    setActivationMessage("Registered. Sign in on the web to link this device.");
  } catch (e) {
    setActivationMessage("Network error. Try again.", true);
  }
}

async function activationLogin() {
  const email = (els.activationEmail && els.activationEmail.value || "").trim();
  const password = els.activationPassword && els.activationPassword.value;
  if (!email || !password) {
    setActivationMessage("Enter email and password.", true);
    return;
  }
  setActivationMessage("Logging in…");
  try {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setActivationMessage(data.message || "Login failed", true);
      return;
    }
    setActivationMessage("Logged in. Sign in on the web to link this device.");
  } catch (e) {
    setActivationMessage("Network error. Try again.", true);
  }
}

async function activationActivate() {
  setActivationMessage("Activating…");
  try {
    const res = await apiFetch("/api/license/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setActivationMessage(data.message || "Activation failed", true);
      return;
    }
    setActivationMessage("Device activated. You can create shares now.");
    await loadControlPlaneConfig();
    if (els.activationBlock) els.activationBlock.style.display = "none";
  } catch (e) {
    setActivationMessage("Network error. Try again.", true);
  }
}

async function createShare() {
  if (!canAddDeviceOrCreateShare()) {
    if (els.shareResult) {
      els.shareResult.textContent = state.activationRequired || state.licenseState === "UNREGISTERED"
        ? "Activate your account to create shares. You can still browse and use existing shares."
        : "License expired. You can still use existing shares and LAN transfer.";
    }
    return;
  }
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
  const shareUrl = data.urlIp || data.url || `${stateMeta.lanBaseUrl}/share/${data.shareId}`;
  els.shareResult.innerHTML = `
    <div>Share created.</div>
    <div class="share-link-box" style="margin-top:10px;padding:12px;border:1px solid var(--stroke);border-radius:8px;background:var(--bg);word-break:break-all;font-size:13px;font-family:ui-monospace,monospace">${shareUrl}</div>
  `;
  els.copyShare.style.display = "inline-flex";
  els.copyShare.onclick = async () => {
    const ok = await copyToClipboard(shareUrl);
    if (ok) {
      els.copyShare.textContent = "Copied!";
      setTimeout(() => (els.copyShare.textContent = "Copy Link"), 2000);
    } else {
      showCopyFallback(shareUrl, els.shareResult);
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
  const fileList = Array.from(files);
  const count = fileList.length;
  const label = count === 1 ? fileList[0].name : `${count} files`;
  showUploadBanner(`Uploading ${label}...`, "loading");

  const formData = new FormData();
  fileList.forEach((file) => formData.append("files", file));
  const uploadPath = state.path;
  formData.append("path", uploadPath);

  try {
    const res = await apiFetch("/api/upload", { method: "POST", body: formData });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const reason = payload.error || "Upload failed.";
      showUploadBanner(reason, "error");
      if (els.uploadScopeHint) {
        els.uploadScopeHint.textContent = reason;
      }
      return;
    }
    const savedTo = String(payload.saved_to || uploadPath || "/");
    showUploadBanner("Upload complete", "success");
    setTimeout(hideUploadBanner, 2500);
    await loadFiles(savedTo);
    await loadLogs();
  } catch (err) {
    showUploadBanner(err.message || "Upload failed", "error");
    if (els.uploadScopeHint) {
      els.uploadScopeHint.textContent = err.message || "Upload failed";
    }
  }
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
    const canApprove = canAddDeviceOrCreateShare();
    approveBtn.disabled = !canApprove;
    approveBtn.textContent = canApprove ? "Approve" : (state.licenseState === "expired" ? "License expired" : "Activate required");
    approveBtn.onclick = async () => {
      if (!canAddDeviceOrCreateShare()) return;
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
  setRefreshLoading(els.refreshDevices, true);
  try {
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
  } finally {
    setRefreshLoading(els.refreshDevices, false);
  }
}

async function loadActivitySummary() {
  if (!state.isAdmin) {
    if (els.activitySummary) els.activitySummary.textContent = "Host-only dashboard.";
    return;
  }
  setRefreshLoading(els.refreshActivity, true);
  try {
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
  } finally {
    setRefreshLoading(els.refreshActivity, false);
  }
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

async function loadSupportMessages() {
  try {
    const res = await apiFetch("/api/support/messages");
    const data = await res.json().catch(() => ({}));
    state.supportMessages = Array.isArray(data.messages) ? data.messages : [];
    renderSupportMessages();
  } catch (_) {
    state.supportMessages = [];
    renderSupportMessages();
  }
}

function renderSupportMessages() {
  if (!els.supportMessages) return;
  const list = state.supportMessages || [];
  els.supportMessages.innerHTML = list.length === 0
    ? "<div class=\"value value-muted\">No messages yet. Send a message to start the conversation.</div>"
    : list.map((m) => {
        const isDevice = (m.sender || "").toLowerCase() === "device";
        const label = isDevice ? "You" : "Support";
        const cls = isDevice ? "support-message device" : "support-message admin";
        const time = m.timestamp ? new Date(m.timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "";
        return `<div class="${cls}"><span class="value value-muted" style="font-size:11px">${label} ${time}</span><br/>${escapeHtml(m.text || "")}</div>`;
      }).join("");
  els.supportMessages.scrollTop = els.supportMessages.scrollHeight;
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

async function sendSupportMessage() {
  if (!els.supportMessageInput) return;
  const text = (els.supportMessageInput.value || "").trim();
  if (!text) return;
  try {
    const res = await apiFetch("/api/support/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.message || "Failed to send message.");
      return;
    }
    els.supportMessageInput.value = "";
    await loadSupportMessages();
  } catch (_) {
    alert("Network error. Try again.");
  }
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
  await loadAccessMe();
  updateAdminUi();
  await loadBuildInfo();
  await fetchStatus();

  var needsActivation = state.activationRequired || state.licenseState === "UNREGISTERED";
  if (needsActivation) {
    showActivationGate();
    return;
  }

  showMainApp();
  await loadRuntimeStatus();
  await loadCloudUrl();
  await loadFiles("/");
  await loadShares();
  await loadLogs();
  await loadNetwork();
  await loadTelemetrySettings();
  await loadNetworkSettings();
  await loadTechnicalConfig();
  await loadPrivacyPolicy();
  await loadPendingAccessRequests();
  await loadApprovedDevices();
  await loadShareVisitSummary();
  await loadActivitySummary();

  const initial = window.location.hash.replace("#", "") || "home";
  setActiveSection(initial);

  setInterval(() => {
    if (document.querySelector(".section.active")?.dataset.section === "support") loadSupportMessages();
  }, 8000);
}

async function continueBootstrapAfterActivation() {
  showMainApp();
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
  setInterval(() => {
    if (document.querySelector(".section.active")?.dataset.section === "support") loadSupportMessages();
  }, 8000);
}

function setActiveSection(sectionId) {
  const adminOnly = new Set(["devices", "activity"]);
  const safeSection = !state.isAdmin && adminOnly.has(sectionId) ? "home" : sectionId;
  if (window.location.hash !== `#${safeSection}`) window.location.hash = safeSection;
  els.sections.forEach((section) => section.classList.toggle("active", section.dataset.section === safeSection));
  els.navButtons.forEach((button) => button.classList.toggle("active", button.dataset.section === safeSection));
  if (safeSection === "support") loadSupportMessages();
  if (safeSection === "network") loadNetwork();
  if (safeSection === "teams") loadTeams();
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

function showUploadBanner(text, type = "loading") {
  if (!els.uploadBanner || !els.uploadBannerText) return;
  els.uploadBanner.className = `upload-banner upload-banner-${type}`;
  els.uploadBanner.classList.remove("upload-banner-hidden");
  els.uploadBanner.setAttribute("aria-hidden", "false");
  els.uploadBannerText.textContent = text;
  if (els.uploadBannerDismiss) {
    els.uploadBannerDismiss.style.display = type === "loading" ? "none" : "inline-flex";
  }
}

function hideUploadBanner() {
  if (!els.uploadBanner) return;
  els.uploadBanner.classList.add("upload-banner-hidden");
  els.uploadBanner.setAttribute("aria-hidden", "true");
}

function setRefreshLoading(buttonEl, loading) {
  if (!buttonEl) return;
  if (loading) {
    buttonEl.classList.add("loading");
    buttonEl.disabled = true;
  } else {
    buttonEl.classList.remove("loading");
    buttonEl.disabled = false;
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
  if (window.innerWidth < 768) {
    document.body.classList.toggle("sidebar-open");
  } else {
    document.body.classList.toggle("sidebar-collapsed");
  }
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

if (els.manualConnectBtn) {
  els.manualConnectBtn.addEventListener("click", manualConnect);
}
if (els.createTeamBtn) {
  els.createTeamBtn.addEventListener("click", createTeam);
}
if (els.teamDetailBack) {
  els.teamDetailBack.addEventListener("click", () => {
    stateTeams.currentTeamId = null;
    loadTeams();
  });
}
if (els.teamSendBtn) {
  els.teamSendBtn.addEventListener("click", sendTeamMessage);
}
if (els.teamInviteBtn) {
  els.teamInviteBtn.addEventListener("click", inviteToTeam);
}
if (els.teamMessageInput) {
  els.teamMessageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendTeamMessage();
    }
  });
}
if (els.networkVisibility) {
  els.networkVisibility.addEventListener("change", async () => {
    await apiFetch("/api/v1/network/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ network_visibility: els.networkVisibility.checked }),
    });
    if (els.networkVisibilityNetwork) els.networkVisibilityNetwork.checked = els.networkVisibility.checked;
  });
}
if (els.networkVisibilityNetwork) {
  els.networkVisibilityNetwork.addEventListener("change", async () => {
    await apiFetch("/api/v1/network/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ network_visibility: els.networkVisibilityNetwork.checked }),
    });
    if (els.networkVisibility) els.networkVisibility.checked = els.networkVisibilityNetwork.checked;
  });
}

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
if (els.closeShareQrModal) {
  els.closeShareQrModal.addEventListener("click", closeShareQrModal);
}
if (els.shareQrModal) {
  els.shareQrModal.addEventListener("click", (event) => {
    if (event.target === els.shareQrModal) closeShareQrModal();
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
if (els.activationRegister) els.activationRegister.onclick = activationRegister;
if (els.activationLogin) els.activationLogin.onclick = activationLogin;
function getHostUuidForDesktopAuth() {
  // Use real host UUID from config; never use "host" (that's the session role from access/me)
  if (state.hostUuidFromConfig && state.hostUuidFromConfig.length >= 8 && state.hostUuidFromConfig.length <= 128) {
    return state.hostUuidFromConfig;
  }
  if (state.deviceId && state.deviceId !== "host" && state.deviceId.length >= 8) {
    return state.deviceId;
  }
  return "";
}
if (els.activationSigninWeb) {
  els.activationSigninWeb.onclick = () => {
    const hostUuid = getHostUuidForDesktopAuth();
    const webUrl = window.__JOINCLOUD_WEB_URL__ || "https://joincloud.com";
    const loginUrl = hostUuid ? `${webUrl}/auth/desktop?deviceId=${encodeURIComponent(hostUuid)}` : `${webUrl}/auth/desktop`;
    window.open(loginUrl, "_blank", "noopener,noreferrer");
  };
}
if (els.activationGateSigninWeb) {
  els.activationGateSigninWeb.onclick = () => {
    const hostUuid = getHostUuidForDesktopAuth();
    if (!hostUuid) {
      setActivationGateMessage("Loading device ID… Try again in a moment, or restart the app.");
      loadControlPlaneConfig().then(() => {
        const retry = getHostUuidForDesktopAuth();
        if (retry) {
          setActivationGateMessage("Opening browser — sign in or create an account…");
          const webUrl = window.__JOINCLOUD_WEB_URL__ || "https://joincloud.com";
          window.open(`${webUrl}/auth/desktop?deviceId=${encodeURIComponent(retry)}`, "_blank", "noopener,noreferrer");
        }
      });
      return;
    }
    const webUrl = window.__JOINCLOUD_WEB_URL__ || "https://joincloud.com";
    const loginUrl = `${webUrl}/auth/desktop?deviceId=${encodeURIComponent(hostUuid)}`;
    setActivationGateMessage("Opening browser — sign in or create an account…");
    window.open(loginUrl, "_blank", "noopener,noreferrer");
  };
}
if (typeof window !== "undefined" && window.joincloud && window.joincloud.onLicenseUpdated) {
  window.joincloud.onLicenseUpdated(async () => {
    await loadControlPlaneConfig();
    var hasLicense = state.licenseState && state.licenseState !== "UNREGISTERED";
    if (els.activationGate && els.activationGate.style.display !== "none" && hasLicense) {
      await continueBootstrapAfterActivation();
    } else {
      updateGraceBanner();
      updateSubscriptionSection();
      updateHeaderProfile();
      if (typeof updateBillingSection === "function") updateBillingSection();
    }
  });
}
if (els.subscriptionManageBtn) els.subscriptionManageBtn.onclick = openBillingPortal;
if (els.settingsLogout) {
  els.settingsLogout.onclick = async () => {
    try {
      const res = await apiFetch("/api/v1/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch (_) {
      // reload anyway to clear UI state
      window.location.reload();
    }
  };
}
if (els.supportSend) els.supportSend.onclick = sendSupportMessage;
if (els.supportMessageInput) {
  els.supportMessageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); sendSupportMessage(); }
  });
}
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
els.dropZone.addEventListener("drop", async (event) => {
  if (els.uploadInput?.disabled) return;
  event.preventDefault();
  els.dropZone.classList.remove("active");
  const items = event.dataTransfer?.items;
  if (items && items.length > 0) {
    const collected = await collectFilesFromItems(items);
    if (collected.length > 0) {
      uploadFilesWithPaths(collected);
      return;
    }
  }
  uploadFiles(event.dataTransfer.files);
});

async function collectFilesFromItems(items) {
  const result = [];
  const readDirEntries = (dirReader) =>
    new Promise((resolve, reject) => {
      const all = [];
      function read() {
        dirReader.readEntries(
          (entries) => {
            if (entries.length === 0) {
              resolve(all);
              return;
            }
            all.push(...entries);
            read();
          },
          (err) => (err ? reject(err) : resolve(all))
        );
      }
      read();
    });
  const readEntry = async (entry, basePath = "") => {
    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file(
          (file) => {
            const relPath = basePath ? `${basePath}/${file.name}` : file.name;
            result.push({ file, relativePath: relPath });
            resolve();
          },
          () => resolve()
        );
      });
    }
    if (entry.isDirectory) {
      const dirPath = basePath ? `${basePath}/${entry.name}` : entry.name;
      const entries = await readDirEntries(entry.createReader());
      for (const e of entries) {
        if (e.name.startsWith(".") || e.name.startsWith("._")) continue;
        await readEntry(e, dirPath);
      }
    }
  };
  for (let i = 0; i < items.length; i++) {
    const entry = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
    if (entry) await readEntry(entry);
  }
  return result;
}

async function uploadFilesWithPaths(items) {
  if (!items || items.length === 0) return;
  const label = items.length === 1 ? items[0].relativePath : `${items.length} files`;
  showUploadBanner(`Uploading ${label}...`, "loading");
  const formData = new FormData();
  formData.append("path", state.path);
  for (const { file, relativePath } of items) {
    formData.append("fileRelPath", relativePath);
    formData.append("files", file);
  }
  try {
    const res = await apiFetch("/api/upload", { method: "POST", body: formData });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const reason = payload.error || "Upload failed.";
      showUploadBanner(reason, "error");
      if (els.uploadScopeHint) els.uploadScopeHint.textContent = reason;
      return;
    }
    const savedTo = String(payload.saved_to || state.path || "/");
    showUploadBanner("Upload complete", "success");
    setTimeout(hideUploadBanner, 2500);
    await loadFiles(savedTo);
    await loadLogs();
  } catch (err) {
    showUploadBanner(err.message || "Upload failed", "error");
    if (els.uploadScopeHint) els.uploadScopeHint.textContent = err.message || "Upload failed";
  }
}
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

if (els.uploadBannerDismiss) {
  els.uploadBannerDismiss.addEventListener("click", hideUploadBanner);
}
if (els.accessDeviceNameInput) {
  els.accessDeviceNameInput.value = getSuggestedDeviceName();
}
els.accessFingerprint.textContent = stateMeta.fingerprint;
bootstrapApp();

setInterval(async () => {
  if (els.appLayout.style.display === "none") return;
  try {
    var prevTier = state.licenseTier;
    var prevState = state.licenseState;
    await loadControlPlaneConfig();
    if (state.licenseTier !== prevTier || state.licenseState !== prevState) {
      updateGraceBanner();
      updateSubscriptionSection();
      updateHeaderProfile();
    }
  } catch (_) {}
}, 60 * 1000);

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
