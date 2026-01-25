const state = {
  path: "/",
  items: [],
  shares: [],
};

const els = {
  status: document.getElementById("node-status"),
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
};

const stateMeta = {
  lanBaseUrl: window.location.origin,
  publicUrl: null,
  publicActive: false,
};

async function fetchStatus() {
  const res = await fetch("/api/status");
  const data = await res.json();
  els.status.textContent = `Status: ${data.status}`;
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

function renderFiles() {
  els.fileList.innerHTML = "";
  state.items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "item";

    const info = document.createElement("div");
    info.innerHTML = `<div class="item-title">${item.name}</div>
      <div class="item-sub">${item.type === "folder" ? "Folder" : "File"} · ${formatBytes(
      item.size,
    )}</div>`;
    row.appendChild(info);

    const typeBadge = document.createElement("span");
    typeBadge.className = "badge";
    typeBadge.textContent = item.type === "folder" ? "Folder" : "File";
    row.appendChild(typeBadge);

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

    if (item.type === "file") {
      const spacer = document.createElement("div");
      row.appendChild(spacer);
    }

    els.fileList.appendChild(row);
  });
}

function renderShares() {
  els.shareList.innerHTML = "";
  if (!state.shares.length) {
    els.shareList.textContent = "No active shares yet.";
    return;
  }
  state.shares.forEach((share) => {
    const row = document.createElement("div");
    row.className = "item";
    const info = document.createElement("div");
    const expiryText = new Date(share.expiresAt).toLocaleString();
    info.innerHTML = `<div class="item-title">${share.path}</div>
      <div class="item-sub">${share.scope} · ${share.permission} · ${share.status} · expires ${expiryText}</div>`;
    row.appendChild(info);

    const statusBadge = document.createElement("span");
    statusBadge.className = "badge";
    statusBadge.textContent = share.status;
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
    const shareUrl =
      share.status === "active" && baseUrl ? `${baseUrl}/share/${share.shareId}` : null;
    copyButton.disabled = !shareUrl;
    copyButton.onclick = async () => {
      if (!shareUrl) return;
      await navigator.clipboard.writeText(shareUrl);
      copyButton.textContent = "Copied!";
      setTimeout(() => (copyButton.textContent = "Copy Link"), 1500);
    };
    row.appendChild(copyButton);

    const revokeButton = document.createElement("button");
    revokeButton.className = "button";
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
  if (selectedScope === "public" && !stateMeta.publicActive) {
    const confirmEnable = confirm("Public access is required. Enable now?");
    if (!confirmEnable) return;
    els.shareResult.textContent = "Enabling public access. This may take a few seconds.";
    await togglePublicAccess();
    const ready = await waitForPublicAccess(10000);
    if (!ready) {
      els.shareResult.textContent = "Public sharing is unavailable on this system";
      return;
    }
  }
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
  const baseUrl =
    selectedScope === "public" && stateMeta.publicActive
      ? stateMeta.publicUrl
      : stateMeta.lanBaseUrl;
  const shareUrl = `${baseUrl}/share/${data.shareId}`;
  els.shareResult.textContent = `Share created: ${shareUrl}`;
  els.copyShare.style.display = "inline-flex";
  els.copyShare.onclick = async () => {
    await navigator.clipboard.writeText(shareUrl);
    els.copyShare.textContent = "Copied!";
    setTimeout(() => (els.copyShare.textContent = "Copy Link"), 1500);
  };
  await loadShares();
}

async function revokeShare(shareId) {
  state.shares = state.shares.filter((share) => share.shareId !== shareId);
  renderShares();
  await fetch(`/api/share/${shareId}`, { method: "DELETE" });
  await loadShares();
}

async function waitForPublicAccess(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await refreshPublicAccess();
    if (stateMeta.publicActive) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function refreshPublicAccess() {
  const res = await fetch("/api/public-access/status");
  const data = await res.json();
  stateMeta.publicActive = data.status === "active";
  stateMeta.publicUrl = data.publicUrl || null;
  if (data.status === "active") {
    els.publicStatus.textContent = "Public access enabled";
    els.publicUrl.textContent = data.publicUrl;
    els.publicReason.textContent = "";
    els.togglePublic.textContent = "Disable Public Sharing";
    els.togglePublic.disabled = false;
  } else if (data.status === "starting" || data.status === "restarting") {
    els.publicStatus.textContent = "Starting public access…";
    els.publicUrl.textContent = "--";
    els.publicReason.textContent = "";
    els.togglePublic.textContent = "Starting…";
    els.togglePublic.disabled = true;
  } else if (data.status === "stopping") {
    els.publicStatus.textContent = "Stopping public access…";
    els.publicUrl.textContent = "--";
    els.publicReason.textContent = "";
    els.togglePublic.textContent = "Stopping…";
    els.togglePublic.disabled = true;
  } else {
    els.publicStatus.textContent =
      data.status === "failed" || data.status === "error"
        ? "Public access unavailable"
        : "Public access disabled";
    els.publicUrl.textContent = "--";
    els.publicReason.textContent = data.reason ? `Reason: ${data.reason}` : "";
    els.togglePublic.textContent = "Enable Public Sharing";
    els.togglePublic.disabled = false;
  }
}

async function togglePublicAccess() {
  if (stateMeta.publicActive) {
    els.togglePublic.disabled = true;
    await fetch("/api/public-access/stop", { method: "POST" });
  } else {
    els.togglePublic.disabled = true;
    const response = await fetch("/api/public-access/start", { method: "POST" });
    const data = await response.json();
    if (data.status === "failed" || data.status === "error") {
      alert(data.message || "Public sharing is unavailable on this system");
    }
  }
  await refreshPublicAccess();
  await loadShares();
  els.togglePublic.disabled = false;
}

els.refreshFiles.onclick = () => loadFiles(state.path);
els.refreshShares.onclick = () => loadShares();
els.refreshNetwork.onclick = () => loadNetwork();
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
els.togglePublic.onclick = togglePublicAccess;
els.retryPublic.onclick = () => togglePublicAccess();
els.switchLan.onclick = async () => {
  await fetch("/api/public-access/stop", { method: "POST" });
  await refreshPublicAccess();
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

function renderLogs(entries) {
  els.logList.innerHTML = "";
  if (!entries.length) {
    els.logList.textContent = "No logs available.";
    return;
  }
  entries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "log-item";
    row.textContent = `${entry.timestamp} [${entry.level}] ${entry.message}`;
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
    els.networkList.textContent =
      "No other JoinCloud users detected on this network.";
    return;
  }
  entries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "item";
    const info = document.createElement("div");
    info.innerHTML = `<div class="item-title">${entry.display_name}</div>
      <div class="item-sub">${entry.status}</div>`;
    row.appendChild(info);
    els.networkList.appendChild(row);
  });
}

async function loadNetwork() {
  els.refreshNetwork.textContent = "Loading...";
  els.refreshNetwork.disabled = true;
  const res = await fetch("/api/v1/network");
  const data = await res.json();
  renderNetwork(data);
  els.refreshNetwork.textContent = "Refresh";
  els.refreshNetwork.disabled = false;
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
const initial = window.location.hash.replace("#", "") || "home";
setActiveSection(initial);

els.telemetryToggle.addEventListener("change", async (event) => {
  await updateTelemetrySettings(event.target.checked);
});

els.saveNetworkName.addEventListener("click", async () => {
  await saveNetworkName();
});

els.networkVisibility.addEventListener("change", async (event) => {
  await updateNetworkVisibility(event.target.checked);
});
