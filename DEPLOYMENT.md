# JoinCloud Deployment Guide

This guide explains how to host the **Admin Control Plane** and **JoinCloud** (server and/or Electron app) and how to set all environment variables for production so that only you can track and manage devices.

---

## Overview

| Component | Purpose |
|-----------|---------|
| **Admin Control Plane** | Web dashboard: users/devices, telemetry, support chat, accounts, licenses, usage. Must be reachable over HTTPS in production. |
| **JoinCloud server** | Runs inside the Electron app or standalone; serves files, shares, and UI. Sends telemetry/heartbeats to the Control Plane when `JOINCLOUD_ADMIN_HOST` is set. |
| **JoinCloud Electron app** | Desktop app that spawns the server and opens the UI. Passes `JOINCLOUD_ADMIN_HOST` from the environment to the server. |

**Production tracking:** Only devices that have `JOINCLOUD_ADMIN_HOST` set to **your** Control Plane URL will report to your dashboard. So you control tracking by:

1. Deploying the Control Plane on a server only you (or your team) can access.
2. Setting `JOINCLOUD_ADMIN_HOST` only in **your** builds or in **your** deployment config so only those instances report to you.

---

## Part 1: Hosting the Admin Control Plane

### 1.1 Build and run

```bash
cd Admin-Control-Plane
npm install
npm run build
NODE_ENV=production node dist/index.cjs
```

Or in development (Vite + API on one port):

```bash
npm run dev
```

The app listens on **PORT** (default `5000`). In production you should put a reverse proxy (e.g. Nginx, Caddy) in front with HTTPS.

### 1.2 Control Plane environment variables

| Variable | Required | Description | Production |
|----------|----------|-------------|------------|
| **PORT** | No | HTTP port (default `5000`). | Set if you need a different port (e.g. `8080`). |
| **NODE_ENV** | No | `production` for static build, no Vite. | Set to `production`. |
| **JWT_SECRET** | Yes in prod | Secret for JWT (auth tokens). | **Set a long random secret.** Never use the default. |
| **JOINCLOUD_LICENSE_PRIVATE_KEY** | No | Ed25519 private key PEM for signing licenses. If unset, a dev key is used. | Set for production so licenses are signed with your key. |
| **JOINCLOUD_CONTROL_PLANE_DB_PATH** | No | Full path to the SQLite database file. | **See section 1.3 below.** |
| **DATABASE_URL** | No* | Postgres URL for Drizzle. *The current app uses SQLite in `storage.ts`; this is only for optional/future Postgres. | Leave unset unless you switch to Postgres. |

### 1.3 Setting JOINCLOUD_CONTROL_PLANE_DB_PATH in production

The Control Plane stores all data in a single SQLite file. By default it uses:

- Path: `data/telemetry.db` relative to the **current working directory** (e.g. `Admin-Control-Plane/data/telemetry.db` when you run from the repo root).

In production you should:

1. **Use an absolute path** so the DB location does not depend on where you start the process.
2. **Put the DB on a persistent volume** (not an ephemeral container filesystem).
3. **Ensure the directory exists** and the process has read/write permissions.

**Examples:**

**Linux (systemd or shell):**
```bash
export JOINCLOUD_CONTROL_PLANE_DB_PATH=/var/lib/joincloud-control-plane/telemetry.db
# Create dir and run (as the app user)
mkdir -p /var/lib/joincloud-control-plane
NODE_ENV=production node dist/index.cjs
```

**Docker:**
```dockerfile
ENV JOINCLOUD_CONTROL_PLANE_DB_PATH=/data/telemetry.db
VOLUME /data
```
Then run with a volume: `docker run -v /host/path:/data ...`

**Windows (PowerShell):**
```powershell
$env:JOINCLOUD_CONTROL_PLANE_DB_PATH = "C:\ProgramData\JoinCloudControlPlane\telemetry.db"
# Create C:\ProgramData\JoinCloudControlPlane if needed
node dist\index.cjs
```

**Example .env for Control Plane (production):**
```env
PORT=5000
NODE_ENV=production
JWT_SECRET=your-long-random-secret-at-least-32-chars

# SQLite DB: absolute path on a persistent volume
JOINCLOUD_CONTROL_PLANE_DB_PATH=/var/lib/joincloud-control-plane/telemetry.db

# Optional: license signing (generate and keep private key secret)
# JOINCLOUD_LICENSE_PRIVATE_KEY=...
```

---

## Part 2: Hosting JoinCloud (server only or Electron)

### 2.1 JoinCloud server (standalone, e.g. headless Linux)

Used when you run the server without the Electron UI (e.g. on a NAS or server).

```bash
cd server
npm install
node index.js
```

The server reads config from `server/config/default.js` and env vars. Default ports: **8787** (main), **8788** (share). Set **JOINCLOUD_ADMIN_HOST** to your Control Plane URL so this instance reports to you.

### 2.2 JoinCloud Electron app (desktop)

The Electron app spawns the server and passes through environment variables. Set **JOINCLOUD_ADMIN_HOST** (or **JOINCLOUD_CONTROL_PLANE_URL**) in the environment **before** starting the app so that the spawned server sends telemetry and heartbeats to your Control Plane.

