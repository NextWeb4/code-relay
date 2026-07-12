'use strict';

const EventEmitter = require('node:events');
const { extractCodes, htmlToText } = require('./code-extractor');
const { fetchMailbox } = require('./providers');

class Poller extends EventEmitter {
  constructor(store, options = {}) {
    super();
    this.store = store;
    this.fetchOptions = options.fetchOptions || {};
    this.fetchMailbox = options.fetchMailbox || fetchMailbox;
    this.maxConcurrent = options.maxConcurrent || 4;
    this.running = new Set();
    this.inFlight = new Map();
    this.timer = null;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 1000);
    this.timer.unref();
    this.tick();
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  async tick() {
    const now = Date.now();
    const due = this.store.state.mailboxes.filter((mailbox) =>
      mailbox.enabled && (mailbox.pollMode === 'repeat' || !mailbox.usedOneShot) &&
      !this.running.has(mailbox.id) && (mailbox.nextPollAt || 0) <= now
    );
    const capacity = Math.max(0, this.maxConcurrent - this.running.size);
    await Promise.allSettled(due.slice(0, capacity).map((mailbox) => this.refresh(mailbox.id)));
  }

  async setAllAuto(enabled) {
    let changed = 0;
    let eligible = 0;
    for (const mailbox of this.store.state.mailboxes) {
      const canAutoFetch = mailbox.pollMode === 'repeat' || !mailbox.usedOneShot;
      if (!canAutoFetch) continue;
      eligible += 1;
      if (mailbox.enabled !== enabled) changed += 1;
      mailbox.enabled = enabled;
      if (enabled) mailbox.nextPollAt = Date.now();
    }
    await this.store.save();
    this.emit('update');
    if (enabled) this.tick();
    return { enabled, changed, eligible };
  }

  async refreshAll() {
    const mailboxes = this.store.state.mailboxes;
    const candidates = mailboxes.filter((mailbox) =>
      mailbox.pollMode === 'repeat' || !mailbox.usedOneShot
    );
    const results = [];
    let cursor = 0;
    const worker = async () => {
      while (cursor < candidates.length) {
        const mailbox = candidates[cursor++];
        try {
          await this.refresh(mailbox.id);
          results.push({ id: mailbox.id, status: 'fulfilled' });
        } catch (error) {
          results.push({ id: mailbox.id, status: 'rejected', reason: error.message });
        }
      }
    };
    await Promise.all(Array.from(
      { length: Math.min(this.maxConcurrent, candidates.length) },
      () => worker()
    ));
    return {
      refreshed: results.filter((item) => item.status === 'fulfilled').length,
      failed: results.filter((item) => item.status === 'rejected').length,
      skipped: mailboxes.length - candidates.length,
      results
    };
  }

  refresh(id) {
    if (this.inFlight.has(id)) return this.inFlight.get(id);
    const operation = this.performRefresh(id);
    this.inFlight.set(id, operation);
    operation.then(
      () => this.inFlight.delete(id),
      () => this.inFlight.delete(id)
    );
    return operation;
  }

  async performRefresh(id) {
    const mailbox = this.store.get(id);
    if (!mailbox) throw new Error('邮箱不存在');
    if (mailbox.pollMode === 'one-shot' && mailbox.usedOneShot) {
      throw new Error('该取信网站限制同一邮箱只能查询一次，已停止重复请求');
    }

    this.running.add(id);
    mailbox.status = 'checking';
    mailbox.lastError = '';
    this.emit('update');
    await this.store.save();

    try {
      const messages = await this.fetchMailbox(mailbox, {
        ...this.fetchOptions,
        onConsume: async () => {
          mailbox.usedOneShot = true;
          mailbox.enabled = false;
          await this.store.save();
          this.emit('update');
        }
      });
      const addressedMessages = messages.filter((message) => {
        const addresses = String(message.recipient || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
        return addresses.length === 0 || addresses.some((address) => address.toLowerCase() === mailbox.email.toLowerCase());
      });
      if (messages.some((message) => message.recipient) && addressedMessages.length === 0) {
        throw new Error('取信响应中的收件邮箱与当前账户不一致，已拒绝显示验证码');
      }
      addressedMessages.sort((left, right) => {
        const leftTime = Date.parse(left.date || '') || 0;
        const rightTime = Date.parse(right.date || '') || 0;
        return rightTime - leftTime;
      });
      const found = [];
      for (const message of addressedMessages) {
        const content = `${message.subject || ''}\n${message.text || ''}\n${message.html || ''}`;
        for (const candidate of extractCodes(content)) {
          found.push({ ...candidate, subject: message.subject || '邮件消息', date: message.date || null });
        }
      }

      const known = new Set((mailbox.codes || []).map((item) => item.code));
      const newCodes = found.filter((item, index) =>
        !known.has(item.code) && found.findIndex((other) => other.code === item.code) === index
      ).map((item) => ({ ...item, receivedAt: new Date().toISOString() }));
      const validHistory = (mailbox.codes || []).filter((item) => Number(item.confidence || 0) >= 0.8);
      mailbox.codes = [...newCodes, ...validHistory]
        .filter((item, index, items) => items.findIndex((other) => other.code === item.code) === index)
        .slice(0, 12);
      mailbox.latestCode = found[0]?.code || '';
      if (newCodes.length) mailbox.newCodeAt = newCodes[0].receivedAt;
      if (!found.length) mailbox.newCodeAt = null;
      mailbox.status = addressedMessages.length ? (found.length ? 'code' : 'mail') : 'empty';
      mailbox.messageCount = addressedMessages.length;
      mailbox.snippet = addressedMessages[0]
        ? htmlToText(`${addressedMessages[0].subject || ''} ${addressedMessages[0].text || ''}`).slice(0, 140)
        : '暂未收到邮件';
      mailbox.lastChecked = new Date().toISOString();
      mailbox.lastError = '';
      mailbox.nextPollAt = Date.now() + mailbox.intervalSec * 1000;
      await this.store.save();
      this.emit('update', { id, newCodes });
      return { mailbox, newCodes };
    } catch (error) {
      mailbox.status = 'error';
      mailbox.lastError = error.message || '取信失败';
      mailbox.lastChecked = new Date().toISOString();
      mailbox.nextPollAt = Date.now() + Math.max(15, mailbox.intervalSec) * 1000;
      await this.store.save();
      this.emit('update');
      throw error;
    } finally {
      this.running.delete(id);
    }
  }
}

module.exports = { Poller };
