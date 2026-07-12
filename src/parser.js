'use strict';

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu;
const URL_PATTERN = /https?:\/\/[^\s<>"'，。；、）】]+/giu;

function collectMatches(text, pattern, clean = (value) => value) {
  return [...String(text || '').matchAll(pattern)].map((match) => ({
    value: clean(match[0]),
    start: match.index,
    end: match.index + match[0].length
  }));
}

function cleanUrl(value) {
  return value.replace(/[),.;!?，。；！？）】]+$/u, '');
}

function tokenDistance(left, right) {
  if (left.end <= right.start) return right.start - left.end;
  if (right.end <= left.start) return left.start - right.end;
  return 0;
}

function lineRange(text, index) {
  const start = text.lastIndexOf('\n', Math.max(0, index - 1)) + 1;
  const nextBreak = text.indexOf('\n', index);
  return { start, end: nextBreak === -1 ? text.length : nextBreak };
}

function classifySource(sourceUrl) {
  const url = new URL(sourceUrl);
  const hasCredential = [...url.searchParams.keys()].some((key) =>
    /token|key|auth|secret|access/i.test(key)
  );
  const isLandingPage = (url.pathname === '/' || url.pathname === '') && !url.search;
  return {
    provider: isLandingPage ? 'portal' : 'direct',
    pollMode: isLandingPage ? 'one-shot' : 'repeat',
    hasCredential
  };
}

function parseImport(text) {
  const source = String(text || '');
  const emails = collectMatches(source, EMAIL_PATTERN, (value) => value.toLowerCase());
  const urls = collectMatches(source, URL_PATTERN, cleanUrl);
  const records = [];
  const rejected = [];
  const seen = new Set();

  for (const email of emails) {
    const range = lineRange(source, email.start);
    const sameLineUrls = urls.filter((url) => url.start >= range.start && url.end <= range.end);
    const candidates = sameLineUrls.length ? sameLineUrls : urls;
    const ranked = candidates
      .map((url) => ({ ...url, distance: tokenDistance(email, url) }))
      .sort((a, b) => a.distance - b.distance || a.start - b.start);
    const closest = ranked[0];

    if (!closest) {
      rejected.push({ email: email.value, reason: '未找到与邮箱配对的取信网址' });
      continue;
    }

    try {
      const parsed = new URL(closest.value);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('unsupported protocol');
      const key = `${email.value}\n${parsed.href}`;
      if (seen.has(key)) continue;
      seen.add(key);
      records.push({
        email: email.value,
        sourceUrl: parsed.href,
        ...classifySource(parsed.href)
      });
    } catch {
      rejected.push({ email: email.value, reason: '取信网址无效' });
    }
  }

  return {
    records,
    rejected,
    detected: { emails: emails.length, urls: urls.length }
  };
}

module.exports = { parseImport, classifySource, cleanUrl, lineRange };
