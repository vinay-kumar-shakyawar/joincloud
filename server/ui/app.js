const state = {
  path: "/",
  items: [],
  rawItems: [],
  shares: [],
  requestId: null,
  isAdmin: false,
  sharingEnabled: true,
  fileView: "list",
  fileSort: "name_asc",
  fileSearch: "",
  foldersOnly: false,
  selectedShares: new Set(),
  accessRole: "host",
  deviceId: null,
  deviceName: null,
  deviceFolderRel: null,
  licenseState: null,
  licenseGraceEndsAt: null,
  licenseTier: null,
  licenseExpiresAt: null,
  licenseDeviceLimit: null,
  activationRequired: false,
  trialDays: 7,
  upgradeUrl: "",
  subscription: null,
  supportMessages: [],
  accountId: null,
  hostUuidFromConfig: null,
  accountEmail: null,
  isAuthenticated: false,
  displayName: "Join",
  entitlements: null,
  trialEndsAt: null,
  canExtendTrial: false,
  isSuspended: false,
  isRevoked: false,
  referralCode: null,
  referralCount: 0,
  daysRemaining: null,
  devMode: false,
  devExpiryWarningMinutes: 2,
  usageSharesThisMonth: 0,
  usageDevicesLinked: 0,
  serverStatus: "online", // "online" | "offline"
  lastServerSuccessAt: 0,
  serverFailureStreak: 0,
};

// Current tab for Shares list: 'local' or 'public'
const stateShareTab = {
  current: "local",
};

const els = {
  appLayout: document.getElementById("app-layout"),
  accessGate: document.getElementById("access-gate"),
  activationGate: document.getElementById("activation-gate"),
  activationGateSigninWeb: document.getElementById("activation-gate-signin-web"),
  activationGateExtendTrial: document.getElementById("activation-gate-extend-trial"),
  activationGateMessage: document.getElementById("activation-gate-message"),
  activationGateUpgradeWrap: document.getElementById("activation-gate-upgrade-wrap"),
  activationGateExtendLink: document.getElementById("activation-gate-extend-link"),
  activationGateUpgradeLink: document.getElementById("activation-gate-upgrade-link"),
  activationGateRetry: document.getElementById("activation-gate-retry"),
  accessDeviceNameInput: document.getElementById("access-device-name-input"),
  accessFingerprint: document.getElementById("access-fingerprint"),
  accessStatus: document.getElementById("access-status"),
  requestApproval: document.getElementById("request-approval"),
  pendingBadge: document.getElementById("pending-badge"),
  menuToggle: document.getElementById("menu-toggle"),
  addFileHeader: document.getElementById("add-file-header"),
  toggleSharing: document.getElementById("toggle-sharing"),
  statusDot: document.getElementById("status-dot"),
  status: document.getElementById("node-status"),
  networkStatusBadge: document.getElementById("network-status-badge"),
  uploadDestinationLabel: document.getElementById("upload-destination-label"),
  headerDisplayName: document.getElementById("header-display-name"),
  homeStorageSection: document.getElementById("home-storage-section"),
  storageLabel: document.getElementById("storage-label"),
  ownerMount: document.getElementById("owner-mount"),
  openStorage: document.getElementById("open-storage"),
  homeRemoteAccessToggle: document.getElementById("home-remote-access-toggle"),
  homeRemoteAccessSettings: document.getElementById("home-remote-access-settings"),
  remoteCloudUrlInput: document.getElementById("remote-cloud-url-input"),
  remoteCloudCopy: document.getElementById("remote-cloud-copy"),
  remoteCloudUrlQr: document.getElementById("remote-cloud-url-qr"),
  remoteCloudActiveWrap: document.getElementById("remote-cloud-active-wrap"),
  remoteCloudQrWrap: document.getElementById("remote-cloud-qr-wrap"),
  remoteCloudSetupCta: document.getElementById("remote-cloud-setup-cta"),
  remoteCloudSetupBtn: document.getElementById("remote-cloud-setup-btn"),
  cloudUrlInput: document.getElementById("cloud-url-input"),
  copyCloudUrl: document.getElementById("copy-cloud-url"),
  cloudUrlQr: document.getElementById("cloud-url-qr"),
  pendingAccessList: document.getElementById("pending-access-list"),
  pendingAccessCount: document.getElementById("pending-access-count"),
  approvedDevicesList: document.getElementById("approved-devices-list"),
  refreshDevices: document.getElementById("refresh-devices"),
  refreshActivity: document.getElementById("refresh-activity"),
  activitySummary: document.getElementById("activity-summary"),
  metricTotalUploads: document.getElementById("metric-total-uploads"),
  metricTotalDownloads: document.getElementById("metric-total-downloads"),
  metricSharesCreated: document.getElementById("metric-shares-created"),
  metricConnectedDevices: document.getElementById("metric-connected-devices"),
  metricStorageUsed: document.getElementById("metric-storage-used"),
  metricShareDownloads: document.getElementById("metric-share-downloads"),
  activityChart: document.getElementById("activity-chart"),
  fileList: document.getElementById("file-list"),
  fileSearch: document.getElementById("file-search"),
  fileSort: document.getElementById("file-sort"),
  foldersOnly: document.getElementById("folders-only"),
  viewList: document.getElementById("view-list"),
  viewThumb: document.getElementById("view-thumb"),
  myFolderShortcut: document.getElementById("my-folder-shortcut"),
  uploadScopeHint: document.getElementById("upload-scope-hint"),
  uploadButtonLabel: document.getElementById("upload-button-label"),
  shareList: document.getElementById("share-list"),
  teamsList: document.getElementById("teams-list"),
  teamsEmptyState: document.getElementById("teams-empty-state"),
  teamsLayout: document.getElementById("teams-layout"),
  teamsLockedOverlay: document.getElementById("teams-locked-overlay"),
  teamsLockedTitle: document.getElementById("teams-locked-title"),
  teamsLockedText: document.getElementById("teams-locked-text"),
  teamsLockedUpgrade: document.getElementById("teams-locked-upgrade"),
  teamDetail: document.getElementById("team-detail"),
  teamDetailBack: document.getElementById("team-detail-back"),
  teamToggleRight: document.getElementById("team-toggle-right"),
  teamsRightCollapseBtn: document.getElementById("teams-right-collapse-btn"),
  teamDetailName: document.getElementById("team-detail-name"),
  teamChatFeed: document.getElementById("team-chat-feed"),
  teamMessageInput: document.getElementById("team-message-input"),
  teamSendBtn: document.getElementById("team-send-btn"),
  teamInviteBtn: document.getElementById("team-invite-btn"),
  createTeamBtn: document.getElementById("create-team-btn"),
  startNewPeerChatBtn: document.getElementById("start-new-peer-chat-btn"),
  breadcrumbs: document.getElementById("breadcrumbs"),
  refreshFiles: document.getElementById("refresh-files"),
  refreshShares: document.getElementById("refresh-shares"),
  revokeSelected: document.getElementById("revoke-selected"),
  revokeAll: document.getElementById("revoke-all"),
  refreshLogs: document.getElementById("refresh-logs"),
  logList: document.getElementById("log-list"),
  networkList: document.getElementById("network-list"),
  telemetryToggle: document.getElementById("telemetry-toggle"),
  networkNameSuffix: document.getElementById("network-name-suffix"),
  saveNetworkName: document.getElementById("save-network-name"),
  networkVisibility: document.getElementById("network-visibility"),
  networkVisibilityNetwork: document.getElementById("network-visibility-network"),
  navButtons: document.querySelectorAll(".nav-button"),
  sections: document.querySelectorAll(".section"),
  backButton: document.getElementById("back-button"),
  uploadInput: document.getElementById("upload-input"),
  dropZone: document.getElementById("drop-zone"),
  shareModal: document.getElementById("share-modal"),
  sharePath: document.getElementById("share-path"),
  sharePermission: document.getElementById("share-permission"),
  shareTtl: document.getElementById("share-ttl"),
  shareTtlCustom: document.getElementById("share-ttl-custom"),
  createShare: document.getElementById("create-share"),
  closeModal: document.getElementById("close-modal"),
  cancelShare: document.getElementById("cancel-share"),
  shareResult: document.getElementById("share-result"),
  copyShare: document.getElementById("copy-share"),
  stopModal: document.getElementById("sharing-stop-modal"),
  closeStopModal: document.getElementById("close-stop-modal"),
  cancelStopModal: document.getElementById("cancel-stop-modal"),
  stopSharingOnly: document.getElementById("stop-sharing-only"),
  closeApplication: document.getElementById("close-application"),
  shareVisitTotal: document.getElementById("share-visit-total"),
  shareVisitToday: document.getElementById("share-visit-today"),
  copyPrivacyPolicy: document.getElementById("copy-privacy-policy"),
  downloadPrivacyPolicy: document.getElementById("download-privacy-policy"),
  privacyPolicyContent: document.getElementById("privacy-policy-content"),
  buildId: document.getElementById("build-id"),
  graceBanner: document.getElementById("grace-banner"),
  graceEndsDate: document.getElementById("grace-ends-date"),
  settingsProfileRow: document.getElementById("settings-profile-row"),
  settingsProfileValue: document.getElementById("settings-profile-value"),
  settingsProfileCard: document.getElementById("settings-profile-card"),
  settingsProfileEmail: document.getElementById("settings-profile-email"),
  settingsProfilePlan: document.getElementById("settings-profile-plan"),
  settingsProfileStatus: document.getElementById("settings-profile-status"),
  settingsServerStatus: document.getElementById("settings-server-status"),
  settingsProfileDeviceLimit: document.getElementById("settings-profile-device-limit"),
  settingsProfileExpiry: document.getElementById("settings-profile-expiry"),
  subscriptionCard: document.getElementById("subscription-card"),
  subscriptionPlan: document.getElementById("subscription-plan"),
  subscriptionStatus: document.getElementById("subscription-status"),
  subscriptionRenewal: document.getElementById("subscription-renewal"),
  subscriptionManageBtn: document.getElementById("subscription-manage-btn"),
  subscriptionUpgradeLink: document.getElementById("subscription-upgrade-link"),
  subscriptionExtendTrialLink: document.getElementById("subscription-extend-trial-link"),
  settingsOpenDashboardLink: document.getElementById("settings-open-dashboard-link"),
  subscriptionHelperText: document.getElementById("subscription-helper-text"),
  settingsLogout: document.getElementById("settings-logout"),
  uptimeDisplay: document.getElementById("uptime-display"),
  previewModal: document.getElementById("preview-modal"),
  closePreviewModal: document.getElementById("close-preview-modal"),
  previewTitle: document.getElementById("preview-title"),
  previewBody: document.getElementById("preview-body"),
  activationBlock: document.getElementById("activation-block"),
  activationEmail: document.getElementById("activation-email"),
  activationPassword: document.getElementById("activation-password"),
  activationRegister: document.getElementById("activation-register"),
  activationLogin: document.getElementById("activation-login"),
  activationActivate: document.getElementById("activation-activate"),
  activationSigninWeb: document.getElementById("activation-signin-web"),
  activationMessage: document.getElementById("activation-message"),
  activationUpgradeWrap: document.getElementById("activation-upgrade-wrap"),
  activationUpgradeLink: document.getElementById("activation-upgrade-link"),
  supportMessages: document.getElementById("support-messages"),
  supportMessageInput: document.getElementById("support-message-input"),
  supportSend: document.getElementById("support-send"),
  uploadBanner: document.getElementById("upload-banner"),
  uploadBannerText: document.querySelector(".upload-banner-text"),
  uploadBannerDismiss: document.querySelector(".upload-banner-dismiss"),
  shareQrModal: document.getElementById("share-qr-modal"),
  closeShareQrModal: document.getElementById("close-share-qr-modal"),
  deleteSharedItemModal: document.getElementById("delete-shared-item-modal"),
  deleteSharedItemCancelTop: document.getElementById("delete-shared-item-cancel-top"),
  deleteSharedItemCancel: document.getElementById("delete-shared-item-cancel"),
  deleteSharedItemStopOnly: document.getElementById("delete-shared-item-stop-only"),
  deleteSharedItemStopAndDelete: document.getElementById("delete-shared-item-stop-and-delete"),
  deleteSharedItemTitle: document.getElementById("delete-shared-item-title"),
  deleteSharedItemDescription: document.getElementById("delete-shared-item-description"),
  deleteSharedItemPath: document.getElementById("delete-shared-item-path"),
  technicalConfigContent: document.getElementById("technical-config-content"),
  mdnsHostname: document.getElementById("mdns-hostname"),
  mdnsIpFallback: document.getElementById("mdns-ip-fallback"),
  mdnsStatusBadge: document.getElementById("mdns-status-badge"),
  mdnsOpenBtn: document.getElementById("mdns-open-btn"),
  manualConnectIp: document.getElementById("manual-connect-ip"),
  manualConnectPort: document.getElementById("manual-connect-port"),
  manualConnectBtn: document.getElementById("manual-connect-btn"),
  manualConnectStatus: document.getElementById("manual-connect-status"),
  shareExtraActions: document.getElementById("share-extra-actions"),
  shareScopePublic: document.getElementById("share-scope-public"),
  shareScopePublicHint: document.getElementById("share-scope-public-hint"),
  shareWithUserBtn: document.getElementById("share-with-user-btn"),
  shareWithTeamBtn: document.getElementById("share-with-team-btn"),
  networkSearchBtn: document.getElementById("network-search-btn"),
  networkSearchBtnText: document.getElementById("network-search-btn-text"),
  connectedUsersList: document.getElementById("connected-users-list"),
  createTeamModal: document.getElementById("create-team-modal"),
  createTeamName: document.getElementById("create-team-name"),
  createTeamDepartment: document.getElementById("create-team-department"),
  createTeamModalClose: document.getElementById("create-team-modal-close"),
  createTeamModalCancel: document.getElementById("create-team-modal-cancel"),
  createTeamModalSubmit: document.getElementById("create-team-modal-submit"),
  addMembersModal: document.getElementById("add-members-modal"),
  addMembersList: document.getElementById("add-members-list"),
  addMembersModalClose: document.getElementById("add-members-modal-close"),
  addMembersModalCancel: document.getElementById("add-members-modal-cancel"),
  addMembersModalSend: document.getElementById("add-members-modal-send"),
  shareTeamPickerModal: document.getElementById("share-team-picker-modal"),
  shareTeamPickerList: document.getElementById("share-team-picker-list"),
  shareTeamPickerClose: document.getElementById("share-team-picker-close"),
  notificationsUnreadBadge: document.getElementById("notifications-unread-badge"),
  notificationsList: document.getElementById("notifications-list"),
  notificationsClearAll: document.getElementById("notifications-clear-all"),
  muteNotificationsBtn: document.getElementById("mute-notifications-btn"),
  muteIcon: document.getElementById("mute-icon"),
  networkDiscoveryHostname: document.getElementById("network-discovery-hostname"),
  networkDiscoveryIp: document.getElementById("network-discovery-ip"),
  networkDiscoveryBadge: document.getElementById("network-discovery-badge"),
  networkDiscoveryOpenBtn: document.getElementById("network-discovery-open-btn"),
  publicStatus: document.getElementById("public-status"),
  remoteAccessNotConfigured: document.getElementById("remote-access-not-configured"),
  remoteAccessSetupWrap: document.getElementById("remote-access-setup-wrap"),
  remoteAccessSetupBtn: document.getElementById("remote-access-setup-btn"),
  remoteAccessSetupSpinner: document.getElementById("remote-access-setup-spinner"),
  remoteAccessSetupError: document.getElementById("remote-access-setup-error"),
  remoteAccessSetupErrorText: document.getElementById("remote-access-setup-error-text"),
  remoteAccessSetupRetry: document.getElementById("remote-access-setup-retry"),
  remoteAccessConfiguredWrap: document.getElementById("remote-access-configured-wrap"),
  remoteAccessToggle: document.getElementById("remote-access-toggle"),
  remoteAccessStarting: document.getElementById("remote-access-starting"),
  remoteAccessActive: document.getElementById("remote-access-active"),
  remoteAccessUrl: document.getElementById("remote-access-url"),
  remoteAccessCopy: document.getElementById("remote-access-copy"),
  remoteAccessOpen: document.getElementById("remote-access-open"),
  remoteAccessQr: document.getElementById("remote-access-qr"),
  remoteAccessPin: document.getElementById("remote-access-pin"),
  remoteAccessPinSave: document.getElementById("remote-access-pin-save"),
};

const stateMeta = {
  lanBaseUrl: window.location.origin,
  cloudUrl: window.location.origin,
  shareLinkUrls: { ip: "" },
  lastNetworkChangedAt: 0,
  mdnsUnresolvableToastShown: false,
  networkDiscoveryUnresolvableToastShown: false,
  fingerprint: getOrCreateFingerprint(),
  sessionToken: localStorage.getItem("joincloud:session-token") || "",
  privacyPolicyRaw: "",
  buildId: "",
  lastPendingCount: 0,
  lastNetworkHash: "",
  notificationsMuted: localStorage.getItem("joincloud:mute-notifications") === "1",
  lastNotificationIds: new Set(),
};

