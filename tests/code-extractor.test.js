'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { extractCodes, htmlToText } = require('../src/code-extractor');

test('优先提取验证码上下文中的数字或字母数字组合', () => {
  const codes = extractCodes('<p>您的登录验证码：<strong>A7K29Q</strong>，5 分钟内有效。</p>');
  assert.equal(codes[0].code, 'A7K29Q');
  assert.equal(codes[0].confidence, 1);
});

test('避免把年份和订单号当成无上下文验证码', () => {
  const codes = extractCodes('订单号 9080706050，日期 2026 年 7 月 12 日。');
  assert.deepEqual(codes, []);
});

test('HTML 转文本会移除脚本并解码实体', () => {
  assert.equal(htmlToText('<div>Hello&nbsp;世界</div><script>alert(1)</script>'), 'Hello 世界');
});

test('读取 iframe srcdoc 中的真实正文并排除时区数字', () => {
  const html = `
    <div><strong>时间:</strong>Sat, 11 Jul 2026 23:37:38 +0800 (CST)</div>
    <iframe srcdoc="&lt;div&gt;您的验证码是478277，30分钟内有效。&lt;/div&gt;"></iframe>`;
  const text = htmlToText(html);
  assert.match(text, /验证码是478277/);
  assert.deepEqual(extractCodes(text).map((item) => item.code), ['478277']);
});

test('没有验证码语义时不会把 +0800 当成验证码', () => {
  assert.deepEqual(extractCodes('时间: Sat, 11 Jul 2026 23:37:38 +0800 (CST)'), []);
});

test('GitHub launch code 邮件标题重复时不会把 YOUR 当成验证码', () => {
  const codes = extractCodes('Your GitHub launch code\nYour GitHub launch code\n386113');
  assert.equal(codes[0].code, '386113');
  assert.deepEqual(codes.map((item) => item.code), ['386113']);
});

test('GitHub launch code 摘要里出现邮箱时不会截取邮箱账号当验证码', () => {
  assert.deepEqual(extractCodes('Your GitHub launch code 邮箱: 3865339216@qq.com'), []);
  assert.deepEqual(extractCodes('Your GitHub launch code\n邮箱: 12345678@qq.com'), []);
});

test('GitHub launch code 邮件不会把 CONTINUE 按钮当成验证码', () => {
  const summary = 'Your GitHub launch code\nYour GitHub launch code\nCONTINUE\n邮箱: 3953789080@qq.com';
  assert.deepEqual(extractCodes(summary), []);
  assert.equal(extractCodes(`${summary}\n386113`)[0].code, '386113');
});

test('支持英文 code is 语义和带连字符的验证码', () => {
  assert.equal(extractCodes('Your code is 123456')[0].code, '123456');
  assert.equal(extractCodes('verification code: ABCD-EFGH')[0].code, 'ABCD-EFGH');
});
