'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs').promises;
const os = require('node:os');
const path = require('node:path');
const { Store } = require('../src/store');

test('加载旧状态时清理已确认的英文按钮误码', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mail-code-store-'));
  const filePath = path.join(directory, 'mailboxes.json');
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.writeFile(filePath, JSON.stringify({
    version: 2,
    mailboxes: [{
      id: 'mailbox-1',
      latestCode: 'CONTINUE',
      newCodeAt: '2026-07-12T00:00:00.000Z',
      status: 'code',
      messageCount: 1,
      codes: [{ code: 'CONTINUE', confidence: 1 }, { code: '386113', confidence: 1 }]
    }]
  }));

  const store = await new Store(filePath).load();
  assert.equal(store.state.mailboxes[0].latestCode, '');
  assert.equal(store.state.mailboxes[0].newCodeAt, null);
  assert.equal(store.state.mailboxes[0].status, 'mail');
  assert.deepEqual(store.state.mailboxes[0].codes.map((item) => item.code), ['386113']);

  const persisted = JSON.parse(await fs.readFile(filePath, 'utf8'));
  assert.equal(persisted.mailboxes[0].latestCode, '');
});
