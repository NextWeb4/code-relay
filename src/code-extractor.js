'use strict';

function decodeEntities(text) {
  const entities = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' '
  };
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity) => {
    if (entity[0] === '#') {
      const radix = entity[1].toLowerCase() === 'x' ? 16 : 10;
      const value = parseInt(entity.slice(radix === 16 ? 2 : 1), radix);
      return Number.isFinite(value) ? String.fromCodePoint(value) : '';
    }
    return entities[entity.toLowerCase()] ?? '';
  });
}

function expandEmbeddedHtml(html) {
  let expanded = String(html || '');
  for (let depth = 0; depth < 3; depth += 1) {
    const next = expanded.replace(
      /<iframe\b[^>]*\bsrcdoc\s*=\s*(["'])([\s\S]*?)\1[^>]*>(?:[\s\S]*?<\/iframe>)?/gi,
      (_, quote, srcdoc) => `\n${decodeEntities(srcdoc)}\n`
    );
    if (next === expanded) break;
    expanded = next;
  }
  return expanded;
}

function htmlToText(html) {
  return decodeEntities(expandEmbeddedHtml(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>|<\/div>|<\/li>|<\/tr>|<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim());
}

const COMMON_WORD_CODES = new Set([
  'YOUR', 'THIS', 'THAT', 'CODE', 'MAIL', 'EMAIL', 'GITHUB', 'LAUNCH',
  'LOGIN', 'SIGN', 'VERIFY', 'ACCOUNT', 'SECURITY', 'PLEASE', 'ENTER',
  'OPEN', 'LINK', 'COPY', 'FROM', 'WITH', 'CONTINUE'
]);

function normalizeCode(value) {
  return String(value || '').toUpperCase().replace(/\s+/g, '');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function addCandidate(bucket, value, confidence, context) {
  const code = normalizeCode(value);
  if (!/^[A-Z0-9]{4,8}(?:-[A-Z0-9]{4,8})?$/.test(code)) return;
  if (COMMON_WORD_CODES.has(code)) return;
  if (new RegExp(`${escapeRegExp(code)}(?=@)`, 'i').test(String(context || ''))) return;
  if (/^[A-Z]{4,8}$/.test(code) && confidence < 0.9) return;
  if (/^\d{4}$/.test(code) && Number(code) >= 1900 && Number(code) <= 2099 && confidence < 0.9) return;
  const previous = bucket.get(code);
  if (!previous || previous.confidence < confidence) {
    bucket.set(code, { code, confidence, context: String(context || '').trim().slice(0, 100) });
  }
}

function extractCodes(input) {
  const text = htmlToText(input);
  const candidates = new Map();
  const candidate = '([A-Z0-9]{4,8}(?:-[A-Z0-9]{4,8})?)(?![A-Z0-9-])';
  const launchCodePattern = new RegExp(
    `(?:github\\s+)?launch\\s+code[^A-Z0-9]{0,16}(\\d{4,8})(?![A-Z0-9-])`,
    'giu'
  );
  const strongKeywordPattern = new RegExp(
    `(?:验证码|校验码|动态码|授权码|安全码|提取码|otp|verification\\s*code|security\\s*code)[^A-Z0-9]{0,16}${candidate}`,
    'giu'
  );
  const genericCodePattern = new RegExp(
    `\\bcode\\b\\s*(?:is|为|是|:|：|=|-|–|—)\\s*${candidate}`,
    'giu'
  );
  const reversePattern = new RegExp(
    `\\b${candidate}\\b[^A-Z0-9\\u4e00-\\u9fff]{0,10}(?:是(?:您的)?|为(?:您的)?|:|：)?\\s*(?:验证码|校验码|动态码|otp|verification\\s*code|security\\s*code|code)`,
    'giu'
  );

  for (const match of text.matchAll(launchCodePattern)) {
    addCandidate(candidates, match[1], 1, text.slice(Math.max(0, match.index - 24), match.index + match[0].length + 24));
  }
  for (const match of text.matchAll(strongKeywordPattern)) {
    addCandidate(candidates, match[1], 1, text.slice(Math.max(0, match.index - 24), match.index + match[0].length + 24));
  }
  for (const match of text.matchAll(genericCodePattern)) {
    addCandidate(candidates, match[1], 0.98, text.slice(Math.max(0, match.index - 24), match.index + match[0].length + 24));
  }
  for (const match of text.matchAll(reversePattern)) {
    addCandidate(candidates, match[1], 0.96, text.slice(Math.max(0, match.index - 24), match.index + match[0].length + 24));
  }

  if (candidates.size === 0) {
    for (const match of text.matchAll(/(?:^|[^A-Z0-9])(\d{4,8})(?![A-Z0-9])/g)) {
      const valueIndex = match.index + match[0].lastIndexOf(match[1]);
      const previousCharacter = text[valueIndex - 1] || '';
      if (/[:+\-/]/.test(previousCharacter)) continue;
      const context = text.slice(Math.max(0, match.index - 20), match.index + match[0].length + 20);
      if (/订单|手机号|电话|时间|日期|金额|价格|\b(?:GMT|UTC|CST)\b|https?:\/\//i.test(context)) continue;
      addCandidate(candidates, match[1], 0.55, context);
    }
  }

  return [...candidates.values()].sort((a, b) => b.confidence - a.confidence);
}

module.exports = { extractCodes, htmlToText, decodeEntities, expandEmbeddedHtml };
