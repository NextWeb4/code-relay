'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Poller } = require('../src/poller');

function createStore(mailbox) {
  return {
    state: { mailboxes: [mailbox] },
    get(id) { return this.state.mailboxes.find((item) => item.id === id); },
    async save() {}
  };
}

test('每次取信都以当前响应更新最新验证码并清理旧的低置信误码', async () => {
  const mailbox = {
    id: 'mailbox-1',
    email: 'buyer@example.com',
    provider: 'direct',
    pollMode: 'repeat',
    enabled: true,
    intervalSec: 10,
    latestCode: '0800',
    codes: [{ code: '0800', confidence: 0.55 }]
  };
  const store = createStore(mailbox);
  const poller = new Poller(store, {
    fetchMailbox: async () => [{
      subject: '账户安全验证',
      recipient: 'buyer@example.com',
      date: '2026-07-12T03:37:38Z',
      text: '您的验证码是478277，30分钟内有效。'
    }]
  });

  await poller.refresh(mailbox.id);
  assert.equal(mailbox.latestCode, '478277');
  assert.deepEqual(mailbox.codes.map((item) => item.code), ['478277']);

  poller.fetchMailbox = async () => [];
  await poller.refresh(mailbox.id);
  assert.equal(mailbox.latestCode, '');
  assert.equal(mailbox.status, 'empty');
});

test('明确属于其他收件人的响应不会串到当前账户', async () => {
  const mailbox = {
    id: 'mailbox-2', email: 'right@example.com', provider: 'direct', pollMode: 'repeat',
    enabled: true, intervalSec: 10, latestCode: '', codes: []
  };
  const poller = new Poller(createStore(mailbox), {
    fetchMailbox: async () => [{ recipient: 'wrong@example.com', text: '验证码：112233' }]
  });
  await assert.rejects(() => poller.refresh(mailbox.id), /收件邮箱与当前账户不一致/);
  assert.equal(mailbox.latestCode, '');
});

test('全部手动刷新会复用正在进行的自动请求而不是跳过账户', async () => {
  const mailbox = {
    id: 'mailbox-3', email: 'buyer@example.com', provider: 'direct', pollMode: 'repeat',
    enabled: true, intervalSec: 10, latestCode: '', codes: []
  };
  let requests = 0;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const poller = new Poller(createStore(mailbox), {
    fetchMailbox: async () => {
      requests += 1;
      await pending;
      return [];
    }
  });
  const automatic = poller.refresh(mailbox.id);
  const manualAll = poller.refreshAll();
  release();
  await automatic;
  const result = await manualAll;
  assert.equal(requests, 1);
  assert.equal(result.refreshed, 1);
  assert.equal(result.skipped, 0);
});
