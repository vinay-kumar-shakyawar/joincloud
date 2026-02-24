# JoinCloud Changelog

## v0.3.1 - Phase 4C (January 26, 2026)

### Bug Fixes

- **Active Shares not updating after revoke**: Fixed the issue where revoked shares remained visible in the Active Shares list. Now only active shares are displayed, and revoked/expired shares are immediately filtered out.

### UI/UX Improvements

#### New Dark Theme
Applied a refined dark theme with the following color system:

| Token | Hex Code | Usage |
|-------|----------|-------|
| Background | `#0A0A0F` | Main app background |
| Card/Surface | `#12121A` | Cards, panels, elevated surfaces |
| Primary (Brand Blue) | `#2FB7FF` | Buttons, links, active states |
| Foreground (Text) | `#FFFFFF` | Primary text |
| Muted (Secondary Text) | `#A1A1AA` | Secondary/helper text |
| Success | `#22C55E` | Active status badges |
| Warning | `#F59E0B` | Warning states |
| Error | `#EF4444` | Revoke button, error states |

#### Enhanced Logs Section
- Added contextual icons for each log type:
  - 📤 Upload actions
  - 📥 Download actions
  - 🔗 Share creation
  - 🚫 Share revocation
  - 🚀 App startup
  - ℹ️ General info
  - ⚠️ Warnings
  - ❌ Errors
- Cleaner time format (HH:MM:SS)
- Color-coded left border based on log level

#### File Browser
- Added file type icons:
  - 📁 Folders
  - 🖼️ Images (jpg, png, gif, webp, svg)
  - 📄 Documents (pdf, doc, txt)
  - 🎵 Audio (mp3, wav, flac)
  - 🎬 Video (mp4, mov, avi, mkv)
  - 📦 Archives (zip, rar, tar, gz)
  - 📜 Code files (js, ts, py, json)
- Improved item layout with icon containers
- Text truncation for long filenames

#### Active Shares
- Green "Active" badge for active shares
- Red "Revoke" button with danger styling
- Cleaner share info display

#### Network Section
- Grid layout for peer devices
- Public/Private status badges (matching reference design)
- Improved empty state messaging

#### General UI Polish
- Smooth hover transitions on all interactive elements
- Custom scrollbar matching dark theme
- Improved focus states on inputs
- Backdrop blur on modals
- Better empty state components across all sections:
  - "No active shares"
  - "No files yet"
  - "No logs yet"
  - "No devices found"

### Technical Changes

- `server/ui/styles.css`: Complete rewrite with CSS custom properties (variables)
- `server/ui/app.js`: 
  - `renderShares()`: Filters to only show `status === "active"`
  - `renderLogs()`: New formatting with icons and time display
  - `renderFiles()`: Added file type icons
  - `renderNetwork()`: Grid layout with status badges

---

## v0.3.0 - Phase 4B (January 2026)

### Features
- Structured JSON logging with in-memory ring buffer
- Log API endpoint (`/api/v1/logs`)
- Auto-refresh logs every 10 seconds
- Log refresh after upload, share, and revoke actions

### Bug Fixes
- Fixed download filename and extension in Content-Disposition headers
- Fixed share revoke immediate UI update

---

## v0.2.0 - Phase 3 (January 2026)

### Features
- mDNS/Bonjour network presence detection
- Display name customization (max 32 chars)
- Network visibility toggle
- Local telemetry with SQLite storage
- Telemetry opt-out setting

---

## v0.1.0 - Initial Release

### Features
- Local file storage vault
- WebDAV server for file access
- File upload via drag & drop
- Share link generation (local + public)
- Cloudflare Tunnel integration for public access
- Time-based share expiration
- Share revocation


Account and connection are not correct 
please in such a way so that we can track limit boundations as per the packages plan please make the correct management of accounts for pro plan of single user and teams plans and after payement update the db and fro show in control panel 

please remove my activate the device setup do not add using activate will add  device in plan of email which is not correct i thing you need to impove in accounts section

please make propfessional setup (like take reference from cursor setup of users for plans) 
- like cursor on starting want signin and limit the usages . make sure how joincloud electron can able  detect login via joincloud web website just like cursor do verify and connect with device
- once device is login free trails starts working and on after expiry please focus users to upgrade our plan  
- why after upgrade payment show Razorpay not configured please correct this setup 
- make surre whole setup fuctionality works and on upgrade JoinCloud electron must detect login and upgrade detail imediately 
- prepare proper flow moving from browser to destop app and destop app to website for smoother user experience 
- on clicking get pro make sure user first login 

- any device login can count the connected devices and limit on 5 devices for pro single users  