'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs').promises;
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../src/server');

test('导入 API 可新增邮箱、去重并且不向前端泄露完整 token', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'code-relay-'));
  const dataFile = path.join(directory, 'mailboxes.json');
  const app = await createApp({ dataFile, pollerOptions: { fetchMailbox: async () => [] } });
  const address = await app.start(0);
  context.after(async () => {
    await app.stop();
    await fs.rm(directory, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${address.port}`;
  const text = 'demo@example.com----https://mail.example.com/api?token=abcdefghijklmnop';

  const imported = await fetch(`${base}/api/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  }).then((response) => response.json());
  assert.equal(imported.added.length, 1);

  const duplicate = await fetch(`${base}/api/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  }).then((response) => response.json());
  assert.equal(duplicate.added.length, 0);
  assert.equal(duplicate.duplicate.length, 1);

  const state = await fetch(`${base}/api/state`).then((response) => response.json());
  assert.equal(state.mailboxes.length, 1);
  assert.doesNotMatch(JSON.stringify(state), /abcdefghijklmnop/);
  assert.match(state.mailboxes[0].sourceUrl, /mnop/);

  const replacement = await fetch(`${base}/api/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'demo@example.com----https://mail.example.com/api?token=replacement-token' })
  }).then((response) => response.json());
  assert.equal(replacement.added.length, 0);
  assert.equal(replacement.updated.length, 1);
  const replacedState = await fetch(`${base}/api/state`).then((response) => response.json());
  assert.equal(replacedState.mailboxes.length, 1);
  assert.match(replacedState.mailboxes[0].sourceUrl, /oken/);

  const paused = await fetch(`${base}/api/auto-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: false })
  }).then((response) => response.json());
  assert.equal(paused.enabled, false);

  const enabled = await fetch(`${base}/api/auto-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: true })
  }).then((response) => response.json());
  assert.equal(enabled.eligible, 1);

  const refreshed = await fetch(`${base}/api/refresh-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  }).then((response) => response.json());
  assert.equal(refreshed.refreshed, 1);
  assert.equal(refreshed.failed, 0);
  assert.equal(refreshed.skipped, 0);

  const shutdown = await fetch(`${base}/api/shutdown`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  }).then((response) => response.json());
  assert.equal(shutdown.ok, true);
  await new Promise((resolve) => setTimeout(resolve, 180));
  assert.equal(app.server.listening, false);
});
