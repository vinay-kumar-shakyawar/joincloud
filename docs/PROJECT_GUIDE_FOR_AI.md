# JoinCloud – Project Guide for AI Assistants (ChatGPT, Cursor, etc.)

This document helps AI assistants understand the JoinCloud codebase so they can make changes, run tests, and verify results effectively.

---

## 1. Project Overview

**JoinCloud** is a local-first personal cloud desktop app. Users share files from their own machine over LAN. Key characteristics:

- **Electron** desktop app (macOS + Windows)
- **Express** HTTP server for API and UI
- **WebDAV** for storage access
- **No cloud backend** – everything runs locally
- **Device pairing** – remote devices need admin approval before access

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop | Electron 31.x |
| Backend | Node.js, Express 5.x |
| Storage | WebDAV (webdav-server), SQLite3 (telemetry) |
| Upload parsing | Busboy (streaming multipart) |
| UI (server-served) | Vanilla JS in `server/ui/` (app.js, share-view.js) |
| UI (optional client) | React, Vite, Tailwind (in `client/`) |
| Build | electron-builder |

---

## 3. Directory Structure

```
joincloud/
├── electron/           # Electron main process
│   ├── main.js         # App entry, window, backend process management
│   ├── preload.js      # IPC bridge for renderer
│   └── tests/          # Smoke tests
├── server/              # Backend (runs as child process or standalone)
│   ├── index.js        # Main Express app, all routes, upload/download logic
│   ├── config/         # default.js – ports, paths, env overrides
│   ├── sharing/        # ShareService, token generation, expiry
│   ├── webdav/         # WebDAV servers (owner, share)
│   ├── security/       # pathGuard – path resolution
│   ├── accessControl.js # Device approval, session tokens
│   ├── ui/             # Static UI served by Express
│   │   ├── index.html  # Main app
│   │   ├── share.html  # Share link page
│   │   ├── app.js      # Main app logic (vanilla JS)
│   │   ├── share-view.js # Share page logic
│   │   └── styles.css
│   └── ...
├── client/              # React/Vite app (optional, dev)
│   └── src/            # Pages, components, storage-api
├── scripts/             # run-electron.cjs, prepare-win-icon.cjs
├── build/               # Icons for packaging
├── assets/              # App assets
├── package.json
└── docs/                # Documentation
```

---

## 4. Key Files and Their Roles

| File | Purpose |
|------|---------|
| `server/index.js` | All HTTP routes, upload (busboy), download (streaming), share, diagnostics, API |
| `server/config/default.js` | Port 8787 (main), 8788 (share), storage paths |
| `server/ui/app.js` | Main app UI: files, shares, devices, copy link, upload |
| `server/ui/share-view.js` | Share link page: download, preview, copy link |
| `client/src/lib/storage-api.ts` | Storage API (Electron IPC or HTTP fetch) |
| `client/src/components/upload-zone.tsx` | Upload UI with per-file status |
| `electron/main.js` | Starts backend, manages window, health checks |

---

## 5. Development Workflow

### Start development

```bash
cd joincloud
npm install
npm run dev
```

This runs Electron and starts the backend. The app opens at `http://127.0.0.1:8787`.

### Backend only (no Electron)

```bash
npm run backend:dev
```

Runs `node server/index.js`. Useful for API testing.

### Ports

- **8787** – main server (API, UI, share)
- **8788** – share-only server (127.0.0.1)

---

## 6. Build Commands

```bash
# macOS DMG
npm run build:mac

# Windows installer + zip
npm run build:win
```

Outputs:

- Mac: `dist/JoinCloud-*.dmg`
- Windows: `dist/JoinCloud Setup *.exe`, `dist/JoinCloud-*-win.zip`

---

## 7. Important API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/health` | GET | Health check |
| `/api/v1/diagnostics/ping?bytes=N` | GET | Throughput test (streams N random bytes) |
| `/api/v1/diagnostics/info` | GET | Version, LAN IP, ports, uptime |
| `/api/upload` | POST | Multipart file upload (busboy, streaming) |
| `/api/v1/file/raw?path=` | PUT | Raw stream upload (fast path, no multipart parsing) |
| `/api/files?path=` | GET | List directory |
| `/share/:id` | GET | Share page (HTML) |
| `/share/:id/meta` | GET | Share metadata |
| `/share/:id/download` | GET | Download file (streaming) |
| `/share/:id/download.zip` | GET | Download folder as ZIP |
| `/api/v1/file/content?path=` | GET | File content (streaming) |

