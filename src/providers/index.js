'use strict';

const { assertSafeUrl } = require('../network-guard');
const { htmlToText, decodeEntities } = require('../code-extractor');

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

function redactUrl(input) {
  try {
    const url = new URL(input);
    for (const key of url.searchParams.keys()) {
      if (/token|key|auth|secret|access|password/i.test(key)) {
        const value = url.searchParams.get(key) || '';
        url.searchParams.set(key, value.length > 4 ? `••••${value.slice(-4)}` : '••••');
      }
    }
    return url.toString();
  } catch {
    return '无效地址';
  }
}

async function readLimited(response) {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > MAX_RESPONSE_BYTES) throw new Error('取信响应超过 2 MB 限制');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error('取信响应超过 2 MB 限制');
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

async function guardedFetch(input, init = {}, options = {}) {
  const url = await assertSafeUrl(input, options);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 12000);
  try {
    const response = await fetch(url, {
      ...init,
      redirect: 'error',
      signal: controller.signal,
      headers: {
        'User-Agent': 'MailCodeDesk/1.0 (local mailbox reader)',
        Accept: 'application/json, text/html;q=0.9, text/plain;q=0.8',
        ...(init.headers || {})
      }
    });
    const body = await readLimited(response);
    if (!response.ok) throw new Error(`取信服务返回 HTTP ${response.status}`);
    return { body, contentType: response.headers.get('content-type') || '', url: url.href };
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('取信请求超时');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function objectToMessage(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value.html ?? value.text ?? value.body ?? value.content ?? '';
  const subject = value.subject ?? value.title ?? value.name ?? '邮件消息';
  if (!body && !value.code && !value.verificationCode) return null;
  const extraCode = value.code ?? value.verificationCode ?? value.otp ?? '';
  return {
    subject: String(subject),
    from: String(value.from ?? value.sender ?? ''),
    date: value.date ?? value.time ?? value.createdAt ?? value.timestamp ?? null,
    recipient: String(value.to ?? value.recipient ?? value.email ?? value.mailbox ?? ''),
    text: `${htmlToText(String(body))}${extraCode ? `\n验证码：${extraCode}` : ''}`,
    html: typeof value.html === 'string' ? value.html : ''
  };
}

function collectMessageObjects(value, depth = 0, visited = new Set()) {
  if (depth > 5 || value == null || typeof value !== 'object' || visited.has(value)) return [];
  visited.add(value);
  if (Array.isArray(value)) return value.flatMap((item) => collectMessageObjects(item, depth + 1, visited));
  const own = objectToMessage(value);
  if (own) return [own];
  const preferred = ['messages', 'mails', 'emails', 'data', 'list', 'items', 'result'];
  for (const key of preferred) {
    if (key in value) {
      const found = collectMessageObjects(value[key], depth + 1, visited);
      if (found.length) return found;
    }
  }
  return Object.values(value).flatMap((item) => collectMessageObjects(item, depth + 1, visited));
}

function parseResponse(body, contentType = '') {
  const source = String(body || '').trim();
  const plainText = htmlToText(source);
  if (!source || /^(?:(?:no mails?|暂无邮件|没有邮件)\s*)+$/i.test(plainText)) return [];
  if (/json/i.test(contentType) || /^[\[{]/.test(source)) {
    try {
      return collectMessageObjects(JSON.parse(source));
    } catch {
      if (/json/i.test(contentType)) throw new Error('取信接口返回了无效 JSON');
    }
  }
  const recipient = source.match(/<strong>\s*邮箱\s*[:：]?\s*<\/strong>\s*([^<]+)/i)?.[1] || '';
  const sender = source.match(/<strong>\s*发件人\s*[:：]?\s*<\/strong>\s*([^<]+)/i)?.[1] || '';
  const date = source.match(/<strong>\s*时间\s*[:：]?\s*<\/strong>\s*([^<]+)/i)?.[1] || null;
  return [{
    subject: (source.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '邮件消息').trim(),
    from: decodeEntities(sender).trim(),
    date: date ? decodeEntities(date).trim() : null,
    recipient: decodeEntities(recipient).trim(),
    text: plainText,
    html: ''
  }];
}

function findScriptSources(html, baseUrl) {
  return [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => new URL(match[1], baseUrl).href)
    .slice(0, 5);
}

function discoverPostEndpoint(script, baseUrl) {
  const fetchMatch = script.match(/fetch\s*\(\s*["'`]([^"'`]+)["'`]/i);
  if (!fetchMatch) return null;
  return new URL(fetchMatch[1], baseUrl).href;
}

async function fetchPortal(mailbox, options) {
  const landing = await guardedFetch(mailbox.sourceUrl, {}, options);
  const scripts = findScriptSources(landing.body, landing.url);
  let endpoint = null;
  for (const scriptUrl of scripts) {
    const script = await guardedFetch(scriptUrl, {}, options);
    endpoint = discoverPostEndpoint(script.body, landing.url);
    if (endpoint) break;
  }
  if (!endpoint) throw new Error('无法自动识别该网站的取信接口，需要新增站点适配器');
  if (typeof options.onConsume === 'function') await options.onConsume();
  const result = await guardedFetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: mailbox.email })
  }, options);
  return parseResponse(result.body, result.contentType);
}

async function fetchMailbox(mailbox, options = {}) {
  if (mailbox.provider === 'portal') return fetchPortal(mailbox, options);
  const response = await guardedFetch(mailbox.sourceUrl, {}, options);
  return parseResponse(response.body, response.contentType);
}

module.exports = {
  fetchMailbox,
  parseResponse,
  collectMessageObjects,
  discoverPostEndpoint,
  redactUrl
};
