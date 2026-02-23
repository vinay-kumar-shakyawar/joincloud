(function () {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const shareId = parts.length >= 2 ? parts[1] : "";

  const titleEl = document.getElementById("share-title");
  const metaEl = document.getElementById("share-meta");
  const actionsEl = document.getElementById("share-actions");
  const listEl = document.getElementById("share-list");
  const previewEl = document.getElementById("share-preview");
  const dropZoneEl = document.getElementById("share-drop-zone");
  let selectedPaths = new Set();
  let currentFolderPath = "/";
  let metaCache = null;
  let sharePermission = "read-only";

  function getShareUrl() {
    return window.location.origin + "/share/" + encodeURIComponent(shareId);
  }

  function setupShareDropZone() {
    if (!dropZoneEl) return;
    const handleDrag = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZoneEl.classList.toggle("active", e.type === "dragenter" || e.type === "dragover");
    };
    const handleDrop = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZoneEl.classList.remove("active");
      if (sharePermission !== "read-write") {
        showToast("Upload not available for read-only shares.", "info");
        return;
      }
      const files = e.dataTransfer?.files;
      if (!files || !files.length) return;
      const formData = new FormData();
      formData.append("path", currentFolderPath.replace(/^\//, "") || "");
      for (let i = 0; i < files.length; i++) formData.append("files", files[i]);
      try {
        showToast("Uploading...", "info");
        const res = await fetch(`/share/${encodeURIComponent(shareId)}/upload`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          showToast("Upload complete", "success");
          await loadFolder(currentFolderPath);
        } else {
          showToast(data.error || "Upload failed", "error");
        }
      } catch (err) {
        showToast(err.message || "Upload failed", "error");
      }
    };
    dropZoneEl.ondragenter = dropZoneEl.ondragover = handleDrag;
    dropZoneEl.ondragleave = handleDrag;
    dropZoneEl.ondrop = handleDrop;
  }

  function showToast(message, type) {
    const existing = document.getElementById("share-toast");
    if (existing) existing.remove();
    const toast = document.createElement("div");
    toast.id = "share-toast";
    toast.className = "share-toast share-toast-" + (type || "info");
    toast.textContent = message;
    toast.setAttribute("role", "status");
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add("share-toast-visible"), 10);
    setTimeout(() => {
      toast.classList.remove("share-toast-visible");
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  async function copyToClipboard(text, container) {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_err) {}
    const input = container ? container.querySelector("input.mono") : null;
    if (input) {
      input.value = text;
      input.focus();
      input.select();
      input.setSelectionRange(0, text.length);
      try {
        if (document.execCommand("copy")) return true;
      } catch (_e) {}
    }
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

  async function handleCopyLink(text, container, copyBtn) {
    const ok = await copyToClipboard(text, container);
    if (ok) {
      showToast("Copied!", "success");
      if (copyBtn) {
        copyBtn.textContent = "Copied!";
        setTimeout(() => (copyBtn.textContent = "Share"), 2000);
      }
    } else {
      showToast("Copy failed — press Ctrl+C / Cmd+C", "error");
      const input = container ? container.querySelector("input.mono") : null;
      if (input) {
        input.focus();
        input.select();
      }
    }
  }

  function showCopyFallback(text, container) {
    const wrap = document.createElement("div");
    wrap.className = "copy-fallback";
    wrap.style.marginTop = "8px";
    wrap.innerHTML = '<div class="muted" style="margin-bottom:4px">Tap and hold to copy:</div>';
    const input = document.createElement("input");
    input.type = "text";
    input.className = "input mono";
    input.value = text;
    input.readOnly = true;
    input.style.width = "100%";
    input.onclick = () => input.select();
    wrap.appendChild(input);
    const existing = container.querySelector(".copy-fallback");
    if (existing) existing.remove();
    container.appendChild(wrap);
  }

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

  function renderPreview(url, name) {
    if (!url) {
      previewEl.innerHTML = "";
      return;
    }
    const lower = String(name || "").toLowerCase();
    if (/\.(png|jpe?g|gif|webp|svg)$/i.test(lower)) {
      previewEl.innerHTML = `<img class="preview-image" src="${url}" alt="${name}" />`;
      return;
    }
    if (/\.pdf$/i.test(lower)) {
      previewEl.innerHTML = `<object class="preview-frame" data="${url}" type="application/pdf"><iframe class="preview-frame" src="${url}" title="${name}"></iframe></object>`;
      return;
    }
    if (/\.(mp4|webm|mov|m4v)$/i.test(lower)) {
      previewEl.innerHTML = `<video controls class="preview-video" src="${url}"></video>`;
      return;
    }
    previewEl.innerHTML = "";
  }

  function renderBreadcrumbs(folderPath) {
    const parts = folderPath.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
    const bc = document.createElement("div");
    bc.className = "share-breadcrumbs";
    const home = document.createElement("button");
    home.className = "button secondary";
    home.textContent = "Home";
    home.onclick = () => loadFolder("/");
    bc.appendChild(home);
    let current = "";
    parts.forEach((part) => {
      const sep = document.createElement("span");
      sep.className = "breadcrumb-sep";
      sep.textContent = " / ";
      bc.appendChild(sep);
      current += "/" + part;
      const btn = document.createElement("button");
      btn.className = "button secondary";
      btn.textContent = part;
      const pathToUse = current;
      btn.onclick = () => loadFolder(pathToUse);
      bc.appendChild(btn);
    });
    return bc;
  }

  function renderZipActions(folderPath) {
    const controls = document.createElement("div");
    controls.className = "actions";
    const copyWrap = document.createElement("div");
    copyWrap.className = "copy-link-wrap";
    const copyBtn = document.createElement("button");
    copyBtn.className = "button";
    copyBtn.textContent = "Share";
    copyBtn.title = "Copy share link";
    copyBtn.onclick = () => handleCopyLink(getShareUrl(), copyWrap, copyBtn);
    copyWrap.appendChild(copyBtn);
    controls.appendChild(copyWrap);

    const allLink = document.createElement("a");
    allLink.className = "button";
    allLink.href = `/share/${encodeURIComponent(shareId)}/download.zip`;
    allLink.textContent = "Download All (ZIP)";
    controls.appendChild(allLink);

    if (folderPath && folderPath !== "/") {
      const folderZipLink = document.createElement("a");
      folderZipLink.className = "button secondary";
      folderZipLink.href = `/share/${encodeURIComponent(shareId)}/download.zip?paths=${encodeURIComponent(folderPath.replace(/^\//, ""))}`;
      folderZipLink.textContent = "Download Folder (ZIP)";
      controls.appendChild(folderZipLink);
    }

    const selectedLink = document.createElement("button");
    selectedLink.className = "button secondary";
    selectedLink.textContent = "Download Selected (ZIP)";
    selectedLink.onclick = (event) => {
      event.preventDefault();
      if (!selectedPaths.size) return;
      const joined = Array.from(selectedPaths).join(",");
      window.location.href = `/share/${encodeURIComponent(shareId)}/download.zip?paths=${encodeURIComponent(joined)}`;
    };
    controls.appendChild(selectedLink);
    listEl.appendChild(controls);
  }

  function renderFolderList(payload, folderPath) {
    listEl.innerHTML = "";
    const bc = renderBreadcrumbs(folderPath || "/");
    listEl.appendChild(bc);

    if (!payload.items || !payload.items.length) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = "Folder is empty.";
      listEl.appendChild(empty);
      renderZipActions(folderPath || "/");
      return;
    }

    payload.items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "list-item";
      const left = document.createElement("div");
      left.innerHTML = `
        <div>${item.type === "folder" ? "Folder" : "File"}: <span class="mono">${item.name}</span></div>
        <div class="muted">${item.type === "file" ? formatBytes(item.size) : "-"}</div>
      `;
      row.appendChild(left);
      if (item.type === "folder") {
        const openBtn = document.createElement("button");
        openBtn.className = "button";
        openBtn.textContent = "Open";
        openBtn.onclick = () => loadFolder(item.relativePath);
        row.appendChild(openBtn);
      } else {
        const selectWrap = document.createElement("label");
        selectWrap.className = "select-wrap";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.onchange = () => {
          if (checkbox.checked) selectedPaths.add(item.relativePath);
          else selectedPaths.delete(item.relativePath);
        };
        selectWrap.appendChild(checkbox);
        row.appendChild(selectWrap);
        row.appendChild(renderFileDownloadButton(item.relativePath));
        if (item.previewUrl) {
          const previewBtn = document.createElement("button");
          previewBtn.className = "button secondary";
          previewBtn.textContent = "Preview";
          previewBtn.onclick = () => renderPreview(item.previewUrl, item.name);
          row.appendChild(previewBtn);
        }
      }
      listEl.appendChild(row);
    });
    renderZipActions(folderPath || "/");
    if (metaCache && metaCache.marketingUrl) renderGrowthCta(metaCache.marketingUrl);
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

  async function loadFolder(folderPath) {
    currentFolderPath = folderPath || "/";
    selectedPaths = new Set();
    const pathParam = currentFolderPath === "/" ? "" : currentFolderPath.replace(/^\//, "");
    const url = `/share/${encodeURIComponent(shareId)}/files` + (pathParam ? `?path=${encodeURIComponent(pathParam)}` : "");
    const files = await fetchJson(url);
    renderFolderList(files, currentFolderPath);
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
      sharePermission = meta.permission || "read-only";

      if (dropZoneEl) {
        dropZoneEl.style.display = meta.targetType === "folder" ? "" : "none";
        setupShareDropZone();
      }

      actionsEl.innerHTML = "";
      if (meta.targetType === "file") {
        const direct = document.createElement("a");
        direct.className = "button";
        direct.href = meta.downloadUrl || `/share/${encodeURIComponent(shareId)}/download`;
        direct.textContent = "Download File";
        actionsEl.appendChild(direct);
        const copyWrap = document.createElement("div");
        copyWrap.className = "copy-link-wrap";
        const copyBtn = document.createElement("button");
        copyBtn.className = "button";
        copyBtn.textContent = "Share";
        copyBtn.title = "Copy share link";
        copyBtn.onclick = () => handleCopyLink(getShareUrl(), copyWrap, copyBtn);
        copyWrap.appendChild(copyBtn);
        actionsEl.appendChild(copyWrap);
        if (meta.previewUrl) {
          const previewBtn = document.createElement("button");
          previewBtn.className = "button secondary";
          previewBtn.textContent = "Preview";
          previewBtn.onclick = () => renderPreview(meta.previewUrl, meta.name);
          actionsEl.appendChild(previewBtn);
          renderPreview(meta.previewUrl, meta.name);
        }
        listEl.innerHTML = '<div class="muted">Sharing is caring ❤️</div>';
        renderGrowthCta(meta.marketingUrl);
        return;
      }

      metaCache = meta;
      await loadFolder("/");
      const note = document.createElement("div");
      note.className = "muted";
      note.textContent = "Sharing is caring ❤️";
      listEl.appendChild(note);
    } catch (error) {
      setError("Share unavailable or expired.");
    }
  }

  init();
})();
