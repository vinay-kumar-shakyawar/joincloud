# JoinCloud

JoinCloud is a local-first personal cloud application that allows users to share files securely from their own machine.

This repository contains the desktop application source code.

## Section 1 — High‑Level System Architecture
JoinCloud is an Electron desktop app with a separate Node backend process. The Electron **main** process spawns and monitors the backend, and loads a renderer UI. The backend exposes an HTTP API and WebDAV file server. Public sharing is implemented in the backend via a tunnel manager (ngrok). Telemetry runs inside the backend and periodically posts aggregated counters.

Communication paths:
- **Renderer UI → Backend:** HTTP requests to `http://127.0.0.1:8787/*`.
- **Electron main → Backend:** process spawn + health checks (no direct IPC for sharing).
- **Local file server (WebDAV) → Backend:** hosted in the same Node process; HTTP server routes to WebDAV handler.
- **Tunnel lifecycle → Backend:** `NgrokManager` manages ngrok child process and reports status.

## Section 2 — Language & Runtime Breakdown
Subsystem | Language | Runtime | Purpose
---|---|---|---
Electron main | JavaScript | Electron (Node) | Spawns backend, health checks, window lifecycle
Renderer/UI | TypeScript/JSX | Browser (Electron renderer) | User UI and API calls
Backend server | JavaScript | Node | HTTP API, WebDAV, sharing logic
ngrok manager | JavaScript | Node | Spawn ngrok, parse public URL, lifecycle
Local file server | JavaScript | Node (webdav-server) | Serve shared files over WebDAV/HTTP
Tunnel/public access | JavaScript | Node | `/api/public-access/*` and `/api/share` path
Telemetry | JavaScript | Node | Aggregate counters, post to admin

## Section 3 — Networking Responsibility Map (CRITICAL)
- **LAN sharing:** Backend owns it. URL built from request host in `server/index.js` (`/api/share`, `/api/shares`).
- **Local server binding:** Backend HTTP server binds `0.0.0.0:8787`, share‑only server binds `127.0.0.1:8788` (`server/index.js`).
- **Public URL generation:** Backend owns it via `NgrokManager.startTunnel()` in `server/ngrok/manager.js`.
- **External access:** ngrok exposes the backend share‑only port; backend returns the public URL once active.
- **Tunnel lifecycle:** Backend is authoritative. UI only triggers and queries status via HTTP.

Who decides if public sharing is possible:
- Backend, via `startPublicAccess()` and `NgrokManager` checks (domain, network, binary, timeout).

Who decides how it is implemented:
- Backend (ngrok only).

Who decides when it becomes active:
- Backend sets status to `active` only after `public_url` is parsed and HTTPS.

## Section 4 — Public Sharing Control Flow (End‑to‑End)
**Intended flow (code path):**  
User action → UI component (`share-dialog.tsx` or `share-files.tsx`)  
→ `POST /api/share` with `{ scope: "public" }`  
→ `server/index.js` `/api/share` handler  
→ `startPublicAccess()`  
→ `NgrokManager.startTunnel(port)`  
→ ngrok process emits `public_url`  
→ `startPublicAccess()` returns `{ status: "active", publicUrl }`  
→ `/api/share` returns public URL  
→ UI displays link.

**Actual observed flow per code and reported behavior:**  
UI sends `POST /api/share`, backend runs `/api/share`, but response fails with “Public sharing is unavailable on this system” when `startPublicAccess()` returns failed or missing `publicUrl`. The divergence happens **after** `/api/share` executes and **before** ngrok URL is produced.

## Section 5 — Capability & Gating Model
Guards that can block public sharing:

**UI‑level**
- `share-dialog.tsx`: only sends `scope: "public"` if user selects it; otherwise local only.
- `share-files.tsx`: always uses `/api/share` with `scope: "public"` now.

**Backend**
- `/api/share` handler (`server/index.js`):
  - Missing `path` → 400.
  - Path guard (`resolveOwnerPath`) rejects paths outside owner root.
  - `shareService.createShare()` rejects invalid targets.
  - **Critical guard:** if `status.status !== "active" || !status.publicUrl`, return error and revoke share.

**Ngrok manager (`server/ngrok/manager.js`)**
- Missing domain (`config.ngrok.domain`) → `ngrok_start_failed`.
- Network offline (DNS check) → `network_offline`.
- Binary missing or not executable → `ngrok_binary_missing`.
- Timeout without `public_url` → `ngrok_start_failed`.
- Immediate process exit → `ngrok_start_failed`.

Assumptions:
- Domain config exists.
- Network check succeeds quickly.
- Binary path exists and executable.
- ngrok emits JSON `public_url` to stdout.
If any assumption fails, backend returns the generic error without ever reaching “active”.

## Section 6 — Tooling & External Dependencies
- **ngrok:** Authoritative tunnel provider. Spawned by backend at `server/ngrok/manager.js` with JSON logs.
- **Cloudflare:** Legacy only. `server/tunnel/*` and `electron/main.js` binary check are unused for runtime sharing.
- **Node HTTP server:** Authoritative API and share server.
- **Electron IPC:** Used for app operations (open storage, stop server), not for sharing.
- **OS networking:** Backend binds HTTP ports; ngrok creates external access.

## Section 7 — Architectural Loophole Hypotheses
1) **Backend process boundary:** The backend runs as a spawned Node process (Electron main). Public sharing depends on logs/paths inside that process; UI cannot directly inspect its state. If the backend’s runtime environment differs (cwd/resources), ngrok may never produce `public_url` even though the UI request is correct. (Subsystems: Electron main → backend → ngrok manager)

2) **Async lifecycle mismatch:** `/api/share` demands an immediately active tunnel. If ngrok takes longer than the timeout to emit `public_url`, `/api/share` fails and revokes the share. (Subsystems: backend API guard + ngrok manager timeout)

3) **Status contract mismatch:** `startPublicAccess()` previously returned `ngrokManager.getStatus()` which may be stale or “starting,” and `/api/share` treats anything non‑active as a hard failure. (Subsystems: backend API guard + ngrok manager state)

4) **Static capability modeled in backend:** Missing domain or binary causes immediate failure with the generic message. This is a static capability gate inside the backend, not the UI. (Subsystems: backend config + ngrok manager)

## Section 8 — Single Most Likely Root Cause
The backend’s `/api/share` handler hard‑fails on any non‑active tunnel status, and `NgrokManager.startTunnel()` is not producing a `public_url` in time (or at all) within the backend process environment, causing a premature failure before the URL is available.

## Section 9 — Strategic Fix Direction (NO CODE)
Re‑assign public share readiness to the backend tunnel lifecycle rather than the synchronous `/api/share` response: the backend should own tunnel state transitions, and the UI should read tunnel readiness separately (or the backend should return a pending share state until the tunnel is active). This aligns ownership of public sharing with the component that actually controls the tunnel.
