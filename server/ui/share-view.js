(function () {
  const shareId =
    window.__SHARE_ID__ ||
    (window.location.pathname.split("/").filter(Boolean)[1] || "");
  const SHARE_BASE = window.__SHARE_BASE__ || "";
  const SHARE_TOKEN = window.__SHARE_TOKEN__ || "";
  const SHARE_EXP = window.__SHARE_EXP__ || "";

  function buildShareUrl(path, extraParams) {
    const base = SHARE_BASE || "";
    let finalPath;
    if (base && base.startsWith("/s/")) {
      // Worker proxy mode — extract only the subpath after /share/SHAREID
      // e.g. /share/abc123/meta → /meta
      // e.g. /share/abc123/download.zip → /download.zip
      // e.g. /share/abc123 → "" (share page itself)
      const subPathMatch = path.match(/\/share\/[^/]+(\/.*)?$/);
      const subPath = (subPathMatch && subPathMatch[1]) || "";
      finalPath = base + subPath; // e.g. /s/1Ba5xI6e/meta
    } else {
      // Direct tunnel access — use full path as-is
      finalPath = path;
    }

    const url = new URL(finalPath, window.location.origin);

    // Only add token/exp for direct tunnel access (Worker adds them server-side)
    if (SHARE_TOKEN && !base.startsWith("/s/")) {
      url.searchParams.set("token", SHARE_TOKEN);
      if (SHARE_EXP) url.searchParams.set("exp", SHARE_EXP);
    }

    if (extraParams && typeof extraParams === "object") {
      Object.entries(extraParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.set(key, String(value));
        }
      });
    }
    return url.toString();
  }

  const titleEl = document.getElementById("share-title");
  const metaEl = document.getElementById("share-meta");
  const actionsEl = document.getElementById("share-actions");
  const listEl = document.getElementById("share-list");
  const previewEl = document.getElementById("share-preview");
  let selectedPaths = new Set();
  let currentFolderPath = "/";
  let metaCache = null;
  let sharePermission = "read-only";
  const previewDrawerState = {
    items: [],
    currentIndex: 0,
    galleryOpen: true,
    selectionMode: false,
    selected: new Set(),
    galleryNodes: null,
  };

  function getShareUrl() {
    return window.location.origin + "/share/" + encodeURIComponent(shareId);
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
      showToast("Copy failed - press Ctrl+C / Cmd+C", "error");
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

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setError(message) {
    metaEl.textContent = message;
    listEl.innerHTML = "";
    actionsEl.innerHTML = "";
  }

  function formatBytesShort(n) {
    if (!n || !Number.isFinite(n)) return "";
    const u = ["B", "KB", "MB", "GB"];
    let i = 0;
    let v = n;
    while (v >= 1024 && i < u.length - 1) {
      v /= 1024;
      i++;
    }
    return (i === 0 ? v : v.toFixed(1)) + " " + u[i];
  }

  function ensureTransferPanel() {
    let el = document.getElementById("share-transfer-panel");
    if (el) return el;
    el = document.createElement("div");
    el.id = "share-transfer-panel";
    el.className = "share-transfer-panel";
    el.setAttribute("role", "status");
    el.innerHTML =
      '<div class="share-transfer-ring-wrap">' +
      '<svg class="share-transfer-svg" viewBox="0 0 88 88" width="88" height="88">' +
      '<circle cx="44" cy="44" r="36" fill="none" stroke="rgba(47,183,255,0.2)" stroke-width="6" />' +
      '<circle class="share-transfer-arc" cx="44" cy="44" r="36" fill="none" stroke="#2fb7ff" stroke-width="6" ' +
      'stroke-linecap="round" transform="rotate(-90 44 44)" />' +
      "</svg>" +
      '<span class="share-transfer-pct">0%</span></div>' +
      '<div class="share-transfer-info">' +
      '<div class="share-transfer-label">Downloading</div>' +
      '<div class="share-transfer-name"></div>' +
      '<div class="share-transfer-meta"></div>' +
      '<div class="share-transfer-stats"></div>' +
      '<div class="share-transfer-controls">' +
      '<button type="button" class="button secondary" id="share-transfer-pause">Pause</button>' +
      '<button type="button" class="button secondary" id="share-transfer-resume" style="display:none;">Resume</button>' +
      '<button type="button" class="button secondary" id="share-transfer-cancel">Cancel</button>' +
      "</div></div>";
    document.body.appendChild(el);
    return el;
  }

  let activeTransferControl = null;

  function syncTransferControls() {
    const el = document.getElementById("share-transfer-panel");
    if (!el) return;
    const pauseBtn = el.querySelector("#share-transfer-pause");
    const resumeBtn = el.querySelector("#share-transfer-resume");
    const cancelBtn = el.querySelector("#share-transfer-cancel");
    const ctrl = activeTransferControl;
    if (!pauseBtn || !resumeBtn || !cancelBtn) return;
    if (!ctrl) {
      pauseBtn.style.display = "none";
      resumeBtn.style.display = "none";
      cancelBtn.style.display = "none";
      return;
    }
    const state = ctrl.state || "running";
    pauseBtn.style.display = state === "running" ? "" : "none";
    resumeBtn.style.display = state === "paused" ? "" : "none";
    cancelBtn.style.display = state === "complete" ? "none" : "";
  }

  function hideTransferPanel() {
    const el = document.getElementById("share-transfer-panel");
    if (el) {
      el.classList.remove("share-transfer-visible");
      setTimeout(function () {
        if (el) el.style.display = "none";
      }, 300);
    }
  }

  function updateTransferPanel(opts) {
    const el = ensureTransferPanel();
    el.style.display = "flex";
    requestAnimationFrame(function () {
      el.classList.add("share-transfer-visible");
    });
    const arc = el.querySelector(".share-transfer-arc");
    const pctEl = el.querySelector(".share-transfer-pct");
    const nameEl = el.querySelector(".share-transfer-name");
    const metaEl2 = el.querySelector(".share-transfer-meta");
    const statsEl = el.querySelector(".share-transfer-stats");
    const labelEl = el.querySelector(".share-transfer-label");
    const pct = Math.min(100, Math.max(0, opts.pct || 0));
    const r = 36;
    const c = 2 * Math.PI * r;
    if (arc) {
      arc.setAttribute("stroke-dasharray", String(c));
      arc.setAttribute("stroke-dashoffset", String(c - (pct / 100) * c));
    }
    if (pctEl) pctEl.textContent = Math.round(pct) + "%";
    if (nameEl) nameEl.textContent = opts.fileName || "Download";
    if (metaEl2) metaEl2.textContent = opts.metaLine || "";
    if (statsEl) statsEl.textContent = opts.statsLine || "";
    if (labelEl) labelEl.textContent = opts.label || "Downloading";
    syncTransferControls();
  }

  async function startResumableDownload(url, fileName, sizeHint) {
    const chunks = [];
    let bytesReceived = 0;
    let totalBytes = 0;
    let startedAt = Date.now();

    const control = {
      state: "running", // running | paused | cancelled | complete
      controller: null,
      resumeWaiter: null,
      pause: () => {},
      resume: () => {},
      cancel: () => {},
    };
    activeTransferControl = control;
    const panel = ensureTransferPanel();
    const pauseBtn = panel.querySelector("#share-transfer-pause");
    const resumeBtn = panel.querySelector("#share-transfer-resume");
    const cancelBtn = panel.querySelector("#share-transfer-cancel");

    async function getTotalSize() {
      try {
        const head = await fetch(url, { method: "HEAD" });
        const len = Number(head.headers.get("Content-Length") || 0);
        return Number.isFinite(len) ? len : 0;
      } catch (_err) {
        return 0;
      }
    }

    totalBytes = sizeHint || (await getTotalSize());
    updateTransferPanel({
      fileName: fileName || "download",
      pct: 0,
      metaLine: totalBytes ? formatBytesShort(totalBytes) : "",
      statsLine: "Starting…",
      label: "Downloading",
    });

    function waitForResume() {
      return new Promise((resolve) => {
        control.resumeWaiter = resolve;
      });
    }

    control.pause = () => {
      if (control.state !== "running") return;
      control.state = "paused";
      try {
        if (control.controller) control.controller.abort();
      } catch (_) {}
      updateTransferPanel({
        fileName: fileName || "download",
        pct: totalBytes > 0 ? Math.round((bytesReceived / totalBytes) * 100) : 0,
        metaLine: totalBytes ? formatBytesShort(bytesReceived) + " / " + formatBytesShort(totalBytes) : formatBytesShort(bytesReceived),
        statsLine: "Paused",
        label: "Paused",
      });
    };

    control.resume = () => {
      if (control.state !== "paused") return;
      control.state = "running";
      startedAt = Date.now();
      if (typeof control.resumeWaiter === "function") {
        const r = control.resumeWaiter;
        control.resumeWaiter = null;
        r();
      }
      updateTransferPanel({
        fileName: fileName || "download",
        pct: totalBytes > 0 ? Math.round((bytesReceived / totalBytes) * 100) : 0,
        metaLine: totalBytes ? formatBytesShort(bytesReceived) + " / " + formatBytesShort(totalBytes) : formatBytesShort(bytesReceived),
        statsLine: "Resuming…",
        label: "Downloading",
      });
    };

    control.cancel = () => {
      if (control.state === "cancelled" || control.state === "complete") return;
      control.state = "cancelled";
      try {
        if (control.controller) control.controller.abort();
      } catch (_) {}
      hideTransferPanel();
      showToast("Download cancelled", "info");
      activeTransferControl = null;
      syncTransferControls();
    };

    if (pauseBtn) pauseBtn.onclick = control.pause;
    if (resumeBtn) resumeBtn.onclick = control.resume;
    if (cancelBtn) cancelBtn.onclick = control.cancel;

    // Auto-pause on connection loss
    if (!window.__joincloudShareNetHooks) {
      window.__joincloudShareNetHooks = true;
      window.addEventListener("offline", () => {
        try {
          if (activeTransferControl && activeTransferControl.state === "running") {
            activeTransferControl.pause();
          }
        } catch (_) {}
      });
    }

    while (true) {
      if (control.state === "cancelled") return;
      if (control.state === "paused") {
        await waitForResume();
        continue;
      }
      try {
        control.controller = new AbortController();
        const response = await fetch(url, {
          headers: bytesReceived > 0 ? { Range: "bytes=" + bytesReceived + "-" } : {},
          signal: control.controller.signal,
        });
        if (!(response.ok || response.status === 206)) {
          throw new Error("Download failed (" + response.status + ")");
        }
        if (!totalBytes) {
          const totalFromRange = response.headers.get("Content-Range");
          if (totalFromRange && totalFromRange.indexOf("/") >= 0) {
            totalBytes = Number(totalFromRange.split("/")[1] || 0);
          } else {
            totalBytes = Number(response.headers.get("Content-Length") || 0);
          }
        }
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (control.state !== "running") {
            try {
              if (control.controller) control.controller.abort();
            } catch (_) {}
            break;
          }
          chunks.push(value);
          bytesReceived += value.length;
          const elapsed = Math.max((Date.now() - startedAt) / 1000, 1);
          const speed = bytesReceived / elapsed;
          const eta = speed > 0 && totalBytes > 0 ? Math.max(Math.round((totalBytes - bytesReceived) / speed), 0) : 0;
          const pct = totalBytes > 0 ? Math.min(100, Math.round((bytesReceived / totalBytes) * 100)) : 0;
          const speedStr =
            speed >= 1024 * 1024
              ? (speed / (1024 * 1024)).toFixed(1) + " MB/s"
              : speed >= 1024
                ? (speed / 1024).toFixed(1) + " KB/s"
                : speed.toFixed(0) + " B/s";
          updateTransferPanel({
            fileName: fileName || "download",
            pct: pct,
            metaLine: totalBytes ? formatBytesShort(bytesReceived) + " / " + formatBytesShort(totalBytes) : formatBytesShort(bytesReceived),
            statsLine: speedStr + (eta > 0 ? " · ETA " + eta + "s" : ""),
            label: "Downloading",
          });
        }
        // Stream finished successfully; exit outer loop and finalize.
        break;
      } catch (error) {
        if (control.state === "cancelled") return;
        if (error && error.name === "AbortError" && control.state === "paused") {
          syncTransferControls();
          await waitForResume();
          continue;
        }
        // Auto-pause on network glitches; user can resume.
        control.state = "paused";
        updateTransferPanel({
          fileName: fileName || "download",
          pct: totalBytes ? Math.round((bytesReceived / totalBytes) * 100) : 0,
          metaLine: "Connection issue",
          statsLine: "Paused due to a connection glitch. Click Resume to continue.",
          label: "Paused",
        });
        syncTransferControls();
        await waitForResume();
      }
    }

    if (control.state === "cancelled") return;

    updateTransferPanel({
      fileName: fileName || "download",
      pct: 100,
      metaLine: totalBytes ? formatBytesShort(totalBytes) : "Complete",
      statsLine: "Saving file…",
      label: "Complete",
    });

    const blob = new Blob(chunks);
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName || "download";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(blobUrl);
      a.remove();
    }, 1000);
    control.state = "complete";
    syncTransferControls();
    showToast("Download complete", "success");
    setTimeout(hideTransferPanel, 2000);
    setTimeout(() => {
      if (activeTransferControl === control) activeTransferControl = null;
      syncTransferControls();
    }, 2500);
  }

  function renderFileDownloadButton(pathValue, sizeHint, nameHint) {
    const btn = document.createElement("button");
    btn.className = "button";
    btn.textContent = "Download";
    btn.onclick = (event) => {
      event.preventDefault();
      const url = buildShareUrl(`/share/${encodeURIComponent(shareId)}/download`, { path: pathValue, download: "true" });
      const fileName = nameHint || String(pathValue || "download").split("/").pop() || "download";
      startResumableDownload(url, fileName, sizeHint);
    };
    return btn;
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
      previewEl.innerHTML = `<object class="preview-frame" data="${url}" type="application/pdf">
      <iframe class="preview-frame" src="${url}" title="${name}"></iframe>
    </object>`;
      return;
    }
    if (/\.(mp4|webm|mov|m4v)$/i.test(lower)) {
      previewEl.innerHTML = `<video controls class="preview-video" src="${url}"></video>`;
      return;
    }
    previewEl.innerHTML = "";
  }

  function getPreviewKind(name) {
    const lower = String(name || "").toLowerCase();
    if (/\.(png|jpe?g|gif|webp|svg)$/i.test(lower)) return "image";
    if (/\.pdf$/i.test(lower)) return "pdf";
    if (/\.(mp4|webm|mov|m4v)$/i.test(lower)) return "video";
    return "none";
  }

  function getPreviewThumbMarkup(item) {
    const kind = getPreviewKind(item.name);
    if (kind === "image") {
      return `<img class="share-card-thumb-media" src="${item.previewUrl}" alt="${escapeHtml(item.name)}" />`;
    }
    if (kind === "video") {
      return `<video class="share-card-thumb-media" src="${item.previewUrl}" muted preload="metadata"></video>`;
    }
    const icon = item.type === "folder" ? "📁" : "📄";
    return `<div class="share-card-thumb-icon">${icon}</div>`;
  }

  function ensureSharePreviewDrawer() {
    let el = document.getElementById("share-preview-drawer");
    if (el) return el;
    el = document.createElement("div");
    el.id = "share-preview-drawer";
    el.className = "share-preview-drawer";
    el.innerHTML =
      '<div class="share-preview-backdrop" data-close="1"></div>' +
      '<div class="share-preview-panel">' +
      '<div class="share-preview-toolbar">' +
      '<div class="share-preview-title" id="share-preview-title"></div>' +
      '<div class="share-preview-actions">' +
      '<button class="button secondary button-icon-only" id="share-preview-toggle-gallery" title="Toggle gallery" aria-label="Toggle gallery"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5h18v4H3V5zm0 5h18v4H3v-4zm0 5h18v4H3v-4z"/></svg></button>' +
      '<button class="button secondary" id="share-preview-toggle-selection">Selection</button>' +
      '<button class="button secondary" id="share-preview-download"><span class="btn-icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M5 20h14v-2H5v2zm7-18-5.5 5.5h4v6h3v-6h4L12 2z"/></svg></span>Download</button>' +
      '<button class="button secondary" id="share-preview-close">Close</button>' +
      "</div></div>" +
      '<div class="share-preview-body">' +
      '<div class="share-preview-main">' +
      '<button class="share-preview-nav" id="share-preview-prev">‹</button>' +
      '<div class="share-preview-stage" id="share-preview-stage"></div>' +
      '<button class="share-preview-nav" id="share-preview-next">›</button>' +
      "</div>" +
      '<aside class="share-preview-gallery" id="share-preview-gallery"><div class="share-preview-gallery-list" id="share-preview-gallery-list"></div></aside>' +
      "</div></div>";
    document.body.appendChild(el);
    el.addEventListener("click", (event) => {
      if (event.target && event.target.getAttribute("data-close") === "1") closeSharePreviewDrawer();
    });
    document.getElementById("share-preview-close").onclick = closeSharePreviewDrawer;
    document.getElementById("share-preview-prev").onclick = () => {
      if (previewDrawerState.currentIndex > 0) {
        previewDrawerState.currentIndex -= 1;
        renderSharePreviewDrawer();
      }
    };
    document.getElementById("share-preview-next").onclick = () => {
      if (previewDrawerState.currentIndex < previewDrawerState.items.length - 1) {
        previewDrawerState.currentIndex += 1;
        renderSharePreviewDrawer();
      }
    };
    document.getElementById("share-preview-toggle-gallery").onclick = () => {
      previewDrawerState.galleryOpen = !previewDrawerState.galleryOpen;
      const gallery = document.getElementById("share-preview-gallery");
      gallery.classList.toggle("collapsed", !previewDrawerState.galleryOpen);
      const drawer = document.getElementById("share-preview-drawer");
      if (drawer) drawer.classList.toggle("gallery-collapsed", !previewDrawerState.galleryOpen);
    };
    document.getElementById("share-preview-download").onclick = () => {
      const current = previewDrawerState.items[previewDrawerState.currentIndex];
      if (!current) return;

      // Multi-select download: build a ZIP using backend /download.zip selection support.
      if (previewDrawerState.selectionMode && previewDrawerState.selected && previewDrawerState.selected.size >= 2) {
        const joined = Array.from(previewDrawerState.selected).join(",");
        const zipUrl = buildShareUrl(`/share/${encodeURIComponent(shareId)}/download.zip`, {
          paths: joined,
        });
        startResumableDownload(zipUrl, "selected-files.zip");
        return;
      }

      // Single-select download in selection mode (or normal mode): download current file.
      startResumableDownload(current.downloadUrl, current.name, current.size);
    };
    document.getElementById("share-preview-toggle-selection").onclick = () => {
      previewDrawerState.selectionMode = !previewDrawerState.selectionMode;
      if (!previewDrawerState.selectionMode) previewDrawerState.selected = new Set();
      renderSharePreviewDrawer();
    };
    const stageEl = document.getElementById("share-preview-stage");
    if (stageEl) {
      let touchStartX = 0;
      stageEl.addEventListener("touchstart", (e) => {
        touchStartX = e.touches && e.touches[0] ? e.touches[0].clientX : 0;
      }, { passive: true });
      stageEl.addEventListener("touchend", (e) => {
        const endX = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : touchStartX;
        const delta = endX - touchStartX;
        if (Math.abs(delta) < 40) return;
        if (delta < 0 && previewDrawerState.currentIndex < previewDrawerState.items.length - 1) {
          previewDrawerState.currentIndex += 1;
          renderSharePreviewDrawer();
        } else if (delta > 0 && previewDrawerState.currentIndex > 0) {
          previewDrawerState.currentIndex -= 1;
          renderSharePreviewDrawer();
        }
      }, { passive: true });
    }
    return el;
  }

  function closeSharePreviewDrawer() {
    const el = document.getElementById("share-preview-drawer");
    if (!el) return;
    el.classList.remove("active");
    document.body.classList.remove("share-preview-open");
  }

  function renderSharePreviewDrawer() {
    const el = ensureSharePreviewDrawer();
    const current = previewDrawerState.items[previewDrawerState.currentIndex];
    if (!current) return;
    document.getElementById("share-preview-title").textContent = current.name || "Preview";
    const stage = document.getElementById("share-preview-stage");
    const kind = getPreviewKind(current.name);
    if (kind === "image") {
      stage.innerHTML = `<img class="preview-image preview-fit-media" src="${current.previewUrl}" alt="${escapeHtml(current.name)}" />`;
    } else if (kind === "pdf") {
      stage.innerHTML = `<object class="preview-frame preview-fullwidth-doc" data="${current.previewUrl}" type="application/pdf"><iframe class="preview-frame preview-fullwidth-doc" src="${current.previewUrl}" title="${escapeHtml(current.name)}"></iframe></object>`;
    } else if (/\.csv$/i.test(String(current.name || ""))) {
      const safeTitle = escapeHtml(current.name || "CSV");
      stage.innerHTML = `<div class="preview-fullwidth-doc" style="width:100%;height:100%;overflow:auto;padding:12px;">
        <div class="muted" style="margin-bottom:8px;">CSV preview (first lines)</div>
        <pre class="mono" id="share-csv-preview" style="white-space:pre;overflow:auto;margin:0;border:1px solid var(--stroke);border-radius:10px;padding:12px;background:rgba(255,255,255,0.03);">${safeTitle}\nLoading…</pre>
      </div>`;
      const pre = document.getElementById("share-csv-preview");
      // Best-effort fetch; if it fails, show a clear fallback.
      fetch(current.previewUrl)
        .then((r) => {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.text();
        })
        .then((text) => {
          const lines = String(text || "").split(/\r?\n/).slice(0, 60).join("\n");
          pre.textContent = lines || "Preview unavailable";
        })
        .catch(() => {
          pre.textContent = "Preview unavailable";
        });
    } else if (kind === "video") {
      stage.innerHTML = `<video controls class="preview-video preview-fit-media" src="${current.previewUrl}"></video>`;
    } else {
      stage.innerHTML = `<div class="share-preview-fallback"><div class="share-preview-fallback-icon">📄</div><div class="muted">Preview unavailable</div></div>`;
    }
    document.getElementById("share-preview-prev").disabled = previewDrawerState.currentIndex <= 0;
    document.getElementById("share-preview-next").disabled = previewDrawerState.currentIndex >= previewDrawerState.items.length - 1;
    const galleryList = document.getElementById("share-preview-gallery-list");
    const selectionToggle = document.getElementById("share-preview-toggle-selection");
    if (selectionToggle) {
      selectionToggle.textContent = previewDrawerState.selectionMode ? `Selection (${previewDrawerState.selected.size})` : "Selection";
    }

    function buildGalleryOnce() {
      galleryList.innerHTML = "";
      previewDrawerState.galleryNodes = [];
      previewDrawerState.items.forEach((entry, index) => {
        const btn = document.createElement("button");
        btn.className = "share-preview-gallery-item";

        const thumbWrap = document.createElement("span");
        thumbWrap.className = "share-preview-gallery-thumb";
        const thumbKind = getPreviewKind(entry.name);
        if (thumbKind === "image") {
          const img = document.createElement("img");
          img.className = "share-preview-gallery-thumb-media";
          img.src = entry.previewUrl;
          img.alt = entry.name || "Preview";
          thumbWrap.appendChild(img);
        } else {
          const icon = document.createElement("div");
          icon.className = "share-preview-gallery-thumb-icon";
          icon.textContent = thumbKind === "video" ? "🎬" : thumbKind === "pdf" ? "📕" : "📄";
          thumbWrap.appendChild(icon);
        }

        const meta = document.createElement("span");
        meta.className = "share-preview-gallery-meta";
        const nameEl = document.createElement("span");
        nameEl.className = "share-preview-gallery-name";
        nameEl.textContent = entry.name || "File";
        const sizeEl = document.createElement("span");
        sizeEl.className = "muted";
        sizeEl.textContent = formatBytes(entry.size);
        meta.appendChild(nameEl);
        meta.appendChild(sizeEl);

        const check = document.createElement("input");
        check.type = "checkbox";
        check.className = "share-preview-gallery-check";
        check.style.display = "none";
        check.onclick = (e) => e.stopPropagation();
        check.onchange = () => {
          if (!entry.relativePath) return;
          if (check.checked) previewDrawerState.selected.add(entry.relativePath);
          else previewDrawerState.selected.delete(entry.relativePath);
          renderSharePreviewDrawer();
        };

        btn.appendChild(thumbWrap);
        btn.appendChild(meta);
        btn.appendChild(check);

        btn.onclick = () => {
          previewDrawerState.currentIndex = index;
          renderSharePreviewDrawer();
        };
        btn.ondblclick = () => {
          previewDrawerState.currentIndex = index;
          renderSharePreviewDrawer();
        };

        previewDrawerState.galleryNodes.push({ btn, check, entry, index });
        galleryList.appendChild(btn);
      });
    }

    if (!previewDrawerState.galleryNodes || previewDrawerState.galleryNodes.length !== previewDrawerState.items.length) {
      buildGalleryOnce();
    }

    previewDrawerState.galleryNodes.forEach((node) => {
      const { btn, check, entry, index } = node;
      btn.classList.toggle("active", index === previewDrawerState.currentIndex);
      if (previewDrawerState.selectionMode) {
        const selectable = !!entry.relativePath;
        check.style.display = "";
        check.disabled = !selectable;
        check.checked = selectable && previewDrawerState.selected.has(entry.relativePath);
      } else {
        check.style.display = "none";
      }
    });
    const activeCard = galleryList.querySelector(".share-preview-gallery-item.active");
    if (activeCard && typeof activeCard.scrollIntoView === "function") {
      activeCard.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    el.classList.add("active");
  }

  function openSharePreviewDrawer(items, startIndex) {
    previewDrawerState.items = items || [];
    previewDrawerState.currentIndex = Math.max(0, startIndex || 0);
    previewDrawerState.galleryOpen = true;
    previewDrawerState.selectionMode = false;
    previewDrawerState.selected = new Set();
    previewDrawerState.galleryNodes = null;
    document.body.classList.add("share-preview-open");
    renderSharePreviewDrawer();
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
    allLink.href = buildShareUrl(`/share/${encodeURIComponent(shareId)}/download.zip`);
    allLink.textContent = "Download All (ZIP)";
    allLink.title = "Streams ZIP directly. Large folders may take minutes. If download fails, click again to retry.";
    controls.appendChild(allLink);

    if (folderPath && folderPath !== "/") {
      const folderZipLink = document.createElement("a");
      folderZipLink.className = "button secondary";
      folderZipLink.href = buildShareUrl(`/share/${encodeURIComponent(shareId)}/download.zip`, {
        paths: folderPath.replace(/^\//, ""),
      });
      folderZipLink.textContent = "Download Folder (ZIP)";
      folderZipLink.title = "Streams ZIP directly. If download fails, click again to retry.";
      controls.appendChild(folderZipLink);
    }

    const zipHint = document.createElement("div");
    zipHint.className = "muted";
    zipHint.style.fontSize = "12px";
    zipHint.style.marginTop = "6px";
    zipHint.textContent = "Large folders stream directly. If download fails, click again to retry.";
    controls.appendChild(zipHint);


    const selectedLink = document.createElement("button");
    selectedLink.className = "button secondary";
    selectedLink.textContent = "Download Selected (ZIP)";
    selectedLink.onclick = (event) => {
      event.preventDefault();
      if (!selectedPaths.size) return;
      const joined = Array.from(selectedPaths).join(",");
      window.location.href = buildShareUrl(`/share/${encodeURIComponent(shareId)}/download.zip`, {
        paths: joined,
      });
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

    const items = payload.items || [];
    const folders = items.filter((x) => x && x.type === "folder");
    const files = items.filter((x) => x && x.type !== "folder");

    function renderSectionTitle(text) {
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
      listEl.appendChild(renderSectionTitle("Folders"));
      folders.forEach((item) => {
        const row = document.createElement("div");
        row.className = "list-item";
        const left = document.createElement("div");
        left.className = "share-file-card";
        left.innerHTML =
          `<div class="share-file-card-thumb">${getPreviewThumbMarkup({
            name: item.name,
            type: item.type,
            previewUrl: "",
          })}</div>` +
          `<div class="share-file-card-body"><div>Folder: <span class="mono">${escapeHtml(item.name)}</span></div>` +
          `<div class="muted">—</div></div>`;
        row.appendChild(left);
        const openBtn = document.createElement("button");
        openBtn.className = "button";
        openBtn.textContent = "Open";
        openBtn.onclick = () => loadFolder(item.relativePath);
        row.appendChild(openBtn);
        listEl.appendChild(row);
      });
    }

    listEl.appendChild(renderSectionTitle("Files"));
    if (!files.length) {
      const emptyFiles = document.createElement("div");
      emptyFiles.className = "muted";
      emptyFiles.textContent = "No files in this folder.";
      listEl.appendChild(emptyFiles);
    } else {
      files.forEach((item) => {
        const row = document.createElement("div");
        row.className = "list-item";
        const left = document.createElement("div");
        left.className = "share-file-card";
        left.innerHTML =
          `<div class="share-file-card-thumb">${getPreviewThumbMarkup({
            name: item.name,
            type: item.type,
            previewUrl: item.previewUrl
              ? buildShareUrl(`/share/${encodeURIComponent(shareId)}/preview?path=${encodeURIComponent(item.relativePath)}`)
              : "",
          })}</div>` +
          `<div class="share-file-card-body"><div>File: <span class="mono">${escapeHtml(item.name)}</span></div>` +
          `<div class="muted">${formatBytes(item.size)}</div></div>`;
        row.appendChild(left);

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
        row.appendChild(renderFileDownloadButton(item.relativePath, item.size, item.name));

        if (item.previewUrl) {
          const previewBtn = document.createElement("button");
          previewBtn.className = "button secondary";
          previewBtn.textContent = "Preview";
          previewBtn.onclick = () => {
            const previewables = (items || [])
              .filter((x) => x.type === "file" && x.previewUrl)
              .map((x) => ({
                name: x.name,
                size: x.size,
                relativePath: x.relativePath,
                previewUrl: buildShareUrl(
                  `/share/${encodeURIComponent(shareId)}/preview?path=${encodeURIComponent(x.relativePath)}`
                ),
                downloadUrl: buildShareUrl(`/share/${encodeURIComponent(shareId)}/download`, {
                  path: x.relativePath,
                  download: "true",
                }),
              }));
            const startIndex = Math.max(0, previewables.findIndex((x) => x.name === item.name));
            openSharePreviewDrawer(previewables, startIndex);
          };
          row.appendChild(previewBtn);
        }

        listEl.appendChild(row);
      });
    }
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
    if (!res.ok) {
      const err = new Error(`Request failed: ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  async function loadFolder(folderPath) {
    currentFolderPath = folderPath || "/";
    selectedPaths = new Set();
    const pathParam = currentFolderPath === "/" ? "" : currentFolderPath.replace(/^\//, "");
    const filesUrl = buildShareUrl(`/share/${encodeURIComponent(shareId)}/files`, {
      path: pathParam ? pathParam.replace(/^\//, "") : undefined,
    });
    const files = await fetchJson(filesUrl);
    renderFolderList(files, currentFolderPath);
  }

  async function init() {
    if (!shareId) {
      setError("Invalid share link.");
      return;
    }
    try {
      const metaUrl = buildShareUrl(`/share/${encodeURIComponent(shareId)}/meta`);
      const meta = await fetchJson(metaUrl);
      titleEl.textContent = meta.name || "Shared Item";
      const sizeText = meta.targetType === "file" && Number.isFinite(meta.size) ? ` | Size: ${formatBytes(meta.size)}` : "";
      const expRaw = meta.expiresAt;
      const expDate = expRaw != null && expRaw !== "" ? new Date(expRaw) : null;
      const expLabel =
        expDate && Number.isFinite(expDate.getTime()) ? expDate.toLocaleString() : "No expiry shown";
      metaEl.textContent = `Type: ${meta.targetType === "folder" ? "Folder" : "File"}${sizeText} | Expires: ${expLabel}`;
      sharePermission = meta.permission || "read-only";

      actionsEl.innerHTML = "";
      if (meta.targetType === "file") {
        const direct = document.createElement("button");
        direct.className = "button";
        direct.textContent = "Download File";
        direct.onclick = (event) => {
          event.preventDefault();
          startResumableDownload(
            buildShareUrl(`/share/${encodeURIComponent(shareId)}/download`, { download: "true" }),
            meta.name || "download",
            Number.isFinite(meta.size) ? meta.size : undefined
          );
        };
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
          previewBtn.onclick = () =>
            openSharePreviewDrawer(
              [
                {
                  name: meta.name || "File",
                  size: meta.size,
                  previewUrl: buildShareUrl(`/share/${encodeURIComponent(shareId)}/preview`),
                  downloadUrl: buildShareUrl(`/share/${encodeURIComponent(shareId)}/download`, { download: "true" }),
                },
              ],
              0
            );
          actionsEl.appendChild(previewBtn);
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
      const st = error && error.status != null ? Number(error.status) : NaN;
      const msg = error && error.message ? String(error.message) : "";
      if (st === 404 || msg.includes("404")) {
        setError("This share link is invalid or has expired.");
      } else if (st === 423 || msg.includes("423")) {
        setError("Sharing is currently stopped on the host. Try again later.");
      } else {
        setError("Could not load this share. Check your connection and try again.");
      }
    }
  }

  document.addEventListener("keydown", (event) => {
    const drawer = document.getElementById("share-preview-drawer");
    if (!drawer || !drawer.classList.contains("active")) return;
    if (event.key === "Escape") closeSharePreviewDrawer();
    if (event.key === "ArrowLeft" && previewDrawerState.currentIndex > 0) {
      previewDrawerState.currentIndex -= 1;
      renderSharePreviewDrawer();
    }
    if (event.key === "ArrowRight" && previewDrawerState.currentIndex < previewDrawerState.items.length - 1) {
      previewDrawerState.currentIndex += 1;
      renderSharePreviewDrawer();
    }
  });

  init();
})();