function getOrCreateFingerprint() {
  const key = "joincloud:device-fingerprint";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const fp = (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : `fp_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  localStorage.setItem(key, fp);
  return fp;
}

function setHeaderDisplayName(value) {
  els.headerDisplayName.textContent = value && value.trim() ? value : "Join";
}

function updateHeaderProfile() {
  if (!els.headerDisplayName) return;
  const displayName = (state.displayName && state.displayName.trim()) ? state.displayName.trim() : null;
  const hasCustomName = displayName && displayName !== "Join";
  if (hasCustomName) {
    els.headerDisplayName.textContent = displayName;
    els.headerDisplayName.title = state.accountEmail ? "Signed in as " + state.accountEmail.trim() : "";
  } else if (state.accountEmail && state.accountEmail.trim()) {
    const email = state.accountEmail.trim();
    const localPart = email.split("@")[0];
    const friendlyName = localPart ? "Join " + localPart.charAt(0).toUpperCase() + localPart.slice(1).toLowerCase() : "Join";
    els.headerDisplayName.textContent = friendlyName;
    els.headerDisplayName.title = "Signed in as " + email;
  } else {
    els.headerDisplayName.textContent = "Join";
    els.headerDisplayName.title = state.accountId ? "Account: " + (state.accountId || "").slice(0, 16) + "…" : "";
  }
}

function displayNameToSuffix(fullName) {
  const normalized = String(fullName || "").trim();
  if (!normalized) return "";
  if (normalized === "Join") return "";
  if (!normalized.toLowerCase().startsWith("join")) return normalized;
  return normalized.slice(4).trimStart();
}

function buildDisplayNameFromSuffix(suffix) {
  const trimmed = String(suffix || "").trim();
  return trimmed ? `Join ${trimmed}` : "Join";
}

function getSuggestedDeviceName() {
  const ua = String(navigator.userAgent || "").toLowerCase();
  if (ua.includes("iphone")) return "iPhone";
  if (ua.includes("ipad")) return "iPad";
  if (ua.includes("android")) return "Android";
  if (ua.includes("windows")) return "Windows Device";
  if (ua.includes("mac")) return "Mac Device";
  return "My Device";
}

function isHostRole() {
  return state.accessRole === "host" || state.isAdmin;
}

function isRemoteRole() {
  return state.accessRole === "remote" || state.accessRole === "device";
}

function isInMyFolder(pathValue) {
  return true;
}

function isPreviewableName(fileName) {
  const lower = String(fileName || "").toLowerCase();
  return /\.(png|jpe?g|gif|webp|svg|pdf|mp4|webm|mov|m4v)$/i.test(lower);
}

function withAuthHeaders(extra = {}) {
  const headers = { ...extra, "x-joincloud-fingerprint": stateMeta.fingerprint };
  if (stateMeta.sessionToken) {
    headers.Authorization = `Bearer ${stateMeta.sessionToken}`;
  }
  return headers;
}

async function apiFetch(url, options = {}, allowUnauthorized = false) {
  const init = { ...options };
  init.headers = withAuthHeaders(options.headers || {});
  const res = await fetch(url, init);
  if (res.status === 423 && !allowUnauthorized) {
    showAccessGate("Sharing is currently stopped by the admin.");
    throw new Error("sharing_stopped");
  }
  if (res.status === 401 && !allowUnauthorized) {
    showAccessGate("Approval required for this device.");
    throw new Error("approval_required");
  }
  return res;
}

function showAccessGate(statusText) {
  document.body.classList.remove("activation-gate-active");
  els.appLayout.style.display = "none";
  if (els.activationGate) els.activationGate.style.display = "none";
  els.accessGate.style.display = "grid";
  els.accessStatus.textContent = statusText || "Waiting to request access.";
  state.accessRole = "pending";
  updateAdminUi();
}

function showActivationGate() {
  console.log("[showActivationGate] Showing activation gate, hiding app layout");
  document.body.classList.add("activation-gate-active");
  els.accessGate.style.display = "none";
  els.appLayout.style.display = "none";
  if (els.activationGate) els.activationGate.classList.add("visible");
  setActivationGateMessage("");
  updateActivationGateTrialText();
  var webUrl = window.__JOINCLOUD_WEB_URL__ || "https://dashboard.joincloud.in";
  var isRevoked = state.licenseState === "revoked";
  var deviceId = state.hostUuidFromConfig || state.deviceId || "";
  var accountId = state.accountId || "";
  var titleEl = document.getElementById("activation-gate-title");
  var billingParams = new URLSearchParams();
  if (accountId) billingParams.set("accountId", accountId);
  if (deviceId) billingParams.set("deviceId", deviceId);
  var billingUrl = billingParams.toString() ? `${webUrl}/billing?${billingParams.toString()}` : (state.upgradeUrl || `${webUrl}/billing`);
  var supportComposeUrl = "https://mail.google.com/mail/?view=cm&to=vinay@arevei.com&cc=rishabh@arevei.com&su=JoinCloud%20Support";
  if (titleEl) {
    titleEl.textContent = isRevoked ? "License revoked" : "Activating JoinCloud loading";
  }
  if (els.activationGateUpgradeWrap) {
    els.activationGateUpgradeWrap.style.display = "block";
    if (els.activationGateUpgradeLink) {
      els.activationGateUpgradeLink.href = isRevoked ? supportComposeUrl : billingUrl;
      els.activationGateUpgradeLink.textContent = isRevoked ? "Contact Support" : "Upgrade / Purchase";
    }
  }
  if (isRevoked) {
    if (els.activationGateSigninWeb) els.activationGateSigninWeb.style.display = "none";
    if (els.activationGateRetry) els.activationGateRetry.style.display = "none";
  }
  const showExtendTrial = !isRevoked && state.canExtendTrial && !isPaidPlanTier();
  if (els.activationGateExtendTrial) {
    els.activationGateExtendTrial.style.display = showExtendTrial ? "block" : "none";
  }
  const extendLink = document.getElementById("activation-gate-extend-link");
  const extendSep = document.getElementById("activation-gate-extend-sep");
  if (extendLink) {
    extendLink.style.display = showExtendTrial ? "inline" : "none";
    if (showExtendTrial && deviceId) {
      extendLink.href = `${webUrl}/auth/desktop?deviceId=${encodeURIComponent(deviceId)}&mode=extendTrial`;
    }
  }
  if (extendSep) extendSep.style.display = showExtendTrial ? "inline" : "none";
}

function setActivationGateMessage(text, isError) {
  if (!els.activationGateMessage) return;
  els.activationGateMessage.textContent = text || "";
  els.activationGateMessage.style.color = isError ? "#ef4444" : "";
}

function showMainApp() {
  console.log("[showMainApp] Hiding activation gate, showing app layout");
  document.body.classList.remove("activation-gate-active");
  els.accessGate.style.display = "none";
  if (els.activationGate) {
    els.activationGate.classList.remove("visible");
  }
  els.appLayout.style.display = "grid";
}

let didBootstrapAfterAuth = false;

/** True if device has a valid license (trial, pro, teams, custom, or grace). */
function hasValidLicense() {
  const s = state.licenseState;
  return s === "trial_active" || s === "active" || s === "grace" || s === "trialing" || s === "TRIAL" || s === "TRIAL_ACTIVE";
}

/** True if license tier is a paid plan (pro, teams, custom). For these, sign-in is required. */
function isPaidPlanTier() {
  const t = (state.licenseTier || "").toLowerCase();
  return t === "pro" || t === "teams" || t === "custom";
}

/**
 * Deterministic gate logic:
 * - Remote users (accessing shared cloud): always allowed - they don't need a license
 * - Paid tiers (pro/teams/custom): require authentication + valid license state
 * - Trial/free tiers: allow usage when trial is active
 * - Otherwise: deny usage
 */
function canUseApp() {
  // Remote users accessing shared cloud UI don't need license checks
  if (isRemoteRole()) {
    return true;
  }

  const ls = (state.licenseState || "").toLowerCase();
  const tier = (state.licenseTier || "").toLowerCase();

  // Suspended and revoked users cannot use the app
  if (ls === "suspended" || ls === "revoked") {
    return false;
  }

  const isPaidTier = tier === "pro" || tier === "teams" || tier === "custom";

  const isValidLicenseState =
    ls === "active" ||
    ls === "trial_active" ||
    ls === "grace" ||
    ls === "trialing";

  // Paid plans: allow access when license is active (sign-in optional)
  if (isPaidTier) {
    return isValidLicenseState;
  }

  // Trial/free devices can use app if trial is active
  if (ls === "trial_active" || ls === "trialing") {
    return true;
  }

  // Free tier with state active: allow use (no activation gate)
  if (tier === "free" && ls === "active") {
    return true;
  }

  return false;
}

/** Show or hide activation gate based purely on canUseApp(). */
function updateAppGate() {
  // Remote users accessing shared cloud never see activation gate
  if (isRemoteRole()) {
    showMainApp();
    return;
  }
  if (canUseApp()) {
    showMainApp();
    bootstrapOnceAfterAuth();
  } else {
    showActivationGate();
  }
}

/** Bootstrap app UI once after auth succeeds (idempotent). */
async function bootstrapOnceAfterAuth() {
  if (didBootstrapAfterAuth) return;
  didBootstrapAfterAuth = true;
  await continueBootstrapAfterActivation();
}

function formatBytes(bytes) {
  if (!bytes) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  return `${size.toFixed(1)} ${units[idx]}`;
}

function formatLogTime(timestamp) {
  try {
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return timestamp;
  }
}

function getLogIcon(level, message) {
  const msg = String(message || "").toLowerCase();
  if (msg.includes("upload")) return "📤";
  if (msg.includes("download")) return "📥";
  if (msg.includes("share")) return "🔗";
  if (msg.includes("revoke")) return "🚫";
  if (msg.includes("started")) return "🚀";
  if (level === "error") return "❌";
  if (level === "warn") return "⚠️";
  return "ℹ️";
}

function drawActivityChart(entries) {
  if (!els.activityChart) return;
  const canvas = els.activityChart;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const width = canvas.clientWidth || 640;
  const height = Number(canvas.getAttribute("height") || 180);
  canvas.width = width;
  canvas.height = height;
  ctx.clearRect(0, 0, width, height);

  const values = entries.map((entry) => Number(entry.value || 0));
  const maxValue = Math.max(1, ...values);
  const gap = 12;
  const barWidth = Math.max(32, Math.floor((width - gap * (entries.length + 1)) / entries.length));
  const baseline = height - 26;
  const drawHeight = height - 52;

  entries.forEach((entry, index) => {
    const x = gap + index * (barWidth + gap);
    const value = Number(entry.value || 0);
    const h = Math.max(3, Math.round((value / maxValue) * drawHeight));
    const y = baseline - h;
    ctx.fillStyle = "#2fb7ff";
    ctx.fillRect(x, y, barWidth, h);
    ctx.fillStyle = "#a1a1aa";
    ctx.font = "11px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(entry.label, x + barWidth / 2, height - 8);
  });
}

function renderBreadcrumbs() {
  const parts = state.path.split("/").filter(Boolean);
  els.breadcrumbs.innerHTML = "";
  const homeButton = document.createElement("button");
  homeButton.textContent = "Home";
  homeButton.onclick = () => loadFiles("/");
  els.breadcrumbs.appendChild(homeButton);

  let current = "";
  parts.forEach((part) => {
    const span = document.createElement("span");
    span.textContent = " / ";
    els.breadcrumbs.appendChild(span);
    current += `/${part}`;
    const button = document.createElement("button");
    button.textContent = part;
    button.onclick = () => loadFiles(current);
    els.breadcrumbs.appendChild(button);
  });
}

function getFileIcon(item) {
  if (item.type === "folder") return "📁";
  const ext = item.name.split(".").pop()?.toLowerCase();
  const iconMap = {
    jpg: "🖼️", jpeg: "🖼️", png: "🖼️", gif: "🖼️", webp: "🖼️", svg: "🖼️",
    pdf: "📄", doc: "📄", docx: "📄", txt: "📄",
    mp3: "🎵", wav: "🎵", flac: "🎵",
    mp4: "🎬", mov: "🎬", avi: "🎬", mkv: "🎬",
    zip: "📦", rar: "📦", tar: "📦", gz: "📦",
    js: "📜", ts: "📜", py: "📜", json: "📜",
  };
  return iconMap[ext] || "📄";
}

function getFileExtension(name) {
  const ext = String(name || "").split(".").pop()?.toLowerCase();
  return ext && ext !== String(name || "").toLowerCase() ? ext : "";
}

function compareBySort(a, b, sortKey) {
  if (sortKey === "name_desc") {
    return b.name.localeCompare(a.name);
  }
  if (sortKey === "modified_desc") {
    return new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime();
  }
  if (sortKey === "modified_asc") {
    return new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime();
  }
  if (sortKey === "ext_asc") {
    return getFileExtension(a.name).localeCompare(getFileExtension(b.name)) || a.name.localeCompare(b.name);
  }
  if (sortKey === "ext_desc") {
    return getFileExtension(b.name).localeCompare(getFileExtension(a.name)) || a.name.localeCompare(b.name);
  }
  return a.name.localeCompare(b.name);
}

function getVisibleItems() {
  const keyword = state.fileSearch.trim().toLowerCase();
  const filtered = state.rawItems.filter((item) => {
    if (state.foldersOnly && item.type !== "folder") return false;
    if (keyword && !String(item.name || "").toLowerCase().includes(keyword)) return false;
    return true;
  });

  const folders = filtered.filter((item) => item.type === "folder").sort((a, b) => compareBySort(a, b, state.fileSort));
  const files = filtered.filter((item) => item.type !== "folder").sort((a, b) => compareBySort(a, b, state.fileSort));
  return [...folders, ...files];
}

function updateFileViewButtons() {
  els.fileList.dataset.view = state.fileView;
  els.viewList.classList.toggle("active", state.fileView === "list");
  els.viewThumb.classList.toggle("active", state.fileView === "thumb");
}

function getActiveShareForPathAndScope(itemPath, scope) {
  const normalizedPath = String(itemPath || "");
  const normalizedScope = scope || "local";
  return (state.shares || []).find((s) => s && s.status === "active" && String(s.path || "") === normalizedPath && (s.scope || "local") === normalizedScope) || null;
}

function renderFiles() {
  state.items = getVisibleItems();
  els.fileList.innerHTML = "";
  updateFileViewButtons();
  if (!state.items.length) {
    const message = state.rawItems.length
      ? "No items match current filters."
      : "Drop files here or click Upload";
    els.fileList.innerHTML = `<div class="empty-state"><div class="empty-state-title">No files yet</div><div class="empty-state-sub">${message}</div></div>`;
    return;
  }

  state.items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "file-card";
    const fileExt = getFileExtension(item.name);
    const typeLabel = item.type === "folder" ? "Folder" : (fileExt || "File").toUpperCase();
    const sizeLabel = item.type === "folder" ? "" : formatBytes(item.size);
    const modifiedLabel = item.modifiedAt ? new Date(item.modifiedAt).toLocaleString() : "";

    const topRow = document.createElement("div");
    topRow.className = "file-card-top";

    const icon = document.createElement("div");
    icon.className = "file-card-icon";
    icon.innerHTML = getFileIcon(item);

    const main = document.createElement("div");
    main.className = "file-card-main";

    const titleRow = document.createElement("div");
    titleRow.className = "file-card-title-row";
    const titleEl = document.createElement("div");
    titleEl.className = "file-card-name";
    titleEl.textContent = item.name;
    titleEl.title = item.name;
    titleRow.appendChild(titleEl);

    const badges = document.createElement("div");
    badges.className = "file-card-badges";

    const localShare = isHostRole() ? getActiveShareForPathAndScope(item.path, "local") : null;
    const publicShare = isHostRole() ? getActiveShareForPathAndScope(item.path, "public") : null;
    if (localShare || publicShare) {
      const makeShareBadge = (kind, share) => {
        const wrap = document.createElement("span");
        wrap.className = "badge badge-pill " + (kind === "local" ? "badge-shared-local" : "badge-shared-public");
        wrap.title = kind === "local" ? "Shared on local network" : "Shared publicly";
        const label = document.createElement("span");
        label.className = "badge-label";
        label.textContent = kind === "local" ? "Local" : "Public";
        wrap.appendChild(label);

        const stop = document.createElement("button");
        stop.type = "button";
        stop.className = "badge-stop";
        stop.textContent = "×";
        stop.title = kind === "local" ? "Stop local share" : "Stop public share";
        stop.setAttribute("aria-label", stop.title);
        stop.onclick = async (e) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            await revokeShare(share.shareId);
          } catch (_) {}
          try { await loadShares(); } catch (_) {}
          try { renderFiles(); } catch (_) {}
        };
        wrap.appendChild(stop);
        return wrap;
      };

      if (localShare) badges.appendChild(makeShareBadge("local", localShare));
      if (publicShare) badges.appendChild(makeShareBadge("public", publicShare));
    }

    titleRow.appendChild(badges);

    const subEl = document.createElement("div");
    subEl.className = "file-card-path mono";
    subEl.textContent = item.path || "";
    subEl.title = item.path || "";

    main.appendChild(titleRow);
    main.appendChild(subEl);

    const actions = document.createElement("div");
    actions.className = "file-card-actions";

    if (item.type === "folder") {
      const openBtn = document.createElement("button");
      openBtn.className = "button secondary";
      openBtn.textContent = "Open";
      openBtn.onclick = () => loadFiles(item.path);
      actions.appendChild(openBtn);
      if (isHostRole()) {
        const shareBtn = document.createElement("button");
        shareBtn.className = "button secondary";
        shareBtn.textContent = "Share";
        shareBtn.onclick = () => openShareModal(item.path);
        actions.appendChild(shareBtn);
      }
    } else {
      if (isHostRole()) {
        const shareBtn = document.createElement("button");
        shareBtn.className = "button secondary";
        shareBtn.textContent = "Share";
        if (localShare && publicShare) {
          shareBtn.disabled = true;
          shareBtn.title = "Already shared for both Local and Public scopes";
        }
        shareBtn.onclick = () => openShareModal(item.path);
        actions.appendChild(shareBtn);
      }
      if (isPreviewableName(item.name)) {
        const previewBtn = document.createElement("button");
        previewBtn.className = "button secondary";
        previewBtn.textContent = "Preview";
        previewBtn.onclick = () => openPreviewModal(item);
        actions.appendChild(previewBtn);
      }
    }

    if (isHostRole()) {
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "button danger button-icon-only";
      deleteBtn.title = "Delete";
      deleteBtn.setAttribute("aria-label", "Delete");
      deleteBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';
      deleteBtn.onclick = () => confirmDeleteItem(item);
      actions.appendChild(deleteBtn);
    }

    topRow.appendChild(icon);
    topRow.appendChild(main);
    topRow.appendChild(actions);
    row.appendChild(topRow);

    const meta = document.createElement("div");
    meta.className = "file-card-meta";

    const makeMetaItem = (label, value, extraClass) => {
      const wrap = document.createElement("div");
      wrap.className = "file-card-meta-item" + (extraClass ? " " + extraClass : "");
      const l = document.createElement("div");
      l.className = "file-card-meta-label";
      l.textContent = label;
      const v = document.createElement("div");
      v.className = "file-card-meta-value";
      v.textContent = value || "—";
      v.title = value || "";
      wrap.appendChild(l);
      wrap.appendChild(v);
      return wrap;
    };

    meta.appendChild(makeMetaItem("Type", String(typeLabel || ""), "file-card-meta-type"));
    meta.appendChild(makeMetaItem("Size", String(sizeLabel || ""), "file-card-meta-size"));
    meta.appendChild(makeMetaItem("Modified", String(modifiedLabel || ""), "file-card-meta-modified"));
    row.appendChild(meta);

    els.fileList.appendChild(row);
  });
  refreshRemoteUploadUi();
}

function renderShares() {
  els.shareList.innerHTML = "";
  const updateBulkButtons = () => {
    els.revokeSelected.disabled = state.selectedShares.size === 0;
  };
  const activeShares = state.shares.filter((share) => share.status === "active");
  const isPublicTab = stateShareTab.current === "public";
  const filteredShares = activeShares.filter((share) =>
    isPublicTab ? !!share.publicUrl : !share.publicUrl
  );
  if (!filteredShares.length) {
    state.selectedShares.clear();
    updateBulkButtons();
    els.shareList.innerHTML = '<div class="empty-state"><div class="empty-state-title">No active shares</div><div class="empty-state-sub">No shares created yet</div></div>';
    return;
  }
  const activeIds = new Set(filteredShares.map((share) => share.shareId));
  state.selectedShares = new Set(Array.from(state.selectedShares).filter((id) => activeIds.has(id)));
  updateBulkButtons();
  filteredShares.forEach((share) => {
    const row = document.createElement("div");
    row.className = "item";
    const localUrl = share.urlIp || share.url || `${stateMeta.lanBaseUrl}/share/${share.shareId}`;
    const publicUrl = share.publicUrl || null;
    const shareUrl = publicUrl || localUrl;
    row.innerHTML = `
      <div style="flex:1;min-width:0">
        <div class="item-title">${escapeHtml(share.path)}</div>
        <div class="item-sub">${share.permission} · expires ${new Date(share.expiresAt).toLocaleString()}</div>
        <div class="share-link-box" style="margin-top:8px;padding:8px 10px;border:1px solid var(--stroke);border-radius:6px;background:var(--bg);font-size:12px;font-family:ui-monospace,monospace;word-break:break-all">${escapeHtml(shareUrl)}</div>
      </div>
      <span class="badge badge-active">Active</span>
    `;
    if (isHostRole()) {
      const checkboxWrap = document.createElement("label");
      checkboxWrap.className = "item-check";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = state.selectedShares.has(share.shareId);
      checkbox.onchange = () => {
        if (checkbox.checked) state.selectedShares.add(share.shareId);
        else state.selectedShares.delete(share.shareId);
        updateBulkButtons();
      };
      checkboxWrap.appendChild(checkbox);
      row.appendChild(checkboxWrap);
    }
    const copyButton = document.createElement("button");
    copyButton.className = "button secondary";
    copyButton.textContent = "Copy Link";
    copyButton.onclick = async () => {
      const ok = await copyToClipboard(shareUrl);
      if (ok) {
        copyButton.textContent = "Copied!";
        setTimeout(() => (copyButton.textContent = "Copy Link"), 2000);
      } else {
        showCopyFallback(shareUrl, copyButton);
      }
    };
    row.appendChild(copyButton);
    const qrBtn = document.createElement("button");
    qrBtn.className = "button secondary";
    qrBtn.textContent = "QR";
    qrBtn.onclick = () => showShareQrModal(shareUrl);
    row.appendChild(qrBtn);

    if (isHostRole()) {
      const revokeButton = document.createElement("button");
      revokeButton.className = "button danger";
      revokeButton.textContent = "Revoke";
      revokeButton.onclick = async () => {
        revokeButton.disabled = true;
        revokeButton.textContent = "Revoking...";
        await revokeShare(share.shareId);
      };
      row.appendChild(revokeButton);
    }
    els.shareList.appendChild(row);
  });
}

function renderLogs(entries) {
  els.logList.innerHTML = "";
  if (!entries.length) {
    els.logList.innerHTML = '<div class="empty-state"><div class="empty-state-title">No logs yet</div><div class="empty-state-sub">Activity will appear here</div></div>';
    return;
  }
  entries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = `log-item log-${entry.level}`;
    row.innerHTML = `
      <span class="log-icon">${getLogIcon(entry.level, entry.message)}</span>
      <span class="log-time">${formatLogTime(entry.timestamp)}</span>
      <span class="log-message">${entry.message}</span>
    `;
    els.logList.appendChild(row);
  });
}

function renderNetwork() {
  els.networkList.innerHTML = '<div class="empty-state"><div class="empty-state-title">Coming Soon</div><div class="empty-state-sub">Network discovery will be available in a future release.</div></div>';
}

function closePreviewModal() {
  if (!els.previewModal) return;
  els.previewModal.classList.remove("active");
  if (els.previewBody) {
    els.previewBody.innerHTML = "";
  }
}

function showShareQrModal(url) {
  if (!window.QRious || !els.shareQrModal) return;
  const canvas = document.getElementById("share-qr-canvas");
  const urlEl = document.getElementById("share-qr-url");
  if (!canvas || !urlEl) return;
  canvas.width = 220;
  canvas.height = 220;
  new window.QRious({
    element: canvas,
    value: url || "",
    size: 220,
    level: "M",
    background: "white",
    foreground: "#000000",
  });
  urlEl.textContent = url || "";
  els.shareQrModal.classList.add("active");
}

function closeShareQrModal() {
  if (els.shareQrModal) els.shareQrModal.classList.remove("active");
}

async function stopSharesForPath(pathValue) {
  const normalizedPath = String(pathValue || "");
  const activeForPath = (state.shares || []).filter(
    (s) => s && s.status === "active" && String(s.path || "") === normalizedPath
  );
  for (const share of activeForPath) {
    try {
      await revokeShare(share.shareId);
    } catch (_) {}
  }
  try {
    await loadShares();
  } catch (_) {}
}

async function deletePathAfterStopSharing(pathValue) {
  try {
    const res = await apiFetch(`/api/v1/file?path=${encodeURIComponent(pathValue)}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Delete failed");
    }
    await loadFiles(state.path);
    await loadLogs();
  } catch (err) {
    alert(err.message || "Delete failed");
  }
}