- **Development:** Set in a `.env` in the repo root (or in your shell). The root `.env` is not always auto-loaded by Electron; you can use `dotenv` in a small launcher or export vars in your shell.
- **Production / packaged app:** Set via the installer, a config file your installer writes, or a launcher script that exports the vars then starts the app. Only builds/configs where you set this URL will report to your Control Plane.

### 2.3 JoinCloud environment variables

| Variable | Required | Description | Production |
|----------|----------|-------------|------------|
| **JOINCLOUD_ADMIN_HOST** | For tracking | Control Plane URL (host:port or full URL). When set, the app registers, sends heartbeats, syncs telemetry, and uses support/activation. | Set to **your** Control Plane URL (e.g. `https://admin.yourdomain.com`). Only then will this instance be tracked by you. |
| **JOINCLOUD_CONTROL_PLANE_URL** | Alternative | Full URL; Electron can derive host from this if `JOINCLOUD_ADMIN_HOST` is unset. | Same as above if you use this instead. |
| **JOINCLOUD_UPGRADE_URL** | No | Shown in activation UI as “Upgrade / Buy plan” link. | Set to your pricing/checkout page if you want the link. |
| **JOINCLOUD_HOST** | No | Bind address (default `0.0.0.0`). | Usually keep default. |
| **JOINCLOUD_PORT** | No | Main server port (default `8787`). | Set if you need a different port. |
| **JOINCLOUD_SHARE_PORT** | No | Share server port (default `8788`). | Set if needed. |
| **JOINCLOUD_PUBLIC_BASE_URL** | No | Public URL for shares (e.g. for tunnel). | Set in production if you use a public URL. |
| **JOINCLOUD_USERNAME** / **JOINCLOUD_PASSWORD** | No | WebDAV/basic auth. | Set strong credentials in production. |
| **JOINCLOUD_STORAGE_ROOT** | No | Root folder for files. | Set to a persistent path. |
| **JOINCLOUD_USER_CONFIG** | No | Path to user config JSON. | Override if you use a custom layout. |
| **JOINCLOUD_TELEMETRY_DB** | No | Path to telemetry SQLite. | Override for custom path. |
| **JOINCLOUD_USER_DATA** | No | Set by Electron to `userData`; used for auth, license, host_uuid. | Do not set when running under Electron; set for standalone if needed. |
| **JOINCLOUD_LICENSE_PUBLIC_KEY** | No | Ed25519 public key PEM for verifying licenses (license-engine). | Set if Control Plane uses a custom key so the app can verify signatures. |

**Example .env for JoinCloud (production, reporting to your Control Plane):**
```env
# Your Control Plane – only instances with this URL report to you
JOINCLOUD_ADMIN_HOST=https://admin.yourdomain.com

# Optional: upgrade link in activation UI
JOINCLOUD_UPGRADE_URL=https://yourdomain.com/pricing

# Optional: stronger auth and storage
JOINCLOUD_USERNAME=your-admin-user
JOINCLOUD_PASSWORD=your-secure-password
JOINCLOUD_STORAGE_ROOT=/var/lib/joincloud/storage
```

---

## Part 3: “Only I can track in production”

To ensure only you (or your organization) can track and manage devices:

1. **Use your own Control Plane URL**  
   Set `JOINCLOUD_ADMIN_HOST` only in the builds or deployment configs that you control. Do not ship a default that points to your dashboard; leave it unset in public/default builds so they do not report anywhere (or point to a URL you don’t use).

2. **Secure the Control Plane**  
   - Serve over **HTTPS** (reverse proxy with TLS).  
   - Use a strong **JWT_SECRET** and good auth (login).  
   - Restrict access: firewall, VPN, or IP allowlist so only you (or your team) can open the admin UI and API.

3. **Restrict who gets the URL**  
   In production, only give `JOINCLOUD_ADMIN_HOST` (or the Control Plane URL) to installs you intend to manage (e.g. your company’s devices or customers you onboard). Don’t put the URL in public docs or default .env committed to the repo.

4. **Database and secrets**  
   - Set **JOINCLOUD_CONTROL_PLANE_DB_PATH** to a path on a persistent volume (see 1.3).  
   - Keep **JWT_SECRET** and **JOINCLOUD_LICENSE_PRIVATE_KEY** in a secure place (e.g. secrets manager or env only, not in repo).

---

## Part 4: Quick reference – where to set what

| Goal | Where to set |
|------|----------------|
| Control Plane port | Control Plane: **PORT** (e.g. in `.env` or systemd/docker). |
| Control Plane DB path in production | Control Plane: **JOINCLOUD_CONTROL_PLANE_DB_PATH** (absolute path). |
| Only my installs report to my dashboard | JoinCloud (each install): **JOINCLOUD_ADMIN_HOST** = your Control Plane URL. Set only in your builds/config. |
| Upgrade link in JoinCloud activation UI | JoinCloud: **JOINCLOUD_UPGRADE_URL**. |
| License signing in production | Control Plane: **JOINCLOUD_LICENSE_PRIVATE_KEY**; JoinCloud (optional): **JOINCLOUD_LICENSE_PUBLIC_KEY** for verification. |

---

## Part 5: Data and DB management

For where the Control Plane stores data, how to back up, and how to manage the SQLite file, see:

- **Admin-Control-Plane/DATA_AND_DB.md**

That file also explains that the main app uses SQLite (and **JOINCLOUD_CONTROL_PLANE_DB_PATH**), not **DATABASE_URL** (Postgres is optional/future).
