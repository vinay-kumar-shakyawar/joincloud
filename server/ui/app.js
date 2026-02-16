const state = {
  path: "/",
  items: [],
  shares: [],
};

const els = {
  status: document.getElementById("node-status"),
  headerDisplayName: document.getElementById("header-display-name"),
  storageLabel: document.getElementById("storage-label"),
  ownerMount: document.getElementById("owner-mount"),
  publicStatus: document.getElementById("public-status"),
  publicReason: document.getElementById("public-reason"),
  openStorage: document.getElementById("open-storage"),
  fileList: document.getElementById("file-list"),
  shareList: document.getElementById("share-list"),
  breadcrumbs: document.getElementById("breadcrumbs"),
  refreshFiles: document.getElementById("refresh-files"),
  refreshShares: document.getElementById("refresh-shares"),
  refreshLogs: document.getElementById("refresh-logs"),
  logList: document.getElementById("log-list"),
  networkList: document.getElementById("network-list"),
  telemetryToggle: document.getElementById("telemetry-toggle"),
  networkName: document.getElementById("network-name"),
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
  shareScope: document.getElementsByName("share-scope"),
  shareTtl: document.getElementById("share-ttl"),
  shareTtlCustom: document.getElementById("share-ttl-custom"),
  createShare: document.getElementById("create-share"),
  closeModal: document.getElementById("close-modal"),
  cancelShare: document.getElementById("cancel-share"),
  shareResult: document.getElementById("share-result"),
  copyShare: document.getElementById("copy-share"),
};

const stateMeta = {
  lanBaseUrl: window.location.origin,
};

function setHeaderDisplayName(value) {
  const displayName = value && value.trim() ? value.trim() : "User";
  els.headerDisplayName.textContent = displayName;
}

async function fetchStatus() {
  const res = await fetch("/api/status");
  const data = await res.json();
  els.status.textContent = `Status: ${data.status === "running" ? "Running" : data.status || "--"}`;
  els.storageLabel.textContent = data.storageLabel || "Local storage";
  els.ownerMount.textContent = data.ownerBasePath;
  if (data.lanBaseUrl) {
    stateMeta.lanBaseUrl = data.lanBaseUrl;
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
    const baseUrl =
      share.scope === "public"
        ? stateMeta.publicActive
          ? stateMeta.publicUrl
          : null
        : stateMeta.lanBaseUrl;
    const shareUrl = baseUrl ? `${baseUrl}/share/${share.shareId}` : null;
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
  const selectedScope = "local";
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
  const baseUrl = stateMeta.lanBaseUrl;
  const shareUrl = `${baseUrl}/share/${data.shareId}`;
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

els.refreshFiles.onclick = () => loadFiles(state.path);
els.refreshShares.onclick = () => loadShares();
els.closeModal.onclick = closeShareModal;
els.cancelShare.onclick = closeShareModal;
els.createShare.onclick = createShare;
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
els.openStorage.onclick = async () => {
  if (window.joincloud && window.joincloud.openStorageFolder) {
    await window.joincloud.openStorageFolder();
  } else {
    alert("Storage folder is available in the desktop app only.");
  }
};

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

function renderNetwork() {
  els.networkList.innerHTML = "";
  const emptyState = document.createElement("div");
  emptyState.className = "empty-state";
  emptyState.innerHTML = `
    <div class="empty-state-title">Coming Soon</div>
    <div class="empty-state-sub">Network discovery will be available in a future release.</div>
  `;
  els.networkList.appendChild(emptyState);
}

async function loadNetwork() {
  renderNetwork();
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
  const displayName = data.display_name || "";
  els.networkName.value = displayName;
  setHeaderDisplayName(displayName);

  // Launch build: keep network visibility disabled and non-interactive.
  if (data.network_visibility) {
    await fetch("/api/v1/network/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ network_visibility: false }),
    });
  }

  els.networkVisibility.checked = false;
  els.networkVisibility.disabled = true;
  if (els.networkVisibilityNetwork) {
    els.networkVisibilityNetwork.checked = false;
    els.networkVisibilityNetwork.disabled = true;
  }
}

async function saveNetworkName() {
  const value = els.networkName.value.trim();
  const res = await fetch("/api/v1/network/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ display_name: value }),
  });
  const data = await res.json();
  const displayName = data.display_name || "";
  els.networkName.value = displayName;
  setHeaderDisplayName(displayName);
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
loadLogs();
loadNetwork();
loadTelemetrySettings();
loadNetworkSettings();
const initial = window.location.hash.replace("#", "") || "home";
setActiveSection(initial);

setInterval(() => {
  loadLogs();
}, 10000);

els.telemetryToggle.addEventListener("change", async (event) => {
  await updateTelemetrySettings(event.target.checked);
});

els.saveNetworkName.addEventListener("click", async () => {
  await saveNetworkName();
});
