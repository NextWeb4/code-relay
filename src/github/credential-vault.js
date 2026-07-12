'use strict';

const SERVICE_NAME = 'code-relay-github';

class KeyringCredentialVault {
  constructor(options = {}) {
    this.serviceName = options.serviceName || SERVICE_NAME;
    this.modulePromise = null;
  }

  async getEntry(accountId) {
    if (!this.modulePromise) this.modulePromise = import('@napi-rs/keyring');
    const { Entry } = await this.modulePromise;
    return new Entry(this.serviceName, accountId);
  }

  async set(accountId, token) {
    if (!accountId || typeof token !== 'string' || !token) throw new Error('GitHub 凭据无效');
    const entry = await this.getEntry(accountId);
    await entry.setPassword(token);
  }

  async get(accountId) {
    const entry = await this.getEntry(accountId);
    return await entry.getPassword() || '';
  }

  async has(accountId) {
    return Boolean(await this.get(accountId));
  }

  async delete(accountId) {
    const entry = await this.getEntry(accountId);
    try {
      await entry.deletePassword();
      return true;
    } catch (error) {
      if (/no entry|not found/i.test(error.message || '')) return false;
      throw error;
    }
  }
}

class MemoryCredentialVault {
  constructor() {
    this.tokens = new Map();
  }

  async set(accountId, token) {
    this.tokens.set(accountId, token);
  }

  async get(accountId) {
    return this.tokens.get(accountId) || '';
  }

  async has(accountId) {
    return this.tokens.has(accountId);
  }

  async delete(accountId) {
    return this.tokens.delete(accountId);
  }
}

module.exports = { KeyringCredentialVault, MemoryCredentialVault };
