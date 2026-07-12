'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs').promises;
const os = require('node:os');
const path = require('node:path');
const { GitHubClient, GitHubApiError } = require('../src/github/client');
const { MemoryCredentialVault } = require('../src/github/credential-vault');
const { GitHubService } = require('../src/github/service');
const { Store } = require('../src/store');
const { createApp } = require('../src/server');

async function createStore(context) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'code-relay-github-'));
  const filePath = path.join(directory, 'mailboxes.json');
  const store = await new Store(filePath).load();
  await store.import([{ email: 'owner@example.com', sourceUrl: 'https://mail.example.com/inbox', provider: 'direct', pollMode: 'repeat' }]);
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  return { store, filePath };
}

test('GitHub client 只调用固定端点并校验单个目标', async () => {
  const calls = [];
  const client = new GitHubClient({
    requestImpl: async (route, options) => {
      calls.push({ route, options });
      return { data: route === 'GET /user' ? { login: 'octocat', avatar_url: 'avatar', html_url: 'profile' } : {} };
    }
  });

  assert.equal((await client.getAuthenticatedUser('test-token')).login, 'octocat');
  await client.star('test-token', 'octo/repo');
  await client.watch('test-token', 'octo/repo');
  await client.fork('test-token', 'octo/repo');
  await client.follow('test-token', 'octocat');

  assert.deepEqual(calls.map((call) => call.route), [
    'GET /user',
    'PUT /user/starred/{owner}/{repo}',
    'PUT /repos/{owner}/{repo}/subscription',
    'POST /repos/{owner}/{repo}/forks',
    'PUT /user/following/{username}'
  ]);
  assert.equal(calls[1].options.headers.authorization, 'Bearer test-token');
  await assert.rejects(() => client.star('test-token', 'one,two'), /owner\/repo/);
  await assert.rejects(() => client.follow('test-token', 'bad/user'), /用户名/);
});

test('OAuth Client ID 可从页面配置并持久化，缺少环境变量时按钮不再被阻塞', async (context) => {
  const { store, filePath } = await createStore(context);
  const service = new GitHubService(store, {
    vault: new MemoryCredentialVault(),
    clientId: ''
  });
  assert.equal(service.configuration().configured, false);
  await assert.rejects(() => service.setConfiguration({ clientId: 'bad' }), /格式无效/);

  const configured = await service.setConfiguration({ clientId: 'Ov23li1234567890abcd' });
  assert.equal(configured.configured, true);
  assert.equal(configured.clientId, 'Ov23li1234567890abcd');
  assert.match(await fs.readFile(filePath, 'utf8'), /Ov23li1234567890abcd/);

  const reloadedStore = await new Store(filePath).load();
  const reloadedService = new GitHubService(reloadedStore, {
    vault: new MemoryCredentialVault(),
    clientId: ''
  });
  assert.equal(reloadedService.configuration().clientId, 'Ov23li1234567890abcd');
});