async function confirmDeleteItem(item) {
  const name = item.name || item.path || "item";
  const typeLabel = item.type === "folder" ? "folder" : "file";
  const msg = item.type === "folder"
    ? `Permanently delete the folder "${name}" and all its contents?`
    : `Permanently delete "${name}"?`;

  const normalizedPath = String(item.path || "");
  const activeSharesForItem = (state.shares || []).filter(
    (s) => s && s.status === "active" && String(s.path || "") === normalizedPath
  );

  if (!activeSharesForItem.length || !els.deleteSharedItemModal) {
    if (!confirm(msg)) return;
    try {
      const res = await apiFetch(`/api/v1/file?path=${encodeURIComponent(item.path)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Delete failed");
      }
      await loadFiles(state.path);
      await loadLogs();
    } catch (err) {
      alert(err.message || "Delete failed");
    }
    return;
  }

  els.deleteSharedItemModal.dataset.path = normalizedPath;
  els.deleteSharedItemModal.dataset.type = typeLabel;
  els.deleteSharedItemModal.dataset.name = name;
  els.deleteSharedItemModal.classList.add("active");
  if (els.deleteSharedItemTitle) {
    els.deleteSharedItemTitle.textContent =
      typeLabel === "folder"
        ? "This folder is currently shared"
        : "This file is currently shared";
  }
  if (els.deleteSharedItemDescription) {
    els.deleteSharedItemDescription.textContent =
      "Stop sharing first, or stop sharing and delete in one step. Shares will stop working immediately after revocation.";
  }
  if (els.deleteSharedItemPath) {
    els.deleteSharedItemPath.textContent = normalizedPath;
  }
}

function openPreviewModal(item) {
  if (!item || item.type !== "file" || !isPreviewableName(item.name)) return;
  if (!els.previewModal || !els.previewBody || !els.previewTitle) return;
  const params = new URLSearchParams({
    path: item.path,
    fp: stateMeta.fingerprint,
  });
  if (stateMeta.sessionToken) {
    params.set("token", stateMeta.sessionToken);
  }
  const previewUrl = `/api/v1/file/content?${params.toString()}`;
  const lower = String(item.name || "").toLowerCase();
  els.previewTitle.textContent = `Preview: ${item.name}`;
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(lower)) {
    els.previewBody.innerHTML = `<img src="${previewUrl}" alt="${item.name}" class="preview-image" />`;
  } else if (/\.pdf$/i.test(lower)) {
    els.previewBody.innerHTML = `<object data="${previewUrl}" type="application/pdf" class="preview-frame"><iframe src="${previewUrl}" class="preview-frame" title="${item.name}"></iframe></object>`;
  } else if (/\.(mp4|webm|mov|m4v)$/i.test(lower)) {
    els.previewBody.innerHTML = `<video controls class="preview-video" src="${previewUrl}"></video>`;
  } else {
    return;
  }
  els.previewModal.classList.add("active");
}

function shortenFingerprint(value) {
  const text = String(value || "");
  if (text.length <= 16) return text;
  return `${text.slice(0, 8)}...${text.slice(-6)}`;
}

function renderCloudQr(url) {
  if (!window.QRious || !els.cloudUrlQr) return;
  new window.QRious({
    element: els.cloudUrlQr,
    value: url,
    size: 220,
    level: "M",
    background: "white",
    foreground: "#000000",
  });
}

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_err) {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch (_e) {
    return false;
  }
}

function showCopyFallback(text, triggerEl) {
  const wrap = document.createElement("div");
  wrap.className = "copy-fallback";
  wrap.style.marginTop = "8px";
  wrap.innerHTML = '<div class="value value-muted" style="margin-bottom:4px">Tap and hold to copy:</div>';
  const input = document.createElement("input");
  input.type = "text";
  input.className = "input mono";
  input.value = text;
  input.readOnly = true;
  input.style.width = "100%";
  input.onclick = () => input.select();
  wrap.appendChild(input);
  const parent = triggerEl.closest(".item") || triggerEl.parentElement;
  const existing = parent.querySelector(".copy-fallback");
  if (existing) existing.remove();
  parent.appendChild(wrap);
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatInline(text) {
  const escaped = escapeHtml(text);
  return escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function renderPrivacyMarkdown(markdownText) {
  const lines = String(markdownText || "").split(/\r?\n/);
  const html = [];
  let paragraph = [];
  let inList = false;

  function flushParagraph() {
    if (!paragraph.length) return;
    const text = paragraph.join(" ");
    html.push(`<p>${formatInline(text)}</p>`);
    paragraph = [];
  }

  function closeList() {
    if (!inList) return;
    html.push("</ul>");
    inList = false;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      closeList();
      continue;
    }
    if (line.startsWith("### ")) {
      flushParagraph();
      closeList();
      html.push(`<h3>${formatInline(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith("## ")) {
      flushParagraph();
      closeList();
      html.push(`<h2>${formatInline(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith("# ")) {
      flushParagraph();
      closeList();
      html.push(`<h1>${formatInline(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith("• ")) {
      flushParagraph();
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${formatInline(line.slice(2))}</li>`);
      continue;
    }
    closeList();
    paragraph.push(line);
  }

  flushParagraph();
  closeList();
  return html.join("");
}

async function loadPrivacyPolicy() {
  try {
    const response = await fetch("/privacy-policy.md");
    if (!response.ok) {
      throw new Error("policy_not_found");
    }
    const markdown = await response.text();
    stateMeta.privacyPolicyRaw = markdown;
    els.privacyPolicyContent.innerHTML = renderPrivacyMarkdown(markdown);
  } catch (_error) {
    stateMeta.privacyPolicyRaw = "";
    els.privacyPolicyContent.innerHTML = "<p>Unable to load privacy policy.</p>";
  }
}

async function loadCloudUrl() {
  const res = await apiFetch("/api/v1/cloud/url");
  const data = await res.json();
  stateMeta.cloudUrl = String(data.url || window.location.origin);
  els.cloudUrlInput.value = stateMeta.cloudUrl;
  renderCloudQr(`${stateMeta.cloudUrl}?pair=1`);
}

async function loadAccessMe() {
  const res = await apiFetch("/api/v1/access/me", {}, true);
  if (!res.ok) {
    state.accessRole = state.isAdmin ? "host" : "remote";
    return;
  }
  const data = await res.json();
  state.accessRole = data.role === "host" ? "host" : "device";
  state.deviceId = data.device_id || null;
  state.deviceName = data.device_name || null;
  state.deviceFolderRel = null;
}

function formatUptime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}H ${m}M`;
  if (m > 0) return `${m}M`;
  return `${seconds}S`;
}

async function loadBuildInfo() {
  try {
    const [buildRes, diagRes] = await Promise.all([
      fetch("/api/v1/build"),
      fetch("/api/v1/diagnostics/info", {}).catch(() => null),
    ]);
    if (buildRes.ok) {
      const data = await buildRes.json();
      stateMeta.buildId = String(data.build_id || "");
      if (els.buildId) {
        els.buildId.textContent = `Build ${stateMeta.buildId || "unknown"}`;
      }
    }
    if (diagRes?.ok && els.uptimeDisplay) {
      const diag = await diagRes.json();
      const sec = Number(diag.uptime_seconds) || 0;
      if (sec > 0) els.uptimeDisplay.textContent = `Uptime: ${formatUptime(sec)}`;
    }
  } catch (_error) {
    if (els.buildId) els.buildId.textContent = "BUILD: unavailable";
  }
}

async function loadControlPlaneConfig() {
  try {
    const res = await fetch("/api/v1/control-plane-config");
    if (!res.ok) {
      markServerRequestResult(false);
      return;
    }
    const data = await res.json();
    markServerRequestResult(true);
    console.log("[loadControlPlaneConfig] received:", JSON.stringify({ is_authenticated: data.is_authenticated, license: data.license }, null, 2));
    state.licenseState = data.license?.state || null;
    state.licenseGraceEndsAt = data.license?.grace_ends_at ?? null;
    state.licenseTier = data.license?.tier ?? null;
    state.licenseExpiresAt = data.license?.expires_at ?? null;
    state.licenseDeviceLimit = data.license?.device_limit ?? null;
    state.activationRequired = data.activation?.required === true;
    state.trialDays = typeof data.trial_days === "number" ? data.trial_days : 7;
    state.devMode = data.dev_mode === true;
    state.devExpiryWarningMinutes = typeof data.dev_expiry_warning_minutes === "number" ? data.dev_expiry_warning_minutes : 2;
    state.usage = data.usage || null;
    state.usageSharesThisMonth = typeof data.usage?.sharesThisMonth === "number" ? data.usage.sharesThisMonth : 0;
    state.usageDevicesLinked = typeof data.usage?.devicesLinked === "number" ? data.usage.devicesLinked : 0;
    state.upgradeUrl = data.upgrade_url || "";
    state.subscription = data.subscription || null;
    state.entitlements = data.entitlements || null;
    state.trialEndsAt = data.trialEndsAt || null;
    state.canExtendTrial = !!(data.entitlements && data.entitlements.canExtendTrial);
    state.isSuspended = data.license?.state === "suspended";
    state.isRevoked = data.license?.state === "revoked";
    state.referralCode = data.referral_code || null;
    state.referralCount = data.referral_count || 0;
    state.daysRemaining = data.license?.days_remaining ?? null;
    if (data.web_url) window.__JOINCLOUD_WEB_URL__ = data.web_url;
    if (data.account_id) state.accountId = data.account_id;
    if (data.host_uuid) state.hostUuidFromConfig = data.host_uuid;
    state.accountEmail = (data.is_authenticated && data.account_email) ? data.account_email : null;
    state.isAuthenticated = data.is_authenticated === true;
    // Gate evaluation must run first and must not be skipped by downstream UI errors.
    updateAppGate();
    try { updateGraceBanner(); } catch (_) {}
    try { updateSubscriptionSection(); } catch (_) {}
    try { updateHeaderProfile(); } catch (_) {}
    try { updateAdminUi(); } catch (_) {}
    try { updateActivationGateTrialText(); } catch (_) {}
    try { updateButtonStates(); } catch (_) {}
    try { scheduleExpiryRefresh(); } catch (_) {}
    try { renderUsageBars().catch(function() {}); } catch (_) {}
  } catch (_) {}
}

// Module-level timer handle for exact-moment expiry refresh.
var expiryRefreshTimer = null;
// Live countdown in dev mode (updates every 1s).
var devCountdownInterval = null;

function stopDevCountdown() {
  if (devCountdownInterval) {
    clearInterval(devCountdownInterval);
    devCountdownInterval = null;
  }
}

function startDevCountdown() {
  if (devCountdownInterval) return;
  var warningMins = (typeof state.devExpiryWarningMinutes === "number" && state.devExpiryWarningMinutes >= 0) ? state.devExpiryWarningMinutes : 2;
  function tick() {
    if (!state.licenseExpiresAt || state.licenseState !== "trial_active" || !state.devMode) {
      stopDevCountdown();
      return;
    }
    var nowSec = Math.floor(Date.now() / 1000);
    var remaining = state.licenseExpiresAt - nowSec;
    var bannerText = document.getElementById("grace-banner-text");
    var graceBanner = document.getElementById("grace-banner");
    if (!bannerText || !graceBanner) return;
    if (remaining <= 0) {
      bannerText.textContent = "Dev mode: trial has expired. Upgrade to keep using JoinCloud.";
      graceBanner.classList.add("grace-banner-warning");
      stopDevCountdown();
      loadControlPlaneConfig().catch(function() {});
      return;
    }
    var mins = Math.floor(remaining / 60);
    var secs = remaining % 60;
    var mss = mins + ":" + (secs < 10 ? "0" : "") + secs;
    bannerText.textContent = "Trial expires in " + mss + ". Upgrade to keep using JoinCloud.";
    if (remaining <= warningMins * 60) {
      graceBanner.classList.add("grace-banner-warning");
    } else {
      graceBanner.classList.remove("grace-banner-warning");
    }
  }
  tick();
  devCountdownInterval = setInterval(tick, 1000);
}

/**
 * Schedules a one-shot timeout that fires at the exact moment the current license expires.
 * When it fires, the full UI is refreshed (gate, banner, settings, teams overlay) without
 * waiting for the next normal config poll cycle.
 * In dev mode the threshold is widened to 2 minutes; in production to 24 hours.
 */
function scheduleExpiryRefresh() {
  if (expiryRefreshTimer) { clearTimeout(expiryRefreshTimer); expiryRefreshTimer = null; }
  var expiresAt = state.licenseExpiresAt;
  if (!expiresAt) return;
  var msLeft = expiresAt * 1000 - Date.now();
  if (msLeft <= 0) return; // already expired — nothing to schedule
  // Only arm the timer if expiry is within the look-ahead window.
  var windowMs = state.devMode ? 2 * 60 * 1000 : 24 * 60 * 60 * 1000;
  if (msLeft > windowMs) return;
  expiryRefreshTimer = setTimeout(async () => {
    expiryRefreshTimer = null;
    try {
      await loadControlPlaneConfig();
      updateAppGate();
      updateGraceBanner();
      updateSubscriptionSection();
      updateTeamsLockedState();
      renderUsageBars().catch(() => {});
    } catch (_) {}
  }, msLeft + 500); // 500 ms buffer so the server has registered the expiry
}

/** Update button states based on license status */
function updateButtonStates() {
  const ls = (state.licenseState || "").toLowerCase();
  const tier = (state.licenseTier || "").toLowerCase();
  const isAuth = state.isAuthenticated === true;
  const webUrl = window.__JOINCLOUD_WEB_URL__ || "https://joincloud.com";
  const deviceId = state.hostUuidFromConfig || state.deviceId || "";
  
  // Build URLs
  const dashboardParams = new URLSearchParams();
  if (state.accountId) dashboardParams.set("accountId", state.accountId);
  if (deviceId) dashboardParams.set("deviceId", deviceId);
  const dashboardUrl = `${webUrl}/dashboard${dashboardParams.toString() ? "?" + dashboardParams.toString() : ""}`;
  const signInUrl = deviceId ? `${webUrl}/auth/desktop?deviceId=${encodeURIComponent(deviceId)}` : `${webUrl}/auth/desktop`;
  const billingUrl = `${webUrl}/billing?${dashboardParams.toString()}`;
  const supportUrl = `${webUrl}/support?${dashboardParams.toString()}`;
  
  // Primary button configuration based on state
  const primaryBtn = document.getElementById("settings-open-dashboard-link");
  const secondaryBtn = document.getElementById("settings-logout");
  const upgradeLink = document.getElementById("subscription-upgrade-link");
  
  if (primaryBtn) {
    // State: Suspended - show "Fix Payment" or "Contact Support"
    if (ls === "suspended") {
      primaryBtn.textContent = "Fix Payment Issue";
      primaryBtn.href = billingUrl;
      primaryBtn.style.display = "";
    }
    // State: Revoked - show "Contact Support"
    else if (ls === "revoked") {
      primaryBtn.textContent = "Contact Support";
      primaryBtn.href = supportUrl;
      primaryBtn.style.display = "";
    }
    // State: Grace - show "Update Payment"
    else if (ls === "grace") {
      primaryBtn.textContent = "Update Payment";
      primaryBtn.href = billingUrl;
      primaryBtn.style.display = "";
    }
    // State: Expired (no account) - show "Sign in"
    else if ((ls === "expired" || ls === "unregistered") && !isAuth) {
      primaryBtn.textContent = "Sign In";
      primaryBtn.href = signInUrl;
      primaryBtn.style.display = "";
    }
    // State: Authenticated or active plan - show "Open Dashboard"
    else if (isAuth || ls === "active" || ls === "trial_active" || ls === "trialing" || ls === "grace") {
      primaryBtn.textContent = "Open Dashboard";
      primaryBtn.href = dashboardUrl;
      primaryBtn.style.display = "";
    }
    // State: Trial without account - show "Open Dashboard" (device-first; dashboard works with deviceId)
    else if ((ls === "trial_active" || ls === "trialing") && deviceId) {
      primaryBtn.textContent = "Open Dashboard";
      primaryBtn.href = dashboardUrl;
      primaryBtn.style.display = "";
    }
    else {
      primaryBtn.textContent = "Open Dashboard";
      primaryBtn.href = dashboardUrl;
      primaryBtn.style.display = "";
    }
  }
  
  // Secondary button is not used in this build – keep it hidden so users
  // always stay in the device-first flow without email sign-out/sign-in.
  if (secondaryBtn) {
    secondaryBtn.style.display = "none";
  }
  
  // Upgrade link visibility
  if (upgradeLink) {
    const isPaidTier = tier === "pro" || tier === "teams" || tier === "custom";
    const showUpgrade = !isPaidTier && (ls === "trial_active" || ls === "trialing" || ls === "active") && isAuth;
    
    if (showUpgrade) {
      upgradeLink.style.display = "inline";
      upgradeLink.href = billingUrl;
      upgradeLink.textContent = "Upgrade Plan";
    } else {
      upgradeLink.style.display = "none";
    }
  }
}

function updateActivationGateTrialText() {
  var el = document.getElementById("activation-gate-trial-text");
  if (!el) return;
  if (state.licenseState === "revoked") {
    el.textContent = "Admin has revoked your device license due to unwanted activity. Contact customer support at vinay@arevei.com to review or restore access.";
  } else if (isPaidPlanTier()) {
    var planName = (state.licenseTier || "plan").replace(/^./, (c) => c.toUpperCase());
    el.textContent = "Your " + planName + " plan is active. Open Dashboard from Settings to manage billing and account details. Sign in is optional on this device.";
  } else if (state.licenseState === "UNREGISTERED" || state.licenseState === "EXPIRED" || state.licenseState === "expired") {
    el.textContent = "A free trial starts automatically on first install (device-based). Sign in only if you want to extend your trial or upgrade to a paid plan.";
  } else {
    var days = state.trialDays || 7;
    el.textContent = "You're on a free " + days + "-day device trial. Create shares and manage your files — no credit card required. Sign in only to extend or upgrade.";
  }
}

function updateGraceBanner() {
  if (!els.graceBanner) return;
  var bannerText = document.getElementById("grace-banner-text");
  var bannerUpgrade = document.getElementById("grace-banner-upgrade");
  var webUrl = window.__JOINCLOUD_WEB_URL__ || "https://joincloud.com";
  var params = new URLSearchParams();
  if (state.accountId) params.set("accountId", state.accountId);
  if (state.hostUuidFromConfig || state.deviceId) params.set("deviceId", state.hostUuidFromConfig || state.deviceId);

  if (!(state.devMode && state.licenseState === "trial_active" && state.licenseExpiresAt)) {
    stopDevCountdown();
  }

  // Suspended state - critical banner
  if (state.licenseState === "suspended") {
    els.graceBanner.style.display = "block";
    els.graceBanner.className = "grace-banner banner-critical";
    if (bannerText) bannerText.innerHTML = "<strong>Account Suspended</strong> \u2013 Your account has been suspended due to payment issues. Please update your payment method to restore access.";
    if (bannerUpgrade) {
      bannerUpgrade.style.display = "inline";
      bannerUpgrade.textContent = "Fix Payment";
      bannerUpgrade.href = webUrl + "/billing?" + params.toString();
    }
    return;
  }

  // Revoked state is handled in the activation gate modal instead of the top banner.
  if (state.licenseState === "revoked") {
    els.graceBanner.style.display = "none";
    return;
  }

  // Reset to default banner class
  els.graceBanner.className = "grace-banner";

  if (state.licenseState === "grace" && state.licenseGraceEndsAt) {
    els.graceBanner.style.display = "block";
    var d = new Date(state.licenseGraceEndsAt * 1000);
    if (els.graceEndsDate) els.graceEndsDate.textContent = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    if (bannerText) bannerText.innerHTML = "Payment issue \u2013 please update your payment method. Full access until <span id=\"grace-ends-date\">" + d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) + "</span>.";
    if (bannerUpgrade) {
      bannerUpgrade.style.display = "inline";
      bannerUpgrade.textContent = "Update Payment";
      bannerUpgrade.href = webUrl + "/billing?" + params.toString();
    }
    return;
  }

  // Trial Active: show banner below header
  if (state.licenseState === "trial_active" && state.licenseExpiresAt) {
    els.graceBanner.style.display = "block";
    if (state.devMode) {
      startDevCountdown();
      if (bannerUpgrade) {
        bannerUpgrade.style.display = "inline";
        bannerUpgrade.textContent = "Upgrade now";
        bannerUpgrade.href = webUrl + "/billing?" + params.toString();
      }
      return;
    }
    var nowSec = Math.floor(Date.now() / 1000);
    var remaining = state.licenseExpiresAt - nowSec;
    var daysLeft = Math.ceil(remaining / 86400);
    if (daysLeft <= 3 && daysLeft > 0) {
      if (bannerText) bannerText.textContent = "Your free trial expires in " + daysLeft + " day" + (daysLeft !== 1 ? "s" : "") + ". Upgrade to keep using JoinCloud.";
    } else {
      if (bannerText) bannerText.textContent = "Trial is Active. Upgrade to a paid plan.";
    }
    if (bannerUpgrade) {
      bannerUpgrade.style.display = "inline";
      bannerUpgrade.textContent = "Upgrade now";
      bannerUpgrade.href = webUrl + "/billing?" + params.toString();
    }
    return;
  }
  // trialing (paid subscription trial) - same banner as trial_active
  if (state.licenseState === "trialing") {
    els.graceBanner.style.display = "block";
    if (bannerText) bannerText.textContent = "Trial is Active. Upgrade to a paid plan.";
    if (bannerUpgrade) {
      bannerUpgrade.style.display = "inline";
      bannerUpgrade.textContent = "Upgrade now";
      bannerUpgrade.href = webUrl + "/billing?" + params.toString();
    }
    return;
  }

  // Expired state — distinguish paid plan expiry vs trial expiry
  if (state.licenseState === "expired" || state.licenseState === "EXPIRED") {
    var expiredTier = String(state.licenseTier || "").toLowerCase();
    var isPaidExpired = ["pro", "teams", "custom"].includes(expiredTier);
    els.graceBanner.style.display = "block";
    els.graceBanner.className = isPaidExpired ? "grace-banner banner-critical" : "grace-banner";
    if (isPaidExpired) {
      var expiredPlanName = expiredTier.charAt(0).toUpperCase() + expiredTier.slice(1);
      if (bannerText) bannerText.innerHTML = "Your <strong>" + expiredPlanName + "</strong> plan has expired. Renew to restore full access.";
      if (bannerUpgrade) {
        bannerUpgrade.style.display = "inline";
        bannerUpgrade.textContent = "Renew";
        bannerUpgrade.href = webUrl + "/billing?" + params.toString();
      }
    } else {
      var webUrl3 = webUrl;
      var deviceId3 = state.hostUuidFromConfig || state.deviceId || "";
      var params3 = new URLSearchParams();
      if (state.accountId) params3.set("accountId", state.accountId);
      if (deviceId3) params3.set("deviceId", deviceId3);
      var pricingHref = webUrl3 + "/billing" + (params3.toString() ? "?" + params3.toString() : "");
      var extendHref = deviceId3
        ? webUrl3 + "/auth/desktop?deviceId=" + encodeURIComponent(deviceId3) + "&mode=extendTrial"
        : webUrl3 + "/auth/desktop?mode=extendTrial";
      if (bannerText) {
        bannerText.innerHTML = "Your trial is expired. Upgrade to a paid plan or move to Free tier. <a href=\"" + pricingHref + "\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"text-decoration:underline;color:inherit\">Upgrade / Purchase</a> \u00b7 <a href=\"" + extendHref + "\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"text-decoration:underline;color:inherit\">Extend Trial</a>.";
      }
      if (bannerUpgrade) bannerUpgrade.style.display = "none";
    }
    return;
  }

  if (state.licenseState === "UNREGISTERED") {
    els.graceBanner.style.display = "block";
    var webUrl3 = window.__JOINCLOUD_WEB_URL__ || "https://dashboard.joincloud.in";
    var params3 = new URLSearchParams();
    var deviceId3 = state.hostUuidFromConfig || state.deviceId || "";
    if (state.accountId) params3.set("accountId", state.accountId);
    if (deviceId3) params3.set("deviceId", deviceId3);
    var pricingHref = webUrl3 + "/billing" + (params3.toString() ? "?" + params3.toString() : "");
    var extendHref = deviceId3
      ? webUrl3 + "/auth/desktop?deviceId=" + encodeURIComponent(deviceId3) + "&mode=extendTrial"
      : webUrl3 + "/auth/desktop?mode=extendTrial";
    if (bannerText) {
      bannerText.innerHTML = "Your trial is expired. Upgrade to a paid plan or move to Free tier. <a href=\"" + pricingHref + "\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"text-decoration:underline;color:inherit\">Upgrade / Purchase</a> \u00b7 <a href=\"" + extendHref + "\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"text-decoration:underline;color:inherit\">Extend Trial</a>.";
    }
    if (bannerUpgrade) bannerUpgrade.style.display = "none";
    return;
  }

  // Free tier active: show non-blocking banner encouraging upgrade
  if (state.licenseState === "active" && (String(state.licenseTier || "").toLowerCase() === "free")) {
    els.graceBanner.style.display = "block";
    if (bannerText) bannerText.textContent = "You are on the free plan with low limits monthly. Upgrade for more.";
    if (bannerUpgrade) {
      bannerUpgrade.style.display = "inline";
      bannerUpgrade.textContent = "Upgrade plan";
      bannerUpgrade.href = webUrl + "/billing?" + params.toString();
    }
    return;
  }

  // Paid active: check if near/at share limit and show banner
  if (state.licenseState === "active") {
    fetch("/api/license/usage").then(function(r) { return r.ok ? r.json() : null; }).then(function(usage) {
      if (!usage || !els.graceBanner) return;
      var sl = usage.shares_limit;
      var su = usage.shares_used != null ? usage.shares_used : 0;
      var nearLimit = sl != null && sl < 999999 &&
        (su >= sl || Math.max(0, sl - su) <= Math.max(1, Math.ceil(sl * 0.1)));
      if (nearLimit) {
        els.graceBanner.style.display = "block";
        if (bannerText) bannerText.textContent = su >= sl
          ? "Share limit reached (" + su + "/" + sl + "). Upgrade your plan for more shares."
          : "Approaching share limit (" + su + "/" + sl + "). Consider upgrading.";
        if (bannerUpgrade) {
          bannerUpgrade.style.display = "inline";
          bannerUpgrade.textContent = "Upgrade plan";
          bannerUpgrade.href = webUrl + "/billing?" + params.toString();
        }
      }
    }).catch(function() {});
    return;
  }

  els.graceBanner.style.display = "none";
}

function setUsageBar(id, used, limit) {
  var el = document.getElementById(id);
  if (!el) return;
  var fill = el.querySelector(".usage-bar-fill");
  var label = el.querySelector(".usage-bar-label");
  if (!fill || !label) return;
  var pct = (limit != null && limit > 0) ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  fill.style.width = pct + "%";
  fill.classList.toggle("usage-bar-warning", pct >= 80 && pct < 100);
  fill.classList.toggle("usage-bar-critical", pct >= 100);
  label.textContent = (limit == null || limit >= 999999) ? (used + " (unlimited)") : (used + " / " + limit);
}

function markServerRequestResult(ok) {
  const now = Date.now();
  if (ok) {
    state.lastServerSuccessAt = now;
    state.serverFailureStreak = 0;
    state.serverStatus = "online";
  } else {
    state.serverFailureStreak = (state.serverFailureStreak || 0) + 1;
    // If we haven't had a success in the last 30s or we have repeated failures, mark offline
    const stale = !state.lastServerSuccessAt || (now - state.lastServerSuccessAt > 30000);
    if (stale || state.serverFailureStreak >= 2) {
      state.serverStatus = "offline";
    }
  }
  updateServerStatusIndicator();
}

function updateServerStatusIndicator() {
  const el = els.settingsServerStatus;
  if (!el) return;
  const status = state.serverStatus || "online";
  if (status === "offline") {
    el.textContent = "Server Inactive";
    el.classList.remove("server-status-online");
    el.classList.add("server-status-offline");
  } else {
    el.textContent = "Server Active";
    el.classList.remove("server-status-offline");
    el.classList.add("server-status-online");
  }
}

async function renderUsageBars() {
  var section = document.getElementById("usage-bars-section");
  var loader = document.getElementById("usage-bars-loader");
  var errorEl = document.getElementById("usage-bars-error");
  var content = document.getElementById("usage-bars-content");
  if (section) section.style.display = "block";
  if (loader) loader.style.display = "flex";
  if (errorEl) errorEl.style.display = "none";
  if (content) content.style.display = "none";

  try {
    const res = await fetch("/api/license/usage");
    if (!res.ok) {
      if (loader) loader.style.display = "none";
      if (errorEl) errorEl.style.display = "block";
      if (content) content.style.display = "none";
      return;
    }
    const usage = await res.json();
    var shareLimit  = (usage.shares_limit != null) ? usage.shares_limit : null;
    var deviceLimit = (usage.devices_limit != null) ? usage.devices_limit : null;
    var shareUsed   = usage.shares_used ?? 0;
    var deviceUsed  = usage.devices_used ?? 0;

    if (loader) loader.style.display = "none";
    if (errorEl) errorEl.style.display = "none";
    if (content) content.style.display = "block";

    var headingEl = document.getElementById("usage-bars-heading");
    if (headingEl) {
      headingEl.textContent = "Plan usage this month";
      headingEl.removeAttribute("title");
    }

    if (section) {
      var tier = (state.licenseTier || "").toLowerCase();
      var isFree = tier === "free";
      var hasLimit = isFree ||
        (shareLimit != null && shareLimit < 999999) ||
        (deviceLimit != null && deviceLimit < 999999);
      section.style.display = hasLimit ? "block" : "none";
    }
    setUsageBar("shares-usage-bar", shareUsed, shareLimit);
    setUsageBar("devices-usage-bar", deviceUsed, deviceLimit);
    var nearLimitEl = document.getElementById("usage-near-limit-msg");
    if (nearLimitEl && section) {
      var shareRemaining = (shareLimit != null && shareLimit < 999999) ? Math.max(0, shareLimit - shareUsed) : null;
      var threshold10 = shareLimit != null && shareLimit < 999999 ? Math.max(1, Math.ceil(shareLimit * 0.1)) : 1;
      var nearOrAtShareLimit = shareLimit != null && shareLimit < 999999 && (shareRemaining <= 1 || shareRemaining <= threshold10 || shareUsed >= shareLimit);
      if (nearOrAtShareLimit) {
        nearLimitEl.style.display = "block";
        nearLimitEl.textContent = "Share limit is reached. Contact support to upgrade your share limit or device limit.";
      } else {
        nearLimitEl.style.display = "none";
        nearLimitEl.textContent = "";
      }
    }
    try { updateGraceBanner(); } catch (_) {}
    try { checkDeviceLimitExceeded(deviceUsed, deviceLimit); } catch (_) {}
  } catch (_) {
    if (loader) loader.style.display = "none";
    if (errorEl) errorEl.style.display = "block";
    if (content) content.style.display = "none";
    if (section) section.style.display = "block";
  }
}

// ── Device Limit Exceeded Modal ──────────────────────────────────────────────
// Shown when the number of approved devices exceeds the plan limit (e.g. after
// a plan downgrade). The user must remove devices until within limits; the modal
// closes automatically once compliant.

var _deviceLimitExceededVisible = false;

async function checkDeviceLimitExceeded(devicesUsed, devicesLimit) {
  if (!state.isAdmin) return;
  if (devicesLimit == null || devicesLimit <= 0) return;
  if (devicesUsed <= devicesLimit) {
    // Within limit — close modal if it was open
    if (_deviceLimitExceededVisible) closeDeviceLimitExceededModal();
    return;
  }
  // Over limit — show modal
  await openDeviceLimitExceededModal(devicesUsed, devicesLimit);
}

async function openDeviceLimitExceededModal(devicesUsed, devicesLimit) {
  const modal = document.getElementById("device-limit-exceeded-modal");
  const desc  = document.getElementById("device-limit-exceeded-desc");
  const list  = document.getElementById("device-limit-exceeded-list");
  if (!modal) return;

  // Fetch current approved devices
  let devices = [];
  try {
    const res = await apiFetch("/api/v1/access/devices");
    if (res && res.ok) devices = await res.json();
  } catch (_) {}

  // Build device rows
  list.innerHTML = "";
  if (!devices.length) {
    list.innerHTML = '<div class="value value-muted">No approved devices found.</div>';
  } else {
    devices.forEach(function(device) {
      const row = document.createElement("div");
      row.className = "pending-item";
      row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;";
      row.dataset.fingerprint = device.fingerprint || "";

      const meta = document.createElement("div");
      meta.innerHTML =
        '<div class="item-title">' + (device.device_name || "Unknown Device") + '</div>' +
        '<div class="item-sub mono">' + shortenFingerprint(device.fingerprint) + '</div>';

      const removeBtn = document.createElement("button");
      removeBtn.className = "button danger";
      removeBtn.style.cssText = "flex-shrink:0;min-width:80px;";
      removeBtn.textContent = "Remove";
      removeBtn.onclick = async function() {
        removeBtn.disabled = true;
        removeBtn.textContent = "Removing…";
        try {
          await apiFetch("/api/v1/access/devices/remove", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fingerprint: device.fingerprint }),
          });
          row.remove();
        } catch (_) {
          removeBtn.disabled = false;
          removeBtn.textContent = "Remove";
          return;
        }
        // Re-fetch usage to get updated counts and auto-close if within limit
        try {
          const usageRes = await fetch("/api/license/usage");
          if (usageRes.ok) {
            const usage = await usageRes.json();
            const newUsed  = usage.devices_used  ?? 0;
            const newLimit = usage.devices_limit ?? devicesLimit;
            desc.textContent = "Your plan allows " + newLimit + " device" + (newLimit !== 1 ? "s" : "") +
              ". You currently have " + newUsed + " approved.";
            if (newUsed <= newLimit) {
              closeDeviceLimitExceededModal();
              // Refresh usage bars and device list after modal closes
              renderUsageBars().catch(function() {});
              if (typeof loadApprovedDevices === "function") loadApprovedDevices().catch ? loadApprovedDevices().catch(function(){}) : loadApprovedDevices();
            }
          }
        } catch (_) {}
      };

      row.appendChild(meta);
      row.appendChild(removeBtn);
      list.appendChild(row);
    });
  }

  if (desc) {
    desc.textContent = "Your plan allows " + devicesLimit + " device" + (devicesLimit !== 1 ? "s" : "") +
      ". You currently have " + devicesUsed + " approved.";
  }

  modal.classList.add("active");
  _deviceLimitExceededVisible = true;
}

function closeDeviceLimitExceededModal() {
  const modal = document.getElementById("device-limit-exceeded-modal");
  if (modal) modal.classList.remove("active");
  _deviceLimitExceededVisible = false;
}
// ─────────────────────────────────────────────────────────────────────────────

function updateSubscriptionSection() {
  const hasLicense = state.licenseState && state.licenseState !== "UNREGISTERED";

  // Home trial notice: show when on trial only; hide when user has purchased a plan (pro/teams/custom)
  var homeTrialNotice = document.getElementById("home-trial-notice");
  if (homeTrialNotice) {
    const paidTiersNotice = ["pro", "teams", "custom"];
    const isPaidPlanNotice = state.licenseTier && paidTiersNotice.includes(String(state.licenseTier).toLowerCase());
    if (!isPaidPlanNotice && (state.licenseState === "trial_active" || state.licenseState === "TRIAL" || state.licenseState === "TRIAL_ACTIVE")) {
      homeTrialNotice.style.display = "block";
      homeTrialNotice.textContent = "You're on a free trial.";
    } else {
      homeTrialNotice.style.display = "none";
    }
  }

  // Populate the richer profile card in Settings (always show plan/status)
  const isAuth = state.isAuthenticated === true;
  const isTrialActive = /^trial/i.test(String(state.licenseState || "")) || state.licenseState === "TRIAL" || state.licenseState === "TRIAL_ACTIVE";
  const deviceIdForDisplay = state.hostUuidFromConfig || state.deviceId || "";

  if (els.settingsProfileCard) {
    els.settingsProfileCard.style.display = "block";
    // When signed in: show email. When signed out: show device ID + trial
    let emailDisplay;
    if (isAuth && state.accountEmail && state.accountEmail.trim()) {
      emailDisplay = state.accountEmail.trim();
    } else if (!isAuth && deviceIdForDisplay) {
      emailDisplay = "Device: " + deviceIdForDisplay.slice(0, 16) + (deviceIdForDisplay.length > 16 ? "…" : "");
    } else if (!isAuth) {
      emailDisplay = "Not signed in";
    } else {
      emailDisplay = state.accountId ? "Account: " + state.accountId.slice(0, 16) + "…" : (hasLicense ? "Device account" : "Not signed in");
    }
    if (els.settingsProfileEmail) els.settingsProfileEmail.textContent = emailDisplay;

    const planDisplay = (state.licenseTier || (state.licenseState === "UNREGISTERED" ? "free" : "trial")).replace(/^./, (c) => c.toUpperCase());
    if (els.settingsProfilePlan) els.settingsProfilePlan.textContent = planDisplay;

    const rawStatus = state.licenseState === "UNREGISTERED" ? "Trial ended" : (state.licenseState || "-");
    const paidTiers = ["pro", "teams", "custom"];
    const isPaidPlan = state.licenseTier && paidTiers.includes(String(state.licenseTier).toLowerCase());
    const effectiveStatus = isPaidPlan && (rawStatus === "trial_active" || rawStatus === "trialing") ? "active" : rawStatus;
    const statusDisplay = String(effectiveStatus).replace(/_/g, " ");
    if (els.settingsProfileStatus) {
      els.settingsProfileStatus.textContent = statusDisplay;
      els.settingsProfileStatus.className = "settings-profile-badge " + (
        effectiveStatus === "active" ? "badge-active" :
        effectiveStatus === "trial_active" ? "badge-trial" :
        effectiveStatus === "grace" ? "badge-grace" :
        effectiveStatus === "Trial ended" || effectiveStatus === "UNREGISTERED" ? "badge-expired" : "badge-expired"
      );
    }

    const limit = state.licenseDeviceLimit;
    if (els.settingsProfileDeviceLimit) {
      els.settingsProfileDeviceLimit.textContent = limit ? `${limit} device${limit !== 1 ? "s" : ""}` : "-";
    }

    let expiryDisplay = "-";
    var isFreeNoExpiry = (String(state.licenseTier || "").toLowerCase() === "free" && state.licenseExpiresAt >= 2147483647);
    if (state.licenseExpiresAt && !isFreeNoExpiry) {
      try {
        const d = new Date(state.licenseExpiresAt * 1000);
        expiryDisplay = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
      } catch (_) {}
    } else if (isFreeNoExpiry) {
      expiryDisplay = "Never";
    }
    if (els.settingsProfileExpiry) els.settingsProfileExpiry.textContent = expiryDisplay;
  }

  // Banner: show when user cannot use app (signed out + no trial, or paid plan requires sign-in)
  const noTrialBanner = document.getElementById("settings-no-trial-banner");
  const noTrialSigninLink = document.getElementById("settings-no-trial-signin-link");
  if (noTrialBanner && noTrialSigninLink) {
    const showNoTrialBanner = !canUseApp();
    noTrialBanner.style.display = showNoTrialBanner ? "block" : "none";
    if (showNoTrialBanner) {
      const webUrl = window.__JOINCLOUD_WEB_URL__ || "https://joincloud.com";
      const params = new URLSearchParams();
      if (deviceIdForDisplay) params.set("deviceId", deviceIdForDisplay);
      if (state.accountId) params.set("accountId", state.accountId);
      noTrialSigninLink.href = `${webUrl}/billing${params.toString() ? "?" + params.toString() : ""}`;
      noTrialSigninLink.target = "_blank";
      noTrialSigninLink.rel = "noopener noreferrer";
    }
  }

  // Legacy single-row profile - hide when the rich card is shown
  if (els.settingsProfileRow && els.settingsProfileValue) {
    if (hasLicense && !els.settingsProfileCard) {
      els.settingsProfileRow.style.display = "block";
      if (state.accountEmail && state.accountEmail.trim()) {
        els.settingsProfileValue.textContent = "Signed in as " + state.accountEmail.trim();
      } else {
        const id = (state.accountId || state.hostUuidFromConfig || state.deviceId || "").slice(0, 24);
        els.settingsProfileValue.textContent = id ? "Account: " + id + "…" : "Device account";
      }
    } else {
      els.settingsProfileRow.style.display = "none";
    }
  }

  if (!els.subscriptionCard) return;
  // Subscription & Billing block is intentionally hidden in Settings UI.
  els.subscriptionCard.style.display = "none";
  return;
  const plan = (state.licenseTier || (state.licenseState === "UNREGISTERED" ? "free" : "trial")).replace(/^./, (c) => c.toUpperCase());
  if (els.subscriptionPlan) els.subscriptionPlan.textContent = plan;
  const rawSubStatus = state.licenseState === "UNREGISTERED" ? "Trial ended" : (state.subscription?.status || state.licenseState || "-");
  const paidTiersSub = ["pro", "teams", "custom"];
  const isPaidPlanSub = state.licenseTier && paidTiersSub.includes(String(state.licenseTier).toLowerCase());
  const status = isPaidPlanSub && (rawSubStatus === "trial_active" || rawSubStatus === "trialing") ? "active" : rawSubStatus;
  if (els.subscriptionStatus) els.subscriptionStatus.textContent = String(status).replace(/_/g, " ");
  let renewalText = "-";
  if (state.subscription?.renewal_at) {
    try {
      const r = state.subscription.renewal_at;
      const d = typeof r === "string" ? new Date(r) : new Date(r * 1000);
      renewalText = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch (_) {}
  } else if (state.licenseExpiresAt) {
    var isFreeNoExpiryRenewal = (String(state.licenseTier || "").toLowerCase() === "free" && state.licenseExpiresAt >= 2147483647);
    if (isFreeNoExpiryRenewal) {
      renewalText = "Never";
    } else {
      try {
        const d = new Date(state.licenseExpiresAt * 1000);
        renewalText = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) + " (expires)";
      } catch (_) {}
    }
  }
  if (els.subscriptionRenewal) els.subscriptionRenewal.textContent = renewalText;
  const showManage = !!(state.subscription && (state.subscription.status === "active" || state.subscription.status === "trialing" || state.subscription.status === "past_due"));
  if (els.subscriptionManageBtn) {
    els.subscriptionManageBtn.style.display = showManage ? "inline-flex" : "none";
  }
  const webUrlSub = window.__JOINCLOUD_WEB_URL__ || "https://joincloud.com";
  const accountIdSub = state.accountId || "";
  const deviceIdSub = state.hostUuidFromConfig || state.deviceId || "";
  const billingParamsSub = new URLSearchParams();
  if (accountIdSub) billingParamsSub.set("accountId", accountIdSub);
  if (deviceIdSub) billingParamsSub.set("deviceId", deviceIdSub);
  const billingQuerySub = billingParamsSub.toString() ? `?${billingParamsSub.toString()}` : "";
  const pricingUrl = `${webUrlSub}/billing${billingQuerySub}`;
  const showUpgrade = !!(state.licenseTier === "trial" || !state.subscription?.status);
  if (els.subscriptionUpgradeLink) {
    els.subscriptionUpgradeLink.style.display = showUpgrade ? "inline" : "none";
    els.subscriptionUpgradeLink.href = state.upgradeUrl || pricingUrl;
    els.subscriptionUpgradeLink.target = "_blank";
    els.subscriptionUpgradeLink.rel = "noopener noreferrer";
    els.subscriptionUpgradeLink.textContent = isPaidPlanSub ? "Upgrade limit" : "Upgrade plan";
  }
  const showExtendTrial = state.licenseState === "UNREGISTERED" && state.canExtendTrial;
  if (els.subscriptionExtendTrialLink) {
    els.subscriptionExtendTrialLink.style.display = showExtendTrial ? "inline" : "none";
    if (showExtendTrial) {
      const webUrlExt = window.__JOINCLOUD_WEB_URL__ || "https://joincloud.com";
      const deviceIdExt = state.hostUuidFromConfig || state.deviceId || "";
      els.subscriptionExtendTrialLink.href = deviceIdExt
        ? `${webUrlExt}/auth/desktop?deviceId=${encodeURIComponent(deviceIdExt)}&mode=extendTrial`
        : `${webUrlExt}/auth/desktop?mode=extendTrial`;
      els.subscriptionExtendTrialLink.target = "_blank";
      els.subscriptionExtendTrialLink.rel = "noopener noreferrer";
    }
  }
  const webUrl = window.__JOINCLOUD_WEB_URL__ || "https://joincloud.com";
  const accountIdSub2 = state.accountId || "";
  const deviceIdSub2 = state.hostUuidFromConfig || state.deviceId || "";
  const dashboardParams = new URLSearchParams();
  if (accountIdSub2) dashboardParams.set("accountId", accountIdSub2);
  if (deviceIdSub2) dashboardParams.set("deviceId", deviceIdSub2);
  const dashboardUrl = `${webUrl}/dashboard${dashboardParams.toString() ? "?" + dashboardParams.toString() : ""}`;
  const signInUrl = deviceIdSub2
    ? `${webUrl}/auth/desktop?deviceId=${encodeURIComponent(deviceIdSub2)}`
    : `${webUrl}/auth/desktop`;
  if (els.settingsOpenDashboardLink) {
    if (isAuth || ls === "active" || ls === "trial_active" || ls === "trialing" || ls === "grace") {
      els.settingsOpenDashboardLink.style.display = "";
      els.settingsOpenDashboardLink.textContent = "Open Dashboard";
      els.settingsOpenDashboardLink.href = dashboardUrl;
    } else {
      els.settingsOpenDashboardLink.style.display = "";
      els.settingsOpenDashboardLink.textContent = "Open Dashboard";
      els.settingsOpenDashboardLink.href = dashboardUrl;
    }
    els.settingsOpenDashboardLink.target = "_blank";
    els.settingsOpenDashboardLink.rel = "noopener noreferrer";
  }
  if (els.settingsLogout) {
    // Hide settings logout/sign-in button in this build.
    els.settingsLogout.style.display = "none";
  }
  if (els.subscriptionHelperText) {
    if (isAuth || ls === "active" || ls === "grace" || ls === "trialing") {
      els.subscriptionHelperText.textContent = "Manage your subscription or extend trial.";
    } else if (isTrialActive) {
      els.subscriptionHelperText.textContent = "Sign in to link this device to your account and manage your subscription.";
    } else {
      els.subscriptionHelperText.textContent = "Log in and purchase a plan to start.";
    }
  }
  // Render usage progress bars
  try { renderUsageBars().catch(() => {}); } catch (_) {}
}

async function openBillingPortal() {
  const btn = els.subscriptionManageBtn;
  if (btn) btn.disabled = true;
  try {
    const returnUrl = window.location.origin + window.location.pathname;
    const res = await apiFetch("/api/v1/billing/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ return_url: returnUrl }),
    });
    const data = await res.json();
    if (res.ok && data.url) {
      window.open(data.url, "_blank", "noopener,noreferrer");
    } else {
      const msg = data.message || "Could not open billing portal";
      if (els.activationMessage) {
        els.activationMessage.textContent = msg;
        els.activationMessage.style.color = "#c00";
      }
    }
  } catch (_) {
    if (els.activationMessage) {
      els.activationMessage.textContent = "Network error. Try again.";
      els.activationMessage.style.color = "#c00";
    }
  }
  if (els.subscriptionManageBtn) els.subscriptionManageBtn.disabled = false;
}

function canAddDeviceOrCreateShare() {
  if (state.accessRole === "pending") return false;
  if (state.licenseState === "revoked") return false;
  return true;
}

function isTeamsEnabledByEntitlement() {
  const ls = String(state.licenseState || "").toUpperCase().replace(/-/g, "_");
  if (ls === "TRIAL" || ls === "TRIAL_ACTIVE") return true;
  if (state.entitlements && typeof state.entitlements.teamEnabled === "boolean") {
    if (state.entitlements.teamEnabled) return true;
  }
  const tier = String(state.licenseTier || "").toLowerCase();
  return tier === "team" || tier === "teams";
}

function shouldShowTeamsMenu() {
  // Always show Teams entry so users can discover it,
  // but behavior for locked plans is handled by updateTeamsLockedState/showUploadBanner.
  return true;
}

function updateTeamsLockedState() {
  const teamsEnabled = isTeamsEnabledByEntitlement();
  const webUrl = window.__JOINCLOUD_WEB_URL__ || "https://joincloud.com";
  const deviceId = state.hostUuidFromConfig || state.deviceId || "";
  const params = new URLSearchParams();
  if (deviceId) params.set("deviceId", deviceId);
  const upgradeHref = webUrl + "/billing" + (params.toString() ? "?" + params.toString() : "");

  if (els.teamsLayout) {
    els.teamsLayout.classList.toggle("teams-locked", !teamsEnabled);
  }
  if (els.teamsLockedOverlay) {
    els.teamsLockedOverlay.style.display = teamsEnabled ? "none" : "flex";
  }
  if (els.teamsLockedTitle) {
    els.teamsLockedTitle.textContent = teamsEnabled ? "" : "Teams not included in your plan";
  }
  if (els.teamsLockedText) {
    var tier = String(state.licenseTier || "").toLowerCase();
    var lockedText;
    if (teamsEnabled) {
      lockedText = "";
    } else if (tier === "pro") {
      lockedText = "Teams is not included in your Pro plan. Upgrade to Teams or Custom to unlock shared team spaces.";
    } else {
      lockedText = "Upgrade to a paid plan to access Teams.";
    }
    els.teamsLockedText.textContent = lockedText;
  }
  if (els.teamsLockedUpgrade) {
    els.teamsLockedUpgrade.href = upgradeHref;
    els.teamsLockedUpgrade.style.display = teamsEnabled ? "none" : "inline-flex";
  }
}

function showNetworkToast() {
  const banner = document.getElementById("upload-banner");
  if (!banner) return;
  const textEl = banner.querySelector(".upload-banner-text");
  if (!textEl) return;
  banner.className = "upload-banner upload-banner-loading";
  banner.classList.remove("upload-banner-hidden");
  textEl.textContent = "Network changed - share links updated.";
  setTimeout(() => {
    banner.classList.add("upload-banner-hidden");
  }, 3000);
}

async function fetchStatus() {
  const res = await apiFetch("/api/status");
  const data = await res.json();
  const running = data.status === "running";
  updateHeaderStatus(running);
  els.storageLabel.textContent = data.storageLabel || "Local storage";
  els.ownerMount.textContent = data.ownerBasePath;
  if (data.lanBaseUrl) stateMeta.lanBaseUrl = data.lanBaseUrl;
  await loadControlPlaneConfig();
  if (data.shareLinkUrls) stateMeta.shareLinkUrls = data.shareLinkUrls;
  const networkHash = data.lanBaseUrl || "";
  if (stateMeta.lastNetworkHash && stateMeta.lastNetworkHash !== networkHash) {
    showNetworkToast();
  }
  if (data.network_changed_at && data.network_changed_at !== stateMeta.lastNetworkChangedAt) {
    stateMeta.lastNetworkChangedAt = data.network_changed_at;
    showNetworkToast();
  }
  stateMeta.lastNetworkHash = networkHash;
  if (els.mdnsHostname) els.mdnsHostname.textContent = data.mdns_hostname || "--";
  if (els.mdnsIpFallback) {
    const port = data.port || (data.lanBaseUrl && data.lanBaseUrl.match(/:(\d+)/)?.[1]) || "8787";
    els.mdnsIpFallback.textContent = data.bestLanIp ? `IP fallback: ${data.bestLanIp}:${port}` : "--";
  }
  if (els.mdnsStatusBadge) {
    const resolvable = !!data.mdns_resolvable;
    els.mdnsStatusBadge.textContent = running ? (resolvable ? "Resolvable" : "IP fallback") : "Inactive";
    els.mdnsStatusBadge.className = "badge " + (running ? (resolvable ? "badge-active" : "badge-private") : "badge-private");
    els.mdnsStatusBadge.title = resolvable ? "mDNS hostname resolves" : "mDNS hostname not resolvable; use IP fallback";
  }
  if (els.mdnsOpenBtn) {
    const port = data.port || "8787";
    const resolvable = !!data.mdns_resolvable;
    const openUrl = resolvable && data.mdns_hostname
      ? `http://${data.mdns_hostname}:${port}/`
      : data.lanBaseUrl || (data.bestLanIp ? `http://${data.bestLanIp}:${port}/` : null);
    els.mdnsOpenBtn.href = openUrl || "#";
    els.mdnsOpenBtn.style.display = openUrl && running ? "" : "none";
  }
  if (running && !data.mdns_resolvable && !stateMeta.mdnsUnresolvableToastShown) {
    stateMeta.mdnsUnresolvableToastShown = true;
    showUploadBanner("mDNS hostname not resolvable; using IP fallback.", "loading");
    setTimeout(() => hideUploadBanner(), 3000);
  }
  if (els.networkDiscoveryHostname) els.networkDiscoveryHostname.textContent = data.mdns_hostname || "--";
  if (els.networkDiscoveryIp) {
    const port = data.port || (data.lanBaseUrl && data.lanBaseUrl.match(/:(\d+)/)?.[1]) || "8787";
    els.networkDiscoveryIp.textContent = data.bestLanIp ? "IP fallback: " + data.bestLanIp + ":" + port : "--";
  }
  if (els.networkDiscoveryBadge) {
    const resolvable = !!data.mdns_resolvable;
    els.networkDiscoveryBadge.textContent = running ? (resolvable ? "Resolvable" : "IP fallback") : "Inactive";
    els.networkDiscoveryBadge.className = "badge " + (running ? (resolvable ? "badge-active" : "badge-private") : "badge-private");
    els.networkDiscoveryBadge.title = resolvable ? "Hostname resolves" : "Hostname not resolvable; use IP fallback";
  }
  if (els.networkDiscoveryOpenBtn) {
    const port = data.port || "8787";
    const resolvable = !!data.mdns_resolvable;
    const openUrl = resolvable && data.mdns_hostname
      ? "http://" + data.mdns_hostname + ":" + port + "/"
      : data.lanBaseUrl || (data.bestLanIp ? "http://" + data.bestLanIp + ":" + port + "/" : null);
    els.networkDiscoveryOpenBtn.href = openUrl || "#";
    els.networkDiscoveryOpenBtn.style.display = openUrl && running ? "" : "none";
  }
  if (els.uptimeDisplay && Number.isFinite(data.uptime_seconds)) {
    els.uptimeDisplay.textContent = `Uptime: ${formatUptime(data.uptime_seconds)}`;
  }
}

function updateHeaderStatus(running) {
  state.sharingEnabled = !!running;
  els.status.innerHTML = `<span class="status-dot ${running ? "running" : "stopped"}" id="status-dot"></span> Status: ${running ? "Running" : "Stopped"}`;
  els.statusDot = document.getElementById("status-dot");
  if (els.toggleSharing) {
    els.toggleSharing.textContent = running ? "Stop" : "Start";
  }
}

async function loadRuntimeStatus() {
  const res = await apiFetch("/api/v1/status", {}, true);
  if (!res.ok) return;
  const data = await res.json();
  updateHeaderStatus(!!data.running);
}

async function loadFiles(pathValue) {
  setRefreshLoading(els.refreshFiles, true);
  try {
    const res = await apiFetch(`/api/files?path=${encodeURIComponent(pathValue)}`);
    const data = await res.json();
    state.path = data.path;
    state.rawItems = Array.isArray(data.items) ? data.items : [];
    renderBreadcrumbs();
    renderFiles();
  } finally {
    setRefreshLoading(els.refreshFiles, false);
  }
}

async function loadShares() {
  setRefreshLoading(els.refreshShares, true);
  try {
    const res = await apiFetch("/api/shares");
    state.shares = await res.json();
    renderShares();
    // Keep file badges in sync with active shares.
    try { renderFiles(); } catch (_) {}
  } finally {
    setRefreshLoading(els.refreshShares, false);
  }
}

async function loadLogs() {
  setRefreshLoading(els.refreshLogs, true);
  try {
    const res = await apiFetch("/api/v1/logs");
    renderLogs(await res.json());
  } finally {
    setRefreshLoading(els.refreshLogs, false);
  }
}

async function loadShareVisitSummary() {
  if (!state.isAdmin) {
    els.shareVisitTotal.textContent = "Total: host only";
    els.shareVisitToday.textContent = "Today: host only";
    return;
  }
  const res = await apiFetch("/api/v1/telemetry/summary");
  const data = await res.json();
  els.shareVisitTotal.textContent = `Total: ${Number(data.share_page_visits || 0)}`;
  els.shareVisitToday.textContent = `Downloads: ${Number(data.total_downloads || 0)}`;
}

async function loadNetwork() {
  renderNetwork();
}

async function loadTelemetrySettings() {
  const res = await apiFetch("/api/v1/telemetry/settings");
  const data = await res.json();
  els.telemetryToggle.checked = !!data.enabled;
}

async function updateTelemetrySettings(enabled) {
  await apiFetch("/api/v1/telemetry/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
}

async function loadTechnicalConfig() {
  if (!els.technicalConfigContent || !isHostRole()) return;
  try {
    const [cfgRes, debugRes] = await Promise.all([
      apiFetch("/api/v1/technical-config"),
      apiFetch("/api/v1/license/local-usage-debug").catch(() => null),
    ]);
    if (!cfgRes.ok) {
      els.technicalConfigContent.textContent = "Available on host only.";
      return;
    }
    const cfg = await cfgRes.json();
    const lines = [
      `Host ID: ${cfg.host_id || "-"}`,
      `Local IPs: ${(cfg.local_ips || []).join(", ") || "-"}`,
      `Port: ${cfg.port || "-"}`,
      `App version: ${cfg.app_version || "-"}`,
      `License state: ${cfg.license_state || "-"}`,
    ];
    if (debugRes && debugRes.ok) {
      try {
        const dbg = await debugRes.json();
        lines.push(
          "",
          "[Local usage diagnostics]",
          `Shares used (local): ${dbg.local_shares_used}`,
          `Shares limit (local): ${dbg.local_shares_limit ?? "-"}`,
          `Shares remaining (local): ${dbg.local_shares_remaining ?? "-"}`,
          `Usage signature valid: ${dbg.usage_signature_valid === null ? "unknown" : String(dbg.usage_signature_valid)}`,
          `Entitlements present: ${dbg.entitlements_present ? "yes" : "no"}`,
          `Admin capped shares this month: ${dbg.admin_capped_shares_this_month}`,
          `Admin capped shares limit: ${dbg.admin_capped_shares_limit ?? "-"}`,
        );
      } catch (_) {}
    }
    els.technicalConfigContent.textContent = lines.join("\n");
  } catch (_err) {
    els.technicalConfigContent.textContent = "Failed to load.";
  }
}

async function loadPublicAccessStatus() {
  if (!els.remoteAccessNotConfigured || !els.remoteAccessConfiguredWrap) return;
  try {
    const res = await apiFetch("/api/public-access/status");
    const data = await res.json();
    const notConfigured = data.status === "failed" && data.reason === "not_configured";
    if (notConfigured) {
      els.remoteAccessNotConfigured.style.display = "block";
      els.remoteAccessConfiguredWrap.style.display = "none";
      if (els.remoteAccessSetupWrap) els.remoteAccessSetupWrap.style.display = "block";
      if (els.remoteAccessSetupSpinner) els.remoteAccessSetupSpinner.style.display = "none";
      if (els.remoteAccessSetupError) els.remoteAccessSetupError.style.display = "none";
      return;
    }
    els.remoteAccessNotConfigured.style.display = "none";
    els.remoteAccessConfiguredWrap.style.display = "block";
    if (els.remoteAccessToggle) {
      els.remoteAccessToggle.checked = data.status === "active" || data.status === "starting";
      els.remoteAccessToggle.disabled = false;
    }
    if (els.remoteAccessStarting) els.remoteAccessStarting.style.display = data.status === "starting" ? "flex" : "none";
    if (els.remoteAccessActive) {
      const hasUrl = data.status === "active" && data.publicUrl;
      const placeholder = document.getElementById("remote-access-unavailable");
      if (placeholder) {
        placeholder.style.display = hasUrl ? "none" : "block";
        const titleEl = placeholder.querySelector(".remote-access-placeholder-title");
        const subEl = placeholder.querySelector(".remote-access-placeholder-sub");
        if (data.status === "starting") {
          if (titleEl) titleEl.textContent = "Starting Remote Access…";
          if (subEl) subEl.textContent = "We’re provisioning your public URL. This usually takes a few seconds.";
        } else if (data.status === "failed") {
          if (titleEl) titleEl.textContent = "Remote Access is inactive";
          if (subEl) subEl.textContent = "Turn it on to generate a public URL. If it keeps failing, check your internet connection and try again.";
        } else {
          if (titleEl) titleEl.textContent = "Public URL not available yet";
          if (subEl) subEl.textContent = "Turn on Remote Access and wait a few seconds. Once active, your URL and QR code will appear here.";
        }
      }

      els.remoteAccessActive.style.display = hasUrl ? "block" : "none";
      if (els.remoteAccessCopy) els.remoteAccessCopy.disabled = !hasUrl;
      if (els.remoteAccessOpen) els.remoteAccessOpen.disabled = !hasUrl;

      if (hasUrl && els.remoteAccessUrl) {
        els.remoteAccessUrl.href = data.publicUrl;
        els.remoteAccessUrl.textContent = data.publicUrl;
        if (window.QRious && els.remoteAccessQr) {
          new QRious({ element: els.remoteAccessQr, value: data.publicUrl, size: 180 });
        }
      } else if (els.remoteAccessUrl) {
        els.remoteAccessUrl.href = "#";
        els.remoteAccessUrl.textContent = "";
        if (els.remoteAccessQr) {
          const ctx = els.remoteAccessQr.getContext("2d");
          if (ctx) ctx.clearRect(0, 0, els.remoteAccessQr.width, els.remoteAccessQr.height);
        }
      }
    }
    // Home → Public File Sharing status
    const isActive = data.status === "active" && data.publicUrl;
    const isEnabled = data.status === "active" || data.status === "starting";
    if (els.homeRemoteAccessToggle) {
      els.homeRemoteAccessToggle.checked = isEnabled;
      els.homeRemoteAccessToggle.disabled = false;
    }
    if (els.remoteCloudUrlInput) {
      els.remoteCloudUrlInput.value = isActive ? data.publicUrl : "";
    }
    if (els.remoteCloudCopy) {
      els.remoteCloudCopy.disabled = !isActive;
    }
    if (els.remoteCloudActiveWrap) {
      els.remoteCloudActiveWrap.style.display = isActive ? "block" : "none";
    }
    if (els.remoteCloudSetupCta) {
      els.remoteCloudSetupCta.style.display = isActive ? "none" : "block";
    }
    if (els.remoteCloudUrlQr) {
      if (window.QRious && isActive) {
        new QRious({
          element: els.remoteCloudUrlQr,
          value: data.publicUrl,
          size: 220,
        });
      } else {
        const ctx = els.remoteCloudUrlQr.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, els.remoteCloudUrlQr.width, els.remoteCloudUrlQr.height);
        }
      }
    }
    if (els.remoteCloudQrWrap) {
      els.remoteCloudQrWrap.style.display = isActive ? "flex" : "none";
    }
    if (els.publicStatus) {
      if (data.status === "active" && data.publicUrl) {
        els.publicStatus.className = "value";
        els.publicStatus.innerHTML = `Active: <a class="link mono" href="${escapeHtml(
          data.publicUrl
        )}" target="_blank" rel="noopener noreferrer">${escapeHtml(data.publicUrl)}</a>`;
      } else if (data.status === "starting") {
        els.publicStatus.className = "value value-muted";
        els.publicStatus.textContent = "Starting…";
      } else if (data.status === "failed") {
        els.publicStatus.className = "value value-muted";
        els.publicStatus.textContent = "Inactive";
      } else {
        els.publicStatus.className = "value value-muted";
        els.publicStatus.textContent = "Inactive";
      }
    }
  } catch (_) {
    els.remoteAccessNotConfigured.style.display = "block";
    els.remoteAccessConfiguredWrap.style.display = "none";
    if (els.homeRemoteAccessToggle) {
      els.homeRemoteAccessToggle.checked = false;
      els.homeRemoteAccessToggle.disabled = true;
    }
    if (els.remoteCloudCopy) els.remoteCloudCopy.disabled = true;
    if (els.remoteCloudSetupCta) els.remoteCloudSetupCta.style.display = "block";
    if (els.remoteCloudActiveWrap) els.remoteCloudActiveWrap.style.display = "none";
    if (els.remoteCloudQrWrap) els.remoteCloudQrWrap.style.display = "none";
    if (els.publicStatus) {
      els.publicStatus.className = "value value-muted";
      els.publicStatus.textContent = "Inactive";
    }
  }
}

async function pollUntilActive() {
  const pollIntervalMs = 2000;
  const timeoutMs = 30000;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await apiFetch("/api/public-access/status");
      const data = await res.json();
      if (data.status === "active") {
        await loadPublicAccessStatus();
        return;
      }
      if (data.status === "failed") {
        await loadPublicAccessStatus();
        return;
      }
    } catch (_) {}
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  await loadPublicAccessStatus();
  if (typeof showUploadBanner === "function") showUploadBanner("Tunnel failed to start", "error");
}

async function loadNetworkSettings() {
  const res = await apiFetch("/api/v1/network/settings");
  const data = await res.json();
  const currentName = String(data.display_name || "Join");
  const normalized = currentName.toLowerCase().startsWith("join") ? currentName : `Join ${currentName}`.trim();
  if (normalized !== currentName) {
    await apiFetch("/api/v1/network/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: normalized }),
    });
  }
  state.displayName = normalized;
  updateHeaderProfile();
  els.networkNameSuffix.value = displayNameToSuffix(normalized);
  const visibility = !!data.network_visibility;
  els.networkVisibility.checked = visibility;
  if (els.networkVisibilityNetwork) els.networkVisibilityNetwork.checked = visibility;
}

