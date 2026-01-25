# JoinCloud Backend API (MVP)

Base URL (dev): `http://localhost:8787`

## Status

`GET /api/status`

Response
```json
{
  "status": "running",
  "tunnel": { "isRunning": true, "url": "https://xxxx.trycloudflare.com" },
  "webdav": { "path": "/dav", "readOnly": true }
}
```

## Files

`GET /api/files`

Response
```json
[
  {
    "id": "base64url",
    "name": "photo.png",
    "type": "file",
    "path": "/photo.png",
    "virtualPath": "/photo.png",
    "parentPath": "/",
    "size": 1024,
    "mimeType": "image/png",
    "createdAt": "2026-01-24T10:00:00.000Z",
    "updatedAt": "2026-01-24T10:00:00.000Z",
    "modifiedAt": "2026-01-24T10:00:00.000Z"
  }
]
```

`POST /api/folders`

Body
```json
{ "name": "New Folder", "parentPath": "/" }
```

`POST /api/upload` (multipart form)

Form fields:
- `files` (multi)
- `parentPath` (string)

`GET /api/files/:fileId/content`

Downloads or previews file.

`PATCH /api/files/:fileId`

Body
```json
{ "name": "renamed.txt" }
```

`DELETE /api/files/:fileId`

## Storage

`GET /api/storage`

Response
```json
{
  "totalSize": 1024,
  "fileCount": 4,
  "folderCount": 2,
  "usedPercentage": 1,
  "usedBytes": 1024,
  "totalBytes": 10737418240,
  "storagePath": "/Users/you/JoinCloud Vault"
}
```

## Shares

`GET /api/shares`

`GET /api/shares/:fileId/check`

Response
```json
{ "isShared": true, "share": { "id": "...", "tunnelUrl": "..." } }
```

`POST /api/shares`

Body
```json
{
  "fileId": "base64url",
  "duration": "24h",
  "password": "optional",
  "maxDownloads": 5,
  "accessType": "download"
}
```

`DELETE /api/shares/:shareId`

## Public Share

`POST /api/public/share/:shareToken/info`

Body
```json
{ "password": "optional" }
```

`GET /api/public/share/:shareToken/download?password=optional`

## WebDAV

Public WebDAV is available at:
`/dav`

Read-only methods only.

## Tunnel Control (UI compatibility)

`GET /api/ngrok/status`

`POST /api/ngrok/start`

`POST /api/ngrok/stop`
