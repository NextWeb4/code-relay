'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { fetchMailbox, parseResponse, redactUrl } = require('../src/providers');

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

test('解析常见 JSON 邮件结构', () => {
  const messages = parseResponse(JSON.stringify({ data: { messages: [
    { subject: '登录提醒', content: '验证码：884211', sender: 'service@example.com' }
  ] } }), 'application/json');
  assert.equal(messages.length, 1);
  assert.equal(messages[0].subject, '登录提醒');
  assert.match(messages[0].text, /884211/);
});

test('接口状态 message 不会遮蔽 data 中的邮件，并识别重复 No Mails HTML', () => {
  const messages = parseResponse(JSON.stringify({
    message: 'success',
    data: [{ subject: '安全验证', body: '动态码：551920' }]
  }), 'application/json');
  assert.equal(messages.length, 1);
  assert.match(messages[0].text, /551920/);
  assert.deepEqual(parseResponse('<title>No Mails</title><body>No Mails</body>', 'text/html'), []);
});

test('HTML 邮件页解析收件邮箱、元数据和 srcdoc 正文', () => {
  const html = `<!doctype html><html><head><title>安全验证</title></head><body>
    <div><strong>邮箱:</strong>buyer@example.com</div>
    <div><strong>时间:</strong>Sat, 11 Jul 2026 23:37:38 +0800 (CST)</div>
    <div><strong>发件人:</strong>账户中心 &lt;service@example.com&gt;</div>
    <iframe srcdoc="&lt;p&gt;您好，验证码是478277。&lt;/p&gt;"></iframe>
  </body></html>`;
  const messages = parseResponse(html, 'text/html; charset=utf-8');
  assert.equal(messages.length, 1);
  assert.equal(messages[0].recipient, 'buyer@example.com');
  assert.equal(messages[0].subject, '安全验证');
  assert.match(messages[0].text, /验证码是478277/);
});

test('token 地址展示时会脱敏', () => {
  const value = redactUrl('https://example.com/api?token=abcdefghijklmnop&view=1');
  assert.doesNotMatch(value, /abcdefghijklmnop/);
  assert.match(value, /mnop/);
});

test('自动发现门户脚本中的 POST 取信接口', async (context) => {
  const server = http.createServer((request, response) => {
    if (request.url === '/') {
      response.setHeader('Content-Type', 'text/html');
      return response.end('<form><input name="email"></form><script src="/app.js"></script>');
    }
    if (request.url === '/app.js') {
      response.setHeader('Content-Type', 'text/javascript');
      return response.end("fetch('/api/customer/query', { method: 'POST' })");
    }
    if (request.url === '/api/customer/query' && request.method === 'POST') {
      response.setHeader('Content-Type', 'application/json');
      return response.end(JSON.stringify({ messages: [{ subject: 'OTP', text: '验证码：739201' }] }));
    }
    response.statusCode = 404;
    response.end();
  });
  const port = await listen(server);
  context.after(() => close(server));
  const messages = await fetchMailbox({
    email: 'test@example.com',
    sourceUrl: `http://127.0.0.1:${port}/`,
    provider: 'portal'
  }, { allowPrivateHosts: true });
  assert.equal(messages[0].subject, 'OTP');
  assert.match(messages[0].text, /739201/);
});