async function loadNetwork() {
  if (!els.networkList) return;
  try {
    const res = await apiFetch("/api/v1/network");
    const peers = await res.json();
    if (!peers.length) {
      els.networkList.innerHTML = '<div class="value value-muted">No peers discovered. Use Manual Connect if mDNS is unavailable.</div>';
    } else {
    els.networkList.innerHTML = "";
    peers.forEach((p) => {
      const row = document.createElement("div");
      row.className = "pending-item";
      const addr = p.bestIp ? `${p.bestIp}:${p.port || 8787}` : (p.hostname || "-");
      row.innerHTML = `
        <div class="pending-item-meta">
          <div class="item-title">${escapeHtml(p.display_name || "Unknown")}</div>
          <div class="item-sub mono">${escapeHtml(addr)}</div>
          <div class="item-sub">${p.hostname ? escapeHtml(p.hostname) + " · " : ""}${p.status || "online"} ${p.source === "manual" ? "(manual)" : ""}</div>
        </div>
      `;
      if (p.bestIp) {
        const openBtn = document.createElement("button");
        openBtn.className = "button secondary";
        openBtn.textContent = "Open";
        openBtn.onclick = () => window.open(`http://${p.bestIp}:${p.port || 8787}`, "_blank");
        row.appendChild(openBtn);
      }
      els.networkList.appendChild(row);
    });
    }
  } catch (_) {
    els.networkList.innerHTML = '<div class="value value-muted">Failed to load peers.</div>';
  }
  await loadConnectedUsers();
}

