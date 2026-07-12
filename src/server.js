'use strict';

const http = require('node:http');
const fs = require('node:fs').promises;
const path = require('node:path');
const { spawn } = require('node:child_process');
const { Store } = require('./store');
const { Poller } = require('./poller');
const { parseImport } = require('./parser');
const { GitHubService } = require('./github/service');

const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const APP_NAME = 'Code Relay';
const DATA_FILE = defaultDataFile();

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(JSON.stringify(payload));
}

function defaultDataFile() {
  if (process.env.DATA_FILE) return process.env.DATA_FILE;
  if (process.pkg) {
    const baseDir = process.env.LOCALAPPDATA || path.dirname(process.execPath);
    return path.join(baseDir, APP_NAME, 'mailboxes.json');
  }
  return path.resolve(__dirname, '..', 'data', 'mailboxes.json');
}

function openBrowser(url) {
  if (process.env.CODE_RELAY_OPEN_BROWSER === '0') return;
  const shouldOpen = process.env.CODE_RELAY_OPEN_BROWSER === '1' || Boolean(process.pkg);
  if (!shouldOpen) return;
  const commands = {
    win32: ['cmd', ['/c', 'start', '', url]],
    darwin: ['open', [url]],
    linux: ['xdg-open', [url]]
  };
  const command = commands[process.platform];
  if (!command) return;
  const child = spawn(command[0], command[1], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });
  child.unref();
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new Error('请求内容不能超过 1 MB');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw new Error('请求 JSON 格式无效');
  }
}

function statePayload(store) {
  const mailboxes = store.listPublic();
  const autoEligible = mailboxes.filter((item) => item.pollMode === 'repeat' || !item.usedOneShot);
  return {
    mailboxes,
    summary: {
      total: mailboxes.length,
      active: mailboxes.filter((item) => item.enabled).length,
      autoEligible: autoEligible.length,
      autoEnabled: autoEligible.filter((item) => item.enabled).length,
      withCode: mailboxes.filter((item) => item.latestCode).length,
      errors: mailboxes.filter((item) => item.status === 'error').length
    },
    serverTime: new Date().toISOString()
  };
}

function safeOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
}

