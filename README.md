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

## Package macOS DMG

```bash
npm run build:mac
```

## Package Windows installer

```bash
npm run build:win
```