const stateNetwork = { searching: false, lastPeers: [] };

async function loadConnectedUsers() {
  if (!els.connectedUsersList || !isHostRole()) return;
  try {
    const res = await apiFetch("/api/v1/access/devices");
    const devices = await res.json();
    if (!devices.length) {
      els.connectedUsersList.innerHTML = '<div class="value value-muted">No connected users yet.</div>';
      return;
    }
    els.connectedUsersList.innerHTML = "";
    devices.forEach((d) => {
      const row = document.createElement("div");
      row.className = "pending-item";
      const lastSeen = d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : "-";
      row.innerHTML = `
        <div class="pending-item-meta">
          <div class="item-title">${escapeHtml(d.device_name || "Unknown")}</div>
          <div class="item-sub mono">${escapeHtml((d.device_id || "").slice(0, 12))}</div>
          <div class="item-sub">Last seen: ${escapeHtml(lastSeen)}</div>
        </div>
      `;
      const removeBtn = document.createElement("button");
      removeBtn.className = "button danger";
      removeBtn.textContent = "Remove";
      removeBtn.onclick = async () => {
        await apiFetch("/api/v1/access/devices/remove", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fingerprint: d.fingerprint }),
        });
        await loadConnectedUsers();
        await loadApprovedDevices();
        await loadNetwork();
        await renderUsageBars();
      };
      row.appendChild(removeBtn);
      els.connectedUsersList.appendChild(row);
    });
  } catch (_) {
    if (els.connectedUsersList) els.connectedUsersList.innerHTML = '<div class="value value-muted">Failed to load.</div>';
  }
}

async function discoverySearch() {
  if (!els.networkList || stateNetwork.searching) return;
  stateNetwork.searching = true;
  if (els.networkSearchBtn) {
    els.networkSearchBtn.disabled = true;
    if (els.networkSearchBtnText) els.networkSearchBtnText.textContent = "Searching nearby devices…";
  }
  try {
    const searchRes = await apiFetch("/api/v1/network/search?wait=4", { method: "POST" });
    const peers = await searchRes.json();
    stateNetwork.lastPeers = peers;
    const approvedRes = isHostRole() ? await apiFetch("/api/v1/access/devices") : { ok: false };
    const approvedDevices = approvedRes.ok ? await approvedRes.json() : [];
    const approvedIds = new Set(approvedDevices.map((d) => d.device_id || d.fingerprint));
    if (!peers.length) {
      els.networkList.innerHTML = '<div class="network-empty-state"><div class="network-empty-title">No users found</div><div class="network-empty-sub">No nearby devices discovered. Try again or use Manual Connect.</div><button class="button secondary" id="network-try-again-btn">Try again</button></div>';
      const tryBtn = document.getElementById("network-try-again-btn");
      if (tryBtn) tryBtn.onclick = () => discoverySearch();
    } else {
      els.networkList.innerHTML = "";
      peers.forEach((p) => {
        const row = document.createElement("div");
        row.className = "pending-item";
        const friendlyName = p.display_name || p.displayName || "Unknown";
        const shortId = (p.deviceId || "").replace(/^jc_|^dev_/i, "").slice(0, 8).toLowerCase() || "-";
        const addr = p.bestIp ? p.bestIp + ":" + (p.port || 8787) : "-";
        const status = approvedIds.has(p.deviceId) ? "Connected" : "Available";
        row.innerHTML = `
          <div class="pending-item-meta">
            <div class="item-title">${escapeHtml(friendlyName)}</div>
            <div class="item-sub mono">${escapeHtml(shortId)} · ${escapeHtml(addr)}</div>
            <div class="item-sub">${status} ${p.source === "manual" ? "(manual)" : ""}</div>
          </div>
        `;
        if (p.bestIp) {
          const openBtn = document.createElement("button");
          openBtn.className = "button secondary";
          openBtn.textContent = "Open";
          openBtn.onclick = () => window.open("http://" + p.bestIp + ":" + (p.port || 8787), "_blank");
          row.appendChild(openBtn);
        }
        els.networkList.appendChild(row);
      });
    }
    await loadConnectedUsers();
  } catch (_) {
    els.networkList.innerHTML = '<div class="value value-muted">Search failed. <button class="button secondary" onclick="discoverySearch()">Try again</button></div>';
  } finally {
    stateNetwork.searching = false;
    if (els.networkSearchBtn) {
      els.networkSearchBtn.disabled = false;
      if (els.networkSearchBtnText) els.networkSearchBtnText.textContent = "Search";
    }
  }
}

const stateTeams = { teams: [], invites: [], currentTeamId: null, addMembersTeamId: null, addMembersSelected: new Set() };

async function loadTeams() {
  if (!els.teamsList) return;
  updateTeamsLockedState();
  if (!isTeamsEnabledByEntitlement()) {
    els.teamsList.innerHTML = '<div class="value value-muted">Teams are locked for this plan.</div>';
    if (els.teamsEmptyState) els.teamsEmptyState.style.display = "flex";
    if (els.teamDetail) els.teamDetail.style.display = "none";
    if (els.teamsLayout) els.teamsLayout.classList.remove("teams-has-team");
    return;
  }
  try {
    const res = await apiFetch("/api/v1/teams");
    const data = await res.json();
    stateTeams.teams = data.teams || [];
    stateTeams.invites = data.invites || [];
    renderTeams();
  } catch (_) {
    els.teamsList.innerHTML = '<div class="value value-muted">Failed to load teams.</div>';
  }
}

function renderTeams() {
  if (!els.teamsList) return;
  if (stateTeams.currentTeamId) return;
  els.teamsList.style.display = "";
  if (els.teamsEmptyState) els.teamsEmptyState.style.display = "flex";
  if (els.teamDetail) els.teamDetail.style.display = "none";
  if (els.teamsLayout) els.teamsLayout.classList.remove("teams-has-team");
  if (stateTeams.invites.length > 0) {
    const inviteHtml = stateTeams.invites.map((i) => {
      const teamName = i.teamName || stateTeams.teams.find((t) => t.teamId === i.teamId)?.teamName || "Unknown";
      return `<div class="pending-item"><span>Invite to ${escapeHtml(teamName)}</span><button class="button secondary accept-invite" data-invite-id="${escapeHtml(i.inviteId)}">Accept</button></div>`;
    }).join("");
    els.teamsList.innerHTML = `<div class="label">Pending Invites</div>${inviteHtml}<div class="label" style="margin-top:12px">Your Teams</div>`;
    els.teamsList.querySelectorAll(".accept-invite").forEach((btn) => {
      btn.onclick = async () => {
        await apiFetch(`/api/v1/teams/invites/${btn.dataset.inviteId}/accept`, { method: "POST" });
        await loadTeams();
      };
    });
  } else {
    els.teamsList.innerHTML = '<div class="label">Your Teams</div>';
  }
  if (!stateTeams.teams.length) {
    els.teamsList.innerHTML += '<div class="value value-muted">No teams yet. Create one to get started.</div>';
    return;
  }
  stateTeams.teams.forEach((t) => {
    const row = document.createElement("div");
    row.className = "pending-item";
    row.innerHTML = `<div class="item-title">${escapeHtml(t.teamName)}</div><div class="item-sub">${t.members?.length || 0} members</div>`;
    const openBtn = document.createElement("button");
    openBtn.className = "button secondary";
    openBtn.textContent = "Open";
    openBtn.onclick = () => showTeamDetail(t.teamId);
    row.appendChild(openBtn);
    els.teamsList.appendChild(row);
  });
}

async function showTeamDetail(teamId) {
  stateTeams.currentTeamId = teamId;
  els.teamsList.style.display = "none";
  if (els.teamsEmptyState) els.teamsEmptyState.style.display = "none";
  if (els.teamDetail) els.teamDetail.style.display = "flex";
  if (els.teamsLayout) els.teamsLayout.classList.add("teams-has-team");
  const team = stateTeams.teams.find((t) => t.teamId === teamId);
  if (els.teamDetailName) els.teamDetailName.textContent = team?.teamName || "Team";
  await loadTeamMessages(teamId);
}

async function loadTeamMessages(teamId) {
  if (!els.teamChatFeed) return;
  try {
    const res = await apiFetch(`/api/v1/teams/${teamId}/messages`);
    const data = await res.json();
    const messages = data.messages || [];
    els.teamChatFeed.innerHTML = messages.map((m) => {
      const text = m.type === "text" ? (m.payload?.text || "") : m.type === "file" ? `[File: ${m.payload?.filename || "?"}]` : m.type === "note" ? `[Note: ${m.payload?.text || ""}]` : "";
      return `<div class="team-message"><span class="team-message-sender">${escapeHtml(m.senderDeviceId?.slice(0, 8) || "?")}</span>: ${escapeHtml(text)}</div>`;
    }).join("") || '<div class="value value-muted">No messages yet.</div>';
    els.teamChatFeed.scrollTop = els.teamChatFeed.scrollHeight;
  } catch (_) {
    els.teamChatFeed.innerHTML = '<div class="value value-muted">Failed to load messages.</div>';
  }
}

async function sendTeamMessage() {
  const teamId = stateTeams.currentTeamId;
  if (!teamId || !els.teamMessageInput) return;
  const text = els.teamMessageInput.value.trim();
  if (!text) return;
  els.teamMessageInput.value = "";
  try {
    await apiFetch("/api/v1/teams/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId, type: "text", payload: { text } }),
    });
    await loadTeamMessages(teamId);
  } catch (_) {}
}

async function inviteToTeam() {
  const teamId = stateTeams.currentTeamId;
  if (!teamId) return;
  const networkRes = await apiFetch("/api/v1/network").catch(() => ({ json: () => [] }));
  const peers = await (networkRes.ok ? networkRes.json() : []);
  const team = stateTeams.teams.find((t) => t.teamId === teamId);
  const existingIds = new Set(team?.members || []);
  const candidates = peers.filter((p) => p.deviceId && !existingIds.has(p.deviceId));
  if (!candidates.length) {
    alert("No peers available to invite. Discover devices in the Network tab first.");
    return;
  }
  const list = candidates.map((c, i) => `${i + 1}. ${c.display_name || c.displayName || c.deviceId} (${c.deviceId})`).join("\n");
  const choice = prompt(`Enter number or device ID to invite:\n${list}`);
  if (!choice) return;
  const num = parseInt(choice, 10);
  const peer = Number.isFinite(num) && num >= 1 && num <= candidates.length
    ? candidates[num - 1]
    : candidates.find((c) => c.deviceId === choice.trim() || (c.display_name || c.displayName) === choice.trim());
  if (!peer) {
    alert("Invalid selection.");
    return;
  }
  try {
    await apiFetch(`/api/v1/teams/${teamId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toDeviceId: peer.deviceId }),
    });
    alert("Invite sent to " + (peer.display_name || peer.displayName || peer.deviceId) + ".");
  } catch (e) {
    alert("Failed to send invite.");
  }
}

function openCreateTeamModal() {
  if (els.createTeamModal) {
    if (els.createTeamName) els.createTeamName.value = "";
    if (els.createTeamDepartment) els.createTeamDepartment.value = "";
    els.createTeamModal.classList.add("active");
  }
}

function closeCreateTeamModal() {
  if (els.createTeamModal) els.createTeamModal.classList.remove("active");
}

function openAddMembersModal(teamId) {
  stateTeams.addMembersTeamId = teamId;
  if (els.addMembersModal) {
    els.addMembersModal.classList.add("active");
    renderAddMembersList(teamId);
  }
}

function closeAddMembersModal() {
  stateTeams.addMembersTeamId = null;
  if (els.addMembersModal) els.addMembersModal.classList.remove("active");
}

async function renderAddMembersList(teamId) {
  if (!els.addMembersList) return;
  const team = stateTeams.teams.find((t) => t.teamId === teamId);
  const existingIds = new Set(team?.members || []);
  stateTeams.addMembersSelected = new Set();
  try {
    const networkRes = await apiFetch("/api/v1/network");
    const peers = await networkRes.json();
    const candidates = peers.filter((p) => p.deviceId && p.bestIp && !existingIds.has(p.deviceId)).slice(0, 5);
    if (!candidates.length) {
      els.addMembersList.innerHTML = '<div class="value value-muted">No connected users available. Connect devices in the Network tab first.</div>';
      return;
    }
    els.addMembersList.innerHTML = candidates.map((c) => {
      const name = c.display_name || c.displayName || c.deviceId?.slice(0, 8) || "Unknown";
      return `<label class="pending-item" style="cursor:pointer"><input type="checkbox" data-device-id="${escapeHtml(c.deviceId)}" /> ${escapeHtml(name)} (${escapeHtml((c.deviceId || "").slice(0, 12))})</label>`;
    }).join("");
    els.addMembersList.querySelectorAll("input[type=checkbox]").forEach((cb) => {
      cb.onchange = () => {
        if (cb.checked) stateTeams.addMembersSelected.add(cb.dataset.deviceId);
        else stateTeams.addMembersSelected.delete(cb.dataset.deviceId);
      };
    });
  } catch (_) {
    els.addMembersList.innerHTML = '<div class="value value-muted">Failed to load.</div>';
  }
}

async function createTeam() {
  if (!isTeamsEnabledByEntitlement()) {
    showUploadBanner("Upgrade to Teams or Custom to create team spaces.", "error");
    setTimeout(hideUploadBanner, 2400);
    return;
  }
  openCreateTeamModal();
}

async function submitCreateTeam() {
  if (!isTeamsEnabledByEntitlement()) {
    showUploadBanner("Upgrade to Teams or Custom to create team spaces.", "error");
    setTimeout(hideUploadBanner, 2400);
    return;
  }
  const name = els.createTeamName?.value?.trim();
  const department = els.createTeamDepartment?.value?.trim();
  if (!name) {
    showUploadBanner("Team name is required.", "error");
    setTimeout(hideUploadBanner, 2000);
    return;
  }
  try {
    const res = await apiFetch("/api/v1/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamName: name, department: department || undefined }),
    });
    const team = await res.json();
    closeCreateTeamModal();
    await loadTeams();
    if (team && team.teamId) openAddMembersModal(team.teamId);
  } catch (_) {
    showUploadBanner("Failed to create team.");
    setTimeout(hideUploadBanner, 2000);
  }
}

async function sendAddMembersInvites() {
  const teamId = stateTeams.addMembersTeamId;
  if (!teamId) return;
  const selected = stateTeams.addMembersSelected ? Array.from(stateTeams.addMembersSelected) : [];
  if (!selected.length) {
    closeAddMembersModal();
    return;
  }
  for (const toDeviceId of selected) {
    try {
      await apiFetch(`/api/v1/teams/${teamId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toDeviceId }),
      });
    } catch (_) {}
  }
  showUploadBanner("Invites sent to " + selected.length + " member(s).", "success");
  setTimeout(hideUploadBanner, 2500);
  closeAddMembersModal();
  await loadTeams();
}

async function manualConnect() {
  if (!els.manualConnectBtn || !els.manualConnectIp) return;
  const ip = els.manualConnectIp.value.trim();
  const port = parseInt(els.manualConnectPort?.value || "8787", 10) || 8787;
  if (!ip) {
    if (els.manualConnectStatus) els.manualConnectStatus.textContent = "Enter IP address.";
    return;
  }
  els.manualConnectBtn.disabled = true;
  if (els.manualConnectStatus) els.manualConnectStatus.textContent = "Connecting...";
  try {
    const res = await apiFetch("/api/v1/network/manual-connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ip, port }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      if (els.manualConnectStatus) els.manualConnectStatus.textContent = `Added ${data.displayName || data.deviceId}.`;
      await loadNetwork();
    } else {
      if (els.manualConnectStatus) els.manualConnectStatus.textContent = data.message || data.error || "Connection failed.";
    }
  } catch (_) {
    if (els.manualConnectStatus) els.manualConnectStatus.textContent = "Connection failed.";
  } finally {
    els.manualConnectBtn.disabled = false;
  }
}

async function saveNetworkName() {
  const displayName = buildDisplayNameFromSuffix(els.networkNameSuffix.value);
  const res = await apiFetch("/api/v1/network/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ display_name: displayName }),
  });
  const data = await res.json();
  const savedName = String(data.display_name || "Join");
  state.displayName = savedName;
  updateHeaderProfile();
  els.networkNameSuffix.value = displayNameToSuffix(savedName);
}

const stateShare = {
  lastShareUrl: null,
  lastShareId: null,
  lastPath: null,
  publicAccessActive: false,
};

async function openShareModal(pathValue) {
  els.shareResult.textContent = "";
  if (els.shareExtraActions) els.shareExtraActions.style.display = "none";
  if (els.copyShare) els.copyShare.style.display = "none";
  // Ensure we have the latest active shares so badges/links are immediate.
  try { await loadShares(); } catch (_) {}
  // Reset scope selection and enable radios for a fresh share
  document.querySelectorAll('input[name="share-scope"]').forEach((radio) => {
    radio.disabled = false;
    if (radio.value === "local") {
      radio.checked = true;
    }
  });
  els.sharePath.value = pathValue;
  // If this path already has an active share for a scope, disable that scope option.
  const existingLocal = getActiveShareForPathAndScope(pathValue, "local");
  const existingPublic = getActiveShareForPathAndScope(pathValue, "public");
  if (existingLocal || existingPublic) {
    const radios = Array.from(document.querySelectorAll('input[name="share-scope"]'));
    radios.forEach((radio) => {
      if (radio.value === "local" && existingLocal) radio.disabled = true;
      if (radio.value === "public" && existingPublic) radio.disabled = true;
    });
    // If local is disabled but public is available, default to public
    const localRadio = radios.find((r) => r.value === "local");
    const publicRadio = radios.find((r) => r.value === "public");
    if (localRadio && localRadio.disabled && publicRadio && !publicRadio.disabled) {
      publicRadio.checked = true;
    }
    const hints = [];
    if (existingLocal) hints.push("Local");
    if (existingPublic) hints.push("Public");
    const localUrl = existingLocal ? (existingLocal.urlIp || existingLocal.url || `${stateMeta.lanBaseUrl}/share/${existingLocal.shareId}`) : null;
    const publicUrl = existingPublic ? (existingPublic.publicUrl || null) : null;
    const publicCandidate = existingPublic && !publicUrl ? (existingPublic.tunnelCandidateUrl || null) : null;
    const publicLabel = publicUrl ? publicUrl : (publicCandidate ? publicCandidate : "Provisioning…");
    els.shareResult.innerHTML = `<div>Already shared for: ${escapeHtml(hints.join(" & "))}.</div>
<div style="margin-top:10px;display:flex;flex-direction:column;gap:10px;">
  ${localUrl ? `<div>
    <span class="value" style="font-size:12px; font-weight:600;">Local:</span>
    <span class="share-link-box share-url-secondary" style="margin-top:4px;display:block;">${escapeHtml(localUrl)}</span>
    <button type="button" class="button secondary" id="share-copy-existing-local-btn" style="margin-top:4px;">Copy</button>
    <button type="button" class="button secondary" id="share-open-existing-local-btn" style="margin-top:4px;margin-left:6px;">Open</button>
  </div>` : ""}
  ${existingPublic ? `<div>
    <span class="value" style="font-size:12px; font-weight:600; color:var(--accent, #2FB7FF);">Public:</span>
    <span class="share-link-box share-url-secondary" style="margin-top:4px;display:block;">${escapeHtml(publicLabel)}</span>
    ${publicUrl ? `<button type="button" class="button secondary" id="share-copy-existing-public-btn" style="margin-top:4px;">Copy</button>
    <button type="button" class="button secondary" id="share-open-existing-public-btn" style="margin-top:4px;margin-left:6px;">Open</button>` : `<div class="value value-muted" style="font-size:11px; margin-top:6px;">Public URL will appear once provisioning completes.</div>`}
  </div>` : ""}
</div>`;

    const copyLocalBtn = document.getElementById("share-copy-existing-local-btn");
    if (copyLocalBtn && localUrl) {
      copyLocalBtn.onclick = async () => {
        const ok = await copyToClipboard(localUrl);
        if (ok) {
          copyLocalBtn.textContent = "Copied!";
          setTimeout(() => (copyLocalBtn.textContent = "Copy"), 2000);
        } else {
          showCopyFallback(localUrl, els.shareResult);
        }
      };
    }
    const openLocalBtn = document.getElementById("share-open-existing-local-btn");
    if (openLocalBtn && localUrl) openLocalBtn.onclick = () => window.open(localUrl, "_blank");

    const copyPublicBtn = document.getElementById("share-copy-existing-public-btn");
    if (copyPublicBtn && publicUrl) {
      copyPublicBtn.onclick = async () => {
        const ok = await copyToClipboard(publicUrl);
        if (ok) {
          copyPublicBtn.textContent = "Copied!";
          setTimeout(() => (copyPublicBtn.textContent = "Copy"), 2000);
        } else {
          showCopyFallback(publicUrl, els.shareResult);
        }
      };
    }
    const openPublicBtn = document.getElementById("share-open-existing-public-btn");
    if (openPublicBtn && publicUrl) openPublicBtn.onclick = () => window.open(publicUrl, "_blank");
  }
  const needActivation = !canAddDeviceOrCreateShare();
  if (els.activationBlock) {
    els.activationBlock.style.display = needActivation ? "block" : "none";
  }
  if (els.activationMessage) els.activationMessage.textContent = "";
  const upgradeUrl = (state.upgradeUrl || "").trim();
  if (els.activationUpgradeWrap) {
    els.activationUpgradeWrap.style.display = needActivation && upgradeUrl ? "block" : "none";
  }
  if (els.activationUpgradeLink && upgradeUrl) {
    els.activationUpgradeLink.href = upgradeUrl;
  }
  try {
    const statusRes = await apiFetch("/api/public-access/status");
    const statusData = await statusRes.json();
    stateShare.publicAccessActive = statusData.status === "active";
    if (els.shareScopePublic) {
      els.shareScopePublic.disabled = !stateShare.publicAccessActive;
    }
    if (els.shareScopePublicHint) {
      els.shareScopePublicHint.style.display = stateShare.publicAccessActive ? "none" : "block";
    }
  } catch (_) {
    stateShare.publicAccessActive = false;
    if (els.shareScopePublic) els.shareScopePublic.disabled = true;
    if (els.shareScopePublicHint) els.shareScopePublicHint.style.display = "block";
  }
  els.shareModal.classList.add("active");
}

