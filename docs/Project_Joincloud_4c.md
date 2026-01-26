# JoinCloud Backend Architecture - Phase 4C

> Complete technical documentation for product planning and future updates

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [API Reference](#api-reference)
5. [Data Flow](#data-flow)
6. [Configuration](#configuration)
7. [Security Model](#security-model)
8. [Feature Status](#feature-status)
9. [Product Roadmap Opportunities](#product-roadmap-opportunities)

---

## System Overview

JoinCloud is a personal cloud node that enables:
- **Local file storage** via a private vault
- **WebDAV access** for native OS file mounting
- **Share links** with time-based expiration
- **Public access** via Cloudflare Tunnel (optional)
- **Network presence** via mDNS/Bonjour discovery
- **Telemetry** for usage analytics (opt-out available)

### Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js (CommonJS) |
| HTTP Server | Express.js + native `http.createServer` |
| File Protocol | WebDAV (`webdav-server` v2) |
| Desktop Shell | Electron |
| Tunnel | Cloudflare `cloudflared` (embedded binary) |
| Database | SQLite (telemetry only) |
| Discovery | Bonjour/mDNS (`bonjour` package) |
| Storage | Local filesystem |

### Ports

| Port | Purpose |
|------|---------|
| `8787` | Main server (UI + API + WebDAV) |
| `8788` | Share-only server (used by tunnel) |

---

## Project Structure

```
server/
├── index.js                 # Main entry point, bootstrap, API routes
├── config/
│   └── default.js           # Configuration with env overrides
├── webdav/
│   ├── ownerServer.js       # Authenticated WebDAV for owner
│   ├── shareServer.js       # Token-gated WebDAV for shares
│   └── mountManager.js      # Request router (owner vs share)
├── sharing/
│   ├── shareService.js      # Share CRUD, persistence
│   ├── expiryManager.js     # Background share expiration
│   ├── tokenGenerator.js    # Secure token generation
│   └── permissionResolver.js # Permission normalization
├── security/
│   └── pathGuard.js         # Path traversal protection
├── tunnel/
│   ├── TunnelManager.js     # Cloudflare tunnel lifecycle
│   ├── resolveBinary.js     # Platform-specific binary path
│   └── platform.js          # OS/arch detection
├── telemetry/
│   ├── store.js             # SQLite telemetry storage
│   └── sync.js              # Background sync to admin server
├── utils/
│   └── logger.js            # Structured JSON logging
├── ui/
│   ├── index.html           # Frontend HTML
│   ├── styles.css           # CSS (Phase 4C dark theme)
│   └── app.js               # Frontend JavaScript
├── bin/tunnel/              # Embedded cloudflared binaries
│   ├── darwin-arm64/tunnel
│   └── darwin-x64/tunnel
└── storage/
    ├── owner/               # User's files (default location)
    └── shares.json          # Persisted share records
```

---

## Core Components

### 1. Bootstrap (`index.js`)

**Purpose**: Application initialization and lifecycle management.

**Functions**:

| Function | Description |
|----------|-------------|
| `bootstrap()` | Main entry point - initializes all services |
| `ensureOwnerStorage()` | Creates storage directory if missing |
| `ensureShareStore()` | Creates share persistence directory |
| `ensureLogDir()` | Creates log directory |
| `ensureUserConfig()` | Creates/loads user config with UUID |
| `generateDisplayName()` | Generates random display name (e.g., `join_Orion`) |
| `getLanAddress()` | Detects local network IP address |
| `listDirectory()` | Lists files in a directory (excludes hidden files) |
| `getStorageStats()` | Calculates storage usage (bytes, file count) |
| `formatSharePath()` | Converts absolute path to relative share path |
| `toPosixPath()` | Normalizes path to POSIX format |
| `startUptimeTracker()` | Tracks app running time for telemetry |

**Lifecycle**:
```
bootstrap()
  ├── ensureOwnerStorage()      # Create ~/Library/Application Support/JoinCloud/storage
  ├── ensureShareStore()        # Create shares.json location
  ├── ensureLogDir()            # Create logs directory
  ├── createLogger()            # Initialize structured logger
  ├── ensureUserConfig()        # Load/create user.json with UUID
  ├── createTelemetryStore()    # Open SQLite database
  ├── createTelemetrySync()     # Start background sync
  ├── startUptimeTracker()      # Start 1-second uptime counter
  ├── createOwnerServer()       # WebDAV for owner (authenticated)
  ├── ShareService.init()       # Load shares from disk
  ├── ExpiryManager.start()     # Start expiration sweep
  ├── TunnelManager             # Ready for public access
  ├── createMountManager()      # Request router
  ├── Express routes            # API endpoints
  ├── HTTP servers              # Listen on ports
  └── Signal handlers           # Graceful shutdown
```

---

### 2. WebDAV Servers

#### 2.1 Owner Server (`webdav/ownerServer.js`)

**Purpose**: Authenticated WebDAV access for the device owner.

**Features**:
- HTTP Basic Authentication
- Full read/write access to storage root
- Compatible with macOS Finder, Windows Explorer

**Configuration**:
```javascript
{
  ownerRoot: "~/Library/Application Support/JoinCloud/storage",
  realm: "JoinCloud",
  username: "joincloud",
  password: "joincloud"
}
```

**Access URL**: `http://127.0.0.1:8787/dav`

---

#### 2.2 Share Server (`webdav/shareServer.js`)

**Purpose**: Unauthenticated WebDAV access for individual shares.

**Features**:
- Token-gated access (no authentication required)
- Scoped to single file/folder
- Permission-based (read-only or read-write)
- Proper Content-Type and Content-Disposition headers
- Download tracking via telemetry

**Key Logic**:
```javascript
// Before every request:
webdavServer.beforeRequest(async (ctx, callback) => {
  if (method === "GET" || method === "HEAD") {
    // Set Content-Type from file extension
    // Set Content-Disposition for download
    // Log download event
    // Track telemetry
  }
});
```

**Access URL**: `http://127.0.0.1:8787/share/<token>`

---

#### 2.3 Mount Manager (`webdav/mountManager.js`)

**Purpose**: Routes incoming requests to the correct WebDAV server.

**Routing Logic**:
```
Request URL
    │
    ├── /dav/*     → Owner Server (requires auth)
    │
    ├── /share/*   → Parse token from URL
    │                 → Lookup share in ShareService
    │                 → Route to Share Server (or 404)
    │
    └── Others     → Express API handlers
```

**Share Server Caching**: Creates share servers on-demand and caches them by `shareId`.

---

### 3. Share Service (`sharing/shareService.js`)

**Purpose**: Manages share lifecycle (create, read, revoke, expire).

**Data Model**:
```javascript
{
  shareId: "48-char-hex-string",
  targetPath: "/absolute/path/to/file",
  permission: "read-only" | "read-write",
  scope: "local" | "public",
  expiryTime: "2026-01-27T12:00:00.000Z",
  createdAt: "2026-01-26T12:00:00.000Z",
  revoked: false
}
```

**Methods**:

| Method | Description |
|--------|-------------|
| `init()` | Load shares from disk |
| `createShare({ targetPath, permission, ttlMs, scope })` | Create new share |
| `getShare(shareId)` | Get active share (null if revoked/expired) |
| `revokeShare(shareId)` | Mark share as revoked |
| `listShares()` | List all shares with computed status |
| `expireShares()` | Mark expired shares as revoked |
| `saveToDisk()` | Persist to `shares.json` |
| `loadFromDisk()` | Load from `shares.json` |

**Share Status Logic**:
```javascript
status = share.revoked 
  ? "revoked" 
  : (expiryTime <= now) 
    ? "expired" 
    : "active"
```

---

### 4. Expiry Manager (`sharing/expiryManager.js`)

**Purpose**: Background task to automatically expire shares.

**Behavior**:
- Runs every 60 seconds (configurable)
- Checks all shares for expiration
- Marks expired shares as `revoked: true`
- Persists changes to disk

---

### 5. Token Generator (`sharing/tokenGenerator.js`)

**Purpose**: Generate secure, unique share tokens.

**Implementation**:
```javascript
crypto.randomBytes(24).toString("hex")  // 48 hex characters
```

---

### 6. Tunnel Manager (`tunnel/TunnelManager.js`)

**Purpose**: Manage Cloudflare Tunnel for public internet access.

**States**:
| State | Description |
|-------|-------------|
| `stopped` | Tunnel not running |
| `starting` | Tunnel process spawned, waiting for URL |
| `active` | Public URL available and verified |
| `restarting` | Recovering from failure |
| `stopping` | Shutting down |
| `failed` | Unrecoverable error |

**Features**:
- Auto-restart with exponential backoff
- Max 3 restarts per 10-minute window
- URL verification via HTTPS GET
- Platform-specific binary resolution
- Graceful process termination

**Key Methods**:

| Method | Description |
|--------|-------------|
| `start()` | Start tunnel, return status |
| `stop()` | Stop tunnel, return status |
| `getStatus()` | Get current status object |

**Status Object**:
```javascript
{
  status: "active" | "starting" | "stopped" | "failed",
  publicUrl: "https://abc123.trycloudflare.com",
  reason: "Error message if failed",
  message: "User-friendly error"
}
```

---

### 7. Telemetry Store (`telemetry/store.js`)

**Purpose**: Local SQLite database for usage metrics.

**Schema**:
```sql
CREATE TABLE daily_metrics (
  date TEXT PRIMARY KEY,           -- "2026-01-26"
  uptime_seconds INTEGER,          -- App running time
  files_uploaded INTEGER,          -- File upload count
  files_downloaded INTEGER,        -- File download count
  bytes_uploaded INTEGER,          -- Upload bytes
  bytes_downloaded INTEGER,        -- Download bytes
  shares_created INTEGER,          -- Total shares created
  public_shares INTEGER,           -- Public scope shares
  lan_shares INTEGER               -- Local scope shares
);
```

**Methods**:

| Method | Description |
|--------|-------------|
| `trackEvent(name, meta)` | Record event by type |
| `addUptime(seconds)` | Increment uptime counter |
| `getDailyMetric(date)` | Get metrics for a date |
| `listDailyMetrics(sinceDate)` | Get all metrics since date |

**Tracked Events**:
- `app_started` - App launch
- `file_uploaded` - Files uploaded (count, bytes)
- `file_downloaded` - File downloaded (bytes)
- `share_created` - Share created (scope, permission)

---

### 8. Telemetry Sync (`telemetry/sync.js`)

**Purpose**: Periodically sync telemetry to admin server.

**Behavior**:
- Runs every 24 hours
- Also runs on app shutdown (flush)
- Respects `telemetry_enabled` setting
- POSTs to `https://{adminHost}/api/v1/telemetry`

**Payload**:
```javascript
{
  user_id: "jc_uuid",
  date: "2026-01-26",
  app_version: "0.3.1",
  os: "macOS",
  uptime_seconds: 3600,
  metrics: {
    files_uploaded: 5,
    files_downloaded: 10,
    bytes_uploaded: 1048576,
    bytes_downloaded: 2097152,
    shares_created: 3,
    public_shares: 1,
    lan_shares: 2
  }
}
```

---

### 9. Logger (`utils/logger.js`)

**Purpose**: Structured JSON logging with in-memory buffer.

**Features**:
- Writes to `~/Library/Application Support/JoinCloud/logs/server.log`
- Maintains in-memory ring buffer (max 200 entries)
- JSON format with timestamp, level, message, meta

**Log Entry**:
```javascript
{
  timestamp: "2026-01-26T12:00:00.000Z",
  level: "info" | "error",
  message: "upload completed",
  meta: { count: 3 }
}
```

---

### 10. Path Guard (`security/pathGuard.js`)

**Purpose**: Prevent directory traversal attacks.

**Methods**:

| Method | Description |
|--------|-------------|
| `resolveOwnerPath(root, path)` | Safely resolve path within root |
| `validateShareTarget(root, path)` | Validate share target is within root |

**Security Checks**:
1. Resolve symbolic links to real paths
2. Ensure resolved path starts with root path
3. Throw error if path escapes root

---

### 11. Network Presence (mDNS/Bonjour)

**Purpose**: Discover other JoinCloud users on local network.

**Service Type**: `joincloud._tcp.local`

**TXT Records**:
```
display_name=join_Orion
protocol=v1
```

**Functions**:

| Function | Description |
|----------|-------------|
| `startPresenceService()` | Broadcast own presence |
| `startPresenceBrowser()` | Discover other nodes |
| `updateDisplayName()` | Change display name |
| `isValidDisplayName()` | Validate name (max 32 chars, alphanumeric) |

---

## API Reference

### Status & Health

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Server status, LAN URL, storage label |
| `/api/v1/health` | GET | Simple health check (`{ status: "ok" }`) |

### Files

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/files?path=` | GET | List directory contents |
| `/api/upload` | POST | Upload files (multipart form) |
| `/api/storage` | GET | Storage stats (bytes, file count) |

### Shares

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/share` | POST | Create share (path, permission, ttlMs, scope) |
| `/api/shares` | GET | List all shares with status |
| `/api/share/:shareId` | DELETE | Revoke share |

### Public Access (Tunnel)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/public-access/status` | GET | Tunnel status |
| `/api/public-access/start` | POST | Start tunnel |
| `/api/public-access/stop` | POST | Stop tunnel |

### Logs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/logs` | GET | Get log buffer |
| `/api/v1/logs` | GET | Get log buffer (v1 alias) |

### Network

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/network` | GET | List discovered peers |
| `/api/v1/network/settings` | GET | Get display name, visibility |
| `/api/v1/network/settings` | POST | Update display name, visibility |

### Telemetry

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/telemetry/settings` | GET | Get telemetry enabled status |
| `/api/v1/telemetry/settings` | POST | Enable/disable telemetry |

### WebDAV

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/dav/*` | PROPFIND, GET, PUT, DELETE, MKCOL, COPY, MOVE | Owner WebDAV (authenticated) |
| `/share/<token>/*` | GET, PROPFIND | Share WebDAV (unauthenticated) |

---

## Data Flow

### File Upload
```
Client → POST /api/upload
           ↓
       Express multer (memory storage)
           ↓
       resolveOwnerPath() (security)
           ↓
       fs.writeFile() (save to disk)
           ↓
       telemetry.trackEvent("file_uploaded")
           ↓
       logger.info("upload completed")
           ↓
       Response: { success: true }
```

### Share Creation
```
Client → POST /api/share { path, permission, ttlMs, scope }
           ↓
       resolveOwnerPath() (security)
           ↓
       shareService.createShare()
           ├── generateShareId() (48-char token)
           ├── validateShareTarget() (security)
           ├── saveToDisk() (persist)
           ├── logger.info("share created")
           └── telemetry.trackEvent("share_created")
           ↓
       Response: { shareId, url, expiresAt }
```

### Share Access
```
Browser → GET /share/<token>/file.pdf
            ↓
        mountManager routes to share handler
            ↓
        shareService.getShare(token)
            ├── Check revoked → 404
            └── Check expired → 404
            ↓
        getShareServer() (cached WebDAV instance)
            ↓
        shareServer.beforeRequest()
            ├── Set Content-Type
            ├── Set Content-Disposition
            ├── logger.info("download requested")
            └── telemetry.trackEvent("file_downloaded")
            ↓
        webdavServer.executeRequest()
            ↓
        Response: File content
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `JOINCLOUD_HOST` | `0.0.0.0` | Server bind address |
| `JOINCLOUD_PORT` | `8787` | Main server port |
| `JOINCLOUD_SHARE_PORT` | `8788` | Share-only server port |
| `JOINCLOUD_STORAGE_ROOT` | `~/Library/.../storage` | File storage path |
| `JOINCLOUD_SHARE_STORE` | `.../storage/shares.json` | Share persistence path |
| `JOINCLOUD_LOG_DIR` | `.../logs` | Log directory |
| `JOINCLOUD_USER_CONFIG` | `.../config/user.json` | User config path |
| `JOINCLOUD_TELEMETRY_DB` | `.../telemetry/telemetry.db` | Telemetry database |
| `JOINCLOUD_USERNAME` | `joincloud` | WebDAV username |
| `JOINCLOUD_PASSWORD` | `joincloud` | WebDAV password |
| `JOINCLOUD_ADMIN_HOST` | `null` | Telemetry sync server |

### User Config (`user.json`)

```javascript
{
  "user_id": "jc_abc123...",
  "created_at": "2026-01-26T12:00:00.000Z",
  "telemetry_enabled": true,
  "telemetry_last_sync": "2026-01-26T12:00:00.000Z",
  "display_name": "join_Orion",
  "network_visibility": true
}
```

---

## Security Model

### Path Traversal Protection
- All paths normalized with `path.resolve()`
- Symbolic links resolved with `fs.realpath()`
- Paths verified to start with storage root
- Throws error on escape attempt

### Share Isolation
- Each share scoped to single file/folder
- WebDAV server rooted at share target
- Cannot navigate above share root
- Token required in URL (48 hex chars = 192 bits entropy)

### Authentication
- Owner WebDAV: HTTP Basic Auth (configurable)
- Share access: Token-only (no auth)
- API endpoints: No auth (localhost only)

### Tunnel Security
- Uses Cloudflare's secure tunnel protocol
- Only share endpoints exposed (not /dav, not /api)
- Temporary URLs (change on restart)

---

## Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| Local file storage | ✅ Complete | Full CRUD via WebDAV |
| File upload (UI) | ✅ Complete | Drag & drop, multi-file |
| Share creation | ✅ Complete | Token-based, time-limited |
| Share revocation | ✅ Complete | Immediate, persisted |
| Share expiration | ✅ Complete | Background sweep |
| Public access (tunnel) | ✅ Complete | Auto-restart, backoff |
| Network presence | ✅ Complete | mDNS discovery |
| Telemetry | ✅ Complete | SQLite, opt-out |
| Structured logging | ✅ Complete | JSON, in-memory buffer |
| Download headers | ✅ Complete | Content-Type, filename |
| Dark theme UI | ✅ Complete | Phase 4C colors |

---

## Product Roadmap Opportunities

### Short-term (v0.4.0)

| Feature | Effort | Impact |
|---------|--------|--------|
| Password-protected shares | Medium | High |
| Download count limits | Low | Medium |
| Share link preview page | Medium | High |
| File/folder creation in UI | Low | Medium |
| Delete files in UI | Low | Medium |

### Medium-term (v0.5.0)

| Feature | Effort | Impact |
|---------|--------|--------|
| Persistent public domain | High | High |
| File sync (desktop ↔ vault) | High | High |
| Share analytics dashboard | Medium | Medium |
| Folder zip download | Medium | Medium |
| Search files | Medium | Medium |

### Long-term (v1.0.0)

| Feature | Effort | Impact |
|---------|--------|--------|
| Mobile app | Very High | High |
| End-to-end encryption | High | High |
| Multi-user sharing | High | Medium |
| P2P file transfer | High | Medium |
| Self-hosted admin server | Medium | Medium |

### Technical Debt

| Item | Priority |
|------|----------|
| Add unit tests | High |
| Add integration tests | High |
| Migrate to TypeScript | Medium |
| Add rate limiting | Medium |
| Add request validation | Medium |
| Improve error handling | Medium |

---

## Quick Commands

```bash
# Start backend (development)
cd server && npm run dev

# Build Electron app
npm run build:mac

# Run Electron (development)
npm run electron:dev

# Check server health
curl http://127.0.0.1:8787/api/v1/health

# List files
curl http://127.0.0.1:8787/api/files

# Create share
curl -X POST http://127.0.0.1:8787/api/share \
  -H "Content-Type: application/json" \
  -d '{"path":"/example.pdf","ttlMs":3600000}'

# Get shares
curl http://127.0.0.1:8787/api/shares

# Revoke share
curl -X DELETE http://127.0.0.1:8787/api/share/<shareId>
```

---

*Document generated: January 26, 2026*
*Version: Phase 4C*
