(function () {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const shareId = parts.length >= 2 ? parts[1] : "";

  const titleEl = document.getElementById("share-title");
  const metaEl = document.getElementById("share-meta");
  const actionsEl = document.getElementById("share-actions");
  const listEl = document.getElementById("share-list");
  const previewEl = document.getElementById("share-preview");
  let selectedPaths = new Set();

  function getShareUrl() {
    return window.location.origin + "/share/" + encodeURIComponent(shareId);
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

  function renderZipActions() {
    const controls = document.createElement("div");
    controls.className = "actions";
    const copyBtn = document.createElement("button");
    copyBtn.className = "button secondary";
    copyBtn.textContent = "Copy Link";
    copyBtn.onclick = async () => {
      const ok = await copyToClipboard(getShareUrl());
      if (ok) {
        copyBtn.textContent = "Copied!";
        setTimeout(() => (copyBtn.textContent = "Copy Link"), 2000);
      } else {
        showCopyFallback(getShareUrl(), listEl);
      }
    };
    controls.appendChild(copyBtn);
    const allLink = document.createElement("a");
    allLink.className = "button";
    allLink.href = `/share/${encodeURIComponent(shareId)}/download.zip`;
    allLink.textContent = "Download All (ZIP)";
    controls.appendChild(allLink);

    const selectedLink = document.createElement("a");
    selectedLink.className = "button secondary";
    selectedLink.textContent = "Download Selected (ZIP)";
    selectedLink.href = "#";
    selectedLink.onclick = (event) => {
      event.preventDefault();
      if (!selectedPaths.size) return;
      const joined = Array.from(selectedPaths).join(",");
      window.location.href = `/share/${encodeURIComponent(shareId)}/download.zip?paths=${encodeURIComponent(joined)}`;
    };
    controls.appendChild(selectedLink);
    listEl.appendChild(controls);
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
    renderZipActions();
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
        const copyBtn = document.createElement("button");
        copyBtn.className = "button secondary";
        copyBtn.textContent = "Copy Link";
        copyBtn.onclick = async () => {
          const ok = await copyToClipboard(getShareUrl());
          if (ok) {
            copyBtn.textContent = "Copied!";
            setTimeout(() => (copyBtn.textContent = "Copy Link"), 2000);
          } else {
            showCopyFallback(getShareUrl(), actionsEl);
          }
        };
        actionsEl.appendChild(copyBtn);
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