function closeShareModal() {
  els.shareModal.classList.remove("active");
}

function setActivationMessage(msg, isError) {
  if (!els.activationMessage) return;
  els.activationMessage.textContent = msg || "";
  els.activationMessage.style.color = isError ? "#c00" : "";
}

async function activationRegister() {
  const email = (els.activationEmail && els.activationEmail.value || "").trim();
  const password = els.activationPassword && els.activationPassword.value;
  if (!email || !password) {
    setActivationMessage("Enter email and password.", true);
    return;
  }
  setActivationMessage("Registering…");
  try {
    const res = await apiFetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setActivationMessage(data.message || "Registration failed", true);
      return;
    }
    setActivationMessage("Registered. Sign in on the web to link this device.");
  } catch (e) {
    setActivationMessage("Network error. Try again.", true);
  }
}

async function activationLogin() {
  const email = (els.activationEmail && els.activationEmail.value || "").trim();
  const password = els.activationPassword && els.activationPassword.value;
  if (!email || !password) {
    setActivationMessage("Enter email and password.", true);
    return;
  }
  setActivationMessage("Logging in…");
  try {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setActivationMessage(data.message || "Login failed", true);
      return;
    }
    setActivationMessage("Logged in. Sign in on the web to link this device.");
  } catch (e) {
    setActivationMessage("Network error. Try again.", true);
  }
}

async function activationActivate() {
  setActivationMessage("Activating…");
  try {
    const res = await apiFetch("/api/license/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setActivationMessage(data.message || "Activation failed", true);
      return;
    }
    setActivationMessage("Device activated. You can create shares now.");
    await loadControlPlaneConfig();
    if (els.activationBlock) els.activationBlock.style.display = "none";
  } catch (e) {
    setActivationMessage("Network error. Try again.", true);
  }
}

async function createShare() {
  if (!canAddDeviceOrCreateShare()) {
    if (els.shareResult) {
      els.shareResult.textContent = state.activationRequired || state.licenseState === "UNREGISTERED"
        ? "Activate your account to create shares. You can still browse and use existing shares."
        : "License expired. You can still use existing shares and LAN transfer.";
    }
    return;
  }
  const pathValue = els.sharePath.value;
  const ttlSelection = els.shareTtl.value;
  if (ttlSelection === "custom" && !els.shareTtlCustom.value) {
    els.shareResult.textContent = "Enter expiry in minutes.";
    return;
  }
  const scope = document.querySelector('input[name="share-scope"]:checked')?.value || "local";
  if (scope === "public" && !stateShare.publicAccessActive) {
    if (els.shareScopePublicHint) els.shareScopePublicHint.style.display = "block";
    return;
  }
  const ttlMs = ttlSelection === "custom" ? Number(els.shareTtlCustom.value) * 60 * 1000 : Number(ttlSelection);
  const res = await apiFetch("/api/share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: pathValue, permission: els.sharePermission.value, ttlMs, scope }),
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 409 && data && data.existingShare) {
      const existing = data.existingShare;
      const existingScope = existing.scope || scope;
      const shareUrl = existing.urlIp || existing.url || `${stateMeta.lanBaseUrl}/share/${existing.shareId}`;
      const publicUrl = existing.publicUrl || null;
      const primaryUrl = existingScope === "public" && publicUrl ? publicUrl : shareUrl;
      stateShare.lastShareUrl = primaryUrl;
      stateShare.lastShareId = existing.shareId;
      stateShare.lastPath = pathValue;

      els.shareResult.innerHTML = `<div>Already shared (${escapeHtml(existingScope)}).</div>
<div style="margin-top:10px;">
  <span class="share-link-box share-url-secondary" style="display:block;">${escapeHtml(primaryUrl)}</span>
  <button type="button" class="button secondary" id="share-copy-existing-btn" style="margin-top:6px;">Copy</button>
  <button type="button" class="button secondary" id="share-open-existing-btn" style="margin-top:6px;margin-left:6px;">Open</button>
</div>`;
      const copyBtn = document.getElementById("share-copy-existing-btn");
      if (copyBtn) {
        copyBtn.onclick = async () => {
          const ok = await copyToClipboard(primaryUrl);
          if (ok) {
            copyBtn.textContent = "Copied!";
            setTimeout(() => (copyBtn.textContent = "Copy"), 1800);
          } else {
            showCopyFallback(primaryUrl, copyBtn);
          }
        };
      }
      const openBtn = document.getElementById("share-open-existing-btn");
      if (openBtn) openBtn.onclick = () => window.open(primaryUrl, "_blank");

      document.querySelectorAll('input[name="share-scope"]').forEach((radio) => {
        radio.disabled = true;
        radio.checked = radio.value === existingScope;
      });
      if (els.copyShare) els.copyShare.style.display = "none";
      if (els.shareExtraActions) els.shareExtraActions.style.display = "none";
      return;
    }
    if (data.error === "share_limit_reached" || res.status === 403) {
      const limit = typeof data.limit === "number" ? data.limit : null;
      const usedFromServer = typeof data.used === "number" ? data.used : null;
      const inferredUsed = usedFromServer !== null && usedFromServer >= 0
        ? usedFromServer
        : (limit !== null && typeof data.remaining === "number"
            ? Math.max(0, limit - data.remaining)
            : (limit !== null ? limit : state.usageSharesThisMonth));
      state.usageSharesThisMonth = inferredUsed;
      try { renderUsageBars().catch(() => {}); } catch (_) {}
      let limitMsg = "Share limit is reached. Contact support to upgrade your share limit or device limit.";
      if (limit !== null && inferredUsed >= 0) {
        limitMsg = `Share limit reached. You used ${inferredUsed} of ${limit} allowed shares this month.`;
      }
      els.shareResult.textContent = limitMsg;
      // Also show a persistent banner for visibility
      showUploadBanner(limitMsg, "error");
      setTimeout(hideUploadBanner, 5000);
    } else {
      els.shareResult.textContent = data.error || data.message || "Failed to create share";
    }
    return;
  }
  const shareUrl = data.urlIp || data.url || `${stateMeta.lanBaseUrl}/share/${data.shareId}`;
  const publicUrl = data.publicUrl || null;
  const primaryUrl = scope === "public" && publicUrl ? publicUrl : shareUrl;
  stateShare.lastShareUrl = primaryUrl;
  stateShare.lastShareId = data.shareId;
  stateShare.lastPath = pathValue;
  let resultHtml = "<div>Share created.</div>";
  const isProvisioningPublic = scope === "public" && !publicUrl && data.publicStatus === "provisioning";
  if (isProvisioningPublic) {
    resultHtml += `<div style="margin-top:10px;">
  <span class="value" style="font-size:12px; font-weight:600;">Local (ready now):</span>
  <span class="share-link-box share-url-secondary" style="margin-top:4px;display:block;">${escapeHtml(shareUrl)}</span>
  <button type="button" class="button secondary" id="share-copy-local-btn" style="margin-top:4px;">Copy</button>
  <div class="value value-muted" style="font-size:11px; margin-top:6px;">Public link is provisioning…</div>
  <div class="value value-muted" id="public-provisioning-status" style="font-size:11px; margin-top:4px;">Waiting for public URL…</div>
</div>`;
  } else if (scope === "public" && publicUrl) {
    resultHtml += `<div style="margin-top:10px;">
  <span class="value" style="font-size:12px; font-weight:600; color:var(--accent, #2FB7FF);">Public:</span>
  <span class="share-link-box share-url-secondary" style="margin-top:4px;display:block;">${escapeHtml(publicUrl)}</span>
  <button type="button" class="button secondary" id="share-copy-public-btn" style="margin-top:4px;">Copy</button>
  <div class="value value-muted" style="font-size:11px; margin-top:4px;">Accessible from anywhere.</div>
</div>`;
  } else {
    resultHtml += `<div style="margin-top:10px;">
  <span class="value" style="font-size:12px; font-weight:600;">Local:</span>
  <span class="share-link-box share-url-secondary" style="margin-top:4px;display:block;">${escapeHtml(shareUrl)}</span>
  <button type="button" class="button secondary" id="share-copy-local-btn" style="margin-top:4px;">Copy</button>
  <div class="value value-muted" style="font-size:11px; margin-top:4px;">Access this link on devices connected to the same WiFi/Hotspot network.</div>
</div>`;
  }
  els.shareResult.innerHTML = resultHtml;
  // Lock scope after creation so the displayed URL always matches the active scope.
  document.querySelectorAll('input[name="share-scope"]').forEach((radio) => {
    radio.disabled = true;
  });
  if (isProvisioningPublic) {
    const localBtn = document.getElementById("share-copy-local-btn");
    if (localBtn) {
      localBtn.onclick = async () => {
        const ok = await copyToClipboard(shareUrl);
        if (ok) {
          localBtn.textContent = "Copied!";
          setTimeout(() => (localBtn.textContent = "Copy"), 2000);
        } else {
          showCopyFallback(shareUrl, els.shareResult);
        }
      };
    }

    // Poll until the publicUrl is available, then update the modal contents.
    (async () => {
      const statusEl = document.getElementById("public-provisioning-status");
      const shareId = data.shareId;
      const deadlineMs = Date.now() + 45_000;
      while (Date.now() < deadlineMs) {
        try {
          const r = await apiFetch(`/api/share/${encodeURIComponent(shareId)}`);
          if (r.ok) {
            const s = await r.json();
            if (s && s.publicUrl) {
              const publicUrlNow = s.publicUrl;
              stateShare.lastShareUrl = publicUrlNow;

              els.shareResult.innerHTML = `<div>Public link is ready.</div>
<div style="margin-top:10px;">
  <span class="value" style="font-size:12px; font-weight:600; color:var(--accent, #2FB7FF);">Public:</span>
  <span class="share-link-box share-url-secondary" style="margin-top:4px;display:block;">${escapeHtml(publicUrlNow)}</span>
  <button type="button" class="button secondary" id="share-copy-public-btn" style="margin-top:4px;">Copy</button>
  <button type="button" class="button secondary" id="share-open-public-btn" style="margin-top:4px;margin-left:6px;">Open</button>
  <div class="value value-muted" style="font-size:11px; margin-top:4px;">Accessible from anywhere.</div>
</div>`;
              const copyBtn = document.getElementById("share-copy-public-btn");
              if (copyBtn) {
                copyBtn.onclick = async () => {
                  const ok = await copyToClipboard(publicUrlNow);
                  if (ok) {
                    copyBtn.textContent = "Copied!";
                    setTimeout(() => (copyBtn.textContent = "Copy"), 2000);
                  } else {
                    showCopyFallback(publicUrlNow, els.shareResult);
                  }
                };
              }
              const openBtn = document.getElementById("share-open-public-btn");
              if (openBtn) openBtn.onclick = () => window.open(publicUrlNow, "_blank");

              try { await loadShares(); } catch (_) {}
              try { renderFiles(); } catch (_) {}
              return;
            }
          }
        } catch (_) {}
        if (statusEl) statusEl.textContent = "Provisioning…";
        await new Promise((rr) => setTimeout(rr, 2000));
      }
      if (statusEl) statusEl.textContent = "Still provisioning. You can use the local link for now.";
    })();
  } else if (scope === "public" && publicUrl) {
    const publicBtn = document.getElementById("share-copy-public-btn");
    if (publicBtn) {
      publicBtn.onclick = async () => {
        const ok = await copyToClipboard(publicUrl);
        if (ok) {
          publicBtn.textContent = "Copied!";
          setTimeout(() => (publicBtn.textContent = "Copy"), 2000);
        } else {
          showCopyFallback(publicUrl, els.shareResult);
        }
      };
    }
  } else {
    const localBtn = document.getElementById("share-copy-local-btn");
    if (localBtn) {
      localBtn.onclick = async () => {
        const ok = await copyToClipboard(shareUrl);
        if (ok) {
          localBtn.textContent = "Copied!";
          setTimeout(() => (localBtn.textContent = "Copy"), 2000);
        } else {
          showCopyFallback(shareUrl, els.shareResult);
        }
      };
    }
  }
  if (els.shareExtraActions) els.shareExtraActions.style.display = "flex";
  if (els.copyShare) {
    // When only a local URL is shown, keep the generic Copy Link button wired to the local URL.
    const shouldShowGenericCopy = !(scope === "public" && publicUrl);
    els.copyShare.style.display = shouldShowGenericCopy ? "inline-flex" : "none";
    if (shouldShowGenericCopy) {
      els.copyShare.textContent = "Copy Link";
      els.copyShare.onclick = async () => {
        const ok = await copyToClipboard(shareUrl);
        if (ok) {
          els.copyShare.textContent = "Copied!";
          setTimeout(() => (els.copyShare.textContent = "Copy Link"), 2000);
        } else {
          showCopyFallback(shareUrl, els.shareResult);
        }
      };
    }
  }
  // Keep usage bars fresh without waiting for next poll.
  state.usageSharesThisMonth = Number(state.usageSharesThisMonth || 0) + 1;
  try { renderUsageBars().catch(() => {}); } catch (_) {}
  await loadShares();
  await loadLogs();
}

async function revokeShare(shareId) {
  state.shares = state.shares.filter((share) => share.shareId !== shareId);
  state.selectedShares.delete(shareId);
  renderShares();
  await apiFetch(`/api/share/${shareId}`, { method: "DELETE" });
  await loadShares();
  await loadLogs();
}

async function revokeSelectedShares() {
  const tokens = Array.from(state.selectedShares);
  if (!tokens.length) return;
  await apiFetch("/api/v1/shares/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tokens }),
  });
  state.selectedShares.clear();
  await loadShares();
  await loadLogs();
}

async function revokeAllShares() {
  await apiFetch("/api/v1/shares/revoke_all", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  state.selectedShares.clear();
  await loadShares();
  await loadLogs();
}

function openShareTeamPicker() {
  if (!stateShare.lastShareUrl) {
    showUploadBanner("Create a share first.");
    setTimeout(hideUploadBanner, 2000);
    return;
  }
  if (!stateTeams.teams.length) {
    showUploadBanner("No teams found. Create a team first.", "error");
    setTimeout(hideUploadBanner, 3000);
    return;
  }
  if (!els.shareTeamPickerModal || !els.shareTeamPickerList) return;
  els.shareTeamPickerList.innerHTML = stateTeams.teams.map((t) => {
    const count = t.members?.length || 0;
    return `<button class="button secondary share-team-pick-btn" data-team-id="${escapeHtml(t.teamId)}">
      <span class="btn-icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg></span>
      <div style="text-align:left;flex:1"><strong>${escapeHtml(t.teamName)}</strong><div class="item-sub" style="margin-top:2px">${count} member${count !== 1 ? "s" : ""}</div></div>
    </button>`;
  }).join("");
  els.shareTeamPickerList.querySelectorAll(".share-team-pick-btn").forEach((btn) => {
    btn.onclick = async () => {
      const teamId = btn.dataset.teamId;
      if (els.shareTeamPickerModal) els.shareTeamPickerModal.classList.remove("active");
      await postShareToTeam(teamId);
    };
  });
  els.shareTeamPickerModal.classList.add("active");
}

function closeShareTeamPicker() {
  if (els.shareTeamPickerModal) els.shareTeamPickerModal.classList.remove("active");
}

async function shareWithTeam() {
  openShareTeamPicker();
}

async function postShareToTeam(teamId) {
  const filename = stateShare.lastPath?.split("/").filter(Boolean).pop() || "file";
  try {
    await apiFetch("/api/v1/teams/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId,
        type: "file",
        payload: { shareUrl: stateShare.lastShareUrl, filename, shareId: stateShare.lastShareId },
      }),
    });
    showUploadBanner("Shared with team.", "success");
    setTimeout(hideUploadBanner, 2000);
  } catch (err) {
    showUploadBanner(err.message || "Failed to share with team.");
    setTimeout(hideUploadBanner, 2500);
  }
}