test('Device Flow 关联现有邮箱，token 只进入凭据库', async (context) => {
  const { store, filePath } = await createStore(context);
  const vault = new MemoryCredentialVault();
  const client = {
    async getAuthenticatedUser(token) {
      assert.equal(token, 'oauth-test-token');
      return { login: 'owner', name: 'Owner', avatarUrl: '', htmlUrl: 'https://github.com/owner' };
    },
    async star(token, target) {
      assert.equal(token, 'oauth-test-token');
      return { action: 'star', target };
    }
  };
  const authFactory = (options) => async () => {
    options.onVerification({
      device_code: 'device-test-code',
      user_code: 'ABCD-EFGH',
      verification_uri: 'https://github.com/login/device',
      expires_in: 900,
      interval: 5
    });
    return { token: 'oauth-test-token', scopes: ['public_repo'] };
  };
  const service = new GitHubService(store, {
    vault,
    client,
    clientId: 'client-id',
    authFactory,
    actionIntervalMs: 0
  });
  const mailboxId = store.listPublic()[0].id;
  const started = await service.startAuthorization({ mailboxId });
  assert.equal(started.verification.userCode, 'ABCD-EFGH');

  for (let attempt = 0; attempt < 50 && service.authorizationStatus(started.sessionId).status !== 'complete'; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(service.authorizationStatus(started.sessionId).status, 'complete');
  const [account] = await service.listAccounts();
  assert.equal(account.login, 'owner');
  assert.equal(account.mailboxEmail, 'owner@example.com');
  assert.equal(account.connected, true);

  const disk = await fs.readFile(filePath, 'utf8');
  assert.doesNotMatch(disk, /oauth-test-token|device-test-code/);
  await assert.rejects(() => service.performAction(account.id, { action: 'star', target: 'octo/repo' }), /明确确认/);
  await assert.rejects(() => service.performAction(account.id, { action: 'star', target: 'octo/repo,other/repo', confirmed: true }), /一个明确目标/);
  assert.deepEqual(await service.performAction(account.id, { action: 'star', target: 'octo/repo', confirmed: true }), {
    action: 'star', target: 'octo/repo'
  });

  await service.disconnect(account.id, true);
  assert.equal((await service.listAccounts()).length, 0);
  assert.equal(await vault.has(account.id), false);
});

test('GitHub 次级限流会阻止后续写请求', async (context) => {
  const { store } = await createStore(context);
  const vault = new MemoryCredentialVault();
  const account = await store.upsertGithubAccount({
    login: 'owner', mailboxId: store.listPublic()[0].id, connectedAt: new Date().toISOString()
  });
  await vault.set(account.id, 'test-value');
  let now = 1000;
  const service = new GitHubService(store, {
    vault,
    client: {
      async star() {
        throw new GitHubApiError('secondary rate limit', { status: 403, secondaryRateLimit: true });
      }
    },
    clientId: 'client-id',
    actionIntervalMs: 0,
    now: () => now
  });

  await assert.rejects(
    () => service.performAction(account.id, { action: 'star', target: 'octo/repo', confirmed: true }),
    /secondary rate limit/
  );
  now += 1000;
  await assert.rejects(
    () => service.performAction(account.id, { action: 'star', target: 'octo/repo', confirmed: true }),
    /59 秒后重试/
  );
});

test('GitHub 本地 API 不返回 token，并把写操作交给受控服务', async (context) => {
  const { store } = await createStore(context);
  const calls = [];
  const accountId = '11111111-1111-4111-8111-111111111111';
  const githubService = {
    configuration() {
      return { configured: true, policy: 'single action' };
    },
    async setConfiguration(body) {
      calls.push({ config: body });
      return { configured: true, clientId: body.clientId };
    },
    async listAccounts() {
      return [{ id: accountId, login: 'owner', connected: true }];
    },
    async performAction(id, body) {
      calls.push({ id, body });
      return { action: body.action, target: body.target };
    },
    async disconnect() {
      return { ok: true };
    },
    authorizationStatus() {
      return { status: 'waiting' };
    }
  };
  const app = await createApp({
    store,
    githubService,
    pollerOptions: { fetchMailbox: async () => [] }
  });
  const address = await app.start(0);
  context.after(() => app.stop());
  const base = `http://127.0.0.1:${address.port}`;

  const accounts = await fetch(`${base}/api/github/accounts`).then((response) => response.json());
  assert.equal(accounts.accounts[0].login, 'owner');
  assert.doesNotMatch(JSON.stringify(accounts), /secret|token/i);

  const config = await fetch(`${base}/api/github/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: 'Ov23li1234567890abcd' })
  }).then((response) => response.json());
  assert.equal(config.clientId, 'Ov23li1234567890abcd');

  const result = await fetch(`${base}/api/github/accounts/${accountId}/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'star', target: 'octo/repo', confirmed: true })
  }).then((response) => response.json());
  assert.deepEqual(result, { action: 'star', target: 'octo/repo' });
  assert.deepEqual(calls[1], {
    id: accountId,
    body: { action: 'star', target: 'octo/repo', confirmed: true }
  });
});
