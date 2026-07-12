'use strict';

const dns = require('node:dns').promises;
const net = require('node:net');

function isPrivateIpv4(address) {
  const parts = address.split('.').map(Number);
  return parts[0] === 10 || parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 0 || parts[0] >= 224;
}

function isPrivateAddress(address) {
  const family = net.isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) {
    const normalized = address.toLowerCase();
    return normalized === '::1' || normalized === '::' || normalized.startsWith('fc') ||
      normalized.startsWith('fd') || normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb');
  }
  return true;
}

async function assertSafeUrl(input, options = {}) {
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('仅支持 HTTP/HTTPS 取信地址');
  if (url.username || url.password) throw new Error('取信地址不能包含 URL 用户名或密码');
  if (options.allowPrivateHosts) return url;
  const addresses = net.isIP(url.hostname)
    ? [{ address: url.hostname }]
    : await dns.lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((item) => isPrivateAddress(item.address))) {
    throw new Error('为安全起见，不能访问本机或局域网地址');
  }
  return url;
}

module.exports = { assertSafeUrl, isPrivateAddress };

