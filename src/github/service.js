'use strict';

const crypto = require('node:crypto');
const { GitHubClient, GitHubApiError } = require('./client');
const { KeyringCredentialVault } = require('./credential-vault');

const ALLOWED_ACTIONS = new Set(['star', 'watch', 'fork', 'follow']);
const DEFAULT_SCOPES = ['public_repo', 'notifications', 'user:follow'];
const CLIENT_ID_PATTERN = /^[A-Za-z0-9._-]{10,100}$/;

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function publicVerification(verification) {
  return {
    userCode: verification.user_code,
    verificationUri: verification.verification_uri,
    expiresAt: new Date(Date.now() + verification.expires_in * 1000).toISOString(),
    intervalSec: verification.interval
  };
}

class GitHubService {
  constructor(store, options = {}) {
    this.store = store;
    this.client = options.client || new GitHubClient();
    this.vault = options.vault || new KeyringCredentialVault();
    this.clientId = options.clientId || process.env.GITHUB_OAUTH_CLIENT_ID || store.getGithubConfig?.().clientId || '';
    this.authFactory = options.authFactory || null;
    this.sessions = new Map();
    this.actionChain = Promise.resolve();
    this.lastMutationAt = 0;
    this.blockedUntil = 0;
    this.actionIntervalMs = options.actionIntervalMs ?? 1000;
    this.wait = options.wait || sleep;
    this.now = options.now || (() => Date.now());
  }

  async getAuthFactory() {
    if (this.authFactory) return this.authFactory;
    const module = await import('@octokit/auth-oauth-device');
    return module.createOAuthDeviceAuth;
  }

  configuration() {
    return {
      configured: Boolean(this.clientId),
      clientId: this.clientId,
      scopes: DEFAULT_SCOPES,
      policy: '仅限自有账号逐次授权和单目标操作；不支持自动注册或批量互动'
    };
  }

  async setConfiguration({ clientId } = {}) {
    const value = String(clientId || '').trim();
    if (!CLIENT_ID_PATTERN.test(value)) throw new Error('GitHub OAuth Client ID 格式无效');
    await this.store.setGithubConfig({ clientId: value });
    this.clientId = value;
    return this.configuration();
  }

  async listAccounts() {
    const accounts = this.store.listGithubAccountsPublic();
    return Promise.all(accounts.map(async (account) => ({
      ...account,
      connected: await this.vault.has(account.id).catch(() => false)
    })));
  }

  async startAuthorization({ mailboxId } = {}) {
    if (!this.clientId) throw new Error('未配置 GITHUB_OAUTH_CLIENT_ID，GitHub 授权暂不可用');
    const mailbox = this.store.get(mailboxId);
    if (!mailbox) throw new Error('请选择现有邮箱作为账号关联');

    const session = {
      id: crypto.randomUUID(),
      status: 'starting',
      mailboxId,
      createdAt: new Date().toISOString(),
      verification: null,
      accountId: null,
      error: ''
    };
    this.sessions.set(session.id, session);

    let verificationResolve;
    let verificationReject;
    const verificationReady = new Promise((resolve, reject) => {
      verificationResolve = resolve;
      verificationReject = reject;
    });

    session.completion = (async () => {
      try {
        const createOAuthDeviceAuth = await this.getAuthFactory();
        const auth = createOAuthDeviceAuth({
          clientType: 'oauth-app',
          clientId: this.clientId,
          scopes: DEFAULT_SCOPES,
          onVerification: (verification) => {
            session.verification = publicVerification(verification);
            session.status = 'waiting';
            verificationResolve(session.verification);
          }
        });
        const authentication = await auth({ type: 'oauth' });
        const user = await this.client.getAuthenticatedUser(authentication.token);
        const account = await this.store.upsertGithubAccount({
          ...user,
          mailboxId,
          scopes: authentication.scopes || DEFAULT_SCOPES,
          connectedAt: new Date().toISOString()
        });
        await this.vault.set(account.id, authentication.token);
        session.accountId = account.id;
        session.status = 'complete';
      } catch (error) {
        session.status = 'error';
        session.error = error.message || 'GitHub 授权失败';
        verificationReject(error);
      }
    })();
    session.completion.catch(() => {});

    const verification = await verificationReady;
    const cleanupTimer = setTimeout(() => this.sessions.delete(session.id), 20 * 60 * 1000);
    cleanupTimer.unref?.();
    return { sessionId: session.id, verification };
  }

  authorizationStatus(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('授权会话不存在或已过期');
    return {
      sessionId: session.id,
      status: session.status,
      verification: session.verification,
      accountId: session.accountId,
      error: session.error
    };
  }

  async performAction(accountId, payload = {}) {
    if (payload.confirmed !== true) throw new Error('GitHub 写操作需要用户明确确认');
    if (!ALLOWED_ACTIONS.has(payload.action)) throw new Error('不支持该 GitHub 操作');
    if (typeof payload.target !== 'string' || !payload.target.trim() || payload.target.includes(',')) {
      throw new Error('每次只能提交一个明确目标');
    }
    const account = this.store.getGithubAccount(accountId);
    if (!account) throw new Error('GitHub 账号不存在');

    const run = this.actionChain.catch(() => {}).then(() => this.executeAction(account, payload));
    this.actionChain = run;
    return run;
  }

  async executeAction(account, payload) {
    const current = this.now();
    if (current < this.blockedUntil) {
      const seconds = Math.ceil((this.blockedUntil - current) / 1000);
      throw new Error(`GitHub API 正在限流，请在 ${seconds} 秒后重试`);
    }
    const elapsed = current - this.lastMutationAt;
    if (elapsed < this.actionIntervalMs) await this.wait(this.actionIntervalMs - elapsed);

    const token = await this.vault.get(account.id);
    if (!token) throw new Error('GitHub 凭据不存在，请重新连接账号');
    try {
      const result = await this.client[payload.action](token, payload.target.trim());
      this.lastMutationAt = this.now();
      await this.store.recordGithubAction(account.id, {
        action: result.action,
        target: result.target,
        status: 'success',
        at: new Date().toISOString()
      });
      return result;
    } catch (error) {
      this.lastMutationAt = this.now();
      if (error instanceof GitHubApiError) this.applyRateLimit(error);
      await this.store.recordGithubAction(account.id, {
        action: payload.action,
        target: payload.target.trim(),
        status: 'error',
        at: new Date().toISOString(),
        message: error.status ? `GitHub API error ${error.status}` : 'GitHub action failed'
      });
      throw error;
    }
  }

  applyRateLimit(error) {
    if (error.retryAfter > 0) {
      this.blockedUntil = Math.max(this.blockedUntil, this.now() + error.retryAfter * 1000);
    } else if (error.rateRemaining === '0' && error.rateReset > 0) {
      this.blockedUntil = Math.max(this.blockedUntil, error.rateReset * 1000);
    } else if (error.status === 429 || error.secondaryRateLimit) {
      this.blockedUntil = Math.max(this.blockedUntil, this.now() + 60 * 1000);
    }
  }

  async disconnect(accountId, confirmed) {
    if (confirmed !== true) throw new Error('断开账号需要用户明确确认');
    const account = this.store.getGithubAccount(accountId);
    if (!account) throw new Error('GitHub 账号不存在');
    await this.vault.delete(accountId);
    await this.store.removeGithubAccount(accountId);
    return { ok: true };
  }
}

module.exports = { ALLOWED_ACTIONS, DEFAULT_SCOPES, GitHubService };