---

## 8. Current Known Issues and Pending Work

### LAN download speed (~3 MB/s)

- **Symptom:** Share download of large files (e.g. 700 MB) caps at ~3 MB/s on 5 GHz WiFi.
- **Diagnostic:** Ping test (`/api/v1/diagnostics/ping?bytes=104857600`) achieves ~184 MB/s on localhost.
- **Conclusion:** Bottleneck is in the **file streaming path**, not network or HTTP layer.
- **Cause:** HTTP response (`res`) has a small default writable buffer (~16 KB). `pipe()` causes frequent backpressure and limits throughput.
- **Planned fix:** Add a `PassThrough` stream with `highWaterMark: 1MB` (or 2MB) between the file read stream and `res` to reduce backpressure cycles and improve throughput.

### Upload speed improvements (applied)

- **Upload timeout:** 60 min (was 30 min) for large files
- **Socket tuning:** `socket.setNoDelay(true)` on all server connections
- **Upload route:** `req.socket.setNoDelay(true)` + optional `setRecvBufferSize(1MB)` if available

### Relevant code (share download)

In `server/index.js`, around line 1147:

```javascript
const readStream = fsSync.createReadStream(filePath, { highWaterMark: 1024 * 1024 });
readStream.pipe(res);
```

Suggested change: insert a `PassThrough` with larger `highWaterMark` between `readStream` and `res`.

---

## 9. Verification Checklist

After making changes, run:

1. **Throughput test (localhost):**
   ```bash
   curl -o /dev/null -w "Time: %{time_total}s | MB/s: %{speed_download}\n" \
     "http://127.0.0.1:8787/api/v1/diagnostics/ping?bytes=104857600"
   ```
   Expect: high MB/s (e.g. 100+).

2. **Share download (LAN):**
   - Upload a 200+ MB file, create share, download from another device.
   - Check server logs for `share download end` (bytes_sent, duration_ms, mb_per_sec).
   - Expect: MB/s significantly higher than 3 after fix.

3. **Upload:**
   - Upload a large video (200+ MB) from mobile or desktop.
   - Expect: completes without stall.

4. **Multi-file upload:**
   - Select 3–5 files, upload.
   - Expect: all appear with per-file status.

5. **Copy link:**
   - Copy share link on desktop and mobile.
   - Expect: "Copied!" or fallback selectable field.

6. **Raw upload fast path:**
   ```bash
   curl -T bigfile.bin "http://<HOST_LAN_IP>:8787/api/v1/file/raw?path=/Uploads/bigfile.bin"
   ```
   Requires auth (same as `/api/upload`). Check logs for `bytes_received`, `duration_ms`, `mb_per_sec`.

---

## 10. Constraints (Do Not Change)

- **Pairing/security:** Do not modify access control, session validation, or device approval logic.
- **LAN/WebDAV storage:** Do not change storage behavior beyond performance and upload stability.
- **Share link format:** Keep `/share/:id` and related routes.

---

## 11. Environment Variables

| Variable | Purpose |
|----------|---------|
| `JOINCLOUD_PORT` | Main server port (default 8787) |
| `JOINCLOUD_SHARE_PORT` | Share port (default 8788) |
| `JOINCLOUD_HOST` | Bind host (default 0.0.0.0) |
| `JOINCLOUD_STORAGE_ROOT` | Storage root path |

---

## 12. Quick Reference: Making the Download Fix

To fix the ~3 MB/s download limit:

1. In `server/index.js`, locate the share download handler (`app.get("/share/:shareId/download", ...)`).
2. Add `const { PassThrough } = require("stream");` at top if not present.
3. Replace:
   ```javascript
   readStream.pipe(res);
   ```
   with:
   ```javascript
   const passThrough = new stream.PassThrough({ highWaterMark: 1024 * 1024 });
   readStream.pipe(passThrough).pipe(res);
   ```
4. Restart the server and re-test share download over LAN.

---

## 13. Logs and Debugging

- Server logs: `server/utils/logger.js` – in-memory buffer, exposed at `/api/v1/logs`.
- Electron startup log: `~/Library/Application Support/JoinCloud-dev/startup.log` (macOS dev).
- Health URL: `http://127.0.0.1:8787/api/v1/health`.

---

*Last updated: Feb 2026. Version 0.3.3.*
