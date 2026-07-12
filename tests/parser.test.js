'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseImport } = require('../src/parser');

const sample = `亲爱的 奉孝: 会员您好
您购买的商品已为您发货
【发货内容】
先发邮件到这个邮箱，再登录网站查询：
点击网站自取邮件：http://120.26.194.241:3100/
qq邮箱:
buyer-one@example.com

buyer-two@example.com----http://115.190.206.67/api.php?token=example-token`;

test('识别网址位于邮箱前后两种格式', () => {
  const result = parseImport(sample);
  assert.equal(result.records.length, 2);
  assert.deepEqual(result.records.map((item) => item.email), [
    'buyer-one@example.com',
    'buyer-two@example.com'
  ]);
  assert.equal(result.records[0].sourceUrl, 'http://120.26.194.241:3100/');
  assert.equal(result.records[0].provider, 'portal');
  assert.equal(result.records[0].pollMode, 'one-shot');
  assert.equal(result.records[1].provider, 'direct');
  assert.equal(result.records[1].pollMode, 'repeat');
});

test('重复记录去重，缺少网址的邮箱会报告拒绝原因', () => {
  const repeated = 'a@example.com https://mail.example.com/api\na@example.com https://mail.example.com/api';
  const result = parseImport(repeated);
  assert.equal(result.records.length, 1);

  const rejected = parseImport('lonely@example.com');
  assert.equal(rejected.records.length, 0);
  assert.equal(rejected.rejected[0].reason, '未找到与邮箱配对的取信网址');
});

test('多行邮箱与 URL 必须优先在各自同一行配对', () => {
  const input = [
    'first@example.com-----http://mail.example/api.php?token=token-one',
    'second@example.com-----http://mail.example/api.php?token=token-two',
    'third@example.com-----http://mail.example/api.php?token=token-three',
    'fourth@example.com-----http://mail.example/api.php?token=token-four'
  ].join('\n');
  const result = parseImport(input);
  assert.equal(result.records.length, 4);
  assert.deepEqual(
    result.records.map((item) => [item.email, new URL(item.sourceUrl).searchParams.get('token')]),
    [
      ['first@example.com', 'token-one'],
      ['second@example.com', 'token-two'],
      ['third@example.com', 'token-three'],
      ['fourth@example.com', 'token-four']
    ]
  );
});
