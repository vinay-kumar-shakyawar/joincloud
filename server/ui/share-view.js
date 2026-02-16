(function () {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const shareId = parts.length >= 2 ? parts[1] : "";

  const titleEl = document.getElementById("share-title");
  const metaEl = document.getElementById("share-meta");
  const actionsEl = document.getElementById("share-actions");
  const listEl = document.getElementById("share-list");

  function formatBytes(bytes) {
    if (!bytes) return "-";
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let index = 0;
    while (size >= 1024 && index < units.length - 1) {
      size /= 1024;
      index += 1;
    }
    return `${size.toFixed(1)} ${units[index]}`;
  }

  function setError(message) {
    metaEl.textContent = message;
    listEl.innerHTML = "";
    actionsEl.innerHTML = "";
  }

  function renderFileDownloadButton(pathValue) {
    const link = document.createElement("a");
    link.className = "button";
    link.href = `/share/${encodeURIComponent(shareId)}/download?path=${encodeURIComponent(pathValue)}`;
    link.textContent = "Download";
    return link;
  }

  function renderFolderList(payload) {
    listEl.innerHTML = "";
    if (!payload.items || !payload.items.length) {
      listEl.innerHTML = '<div class="muted">Folder is empty.</div>';
      return;
    }

    payload.items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "list-item";
      const left = document.createElement("div");
      left.innerHTML = `
        <div>${item.type === "folder" ? "Folder" : "File"}: <span class="mono">${item.relativePath}</span></div>
        <div class="muted">${item.type === "file" ? formatBytes(item.size) : "-"}</div>
      `;
      row.appendChild(left);
      if (item.type === "file") {
        row.appendChild(renderFileDownloadButton(item.relativePath));
      }
      listEl.appendChild(row);
    });
  }

  function renderGrowthCta(marketingUrl) {
    const cta = document.createElement("div");
    cta.className = "growth-cta";
    cta.innerHTML = `
      <div class="growth-title">Want to share files easily?</div>
      <a class="button" target="_blank" rel="noopener noreferrer" href="${marketingUrl}">Download JoinCloud Now</a>
    `;
    listEl.appendChild(cta);
  }

  async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return res.json();
  }

  async function init() {
    if (!shareId) {
      setError("Invalid share link.");
      return;
    }
    try {
      const meta = await fetchJson(`/share/${encodeURIComponent(shareId)}/meta`);
      titleEl.textContent = meta.name || "Shared Item";
      const sizeText = meta.targetType === "file" && Number.isFinite(meta.size) ? ` | Size: ${formatBytes(meta.size)}` : "";
      metaEl.textContent = `Type: ${meta.targetType === "folder" ? "Folder" : "File"}${sizeText} | Expires: ${new Date(meta.expiresAt).toLocaleString()}`;

      actionsEl.innerHTML = "";
      if (meta.targetType === "file") {
        const direct = document.createElement("a");
        direct.className = "button";
        direct.href = meta.downloadUrl || `/share/${encodeURIComponent(shareId)}/download`;
        direct.textContent = "Download File";
        actionsEl.appendChild(direct);
        listEl.innerHTML = '<div class="muted">Sharing is caring ❤️</div>';
        renderGrowthCta(meta.marketingUrl);
        return;
      }

      const files = await fetchJson(`/share/${encodeURIComponent(shareId)}/files`);
      renderFolderList(files);
      const note = document.createElement("div");
      note.className = "muted";
      note.textContent = "Sharing is caring ❤️";
      listEl.appendChild(note);
      renderGrowthCta(meta.marketingUrl);
    } catch (error) {
      setError("Share unavailable or expired.");
    }
  }

  init();
})();
