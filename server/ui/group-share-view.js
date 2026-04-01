(function () {
  let pathname = window.location.pathname || "";
  try {
    pathname = decodeURIComponent(pathname);
  } catch (_) {}
  if (/\/share\s+group\//i.test(pathname)) {
    const fixed = pathname.replace(/\/share\s+group\//gi, "/share-group/");
    if (fixed !== window.location.pathname) {
      window.history.replaceState(null, "", fixed + window.location.search + window.location.hash);
    }
    pathname = fixed;
  }
  const groupId = pathname.split("/").filter(Boolean).pop();

  const titleEl = document.getElementById("share-title");
  const metaEl = document.getElementById("share-meta");
  const actionsEl = document.getElementById("share-actions");
  const listEl = document.getElementById("share-list");
  const previewEl = document.getElementById("share-preview");
  const state = {
    items: [],
    selected: new Set(),
  };

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatBytes(n) {
    const bytes = Number(n || 0);
    if (!Number.isFinite(bytes) || bytes <= 0) return "-";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let v = bytes;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i++;
    }
    return (i === 0 ? v : v.toFixed(1)) + " " + units[i];
  }

  async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) {
      const err = new Error(`Request failed: ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  

  function getKind(name) {
    const lower = String(name || "").toLowerCase();
    if (/\.(png|jpe?g|gif|webp|svg)$/i.test(lower)) return "image";
    if (/\.pdf$/i.test(lower)) return "pdf";
    if (/\.(mp4|webm|mov|m4v)$/i.test(lower)) return "video";
    return "none";
  }

  function getThumb(item) {
    const kind = getKind(item.name);
    if (kind === "image") {
      return `<div class="share-card-thumb-icon">🖼️</div>`;
    }
    if (kind === "video") {
      return `<div class="share-card-thumb-icon">▶️</div>`;
    }
    const icon = item.type === "folder" ? "📁" : "📄";
    return `<div class="share-card-thumb-icon">${icon}</div>`;
  }

  function renderList(items) {
    listEl.innerHTML = "";
    const folders = (items || []).filter((x) => x.type === "folder");
    const files = (items || []).filter((x) => x.type !== "folder");

    function sectionTitle(text) {
      const t = document.createElement("div");
      t.className = "muted";
      t.style.margin = "10px 0 6px";
      t.style.fontSize = "12px";
      t.style.textTransform = "uppercase";
      t.style.letterSpacing = "0.08em";
      t.textContent = text;
      return t;
    }

    if (folders.length) {
      listEl.appendChild(sectionTitle("Folders"));
      folders.forEach((item) => {
        const row = document.createElement("div");
        row.className = "list-item";
        const left = document.createElement("div");
        left.className = "share-file-card";
        left.innerHTML =
          `<div class="share-file-card-thumb">${getThumb(item)}</div>` +
          `<div class="share-file-card-body"><div>Folder: <span class="mono">${escapeHtml(item.name)}</span></div>` +
          `<div class="muted">—</div></div>`;
        row.appendChild(left);
        const open = document.createElement("a");
        open.className = "button";
        open.href = item.downloadUrl;
        open.target = "_blank";
        open.rel = "noopener noreferrer";
        open.textContent = "Open";
        row.appendChild(open);
        listEl.appendChild(row);
      });
    }

    listEl.appendChild(sectionTitle("Files"));
    if (!files.length) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = "No files.";
      listEl.appendChild(empty);
      return;
    }

    files.forEach((item) => {
      const row = document.createElement("div");
      row.className = "list-item";
      const left = document.createElement("div");
      left.className = "share-file-card";
      left.innerHTML =
        `<div class="share-file-card-thumb">${getThumb(item)}</div>` +
        `<div class="share-file-card-body"><div tyle="margin-top: auto; margin-bottom: auto;">File: <span class="mono" s>${escapeHtml(item.name)}</span></div>` +
        `</div>`;
      row.appendChild(left);

      

      const open = document.createElement("a");
      open.className = "button secondary";
      open.href = item.downloadUrl;
      open.target = "_blank";
      open.rel = "noopener noreferrer";
      open.textContent = "Open";
      row.appendChild(open);
      listEl.appendChild(row);
    });
  }

  async function init() {
    if (!groupId) {
      metaEl.textContent = "Invalid group link.";
      return;
    }
    try {
      const group = await fetchJson(`/api/v1/share-groups/${encodeURIComponent(groupId)}`);
      titleEl.textContent = group.name || "Shared Group";
      metaEl.textContent = `Scope: ${group.scope || "local"} | Items: ${Array.isArray(group.paths) ? group.paths.length : 0}`;

      // Build items from the stored paths. Folders open as links to their individual share URLs if present.
      const entries = Array.isArray(group.entries) ? group.entries : [];
      const items = entries.map((e) => {
        const p = String(e.path || "");
        const name = String(e.name || "") || p.split("/").filter(Boolean).pop() || p || "Item";
        const tt = String(e.targetType || e.type || "").toLowerCase();
        const isFolder = tt === "folder" || tt === "dir" || tt === "directory";
        const bestUrl = e.publicUrl || e.url;
        return {
          type: isFolder ? "folder" : "file",
          path: p,
          name,
          size: 0,
          downloadUrl: bestUrl,
          previewUrl: null,
        };
      });
      state.items = items;
      renderList(items);
      previewEl.innerHTML = "";
    } catch (err) {
      const st = err && err.status != null ? Number(err.status) : NaN;
      const msg = err && err.message ? String(err.message) : "";
      if (st === 404 || msg.includes("404")) {
        metaEl.textContent =
          "This group link is invalid or no longer exists (the host may have restarted or removed the group).";
      } else if (st === 423 || msg.includes("423")) {
        metaEl.textContent = "Sharing is currently stopped on the host. Try again later.";
      } else if (st === 401 || msg.includes("401")) {
        metaEl.textContent =
          "This page could not load group data. If you are the host, open the link from this device’s JoinCloud app or try again.";
      } else {
        metaEl.textContent = "Could not load this group. Check your connection and use the exact link from Share (with share-group in the URL).";
      }
      actionsEl.innerHTML = "";
      listEl.innerHTML = "";
    }
  }

  init();
})();

