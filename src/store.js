'use strict';

const fs = require('node:fs').promises;
const path = require('node:path');
const crypto = require('node:crypto');
const { redactUrl } = require('./providers');

const LEGACY_FALSE_CODES = new Set(['YOUR', 'CONTINUE']);

function nowIso() {
  return new Date().toISOString();
}

function publicMailbox(mailbox) {
  return {
    id: mailbox.id,
    email: mailbox.email,
    sourceUrl: redactUrl(mailbox.sourceUrl),
    sourceHost: new URL(mailbox.sourceUrl).host,
    provider: mailbox.provider,
    pollMode: mailbox.pollMode,
    enabled: mailbox.enabled,
    intervalSec: mailbox.intervalSec,
    status: mailbox.status,
    lastChecked: mailbox.lastChecked,
    lastError: mailbox.lastError,
    latestCode: mailbox.latestCode,
    newCodeAt: mailbox.newCodeAt,
    messageCount: mailbox.messageCount || 0,
    snippet: mailbox.snippet || '',
    codes: mailbox.codes || [],
    usedOneShot: Boolean(mailbox.usedOneShot),
    createdAt: mailbox.createdAt
  };
}

function clearLegacyFalseCodes(mailbox) {
  const latestCode = String(mailbox.latestCode || '').toUpperCase();
  const originalCodes = Array.isArray(mailbox.codes) ? mailbox.codes : [];
  const filteredCodes = originalCodes.filter((item) =>
    !LEGACY_FALSE_CODES.has(String(item?.code || '').toUpperCase())
  );
  const latestWasInvalid = LEGACY_FALSE_CODES.has(latestCode);
  const historyChanged = filteredCodes.length !== originalCodes.length;
  if (!latestWasInvalid && !historyChanged) return false;

  mailbox.codes = filteredCodes;
  if (latestWasInvalid) {
    mailbox.latestCode = '';
    mailbox.newCodeAt = null;
    if (mailbox.status === 'code') mailbox.status = mailbox.messageCount ? 'mail' : 'empty';
  }
  return true;
}

class Store {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = { version: 2, mailboxes: [], githubAccounts: [], githubConfig: {} };
    this.writeChain = Promise.resolve();
  }

  async load() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
      if (parsed && Array.isArray(parsed.mailboxes)) {
        this.state = {
          ...parsed,
          version: 2,
          githubAccounts: Array.isArray(parsed.githubAccounts) ? parsed.githubAccounts : [],
          githubConfig: parsed.githubConfig && typeof parsed.githubConfig === 'object' ? parsed.githubConfig : {}
        };
        const migrated = this.state.mailboxes.map(clearLegacyFalseCodes).some(Boolean);
        if (migrated) await this.save();
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    return this;
  }

  listPublic() {
    return this.state.mailboxes.map(publicMailbox);
  }

  get(id) {
    return this.state.mailboxes.find((mailbox) => mailbox.id === id);
  }

  listGithubAccountsPublic() {
    return this.state.githubAccounts.map((account) => ({
      id: account.id,
      login: account.login,
      name: account.name || '',
      avatarUrl: account.avatarUrl || '',
      htmlUrl: account.htmlUrl || '',
      mailboxId: account.mailboxId,
      mailboxEmail: this.get(account.mailboxId)?.email || '',
      scopes: account.scopes || [],
      connectedAt: account.connectedAt,
      recentActions: account.recentActions || []
    }));
  }

  getGithubAccount(id) {
    return this.state.githubAccounts.find((account) => account.id === id);
  }

  getGithubConfig() {
    return { clientId: this.state.githubConfig.clientId || '' };
  }

  async setGithubConfig(config) {
    this.state.githubConfig = { clientId: config.clientId || '' };
    await this.save();
    return this.getGithubConfig();
  }

  async upsertGithubAccount(input) {
    let account = this.state.githubAccounts.find((item) => item.login.toLowerCase() === input.login.toLowerCase());
    if (account) {
      Object.assign(account, input, { id: account.id, recentActions: account.recentActions || [] });
    } else {
      account = {
        id: crypto.randomUUID(),
        ...input,
        recentActions: [],
        createdAt: nowIso()
      };
      this.state.githubAccounts.push(account);
    }
    await this.save();
    return this.listGithubAccountsPublic().find((item) => item.id === account.id);
  }

  async recordGithubAction(id, action) {
    const account = this.getGithubAccount(id);
    if (!account) return null;
    const safeAction = {
      action: action.action,
      target: action.target,
      status: action.status,
      at: action.at,
      message: action.message ? String(action.message).slice(0, 240) : ''
    };
    account.recentActions = [safeAction, ...(account.recentActions || [])].slice(0, 10);
    await this.save();
    return safeAction;
  }

  async removeGithubAccount(id) {
    const index = this.state.githubAccounts.findIndex((account) => account.id === id);
    if (index < 0) return false;
    this.state.githubAccounts.splice(index, 1);
    await this.save();
    return true;
  }

  async import(records) {
    const existing = new Set(this.state.mailboxes.map((item) => `${item.email}\n${item.sourceUrl}`));
    const existingByEmail = new Map(this.state.mailboxes.map((item) => [item.email.toLowerCase(), item]));
    const added = [];
    const updated = [];
    const duplicate = [];
    for (const record of records) {
      const key = `${record.email}\n${record.sourceUrl}`;
      if (existing.has(key)) {
        duplicate.push(record.email);
        continue;
      }
      const mailboxForEmail = existingByEmail.get(record.email.toLowerCase());
      if (mailboxForEmail) {
        existing.delete(`${mailboxForEmail.email}\n${mailboxForEmail.sourceUrl}`);
        Object.assign(mailboxForEmail, record, {
          enabled: record.pollMode === 'repeat',
          status: 'idle',
          lastChecked: null,
          lastError: '',
          latestCode: '',
          newCodeAt: null,
          messageCount: 0,
          snippet: '',
          codes: [],
          usedOneShot: false,
          nextPollAt: Date.now()
        });
        existing.add(key);
        updated.push(publicMailbox(mailboxForEmail));
        continue;
      }
      existing.add(key);
      const mailbox = {
        id: crypto.randomUUID(),
        ...record,
        enabled: record.pollMode === 'repeat',
        intervalSec: 10,
        status: 'idle',
        lastChecked: null,
        lastError: '',
        latestCode: '',
        newCodeAt: null,
        messageCount: 0,
        snippet: '',
        codes: [],
        usedOneShot: false,
        nextPollAt: Date.now(),
        createdAt: nowIso()
      };
      this.state.mailboxes.push(mailbox);
      existingByEmail.set(record.email.toLowerCase(), mailbox);
      added.push(publicMailbox(mailbox));
    }
    await this.save();
    return { added, updated, duplicate };
  }

  async update(id, patch) {
    const mailbox = this.get(id);
    if (!mailbox) return null;
    Object.assign(mailbox, patch);
    await this.save();
    return publicMailbox(mailbox);
  }

  async remove(id) {
    const index = this.state.mailboxes.findIndex((mailbox) => mailbox.id === id);
    if (index < 0) return false;
    this.state.mailboxes.splice(index, 1);
    await this.save();
    return true;
  }

  async save() {
    this.writeChain = this.writeChain.then(async () => {
      const tempPath = `${this.filePath}.tmp`;
      await fs.writeFile(tempPath, `${JSON.stringify(this.state, null, 2)}\n`, { mode: 0o600 });
      await fs.rename(tempPath, this.filePath);
    });
    return this.writeChain;
  }
}

module.exports = { Store, publicMailbox, clearLegacyFalseCodes };