async function serveStatic(requestPath, response) {
  const relative = requestPath === '/' ? 'index.html' : requestPath.slice(1);
  const filePath = path.resolve(PUBLIC_DIR, relative);
  if (!filePath.startsWith(`${PUBLIC_DIR}${path.sep}`)) return false;
  try {
    const content = await fs.readFile(filePath);
    response.writeHead(200, {
      'Content-Type': CONTENT_TYPES[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'"
    });
    response.end(content);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function createApp(options = {}) {
  const store = options.store || await new Store(options.dataFile || DATA_FILE).load();
  const poller = options.poller || new Poller(store, options.pollerOptions);
  const githubService = options.githubService || new GitHubService(store, options.githubOptions);
  const eventClients = new Set();
  let server;
  let stopping = false;

  function broadcast() {
    const event = `event: state\ndata: ${JSON.stringify(statePayload(store))}\n\n`;
    for (const client of eventClients) client.write(event);
  }
  poller.on('update', broadcast);

  async function stopApplication() {
    if (stopping) return;
    stopping = true;
    poller.stop();
    for (const client of eventClients) client.end();
    eventClients.clear();
    if (!server?.listening) return;
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeIdleConnections?.();
    });
    if (options.exitOnShutdown) {
      setTimeout(() => process.exit(0), 20);
    }
  }

  server = http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url, 'http://127.0.0.1');
    const method = request.method || 'GET';

    try {
      if (method !== 'GET' && !safeOrigin(request)) {
        return sendJson(response, 403, { error: '拒绝来自外部网页的请求' });
      }

      if (method === 'GET' && requestUrl.pathname === '/api/state') {
        return sendJson(response, 200, statePayload(store));
      }

      if (method === 'GET' && requestUrl.pathname === '/api/github/config') {
        return sendJson(response, 200, githubService.configuration());
      }

      if (method === 'POST' && requestUrl.pathname === '/api/github/config') {
        const body = await readJson(request);
        try {
          return sendJson(response, 200, await githubService.setConfiguration(body));
        } catch (error) {
          return sendJson(response, 400, { error: error.message });
        }
      }

      if (method === 'GET' && requestUrl.pathname === '/api/github/accounts') {
        return sendJson(response, 200, { accounts: await githubService.listAccounts() });
      }

      if (method === 'POST' && requestUrl.pathname === '/api/github/auth/start') {
        const body = await readJson(request);
        try {
          return sendJson(response, 200, await githubService.startAuthorization(body));
        } catch (error) {
          const status = /GITHUB_OAUTH_CLIENT_ID/.test(error.message) ? 503 : 400;
          return sendJson(response, status, { error: error.message });
        }
      }

      const githubAuthMatch = requestUrl.pathname.match(/^\/api\/github\/auth\/([a-f0-9-]+)$/i);
      if (method === 'GET' && githubAuthMatch) {
        try {
          return sendJson(response, 200, githubService.authorizationStatus(githubAuthMatch[1]));
        } catch (error) {
          return sendJson(response, 404, { error: error.message });
        }
      }

      const githubAccountMatch = requestUrl.pathname.match(/^\/api\/github\/accounts\/([a-f0-9-]+)\/(actions|disconnect)$/i);
      if (method === 'POST' && githubAccountMatch) {
        const body = await readJson(request);
        try {
          const result = githubAccountMatch[2] === 'actions'
            ? await githubService.performAction(githubAccountMatch[1], body)
            : await githubService.disconnect(githubAccountMatch[1], body.confirmed);
          return sendJson(response, 200, result);
        } catch (error) {
          const status = error.status === 429 ? 429 : error.status >= 500 ? 502 : 409;
          return sendJson(response, status, { error: error.message });
        }
      }

      if (method === 'GET' && requestUrl.pathname === '/api/events') {
        response.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive'
        });
        response.write(`event: state\ndata: ${JSON.stringify(statePayload(store))}\n\n`);
        eventClients.add(response);
        request.on('close', () => eventClients.delete(response));
        return;
      }

      if (method === 'POST' && requestUrl.pathname === '/api/import') {
        const body = await readJson(request);
        if (typeof body.text !== 'string' || !body.text.trim()) {
          return sendJson(response, 400, { error: '请粘贴需要导入的邮箱文本' });
        }
        const parsed = parseImport(body.text);
        const result = await store.import(parsed.records);
        broadcast();
        return sendJson(response, 200, { ...result, rejected: parsed.rejected, detected: parsed.detected });
      }

      if (method === 'POST' && requestUrl.pathname === '/api/refresh-all') {
        return sendJson(response, 200, await poller.refreshAll());
      }

      if (method === 'POST' && requestUrl.pathname === '/api/auto-all') {
        const body = await readJson(request);
        if (typeof body.enabled !== 'boolean') {
          return sendJson(response, 400, { error: 'enabled 必须是布尔值' });
        }
        return sendJson(response, 200, await poller.setAllAuto(body.enabled));
      }

      if (method === 'POST' && requestUrl.pathname === '/api/shutdown') {
        sendJson(response, 200, { ok: true, message: '服务正在安全关闭' });
        setTimeout(() => stopApplication().catch(() => {}), 120);
        return;
      }

      const mailboxMatch = requestUrl.pathname.match(/^\/api\/mailboxes\/([a-f0-9-]+)(?:\/(refresh))?$/i);
      if (mailboxMatch) {
        const id = mailboxMatch[1];
        if (method === 'POST' && mailboxMatch[2] === 'refresh') {
          try {
            const result = await poller.refresh(id);
            return sendJson(response, 200, { mailbox: store.listPublic().find((item) => item.id === id), newCodes: result.newCodes });
          } catch (error) {
            return sendJson(response, 409, { error: error.message });
          }
        }
        if (method === 'PATCH' && !mailboxMatch[2]) {
          const body = await readJson(request);
          const patch = {};
          if (typeof body.enabled === 'boolean') patch.enabled = body.enabled;
          if (Number.isFinite(body.intervalSec)) patch.intervalSec = Math.max(5, Math.min(3600, Math.round(body.intervalSec)));
          const mailbox = await store.update(id, patch);
          if (!mailbox) return sendJson(response, 404, { error: '邮箱不存在' });
          broadcast();
          return sendJson(response, 200, { mailbox });
        }
        if (method === 'DELETE' && !mailboxMatch[2]) {
          if (!await store.remove(id)) return sendJson(response, 404, { error: '邮箱不存在' });
          broadcast();
          return sendJson(response, 200, { ok: true });
        }
      }

      if (method === 'GET' && await serveStatic(requestUrl.pathname, response)) return;
      sendJson(response, 404, { error: '未找到该地址' });
    } catch (error) {
      sendJson(response, 500, { error: error.message || '服务器内部错误' });
    }
  });

  return {
    server,
    store,
    poller,
    githubService,
    start(port = Number(process.env.PORT || 4173), host = '127.0.0.1') {
      poller.start();
      return new Promise((resolve) => server.listen(port, host, () => resolve(server.address())));
    },
    async stop() {
      await stopApplication();
    }
  };
}

if (require.main === module) {
  createApp({ exitOnShutdown: true }).then(async (app) => {
    const address = await app.start();
    const url = `http://127.0.0.1:${address.port}/`;
    console.log(`Code Relay 已启动：${url}`);
    openBrowser(url);
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { createApp, statePayload };
