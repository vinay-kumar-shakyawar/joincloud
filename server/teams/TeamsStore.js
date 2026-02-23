"use strict";

const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const MAX_TEAM_MEMBERS = 5;

function nowIso() {
  return new Date().toISOString();
}

function ensureShape(raw) {
  return {
    teams: raw && typeof raw.teams === "object" ? raw.teams : {},
    messages: raw && typeof raw.messages === "object" ? raw.messages : {},
    invites: raw && typeof raw.invites === "object" ? raw.invites : {},
  };
}

class TeamsStore {
  constructor({ storagePath, logger }) {
    this.storagePath = storagePath;
    this.logger = logger;
    this.state = ensureShape();
  }

  async init() {
    await fs.mkdir(path.dirname(this.storagePath), { recursive: true });
    try {
      const raw = await fs.readFile(this.storagePath, "utf8");
      this.state = ensureShape(JSON.parse(raw));
    } catch (error) {
      this.state = ensureShape();
      await this.persist();
    }
  }

  async persist() {
    await fs.writeFile(this.storagePath, JSON.stringify(this.state, null, 2));
  }

  createTeam({ teamName, createdByDeviceId }) {
    const teamId = crypto.randomUUID();
    const now = nowIso();
    this.state.teams[teamId] = {
      teamId,
      teamName: teamName || "Unnamed Team",
      members: [createdByDeviceId],
      createdByDeviceId,
      createdAt: now,
      lastUpdatedAt: now,
    };
    this.persist();
    return this.state.teams[teamId];
  }

  getTeam(teamId) {
    return this.state.teams[teamId] || null;
  }

  listTeamsForDevice(deviceId) {
    return Object.values(this.state.teams).filter((t) =>
      t.members.includes(deviceId)
    );
  }

  createInvite({ teamId, fromDeviceId, toDeviceId }) {
    const team = this.state.teams[teamId];
    if (!team || !team.members.includes(fromDeviceId)) return null;
    if (team.members.length >= MAX_TEAM_MEMBERS) return null;
    if (team.members.includes(toDeviceId)) return null;
    const inviteId = crypto.randomUUID();
    this.state.invites[inviteId] = {
      inviteId,
      teamId,
      teamName: team.teamName,
      fromDeviceId,
      toDeviceId,
      status: "pending",
      createdAt: nowIso(),
    };
    this.persist();
    return this.state.invites[inviteId];
  }

  acceptInvite(inviteId, deviceId) {
    const invite = this.state.invites[inviteId];
    if (!invite || invite.toDeviceId !== deviceId || invite.status !== "pending")
      return null;
    let team = this.state.teams[invite.teamId];
    if (!team) {
      team = {
        teamId: invite.teamId,
        teamName: invite.teamName || "Team",
        members: [invite.fromDeviceId, deviceId],
        createdByDeviceId: invite.fromDeviceId,
        createdAt: invite.createdAt || nowIso(),
        lastUpdatedAt: nowIso(),
      };
      this.state.teams[invite.teamId] = team;
    } else {
      if (team.members.length >= MAX_TEAM_MEMBERS) return null;
      if (!team.members.includes(deviceId)) team.members.push(deviceId);
    }
    team.lastUpdatedAt = nowIso();
    invite.status = "accepted";
    this.persist();
    return team;
  }

  addMessage({ teamId, senderDeviceId, type, payload }) {
    const team = this.state.teams[teamId];
    if (!team || !team.members.includes(senderDeviceId)) return null;
    const messageId = crypto.randomUUID();
    const msg = {
      messageId,
      teamId,
      senderDeviceId,
      timestamp: nowIso(),
      type: type || "text",
      payload: payload || {},
    };
    if (!this.state.messages[teamId]) this.state.messages[teamId] = [];
    this.state.messages[teamId].push(msg);
    team.lastUpdatedAt = nowIso();
    this.persist();
    return msg;
  }

  getMessages(teamId, deviceId) {
    const team = this.state.teams[teamId];
    if (!team || !team.members.includes(deviceId)) return [];
    return (this.state.messages[teamId] || []).slice();
  }

  getPendingInvitesForDevice(deviceId) {
    return Object.values(this.state.invites).filter(
      (i) => i.toDeviceId === deviceId && i.status === "pending"
    );
  }
}

module.exports = { TeamsStore };