async function shareWithUser() {
  if (!stateShare.lastShareUrl) {
    showUploadBanner("Create a share first.");
    setTimeout(hideUploadBanner, 2000);
    return;
  }
  try {
    const networkRes = await apiFetch("/api/v1/network");
    const peers = await networkRes.json();
    const candidates = peers.filter((p) => p.deviceId && p.bestIp);
    if (!candidates.length) {
      showUploadBanner("No users available. Connect devices in Network first.");
      setTimeout(hideUploadBanner, 2000);
      return;
    }
    const list = candidates.map((c, i) => `${i + 1}. ${c.display_name || c.displayName || c.deviceId}`).join("\n");
    const choice = prompt(`Select user to share with:\n${list}`);
    if (!choice) return;
    const num = parseInt(choice, 10);
    const peer = Number.isFinite(num) && num >= 1 && num <= candidates.length
      ? candidates[num - 1]
      : candidates.find((c) => (c.display_name || c.displayName) === choice.trim());
    if (!peer) {
      showUploadBanner("User not found.");
      setTimeout(hideUploadBanner, 2000);
      return;
    }
    const filename = stateShare.lastPath?.split("/").filter(Boolean).pop() || "file";
    const displayName = els.headerDisplayName?.textContent?.trim() || getSuggestedDeviceName();
    const baseUrl = `http://${peer.bestIp}:${peer.port || 8787}`;
    const res = await fetch(`${baseUrl}/api/v1/share/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromDeviceId: stateMeta.fingerprint ? `dev_${stateMeta.fingerprint.slice(0, 16)}` : "host",
        fromDisplayName: displayName,
        shareUrl: stateShare.lastShareUrl,
        filename,
      }),
    });
    if (res.ok) {
      showUploadBanner("Share sent to " + (peer.display_name || peer.displayName || "user") + ".", "success");
    } else {
      showUploadBanner("Failed to send. User may be offline.");
    }
    setTimeout(hideUploadBanner, 2000);
  } catch (err) {
    showUploadBanner(err.message || "Failed to share.");
    setTimeout(hideUploadBanner, 2500);
  }
}

function openStopModal() {
  if (els.stopModal) {
    els.stopModal.classList.add("active");
  }
}

function closeStopModal() {
  if (els.stopModal) {
    els.stopModal.classList.remove("active");
  }
}

async function stopSharing() {
  await apiFetch("/api/v1/sharing/stop", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  closeStopModal();
  await loadRuntimeStatus();
  await loadLogs();
}

async function startSharing() {
  await apiFetch("/api/v1/sharing/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  await loadRuntimeStatus();
  await loadLogs();
}

async function addFileViaNativePicker() {
  if (!window.joincloud || !window.joincloud.selectFiles) {
    if (els.uploadInput && !els.uploadInput.disabled) {
      els.uploadInput.click();
    }
    return;
  }
  if (isRemoteRole() && state.deviceFolderRel && !isInMyFolder(state.path)) {
    await loadFiles(state.deviceFolderRel);
  }
  const selectedPaths = await window.joincloud.selectFiles();
  if (!selectedPaths || !selectedPaths.length) return;
  const importTarget = state.path;
  await apiFetch("/api/v1/files/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: importTarget, sourcePaths: selectedPaths }),
  });
  await loadFiles(importTarget);
  await loadLogs();
}

async function uploadFiles(files) {
  if (!files || files.length === 0) return;
  const fileList = Array.from(files);
  const count = fileList.length;
  const label = count === 1 ? fileList[0].name : `${count} files`;
  showUploadBanner(`Uploading ${label}...`, "loading");

  const formData = new FormData();
  fileList.forEach((file) => formData.append("files", file));
  const uploadPath = state.path;
  formData.append("path", uploadPath);

  try {
    const res = await apiFetch("/api/upload", { method: "POST", body: formData });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const reason = payload.error || "Upload failed.";
      showUploadBanner(reason, "error");
      if (els.uploadScopeHint) {
        els.uploadScopeHint.textContent = reason;
      }
      return;
    }
    const savedTo = String(payload.saved_to || uploadPath || "/");
    showUploadBanner("Upload complete", "success");
    setTimeout(hideUploadBanner, 2500);
    await loadFiles(savedTo);
    await loadLogs();
  } catch (err) {
    showUploadBanner(err.message || "Upload failed", "error");
    if (els.uploadScopeHint) {
      els.uploadScopeHint.textContent = err.message || "Upload failed";
    }
  }
}

async function loadPendingAccessRequests() {
  if (!state.isAdmin) {
    els.pendingAccessCount.textContent = "0";
    els.pendingAccessList.innerHTML = '<div class="value value-muted">Available only on the host machine.</div>';
    if (els.pendingBadge) els.pendingBadge.style.display = "none";
    return;
  }
  const res = await apiFetch("/api/v1/access/pending");
  const pending = await res.json();
  els.pendingAccessCount.textContent = String(pending.length);
  if (els.pendingBadge) {
    if (pending.length > 0) {
      els.pendingBadge.style.display = "inline-flex";
      els.pendingBadge.textContent = `${pending.length} Pending`;
    } else {
      els.pendingBadge.style.display = "none";
    }
  }
  if (pending.length > stateMeta.lastPendingCount && document.visibilityState === "visible") {
    try {
      if ("Notification" in window) {
        if (Notification.permission === "granted") {
          new Notification("JoinCloud", {
            body: `${pending.length} device request(s) pending approval.`,
          });
        } else if (Notification.permission === "default") {
          Notification.requestPermission().then(() => {});
        }
      }
    } catch (_error) {
      // ignore notification errors
    }
  }
  stateMeta.lastPendingCount = pending.length;
  if (!pending.length) {
    els.pendingAccessList.innerHTML = '<div class="value value-muted">No pending requests.</div>';
    return;
  }
  els.pendingAccessList.innerHTML = "";
  pending.forEach((item) => {
    const row = document.createElement("div");
    row.className = "pending-item";
    row.innerHTML = `
      <div class="pending-item-meta">
        <div class="item-title">${item.device_name || "Unknown Device"}</div>
        <div class="item-sub mono">${item.fingerprint}</div>
        <div class="item-sub">${new Date(item.created_at).toLocaleString()}</div>
      </div>
    `;
    const approveBtn = document.createElement("button");
    approveBtn.className = "button";
    const canApprove = canAddDeviceOrCreateShare();
    approveBtn.disabled = !canApprove;
    approveBtn.textContent = canApprove ? "Approve" : (state.licenseState === "expired" ? "License expired" : "Activate required");
    approveBtn.onclick = async () => {
      if (!canAddDeviceOrCreateShare()) return;
      const approveRes = await apiFetch("/api/v1/access/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: item.request_id }),
      });
      if (approveRes && !approveRes.ok) {
        let errData = null;
        try { errData = await approveRes.json(); } catch (_) {}
        if (errData && errData.code === "DEVICE_LIMIT_REACHED") {
          // Show inline error in the row
          var errMsg = row.querySelector(".device-limit-error");
          if (!errMsg) {
            errMsg = document.createElement("div");
            errMsg.className = "device-limit-error";
            errMsg.style.cssText = "color:var(--warning,#f59e0b);font-size:12px;margin-top:4px;width:100%;";
            row.appendChild(errMsg);
          }
          errMsg.textContent = "\u26a0\ufe0f " + (errData.message || "Device limit reached. Remove a device first.");
          return;
        }
      }
      await loadPendingAccessRequests();
      if (approveRes && approveRes.ok) {
        await loadControlPlaneConfig();
        renderUsageBars().catch(function() {});
      }
    };
    const denyBtn = document.createElement("button");
    denyBtn.className = "button secondary";
    denyBtn.textContent = "Deny";
    denyBtn.onclick = async () => {
      await apiFetch("/api/v1/access/deny", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: item.request_id }),
      });
      await loadPendingAccessRequests();
    };
    row.appendChild(approveBtn);
    row.appendChild(denyBtn);
    els.pendingAccessList.appendChild(row);
  });
}

async function loadApprovedDevices() {
  if (!state.isAdmin) {
    els.approvedDevicesList.innerHTML = '<div class="value value-muted">Devices management is available on the host machine only.</div>';
    return;
  }
  setRefreshLoading(els.refreshDevices, true);
  try {
    const res = await apiFetch("/api/v1/access/devices");
    const devices = await res.json();
  if (!devices.length) {
    els.approvedDevicesList.innerHTML = '<div class="value value-muted">No approved devices.</div>';
    return;
  }
  els.approvedDevicesList.innerHTML = "";
  devices.forEach((device) => {
    const row = document.createElement("div");
    row.className = "pending-item";
    row.innerHTML = `
      <div class="pending-item-meta">
        <div class="item-title">${device.device_name || "Unknown Device"}</div>
        <div class="item-sub mono" title="${device.fingerprint}">${shortenFingerprint(device.fingerprint)}</div>
        <div class="item-sub mono">Folder: ${device.device_folder_rel || "-"}</div>
        <div class="item-sub">Approved: ${device.approved_at ? new Date(device.approved_at).toLocaleString() : "-"}</div>
        <div class="item-sub">Last seen: ${device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : "Never"}</div>
      </div>
    `;
    if (device.device_folder_rel) {
      const openFolderBtn = document.createElement("button");
      openFolderBtn.className = "button secondary";
      openFolderBtn.textContent = "Open Device Folder";
      openFolderBtn.onclick = async () => {
        setActiveSection("files");
        await loadFiles(device.device_folder_rel);
      };
      row.appendChild(openFolderBtn);
    }
    const removeBtn = document.createElement("button");
    removeBtn.className = "button danger";
    removeBtn.textContent = "Remove";
    removeBtn.onclick = async () => {
      await apiFetch("/api/v1/access/devices/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint: device.fingerprint }),
      });
      await loadApprovedDevices();
      await loadPendingAccessRequests();
      await renderUsageBars();
    };
    row.appendChild(removeBtn);
    els.approvedDevicesList.appendChild(row);
  });
  } finally {
    setRefreshLoading(els.refreshDevices, false);
  }
}

async function loadActivitySummary() {
  if (!state.isAdmin) {
    if (els.activitySummary) els.activitySummary.textContent = "Host-only dashboard.";
    return;
  }
  setRefreshLoading(els.refreshActivity, true);
  try {
  const [activityRes, storageRes] = await Promise.all([
    apiFetch("/api/v1/activity/summary"),
    apiFetch("/api/storage"),
  ]);
  const data = await activityRes.json();
  const storage = await storageRes.json();
  const telemetry = data.telemetry || {};
  const devices = Array.isArray(data.devices) ? data.devices : [];
  const uploadsFromDevices = devices.reduce((sum, device) => sum + Number(device.uploads || 0), 0);
  const downloadsFromDevices = devices.reduce((sum, device) => sum + Number(device.downloads || 0), 0);
  const activeSince = Date.now() - 24 * 60 * 60 * 1000;
  const active24h = devices.filter((device) => {
    const ts = device.last_seen_at ? new Date(device.last_seen_at).getTime() : 0;
    return ts > activeSince;
  }).length;
  const sharesCreated = Number(telemetry.total_shares_created || 0);
  const shareDownloads = Number(telemetry.total_downloads || 0);
  const totalUploads = Number(telemetry.total_uploads || 0) || uploadsFromDevices;
  const totalDownloads = Math.max(downloadsFromDevices, shareDownloads);
  const connectedDevices = Number(data.connected_devices || devices.length || 0);
  const storageUsed = Number(storage.usedBytes || 0);

  if (els.metricTotalUploads) els.metricTotalUploads.textContent = String(totalUploads);
  if (els.metricTotalDownloads) els.metricTotalDownloads.textContent = String(totalDownloads);
  if (els.metricSharesCreated) els.metricSharesCreated.textContent = String(sharesCreated);
  if (els.metricConnectedDevices) els.metricConnectedDevices.textContent = String(connectedDevices);
  if (els.metricStorageUsed) els.metricStorageUsed.textContent = formatBytes(storageUsed);
  if (els.metricShareDownloads) els.metricShareDownloads.textContent = String(shareDownloads);
  if (els.activitySummary) {
    els.activitySummary.textContent = `Pending requests: ${Number(data.pending_count || 0)} | Active (24h): ${active24h} devices`;
  }
  drawActivityChart([
    { label: "Uploads", value: totalUploads },
    { label: "Downloads", value: totalDownloads },
    { label: "Shares", value: sharesCreated },
    { label: "Devices", value: connectedDevices },
    { label: "Share DL", value: shareDownloads },
  ]);
  } finally {
    setRefreshLoading(els.refreshActivity, false);
  }
}

function showToastBanner(text, targetRoute) {
  const el = document.getElementById("notification-toast");
  if (!el) return;
  el.textContent = text;
  el.dataset.targetRoute = targetRoute || "";
  el.classList.remove("notification-toast-hidden");
  el.setAttribute("aria-hidden", "false");
  el.onclick = () => {
    if (targetRoute) {
      setActiveSection(targetRoute.startsWith("teams") ? "teams" : targetRoute);
    }
    el.classList.add("notification-toast-hidden");
  };
  setTimeout(() => {
    el.classList.add("notification-toast-hidden");
    el.setAttribute("aria-hidden", "true");
  }, 4000);
}

function updateMuteButton() {
  if (!els.muteIcon) return;
  els.muteIcon.textContent = stateMeta.notificationsMuted ? "\uD83D\uDD15" : "\uD83D\uDD14";
  if (els.muteNotificationsBtn) {
    els.muteNotificationsBtn.title = stateMeta.notificationsMuted ? "Unmute notifications" : "Mute notifications";
  }
}

async function loadNotifications() {
  if (!els.notificationsList) return;
  try {
    const res = await apiFetch("/api/v1/notifications", {}, true);
    if (!res.ok) return;
    const data = await res.json();
    const list = data.notifications || [];
    const unreadCount = data.unreadCount ?? list.filter((n) => !n.read).length;
    if (els.notificationsUnreadBadge) {
      els.notificationsUnreadBadge.textContent = String(unreadCount);
      els.notificationsUnreadBadge.style.display = unreadCount > 0 ? "inline-flex" : "none";
    }
    const knownIds = new Set(stateMeta.lastNotificationIds);
    for (const n of list) {
      if (!knownIds.has(n.id) && !n.read && document.visibilityState === "visible" && !stateMeta.notificationsMuted) {
        showToastBanner((n.title || "") + (n.body ? ": " + n.body : ""), n.targetRoute);
      }
      knownIds.add(n.id);
    }
    stateMeta.lastNotificationIds = new Set(list.slice(0, 20).map((x) => x.id));
    stateMeta.unreadTeamIds = new Set(list.filter((n) => !n.read && n.teamId).map((n) => n.teamId));
    if (!list.length) {
      els.notificationsList.innerHTML = '<div class="value value-muted">No notifications.</div>';
      return;
    }
    els.notificationsList.innerHTML = list.map((n) =>
      `<div class="pending-item notification-item ${n.read ? "" : "notification-unread"}" data-id="${escapeHtml(n.id)}">
        <div class="pending-item-meta">
          <div class="item-title">${escapeHtml(n.title || "")}</div>
          ${n.body ? "<div class=\"item-sub\">" + escapeHtml(n.body) + "</div>" : ""}
          <div class="item-sub value-muted" style="font-size:11px">${new Date(n.timestamp).toLocaleString()}</div>
        </div>
        <button class="button ghost button-compact notification-delete" data-id="${escapeHtml(n.id)}" title="Delete">\u2715</button>
      </div>`
    ).join("");
    els.notificationsList.querySelectorAll(".notification-delete").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await apiFetch("/api/v1/notifications/" + btn.dataset.id, { method: "DELETE" });
        await loadNotifications();
      });
    });
  } catch (_) {
    if (els.notificationsList) els.notificationsList.innerHTML = '<div class="value value-muted">Failed to load.</div>';
  }
}

async function pollAccessStatus(requestId) {
  const res = await apiFetch(`/api/v1/access/status?request_id=${encodeURIComponent(requestId)}`, {}, true);
  if (!res.ok) return;
  const data = await res.json();
  if (data.status === "approved" && data.session_token) {
    localStorage.setItem("joincloud:session-token", data.session_token);
    stateMeta.sessionToken = data.session_token;
    localStorage.removeItem("joincloud:request-id");
    await bootstrapApp();
  } else if (data.status === "denied") {
    localStorage.removeItem("joincloud:request-id");
    state.requestId = null;
    showAccessGate("Request denied by admin.");
  } else {
    showAccessGate("Waiting for admin approval...");
  }
}

async function requestAccessApproval() {
  const deviceName = String(els.accessDeviceNameInput?.value || "").trim() || getSuggestedDeviceName();
  const body = {
    device_name: deviceName,
    user_agent: navigator.userAgent,
    fingerprint: stateMeta.fingerprint,
  };
  const res = await apiFetch("/api/v1/access/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, true);
  if (!res.ok) {
    showAccessGate("Failed to request access.");
    return;
  }
  const data = await res.json();
  state.requestId = data.request_id;
  localStorage.setItem("joincloud:request-id", state.requestId);
  showAccessGate("Waiting for admin approval...");
}

async function checkSessionAccess() {
  const res = await apiFetch("/api/v1/access/session", {}, true);
  if (res.status === 423) {
    const payload = await res.json().catch(() => ({}));
    return { authorized: false, reason: payload.reason || "sharing_stopped" };
  }
  if (!res.ok) return null;
  return res.json();
}

async function loadSupportMessages() {
  try {
    const res = await apiFetch("/api/support/messages");
    const data = await res.json().catch(() => ({}));
    state.supportMessages = Array.isArray(data.messages) ? data.messages : [];
    renderSupportMessages();
  } catch (_) {
    state.supportMessages = [];
    renderSupportMessages();
  }
}

function renderSupportMessages() {
  if (!els.supportMessages) return;
  const list = state.supportMessages || [];
  els.supportMessages.innerHTML = list.length === 0
    ? "<div class=\"value value-muted\">No messages yet. Send a message to start the conversation.</div>"
    : list.map((m) => {
        const isDevice = (m.sender || "").toLowerCase() === "device";
        const label = isDevice ? "You" : "Support";
        const cls = isDevice ? "support-message device" : "support-message admin";
        const time = m.timestamp ? new Date(m.timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "";
        return `<div class="${cls}"><span class="value value-muted" style="font-size:11px">${label} ${time}</span><br/>${escapeHtml(m.text || "")}</div>`;
      }).join("");
  els.supportMessages.scrollTop = els.supportMessages.scrollHeight;
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

async function sendSupportMessage() {
  if (!els.supportMessageInput) return;
  const text = (els.supportMessageInput.value || "").trim();
  if (!text) return;
  try {
    const res = await apiFetch("/api/support/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.message || "Failed to send message.");
      return;
    }
    els.supportMessageInput.value = "";
    await loadSupportMessages();
  } catch (_) {
    alert("Network error. Try again.");
  }
}

async function bootstrapApp() {
  const session = await checkSessionAccess();
  if (!session || !session.authorized) {
    state.requestId = localStorage.getItem("joincloud:request-id");
    if (session && session.reason === "sharing_stopped") {
      showAccessGate("Sharing is currently stopped by the admin.");
    } else {
      showAccessGate(state.requestId ? "Waiting for admin approval..." : "This device requires admin approval.");
    }
    return;
  }
  state.isAdmin = session.role === "admin";
  state.accessRole = state.isAdmin ? "host" : "remote";
  await loadAccessMe();
  updateAdminUi();
  await loadBuildInfo();
  await fetchStatus();

  // Remote users accessing the shared cloud don't need license/activation checks
  if (!isRemoteRole()) {
    var needsActivation = state.activationRequired || state.licenseState === "UNREGISTERED";
    if (needsActivation) {
      const MAX_BOOTSTRAP_ATTEMPTS = 5;
      const BOOTSTRAP_RETRY_DELAY_MS = 5000;
      var bootstrapSucceeded = false;
      for (let attempt = 0; attempt < MAX_BOOTSTRAP_ATTEMPTS; attempt++) {
        try {
          await fetchStatus();
          const deviceId = state.hostUuidFromConfig || state.deviceId || "";
          const bootstrapRes = await fetch("/api/v1/devices/bootstrap-trial", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(deviceId ? { deviceId } : {}),
          });
          if (bootstrapRes.ok) {
            // Refresh control-plane config so licenseState/activationRequired reflect the new trial
            await loadControlPlaneConfig();
            bootstrapSucceeded = true;
            break;
          } else if (bootstrapRes.status === 502 || bootstrapRes.status === 503 || bootstrapRes.status === 500) {
            if (els.activationGateMessage) {
              els.activationGateMessage.textContent =
                `Attempt ${attempt + 1}/${MAX_BOOTSTRAP_ATTEMPTS}: Cannot reach JoinCloud Control Plane. Retrying…`;
              els.activationGateMessage.style.color = "#f97316";
            }
          }
        } catch (_) {
          if (els.activationGateMessage) {
            els.activationGateMessage.textContent =
              `Attempt ${attempt + 1}/${MAX_BOOTSTRAP_ATTEMPTS}: Network error. Retrying…`;
            els.activationGateMessage.style.color = "#f97316";
          }
        }
        if (attempt < MAX_BOOTSTRAP_ATTEMPTS - 1) await new Promise((r) => setTimeout(r, BOOTSTRAP_RETRY_DELAY_MS));
      }
      // All attempts exhausted without success — show contact support prominently.
      if (!bootstrapSucceeded) {
        if (els.activationGateMessage) {
          els.activationGateMessage.textContent = "Could not activate after 5 attempts. Please contact support.";
          els.activationGateMessage.style.color = "#ef4444";
        }
        // Hide retry button; the static support link is always visible.
        if (els.activationGateRetry) els.activationGateRetry.style.display = "none";
        var supportEl = document.getElementById("activation-gate-support");
        if (supportEl) supportEl.style.fontWeight = "600";
      }
      needsActivation = state.activationRequired || state.licenseState === "UNREGISTERED";
    }
    // Block app if signed out AND no valid license (trial/pro/teams/custom/grace).
    // User must sign in or have a valid license to use the app.
    updateAppGate();
    if (!canUseApp()) {
      return; // Activation gate is shown; bootstrap stops until user signs in or gets license
    }
  }
  showMainApp();
  const initial = window.location.hash.replace("#", "") || "home";
  setActiveSection(initial);
  
  try {
    await loadRuntimeStatus();
  } catch (_) {}
  try {
    await loadCloudUrl();
  } catch (_) {}
  try {
    await loadFiles("/");
  } catch (_) {}
  try {
    await loadShares();
  } catch (_) {}
  try {
    await loadLogs();
  } catch (_) {}
  try {
    await loadNetwork();
  } catch (_) {}
  try {
    await loadTelemetrySettings();
  } catch (_) {}
  try {
    await loadNetworkSettings();
  } catch (_) {}
  try {
    await loadTechnicalConfig();
  } catch (_) {}
  try {
    await loadPublicAccessStatus();
  } catch (_) {}
  try {
    await loadPrivacyPolicy();
  } catch (_) {}
  try {
    await loadPendingAccessRequests();
  } catch (_) {}
  try {
    await loadApprovedDevices();
  } catch (_) {}
  try {
    await loadShareVisitSummary();
  } catch (_) {}
  try {
    await loadActivitySummary();
  } catch (_) {}
  try {
    await loadNotifications();
  } catch (_) {}
  updateMuteButton();

  setInterval(() => {
    if (document.querySelector(".section.active")?.dataset.section === "support") loadSupportMessages();
  }, 8000);
}

async function continueBootstrapAfterActivation() {
  showMainApp();
  const initial = window.location.hash.replace("#", "") || "home";
  setActiveSection(initial);
  
  try {
    await loadRuntimeStatus();
  } catch (_) {}
  try {
    await loadCloudUrl();
  } catch (_) {}
  try {
    await loadFiles("/");
  } catch (_) {}
  try {
    await loadShares();
  } catch (_) {}
  try {
    await loadLogs();
  } catch (_) {}
  try {
    await loadNetwork();
  } catch (_) {}
  try {
    await loadTelemetrySettings();
  } catch (_) {}
  try {
    await loadNetworkSettings();
  } catch (_) {}
  try {
    await loadPublicAccessStatus();
  } catch (_) {}
  try {
    await loadPrivacyPolicy();
  } catch (_) {}
  try {
    await loadPendingAccessRequests();
  } catch (_) {}
  try {
    await loadApprovedDevices();
  } catch (_) {}
  try {
    await loadShareVisitSummary();
  } catch (_) {}
  try {
    await loadActivitySummary();
  } catch (_) {}
  try {
    await loadNotifications();
  } catch (_) {}
  updateMuteButton();
  setInterval(() => {
    if (document.querySelector(".section.active")?.dataset.section === "support") loadSupportMessages();
  }, 8000);
}

function setActiveSection(sectionId) {
  const adminOnly = new Set(["devices", "activity"]);
  const remoteHidden = new Set(["logs", "network", "support"]);
  let safeSection = sectionId;
  if (!state.isAdmin && adminOnly.has(sectionId)) safeSection = "home";
  if (isRemoteRole() && remoteHidden.has(sectionId)) safeSection = "home";
  if (window.location.hash !== `#${safeSection}`) window.location.hash = safeSection;
  els.sections.forEach((section) => section.classList.toggle("active", section.dataset.section === safeSection));
  els.navButtons.forEach((button) => button.classList.toggle("active", button.dataset.section === safeSection));
  if (safeSection === "support") loadSupportMessages();
  if (safeSection === "network") loadNetwork();
  if (safeSection === "teams") loadTeams();
  if (safeSection === "settings") {
    renderUsageBars().catch(() => {});
    loadPublicAccessStatus().catch(() => {});
  }
}

function updateAdminUi() {
  const devicesButton = Array.from(els.navButtons).find((button) => button.dataset.section === "devices");
  const devicesSection = Array.from(els.sections).find((section) => section.dataset.section === "devices");
  const activityButton = Array.from(els.navButtons).find((button) => button.dataset.section === "activity");
  const activitySection = Array.from(els.sections).find((section) => section.dataset.section === "activity");
  const teamsButton = Array.from(els.navButtons).find((button) => button.dataset.section === "teams");
  const teamsSection = Array.from(els.sections).find((section) => section.dataset.section === "teams");
  const pendingRole = state.accessRole === "pending";
  const hostRole = isHostRole();
  const remoteRole = isRemoteRole();
  const teamsVisible = shouldShowTeamsMenu();
  const teamsEnabled = isTeamsEnabledByEntitlement();
  if (devicesButton) {
    devicesButton.style.display = hostRole ? "" : "none";
  }
  if (devicesSection && !hostRole) {
    devicesSection.classList.remove("active");
  }
  if (activityButton) {
    activityButton.style.display = hostRole ? "" : "none";
  }
  if (activitySection && !hostRole) {
    activitySection.classList.remove("active");
  }
  if (teamsButton) {
    teamsButton.style.display = "";
    teamsButton.style.opacity = teamsEnabled ? "" : "0.7";
    teamsButton.title = teamsEnabled ? "Teams" : "Upgrade to Teams to unlock this feature";
  }
  if (teamsSection && !teamsVisible) {
    teamsSection.classList.remove("active");
  }
  updateTeamsLockedState();
  if (els.addFileHeader) {
    els.addFileHeader.style.display = pendingRole ? "none" : "";
    els.addFileHeader.textContent = remoteRole ? "Add File" : "Add File";
  }
  if (els.toggleSharing) {
    els.toggleSharing.style.display = hostRole && !pendingRole ? "" : "none";
  }
  if (els.revokeAll) {
    els.revokeAll.style.display = hostRole ? "" : "none";
  }
  if (els.revokeSelected) {
    els.revokeSelected.style.display = hostRole ? "" : "none";
  }
  if (els.myFolderShortcut) {
    els.myFolderShortcut.style.display = "none";
  }
  const logsButton = Array.from(els.navButtons).find((b) => b.dataset.section === "logs");
  const networkButton = Array.from(els.navButtons).find((b) => b.dataset.section === "network");
  const supportButton = Array.from(els.navButtons).find((b) => b.dataset.section === "support");
  const logsSection = Array.from(els.sections).find((s) => s.dataset.section === "logs");
  const networkSection = Array.from(els.sections).find((s) => s.dataset.section === "network");
  const supportSection = Array.from(els.sections).find((s) => s.dataset.section === "support");
  const hideForRemote = remoteRole;
  if (logsButton) logsButton.style.display = hideForRemote ? "none" : "";
  if (networkButton) networkButton.style.display = hideForRemote ? "none" : "";
  if (supportButton) supportButton.style.display = hideForRemote ? "none" : "";
  if (logsSection && hideForRemote) logsSection.classList.remove("active");
  if (networkSection && hideForRemote) networkSection.classList.remove("active");
  if (supportSection && hideForRemote) supportSection.classList.remove("active");
  if (els.homeStorageSection) {
    els.homeStorageSection.style.display = hideForRemote ? "none" : "";
  }
}

function showUploadBanner(text, type = "loading") {
  if (!els.uploadBanner || !els.uploadBannerText) return;
  els.uploadBanner.className = `upload-banner upload-banner-${type}`;
  els.uploadBanner.classList.remove("upload-banner-hidden");
  els.uploadBanner.setAttribute("aria-hidden", "false");
  els.uploadBannerText.textContent = text;
  if (els.uploadBannerDismiss) {
    els.uploadBannerDismiss.style.display = type === "loading" ? "none" : "inline-flex";
  }
}

function hideUploadBanner() {
  if (!els.uploadBanner) return;
  els.uploadBanner.classList.add("upload-banner-hidden");
  els.uploadBanner.setAttribute("aria-hidden", "true");
}

function setRefreshLoading(buttonEl, loading) {
  if (!buttonEl) return;
  if (loading) {
    buttonEl.classList.add("loading");
    buttonEl.disabled = true;
  } else {
    buttonEl.classList.remove("loading");
    buttonEl.disabled = false;
  }
}

function refreshRemoteUploadUi() {
  const uploadAllowed = true;
  if (els.uploadInput) {
    els.uploadInput.disabled = !uploadAllowed;
  }
  if (els.uploadButtonLabel) {
    els.uploadButtonLabel.classList.toggle("disabled", !uploadAllowed);
  }
  if (els.dropZone) {
    els.dropZone.classList.toggle("disabled", !uploadAllowed);
    els.dropZone.textContent = "Drag & drop files here";
  }
  if (els.uploadScopeHint) {
    els.uploadScopeHint.textContent = "";
  }
  if (els.uploadDestinationLabel) {
    els.uploadDestinationLabel.textContent = "";
  }
}

els.menuToggle.addEventListener("click", () => {
  if (window.innerWidth < 768) {
    document.body.classList.toggle("sidebar-open");
  } else {
    document.body.classList.toggle("sidebar-collapsed");
  }
});

els.navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveSection(button.dataset.section);
    document.body.classList.remove("sidebar-open");
  });
});

window.addEventListener("hashchange", () => {
  const target = window.location.hash.replace("#", "");
  if (target) setActiveSection(target);
});

els.copyCloudUrl.addEventListener("click", async () => {
  const ok = await copyToClipboard(`${stateMeta.cloudUrl}?pair=1`);
  if (ok) {
    els.copyCloudUrl.textContent = "Copied!";
    setTimeout(() => (els.copyCloudUrl.textContent = "Copy"), 2000);
  } else {
    showCopyFallback(`${stateMeta.cloudUrl}?pair=1`, els.copyCloudUrl);
  }
});

