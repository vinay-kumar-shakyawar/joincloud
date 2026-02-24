# Testing Phase 2: Telemetry & Control Plane connection

This guide gets the Admin Control Plane and JoinCloud app connected so you can see telemetry and usage in the dashboard.

## 1. Start the Admin Control Plane

```bash
cd Admin-Control-Plane
npm install
npm run dev
```

- Dashboard and API will be at **http://localhost:5000**
- `.env` is loaded automatically (PORT=5000, JWT_SECRET). Edit `Admin-Control-Plane/.env` if needed.

## 2. Point JoinCloud at the Control Plane

**Option A – Use a `.env` file (recommended)**

In the **joincloud repo root** (same folder as `server/` and `electron/`):

```bash
cp .env.example .env
```

Edit `.env` and set:

```env
JOINCLOUD_ADMIN_HOST=http://localhost:5000
```

**Option B – Set env in the shell**

**Windows (PowerShell):**
```powershell
$env:JOINCLOUD_ADMIN_HOST="http://localhost:5000"
```

**macOS/Linux:**
```bash
export JOINCLOUD_ADMIN_HOST=http://localhost:5000
```

Then start JoinCloud (see step 3).

## 3. Run JoinCloud

**Electron app (full flow: host registration, usage aggregates, config):**

```bash
npm run dev
```

- Electron starts the backend with `JOINCLOUD_USER_DATA` set, so `host_uuid` is written and config/usage use it.
- Ensure the same env is visible to the process that runs Electron (e.g. set `JOINCLOUD_ADMIN_HOST` in the same terminal before `npm run dev`, or use a `.env` in the repo root with `dotenv` loaded by the server).

**Backend only (telemetry sync only, no host_uuid for usage):**

```bash
npm run backend:dev
```

- Set `JOINCLOUD_ADMIN_HOST=http://localhost:5000` (and optionally `JOINCLOUD_USER_DATA` to a path that has a `JoinCloud/system/host_uuid` file if you want usage aggregates).

## 4. Enable telemetry in JoinCloud

1. Open the JoinCloud UI (Electron window or http://127.0.0.1:8787).
2. Go to **Settings**.
3. Turn **Telemetry** **On** (so daily telemetry is sent to the Control Plane).

Usage aggregates (Phase 2) are sent when the host is idle or every 24h; they do not require a separate toggle.

## 5. What to check in the Admin dashboard

- **Dashboard** – Total users, active users (7d), daily activity, version/OS distribution.
- **Hosts** – Registered hosts (from Electron); heartbeats update “last seen”.
- **Users** – Device list (from legacy telemetry ingest).
- **Usage** – Phase 2 usage aggregates (host uptime, storage, bytes up/down, shares, devices) after at least one send (idle or 24h).
- **Accounts** – After you use the auth API (register/login).
- **Licenses** – After activation (license/activate).

## 6. Quick sanity checks

- **Health:** `curl http://localhost:5000/health`
- **Config (no host):** `curl "http://localhost:5000/api/v1/config"`
- **Config (with host):** `curl "http://localhost:5000/api/v1/config?host_uuid=YOUR_HOST_UUID"` (use a real host_uuid from the Hosts page if needed).

## 7. Troubleshooting

| Issue | What to do |
|-------|------------|
| No telemetry in dashboard | Ensure telemetry is enabled in JoinCloud Settings and `JOINCLOUD_ADMIN_HOST` is set. Restart JoinCloud. |
| No hosts listed | Run the **Electron** app (not only backend) so host registration runs; check `JOINCLOUD_ADMIN_HOST` (or `JOINCLOUD_CONTROL_PLANE_URL`) is set before Electron starts. |
| No usage aggregates | Usage is sent when idle (~15 min) or every 24h. Ensure Electron was used (so `host_uuid` exists under userData). Wait or trigger a flush by closing the app gracefully. |
| Connection refused | Start Admin first (`cd Admin-Control-Plane && npm run dev`), then JoinCloud. Use `http://localhost:5000` for local testing. |
