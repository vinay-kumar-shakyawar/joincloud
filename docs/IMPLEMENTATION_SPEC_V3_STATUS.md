# JoinCloud Implementation Spec v3 – Status

This document tracks implementation of the Full Implementation Specification (Speed · Reliability · Network Discovery · Team Workspace · Peer Chat).

## Done

### 1. WebRTC signaling (server)
- **`server/rtc/rtcSignal.js`** – WebSocket server on `/rtc/signal`; routes offer/answer/ice-candidate by `sessionId`; host-side peer via `node-datachannel` (optional, graceful fallback if native addon missing); receives file upload over DataChannel `file-transfer` (file-meta + chunk headers + binary), writes to `config.storage.ownerRoot`.
- **Wired in `server/index.js`** – `attachRTCSignaling(server, { config, logger })` after server creation.

### 2. Chunked resumable upload (server)
- **`server/upload/chunkUploadManager.js`** – Routes: `POST /api/v2/upload/init`, `PUT /api/v2/upload/chunk`, `POST /api/v2/upload/complete`, `GET /api/v2/upload/status/:uploadId`; temp dir `ownerRoot/.uploads-tmp/`; pre-allocated temp file; 6h TTL cleanup.
- **Wired in `server/index.js`** – `registerChunkUploadRoutes(app, config)`.

### 3. Peer connect (server)
- **`server/network/peerConnect.js`** – WebSocket upgrade at `/peer/connect`; hello/hello-ack handshake; `connectedPeers` Map; optional emitter for peer-connected/disconnected.
- **Wired in `server/index.js`** – `attachPeerConnect(server, discoveryManager, { logger, hostId, hostName })`.

### 4. Share page context
- **`server/index.js`** – `GET /share/:shareId/meta` now returns `hostName` (userConfig.display_name || os.hostname()) and `scope` (share.scope || 'local').
- **`server/ui/share-view.js`** – Shows “Shared by {hostName}”; “Team workspace share” badge when `scope === 'workspace'`; “Open in JoinCloud” button when `http://127.0.0.1:8787/api/status` responds (500ms timeout).

### 5. Service Worker and /sw.js
- **`server/ui/sw.js`** – Intercepts `PUT /api/v2/upload/chunk`, retries with backoff (1/2/4/8/16/30s), `postMessage` on retry success.
- **`server/index.js`** – `GET /sw.js` serves the file from `uiRoot` with `Service-Worker-Allowed: /`.

### 6. Dependencies
- **`server/package.json`** – Added `ws`, `uuid`, `node-datachannel` (optional native addon).

## Not done (spec v3)

- **DiscoveryManager UDP broadcast** – Dual discovery (mDNS + UDP on 47842) and peer registry fields (`connectionStatus`, `discoveredVia`, `connectedAt`, `unreadChatCount`).
- **TeamsStore over peer** – Workspace invites and chat over `/peer/connect` WebSocket; `getWorkspaceState()` and `GET /api/v1/teams/workspace-state`.
- **app.js client** – `JoinCloudRTC` class (connect, sendFile, backpressure, Wake Lock, 5s HTTP fallback); `ChunkUploader` (init, status, resume, IndexedDB, 4 parallel chunks); SW registration; upload path decision (WebRTC > 1MB, chunked > 10MB, else legacy).
- **share-view.js download** – WebRTC P2P download path (attempt first, then fallback to HTTP); real-time MB/s.
- **Folder zip** – Pre-build zip under `.uploads-tmp/`, Range/206, 2h cleanup.
- **Network tab UI** – Single list with Discovered/Connected/Offline badges; Add to Workspace / Start Chat only when Connected.

## How to run

From repo root (or `joincloud/server`):

```bash
cd joincloud/server && npm install && node index.js
```

If `node-datachannel` fails to build, the server still starts; WebRTC host-side receive will be disabled until the addon is available.