if (els.remoteCloudCopy) {
  els.remoteCloudCopy.addEventListener("click", async () => {
    const url = els.remoteCloudUrlInput && els.remoteCloudUrlInput.value;
    if (!url) return;
    const ok = await copyToClipboard(url);
    if (ok) {
      els.remoteCloudCopy.textContent = "Copied!";
      setTimeout(() => (els.remoteCloudCopy.textContent = "Copy"), 2000);
    } else {
      showCopyFallback(url, els.remoteCloudCopy);
    }
  });
}
if (els.remoteCloudSetupBtn) {
  els.remoteCloudSetupBtn.addEventListener("click", () => {
    // Bring user to Settings → Remote Access and start setup.
    setActiveSection("settings");
    const section = document.getElementById("remote-access-section");
    if (section && typeof section.scrollIntoView === "function") {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (els.remoteAccessNotConfigured) els.remoteAccessNotConfigured.style.display = "block";
    if (els.remoteAccessConfiguredWrap) els.remoteAccessConfiguredWrap.style.display = "none";
    if (els.remoteAccessSetupBtn) els.remoteAccessSetupBtn.click();
  });
}

function hideDeleteSharedItemModal() {
  if (els.deleteSharedItemModal) {
    els.deleteSharedItemModal.classList.remove("active");
    delete els.deleteSharedItemModal.dataset.path;
    delete els.deleteSharedItemModal.dataset.type;
    delete els.deleteSharedItemModal.dataset.name;
  }
}

if (els.deleteSharedItemCancelTop) {
  els.deleteSharedItemCancelTop.addEventListener("click", hideDeleteSharedItemModal);
}
if (els.deleteSharedItemCancel) {
  els.deleteSharedItemCancel.addEventListener("click", hideDeleteSharedItemModal);
}
if (els.deleteSharedItemStopOnly) {
  els.deleteSharedItemStopOnly.addEventListener("click", async () => {
    const pathValue = els.deleteSharedItemModal && els.deleteSharedItemModal.dataset.path;
    hideDeleteSharedItemModal();
    if (!pathValue) return;
    await stopSharesForPath(pathValue);
    try { await loadFiles(state.path); } catch (_) {}
    try { await loadLogs(); } catch (_) {}
  });
}
if (els.deleteSharedItemStopAndDelete) {
  els.deleteSharedItemStopAndDelete.addEventListener("click", async () => {
    const pathValue = els.deleteSharedItemModal && els.deleteSharedItemModal.dataset.path;
    hideDeleteSharedItemModal();
    if (!pathValue) return;
    await stopSharesForPath(pathValue);
    await deletePathAfterStopSharing(pathValue);
  });
}

if (els.homeRemoteAccessSettings) {
  els.homeRemoteAccessSettings.addEventListener("click", () => {
    setActiveSection("settings");
    const section = document.getElementById("remote-access-section");
    if (section && typeof section.scrollIntoView === "function") {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

async function setHomeRemoteAccessEnabled(enabled) {
  if (!els.homeRemoteAccessToggle) return;
  els.homeRemoteAccessToggle.disabled = true;
  try {
    if (enabled) {
      const statusRes = await apiFetch("/api/public-access/status");
      const statusData = await statusRes.json();
      if (statusData.status === "failed" && statusData.reason === "not_configured") {
        els.homeRemoteAccessToggle.checked = false;
        await loadPublicAccessStatus();
        return;
      }
      await apiFetch("/api/public-access/start", { method: "POST" });
      await pollUntilActive();
    } else {
      await apiFetch("/api/public-access/stop", { method: "POST" });
      await loadPublicAccessStatus();
    }
  } catch (_) {
    await loadPublicAccessStatus();
  } finally {
    els.homeRemoteAccessToggle.disabled = false;
  }
}

if (els.homeRemoteAccessToggle) {
  els.homeRemoteAccessToggle.addEventListener("change", async () => {
    await setHomeRemoteAccessEnabled(!!els.homeRemoteAccessToggle.checked);
  });
}

function navigateToSettings() {
  setActiveSection("settings");
}

if (els.manualConnectBtn) {
  els.manualConnectBtn.addEventListener("click", manualConnect);
}
if (els.networkSearchBtn) {
  els.networkSearchBtn.addEventListener("click", () => discoverySearch());
}
if (els.createTeamBtn) {
  els.createTeamBtn.addEventListener("click", createTeam);
}
if (els.createTeamModalSubmit) els.createTeamModalSubmit.addEventListener("click", submitCreateTeam);
if (els.createTeamModalClose) els.createTeamModalClose.addEventListener("click", closeCreateTeamModal);
if (els.createTeamModalCancel) els.createTeamModalCancel.addEventListener("click", closeCreateTeamModal);

async function startNewPeerChat() {
  if (!isTeamsEnabledByEntitlement()) {
    showUploadBanner("Teams are available on the Teams plan. Upgrade to start peer chats.", "error");
    setTimeout(hideUploadBanner, 2400);
    return;
  }
  try {
    const networkRes = await apiFetch("/api/v1/network");
    const peers = await networkRes.json();
    const candidates = peers.filter((p) => p.deviceId && p.bestIp);
    if (!candidates.length) {
      showUploadBanner("No peers available. Go to Network to discover devices or use Manual Connect.", "error");
      setTimeout(hideUploadBanner, 3500);
      return;
    }
    const list = candidates.map((c, i) => `${i + 1}. ${c.display_name || c.displayName || c.deviceId}`).join("\n");
    const choice = prompt(`Select a peer to start a chat:\n${list}`);
    if (!choice) return;
    const num = parseInt(choice, 10);
    const peer = Number.isFinite(num) && num >= 1 && num <= candidates.length
      ? candidates[num - 1]
      : candidates.find((c) => (c.display_name || c.displayName || c.deviceId) === choice.trim());
    if (!peer) {
      showUploadBanner("Peer not found.");
      setTimeout(hideUploadBanner, 2000);
      return;
    }
    const teamName = peer.display_name || peer.displayName || peer.deviceId?.slice(0, 8) || "Peer";
    const res = await apiFetch("/api/v1/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamName: `Chat with ${teamName}`, department: undefined }),
    });
    const team = await res.json();
    if (!team || !team.teamId) {
      showUploadBanner("Failed to create chat.");
      setTimeout(hideUploadBanner, 2000);
      return;
    }
    await apiFetch(`/api/v1/teams/${team.teamId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toDeviceId: peer.deviceId }),
    });
    await loadTeams();
    showUploadBanner("Chat created. Invite sent to " + (peer.display_name || peer.displayName || peer.deviceId) + ".", "success");
    setTimeout(hideUploadBanner, 2500);
    await showTeamDetail(team.teamId);
  } catch (err) {
    showUploadBanner(err?.message || "Failed to start chat.");
    setTimeout(hideUploadBanner, 2500);
  }
}
if (els.startNewPeerChatBtn) {
  els.startNewPeerChatBtn.addEventListener("click", startNewPeerChat);
}
if (els.addMembersModalSend) els.addMembersModalSend.addEventListener("click", sendAddMembersInvites);
if (els.addMembersModalClose) els.addMembersModalClose.addEventListener("click", closeAddMembersModal);
if (els.addMembersModalCancel) els.addMembersModalCancel.addEventListener("click", closeAddMembersModal);
if (els.notificationsClearAll) {
  els.notificationsClearAll.addEventListener("click", async () => {
    await apiFetch("/api/v1/notifications/clear", { method: "POST" });
    await loadNotifications();
  });
}
if (els.muteNotificationsBtn) {
  els.muteNotificationsBtn.addEventListener("click", () => {
    stateMeta.notificationsMuted = !stateMeta.notificationsMuted;
    localStorage.setItem("joincloud:mute-notifications", stateMeta.notificationsMuted ? "1" : "0");
    updateMuteButton();
  });
}
if (els.teamDetailBack) {
  els.teamDetailBack.addEventListener("click", () => {
    stateTeams.currentTeamId = null;
    loadTeams();
  });
}
function toggleTeamsRightPanel() {
  if (els.teamsLayout) els.teamsLayout.classList.toggle("right-collapsed");
}
if (els.teamToggleRight) {
  els.teamToggleRight.addEventListener("click", toggleTeamsRightPanel);
}
if (els.teamsRightCollapseBtn) {
  els.teamsRightCollapseBtn.addEventListener("click", toggleTeamsRightPanel);
}
if (els.teamSendBtn) {
  els.teamSendBtn.addEventListener("click", sendTeamMessage);
}
if (els.teamInviteBtn) {
  els.teamInviteBtn.addEventListener("click", inviteToTeam);
}
if (els.teamMessageInput) {
  els.teamMessageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendTeamMessage();
    }
  });
}
if (els.networkVisibility) {
  els.networkVisibility.addEventListener("change", async () => {
    await apiFetch("/api/v1/network/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ network_visibility: els.networkVisibility.checked }),
    });
    if (els.networkVisibilityNetwork) els.networkVisibilityNetwork.checked = els.networkVisibility.checked;
  });
}
if (els.networkVisibilityNetwork) {
  els.networkVisibilityNetwork.addEventListener("change", async () => {
    await apiFetch("/api/v1/network/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ network_visibility: els.networkVisibilityNetwork.checked }),
    });
    if (els.networkVisibility) els.networkVisibility.checked = els.networkVisibilityNetwork.checked;
  });
}

els.requestApproval.addEventListener("click", async () => {
  await requestAccessApproval();
});

els.addFileHeader.addEventListener("click", async () => {
  await addFileViaNativePicker();
});

els.toggleSharing.addEventListener("click", async () => {
  if (state.sharingEnabled) {
    openStopModal();
    return;
  }
  await startSharing();
});

els.closeStopModal.addEventListener("click", closeStopModal);
els.cancelStopModal.addEventListener("click", closeStopModal);
els.stopSharingOnly.addEventListener("click", async () => {
  await stopSharing();
});
els.closeApplication.addEventListener("click", async () => {
  closeStopModal();
  if (window.joincloud && window.joincloud.quitApp) {
    await window.joincloud.quitApp();
    return;
  }
  await apiFetch("/api/v1/app/quit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
});
if (els.closePreviewModal) {
  els.closePreviewModal.addEventListener("click", closePreviewModal);
}
if (els.previewModal) {
  els.previewModal.addEventListener("click", (event) => {
    if (event.target === els.previewModal) closePreviewModal();
  });
}
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && els.previewModal && els.previewModal.classList.contains("active")) {
    closePreviewModal();
  }
});
if (els.closeShareQrModal) {
  els.closeShareQrModal.addEventListener("click", closeShareQrModal);
}
if (els.shareQrModal) {
  els.shareQrModal.addEventListener("click", (event) => {
    if (event.target === els.shareQrModal) closeShareQrModal();
  });
}

els.refreshFiles.onclick = () => loadFiles(state.path);
els.refreshShares.onclick = () => loadShares();
els.revokeSelected.onclick = () => revokeSelectedShares();
els.revokeAll.onclick = () => revokeAllShares();
els.refreshLogs.onclick = () => loadLogs();
els.refreshDevices.onclick = () => loadApprovedDevices();
if (els.refreshActivity) {
  els.refreshActivity.onclick = () => loadActivitySummary();
}
els.closeModal.onclick = closeShareModal;
els.cancelShare.onclick = closeShareModal;
els.createShare.onclick = createShare;
document.querySelectorAll('input[name="share-scope"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    const isPublic = document.querySelector('input[name="share-scope"]:checked')?.value === "public";
    if (els.shareScopePublicHint) {
      els.shareScopePublicHint.style.display = isPublic && !stateShare.publicAccessActive ? "block" : "none";
    }
  });
});
// Share list tabs (Local / Public)
document.querySelectorAll(".share-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.getAttribute("data-share-tab") || "local";
    stateShareTab.current = tab === "public" ? "public" : "local";
    document.querySelectorAll(".share-tab").forEach((b) => {
      b.classList.toggle("active", b === btn);
    });
    renderShares();
  });
});
function setNetworkStatusBadge(status) {
  const badge = els.networkStatusBadge;
  if (!badge) return;

  const textEl = document.getElementById("network-status-text") || badge;

  badge.classList.remove("server-status-strong", "server-status-weak", "server-status-inactive");

  if (status === "strong") {
    badge.classList.add("server-status-strong");
    textEl.textContent = "Online";
    return;
  }
  if (status === "weak") {
    badge.classList.add("server-status-strong");
    textEl.textContent = "Online";
    return;
  }
  if (status === "inactive") {
    badge.classList.add("server-status-inactive");
    textEl.textContent = "Server Inactive";
    return;
  }
  badge.classList.add("server-status-inactive");
  textEl.textContent = "Offline";
}

async function measureInternet() {
  // Prefer Electron IPC bridge if available (accurate even when CORS/network policies apply)
  try {
    if (window.joincloud && typeof window.joincloud.checkInternet === "function") {
      const r = await window.joincloud.checkInternet();
      const connected = !!r && r.connected === true;
      const latencyMs = typeof r?.latencyMs === "number" ? r.latencyMs : null;
      return { connected, latencyMs };
    }
  } catch (_) {}

  // Fallback for non-Electron testing
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { connected: false, latencyMs: null };
  }
  const start = Date.now();
  try {
    // no-cors gives us timing without needing to read body
    await fetch("https://www.google.com/favicon.ico", { mode: "no-cors", cache: "no-store" });
    return { connected: true, latencyMs: Date.now() - start };
  } catch (_) {
    return { connected: false, latencyMs: null };
  }
}

// Control Plane connection status indicator (header heart icon)
async function checkControlPlaneStatus() {
  const btn = document.getElementById("control-plane-status");
  if (!btn) return;
  // Yellow - trying
  btn.style.color = "#EAB308";
  btn.title = "Control Plane: Checking…";
  try {
    // Use same-origin API that already talks to the Control Plane
    const res = await apiFetch("/api/public-access/status");
    const data = await res.json().catch(() => ({}));
    const controlPlaneReady = !!(res.ok && data && (data.status === "active" || data.status === "ready"));
    const internet = await measureInternet();

    // Navbar badge should reflect ONLY internet status (not control plane)
    const ms = internet.latencyMs;
    if (internet.connected && typeof ms === "number") {
      setNetworkStatusBadge(ms < 150 ? "strong" : ms < 500 ? "weak" : "weak");
    } else if (internet.connected) {
      setNetworkStatusBadge("weak");
    } else {
      setNetworkStatusBadge("offline");
    }

    if (controlPlaneReady) {
      btn.style.color = "#22C55E"; // green - connected / public sharing works
      btn.title = "Control Plane: Connected — public sharing is active";
    } else {
      btn.style.color = "#EF4444"; // red - error / inactive
      btn.title = "Control Plane: Unreachable or inactive — public sharing may not work";
    }
  } catch (_) {
    btn.style.color = "#EF4444"; // red - not connected
    btn.title = "Control Plane: Unreachable — public sharing may not work";
    const internet = await measureInternet();
    const ms = internet.latencyMs;
    if (internet.connected && typeof ms === "number") {
      setNetworkStatusBadge(ms < 150 ? "strong" : ms < 500 ? "weak" : "weak");
    } else if (internet.connected) {
      setNetworkStatusBadge("weak");
    } else {
      setNetworkStatusBadge("offline");
    }
  }
}

checkControlPlaneStatus();
setInterval(checkControlPlaneStatus, 30000);

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    checkControlPlaneStatus().catch(() => {});
  });
  window.addEventListener("offline", () => {
    setNetworkStatusBadge("offline");
  });
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    setNetworkStatusBadge("offline");
  }
}
if (els.shareWithUserBtn) els.shareWithUserBtn.onclick = shareWithUser;
if (els.shareWithTeamBtn) els.shareWithTeamBtn.onclick = shareWithTeam;
if (els.shareTeamPickerClose) els.shareTeamPickerClose.onclick = closeShareTeamPicker;
if (els.activationRegister) els.activationRegister.onclick = activationRegister;
if (els.activationLogin) els.activationLogin.onclick = activationLogin;
function getHostUuidForDesktopAuth() {
  // Use real host UUID from config; never use "host" (that's the session role from access/me)
  if (state.hostUuidFromConfig && state.hostUuidFromConfig.length >= 8 && state.hostUuidFromConfig.length <= 128) {
    return state.hostUuidFromConfig;
  }
  if (state.deviceId && state.deviceId !== "host" && state.deviceId.length >= 8) {
    return state.deviceId;
  }
  return "";
}
if (els.activationSigninWeb) {
  els.activationSigninWeb.onclick = () => {
    const hostUuid = getHostUuidForDesktopAuth();
    const webUrl = window.__JOINCLOUD_WEB_URL__ || "https://joincloud.com";
    const loginUrl = hostUuid ? `${webUrl}/auth/desktop?deviceId=${encodeURIComponent(hostUuid)}` : `${webUrl}/auth/desktop`;
    if (window.joincloud && window.joincloud.openAuthModal) {
      window.joincloud.openAuthModal(loginUrl);
    } else {
      window.open(loginUrl, "_blank", "noopener,noreferrer");
    }
  };
}
if (els.activationGateSigninWeb) {
  els.activationGateSigninWeb.onclick = () => {
    const hostUuid = getHostUuidForDesktopAuth();
    if (!hostUuid) {
      setActivationGateMessage("Loading device ID... Try again in a moment, or restart the app.");
      loadControlPlaneConfig().then(() => {
        const retry = getHostUuidForDesktopAuth();
        if (retry) {
          setActivationGateMessage("Loading sign-in...");
          const webUrl = window.__JOINCLOUD_WEB_URL__ || "https://joincloud.com";
          const loginUrl = `${webUrl}/auth/desktop?deviceId=${encodeURIComponent(retry)}`;
          if (window.joincloud && window.joincloud.openAuthModal) {
            window.joincloud.openAuthModal(loginUrl);
          } else {
            window.open(loginUrl, "_blank", "noopener,noreferrer");
          }
        }
      });
      return;
    }
    const webUrl = window.__JOINCLOUD_WEB_URL__ || "https://joincloud.com";
    const loginUrl = `${webUrl}/auth/desktop?deviceId=${encodeURIComponent(hostUuid)}`;
    setActivationGateMessage("Loading sign-in...");
    if (window.joincloud && window.joincloud.openAuthModal) {
      window.joincloud.openAuthModal(loginUrl);
    } else {
      window.open(loginUrl, "_blank", "noopener,noreferrer");
    }
  };
}
if (els.activationGateExtendTrial) {
  els.activationGateExtendTrial.onclick = () => {
    const hostUuid = getHostUuidForDesktopAuth();
    if (!hostUuid) {
      setActivationGateMessage("Loading device ID... Try again in a moment, or restart the app.");
      return;
    }
    const webUrl = window.__JOINCLOUD_WEB_URL__ || "https://joincloud.com";
    const extendUrl = `${webUrl}/auth/desktop?deviceId=${encodeURIComponent(hostUuid)}&mode=extendTrial`;
    setActivationGateMessage("Loading sign-in...");
    if (window.joincloud && window.joincloud.openAuthModal) {
      window.joincloud.openAuthModal(extendUrl);
    } else {
      window.open(extendUrl, "_blank", "noopener,noreferrer");
    }
  };
}
if (typeof window !== "undefined" && window.joincloud && window.joincloud.onLicenseUpdated) {
  window.joincloud.onLicenseUpdated(async () => {
    console.log("[joincloud] license-updated IPC received, reloading config...");
    setActivationGateMessage("");
    await loadControlPlaneConfig();
    console.log("[joincloud] config reloaded, canUseApp:", canUseApp(), "isAuthenticated:", state.isAuthenticated, "licenseState:", state.licenseState, "licenseTier:", state.licenseTier);
    if (canUseApp()) {
      showMainApp();
      bootstrapOnceAfterAuth();
    }
  });
}
if (els.subscriptionManageBtn) els.subscriptionManageBtn.onclick = openBillingPortal;
// settingsLogout intentionally has no click handler in this build (button is hidden).
if (els.activationGateRetry) {
  els.activationGateRetry.onclick = () => {
    // Reload to retry activation/bootstrap when network or Control Plane is back.
    window.location.reload();
  };
}
if (els.supportSend) els.supportSend.onclick = sendSupportMessage;
if (els.supportMessageInput) {
  els.supportMessageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); sendSupportMessage(); }
  });
}
els.shareTtl.onchange = () => {
  els.shareTtlCustom.style.display = els.shareTtl.value === "custom" ? "block" : "none";
};
els.fileSearch.addEventListener("input", (event) => {
  state.fileSearch = String(event.target.value || "");
  renderFiles();
});
els.fileSort.addEventListener("change", (event) => {
  state.fileSort = String(event.target.value || "name_asc");
  renderFiles();
});
els.foldersOnly.addEventListener("change", (event) => {
  state.foldersOnly = !!event.target.checked;
  renderFiles();
});
els.viewList.addEventListener("click", () => {
  state.fileView = "list";
  renderFiles();
});
els.viewThumb.addEventListener("click", () => {
  state.fileView = "thumb";
  renderFiles();
});
if (els.myFolderShortcut) {
  els.myFolderShortcut.addEventListener("click", async () => {
    await loadFiles(state.path);
  });
}
els.backButton.onclick = () => {
  if (state.path === "/") return;
  const parts = state.path.split("/").filter(Boolean);
  parts.pop();
  loadFiles(`/${parts.join("/")}` || "/");
};
els.openStorage.onclick = async () => {
  if (window.joincloud && window.joincloud.openStorageFolder) {
    await window.joincloud.openStorageFolder();
  } else {
    alert("Storage folder is available in the desktop app only.");
  }
};
els.uploadInput.onchange = (event) => {
  uploadFiles(event.target.files);
  els.uploadInput.value = "";
};
els.dropZone.addEventListener("dragover", (event) => {
  if (els.uploadInput?.disabled) return;
  event.preventDefault();
  els.dropZone.classList.add("active");
});
els.dropZone.addEventListener("dragleave", () => els.dropZone.classList.remove("active"));
els.dropZone.addEventListener("drop", async (event) => {
  if (els.uploadInput?.disabled) return;
  event.preventDefault();
  els.dropZone.classList.remove("active");
  const items = event.dataTransfer?.items;
  if (items && items.length > 0) {
    const collected = await collectFilesFromItems(items);
    if (collected.length > 0) {
      uploadFilesWithPaths(collected);
      return;
    }
  }
  uploadFiles(event.dataTransfer.files);
});

async function collectFilesFromItems(items) {
  const result = [];
  const readDirEntries = (dirReader) =>
    new Promise((resolve, reject) => {
      const all = [];
      function read() {
        dirReader.readEntries(
          (entries) => {
            if (entries.length === 0) {
              resolve(all);
              return;
            }
            all.push(...entries);
            read();
          },
          (err) => (err ? reject(err) : resolve(all))
        );
      }
      read();
    });
  const readEntry = async (entry, basePath = "") => {
    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file(
          (file) => {
            const relPath = basePath ? `${basePath}/${file.name}` : file.name;
            result.push({ file, relativePath: relPath });
            resolve();
          },
          () => resolve()
        );
      });
    }
    if (entry.isDirectory) {
      const dirPath = basePath ? `${basePath}/${entry.name}` : entry.name;
      const entries = await readDirEntries(entry.createReader());
      for (const e of entries) {
        if (e.name.startsWith(".") || e.name.startsWith("._")) continue;
        await readEntry(e, dirPath);
      }
    }
  };
  for (let i = 0; i < items.length; i++) {
    const entry = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
    if (entry) await readEntry(entry);
  }
  return result;
}

async function uploadFilesWithPaths(items) {
  if (!items || items.length === 0) return;
  const label = items.length === 1 ? items[0].relativePath : `${items.length} files`;
  showUploadBanner(`Uploading ${label}...`, "loading");
  const formData = new FormData();
  formData.append("path", state.path);
  for (const { file, relativePath } of items) {
    formData.append("fileRelPath", relativePath);
    formData.append("files", file);
  }
  try {
    const res = await apiFetch("/api/upload", { method: "POST", body: formData });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const reason = payload.error || "Upload failed.";
      showUploadBanner(reason, "error");
      if (els.uploadScopeHint) els.uploadScopeHint.textContent = reason;
      return;
    }
    const savedTo = String(payload.saved_to || state.path || "/");
    showUploadBanner("Upload complete", "success");
    setTimeout(hideUploadBanner, 2500);
    await loadFiles(savedTo);
    await loadLogs();
  } catch (err) {
    showUploadBanner(err.message || "Upload failed", "error");
    if (els.uploadScopeHint) els.uploadScopeHint.textContent = err.message || "Upload failed";
  }
}
els.telemetryToggle.addEventListener("change", async (event) => {
  await updateTelemetrySettings(event.target.checked);
});
els.saveNetworkName.addEventListener("click", async () => {
  await saveNetworkName();
});

if (els.remoteAccessToggle) {
  els.remoteAccessToggle.addEventListener("change", async () => {
    if (!els.remoteAccessStarting) return;
    els.remoteAccessToggle.disabled = true;
    if (els.remoteAccessToggle.checked) {
      try {
        const statusRes = await apiFetch("/api/public-access/status");
        const statusData = await statusRes.json();
        if (statusData.status === "failed" && statusData.reason === "not_configured") {
          els.remoteAccessToggle.checked = false;
          await loadPublicAccessStatus();
          els.remoteAccessToggle.disabled = false;
          return;
        }
      } catch (_) {
        els.remoteAccessToggle.disabled = false;
        return;
      }
      els.remoteAccessStarting.style.display = "flex";
      if (els.remoteAccessActive) els.remoteAccessActive.style.display = "none";
      try {
        await apiFetch("/api/public-access/start", { method: "POST" });
        await pollUntilActive();
      } catch (_) {
        await loadPublicAccessStatus();
      }
    } else {
      try {
        await apiFetch("/api/public-access/stop", { method: "POST" });
      } catch (_) {}
      await loadPublicAccessStatus();
    }
    els.remoteAccessToggle.disabled = false;
  });
}
if (els.remoteAccessCopy) {
  els.remoteAccessCopy.addEventListener("click", async () => {
    const url = els.remoteAccessUrl && els.remoteAccessUrl.href;
    if (url) {
      const ok = await copyToClipboard(url);
      if (ok) { els.remoteAccessCopy.textContent = "Copied!"; setTimeout(() => (els.remoteAccessCopy.textContent = "Copy"), 2000); }
    }
  });
}
if (els.remoteAccessOpen) {
  els.remoteAccessOpen.addEventListener("click", () => {
    if (els.remoteAccessUrl && els.remoteAccessUrl.href) window.open(els.remoteAccessUrl.href, "_blank");
  });
}
if (els.remoteAccessPinSave) {
  els.remoteAccessPinSave.addEventListener("click", async () => {
    const pin = els.remoteAccessPin ? els.remoteAccessPin.value : "";
    try {
      const res = await apiFetch("/api/user/remote-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pin.trim() || null }),
      });
      if (res.ok) {
        els.remoteAccessPinSave.textContent = "Saved";
        setTimeout(() => (els.remoteAccessPinSave.textContent = "Save"), 2000);
      }
    } catch (_) {}
  });
}

async function doRemoteAccessProvision() {
  if (!els.remoteAccessSetupBtn) return;
  els.remoteAccessSetupBtn.disabled = true;
  if (els.remoteAccessSetupSpinner) els.remoteAccessSetupSpinner.style.display = "block";
  if (els.remoteAccessSetupError) els.remoteAccessSetupError.style.display = "none";
  try {
    const res = await apiFetch("/api/public-access/provision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      await loadPublicAccessStatus();
    } else {
      if (els.remoteAccessSetupErrorText) els.remoteAccessSetupErrorText.textContent = data.error || "Setup failed";
      if (els.remoteAccessSetupError) els.remoteAccessSetupError.style.display = "block";
    }
  } catch (e) {
    if (els.remoteAccessSetupErrorText) els.remoteAccessSetupErrorText.textContent = e && e.message ? e.message : "Network error";
    if (els.remoteAccessSetupError) els.remoteAccessSetupError.style.display = "block";
  }
  if (els.remoteAccessSetupSpinner) els.remoteAccessSetupSpinner.style.display = "none";
  els.remoteAccessSetupBtn.disabled = false;
}

if (els.remoteAccessSetupBtn) {
  els.remoteAccessSetupBtn.addEventListener("click", () => doRemoteAccessProvision());
}
if (els.remoteAccessSetupRetry) {
  els.remoteAccessSetupRetry.addEventListener("click", () => doRemoteAccessProvision());
}

els.copyPrivacyPolicy.addEventListener("click", async () => {
  if (!stateMeta.privacyPolicyRaw) return;
  await copyToClipboard(stateMeta.privacyPolicyRaw);
  els.copyPrivacyPolicy.textContent = "Copied!";
  setTimeout(() => {
    els.copyPrivacyPolicy.textContent = "Copy";
  }, 1200);
});
els.downloadPrivacyPolicy.addEventListener("click", () => {
  if (!stateMeta.privacyPolicyRaw) return;
  const blob = new Blob([stateMeta.privacyPolicyRaw], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "JoinCloud-Privacy-Policy.md";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

// Privacy Policy Modal
const privacyModal = document.getElementById("privacy-policy-modal");
const openPrivacyBtn = document.getElementById("open-privacy-policy-modal");
const closePrivacyBtn = document.getElementById("close-privacy-modal");

if (openPrivacyBtn && privacyModal) {
  openPrivacyBtn.addEventListener("click", () => {
    privacyModal.style.display = "flex";
  });
}

if (closePrivacyBtn && privacyModal) {
  closePrivacyBtn.addEventListener("click", () => {
    privacyModal.style.display = "none";
  });
}

if (privacyModal) {
  privacyModal.addEventListener("click", (e) => {
    if (e.target === privacyModal) {
      privacyModal.style.display = "none";
    }
  });
}

if (els.uploadBannerDismiss) {
  els.uploadBannerDismiss.addEventListener("click", hideUploadBanner);
}
if (els.accessDeviceNameInput) {
  els.accessDeviceNameInput.value = getSuggestedDeviceName();
}
els.accessFingerprint.textContent = stateMeta.fingerprint;
bootstrapApp();

// Dynamic config poll: 10 s in dev mode, 60 s in production.
// Self-reschedules so the interval can adapt after the first config load sets state.devMode.
(function scheduleConfigPoll() {
  var delay = state.devMode ? 10 * 1000 : 60 * 1000;
  setTimeout(async () => {
    if (els.appLayout.style.display !== "none") {
      try {
        await loadControlPlaneConfig();
        updateGraceBanner();
        updateSubscriptionSection();
        updateHeaderProfile();
        renderUsageBars().catch(() => {});
      } catch (_) {}
    }
    scheduleConfigPoll();
  }, delay);
})();

setInterval(async () => {
  if (els.appLayout.style.display !== "none") {
    await loadRuntimeStatus();
    await loadLogs();
    await loadNotifications();
    if (state.isAdmin) {
      await loadPendingAccessRequests();
      await loadApprovedDevices();
      await loadShareVisitSummary();
      await loadActivitySummary();
    }
  } else if (state.requestId) {
    await pollAccessStatus(state.requestId);
  }
}, 3000);
