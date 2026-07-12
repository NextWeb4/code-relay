'use strict';

const API_VERSION = '2026-03-10';
const OWNER_REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const USERNAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

class GitHubApiError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'GitHubApiError';
    Object.assign(this, details);
  }
}

function parseRepository(target) {
  const value = String(target || '').trim();
  if (!OWNER_REPO_PATTERN.test(value)) throw new Error('仓库目标必须是 owner/repo');
  const [owner, repo] = value.split('/');
  if (!owner || !repo || owner.length > 100 || repo.length > 100) throw new Error('仓库目标无效');
  return { owner, repo, target: `${owner}/${repo}` };
}

function parseUsername(target) {
  const username = String(target || '').trim();
  if (!USERNAME_PATTERN.test(username)) throw new Error('GitHub 用户名格式无效');
  return username;
}

function sanitizedUser(data) {
  return {
    login: data.login,
    name: data.name || '',
    avatarUrl: data.avatar_url || '',
    htmlUrl: data.html_url || `https://github.com/${data.login}`
  };
}

class GitHubClient {
  constructor(options = {}) {
    this.requestImpl = options.requestImpl || null;
    this.requestPromise = null;
  }

  async getRequest() {
    if (this.requestImpl) return this.requestImpl;
    if (!this.requestPromise) this.requestPromise = import('@octokit/request').then((module) => module.request);
    return this.requestPromise;
  }

  async call(token, route, parameters = {}) {
    if (!token) throw new GitHubApiError('GitHub 账号需要重新授权', { status: 401 });
    const request = await this.getRequest();
    try {
      const response = await request(route, {
        ...parameters,
        headers: {
          authorization: `Bearer ${token}`,
          accept: 'application/vnd.github+json',
          'x-github-api-version': API_VERSION,
          ...(parameters.headers || {})
        }
      });
      return response;
    } catch (error) {
      const headers = error.response?.headers || {};
      const status = Number(error.status || error.response?.status || 0);
      const retryAfter = Number(headers['retry-after'] || 0);
      const rateReset = Number(headers['x-ratelimit-reset'] || 0);
      const apiMessage = error.response?.data?.message || error.message || 'GitHub API 请求失败';
      throw new GitHubApiError(apiMessage, {
        status,
        retryAfter: Number.isFinite(retryAfter) ? retryAfter : 0,
        rateRemaining: headers['x-ratelimit-remaining'],
        rateReset: Number.isFinite(rateReset) ? rateReset : 0,
        secondaryRateLimit: status === 403 && /secondary rate limit/i.test(apiMessage)
      });
    }
  }

  async getAuthenticatedUser(token) {
    const response = await this.call(token, 'GET /user');
    return sanitizedUser(response.data);
  }

  async star(token, target) {
    const repository = parseRepository(target);
    await this.call(token, 'PUT /user/starred/{owner}/{repo}', repository);
    return { action: 'star', target: repository.target };
  }

  async watch(token, target) {
    const repository = parseRepository(target);
    await this.call(token, 'PUT /repos/{owner}/{repo}/subscription', {
      ...repository,
      subscribed: true,
      ignored: false
    });
    return { action: 'watch', target: repository.target };
  }

  async fork(token, target) {
    const repository = parseRepository(target);
    const response = await this.call(token, 'POST /repos/{owner}/{repo}/forks', repository);
    return {
      action: 'fork',
      target: repository.target,
      created: response.data?.full_name || repository.target,
      htmlUrl: response.data?.html_url || ''
    };
  }

  async follow(token, target) {
    const username = parseUsername(target);
    await this.call(token, 'PUT /user/following/{username}', { username });
    return { action: 'follow', target: username };
  }
}

module.exports = { API_VERSION, GitHubApiError, GitHubClient, parseRepository, parseUsername };
