# JoinCloud

JoinCloud is a local-first personal cloud application that allows users to share files securely from their own machine.

This repository contains the desktop application source code.

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Start local development (single command):

```bash
npm run dev
```

This launches Electron and starts the backend automatically.  
The app UI is served only from `server/ui`.

### Pointing Electron and Web to local dev

To use the **JoinCloud Web** dashboard and **Control Plane (JoinCloudAdmin)** on your machine:

1. **Root `.env`** (copy from `.env.example` if needed):
   - `JOINCLOUD_ADMIN_HOST=http://localhost:5000` — Control Plane URL
   - `JOINCLOUD_WEB_URL=http://localhost:3000` — JoinCloud Web URL for “Open Dashboard” and desktop auth

2. **JoinCloud-Web** (`JoinCloud-Web/.env`):
   - `NEXT_PUBLIC_CONTROL_PLANE_URL=http://localhost:5000` and `CONTROL_PLANE_URL=http://localhost:5000`

3. **Run all three** (each in its own terminal):
   - **Control Plane:** `cd JoinCloudAdmin && npm run dev` (port 5000)
   - **JoinCloud Web:** `cd JoinCloud-Web && npm run dev` (port 3000)
   - **Electron + server:** from repo root `npm run dev` (backend on 8787)

The Electron dev launcher loads the root `.env`, so the desktop app and its backend will use the local Admin and Web URLs.

## Package macOS DMG

```bash
npm run build:mac
```

## Package Windows installer

```bash
npm run build:win
```
