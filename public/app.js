'use strict';

const LANGUAGE_STORAGE_KEY = 'codeRelayLanguage';
const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);

const state = {
  mailboxes: [],
  summary: {},
  filter: 'all',
  search: '',
  githubAccounts: [],
  githubConfig: { configured: false },
  language: savedLanguage === 'en' ? 'en' : 'zh'
};
const elements = {
  grid: document.getElementById('mailboxGrid'),
  empty: document.getElementById('emptyState'),
  dialog: document.getElementById('importDialog'),
  importText: document.getElementById('importText'),
  importButton: document.getElementById('importButton'),
  importMessage: document.getElementById('importMessage'),
  search: document.getElementById('searchInput'),
  filters: document.getElementById('filters'),
  toast: document.getElementById('toast'),
  live: document.getElementById('liveIndicator'),
  autoAllButton: document.getElementById('autoAllButton'),
  shutdownScreen: document.getElementById('shutdownScreen'),
  githubGrid: document.getElementById('githubAccountGrid'),
  githubEmpty: document.getElementById('githubEmpty'),
  githubPolicy: document.getElementById('githubPolicy'),
  githubConnectDialog: document.getElementById('githubConnectDialog'),
  githubActionDialog: document.getElementById('githubActionDialog'),
  languageToggle: document.getElementById('languageToggle')
};

const translations = {
  zh: {
    pageTitle: 'Code Relay · 邮箱验证码聚合台',
    brandEyebrow: 'LOCAL SIGNAL CONSOLE · 本地运行',
    liveConnecting: '实时通道连接中',
    liveConnected: '实时通道已连接',
    liveReconnecting: '实时通道重连中',
    refreshAll: '手动刷新全部',
    connectGithub: '连接 GitHub',
    bulkImport: '批量导入',
    shutdown: '关闭服务',
    heroAria: '运行概览',
    heroTitle: '把散落的邮箱，<br><em>汇成一条验证码流。</em>',
    heroLead: '自动识别粘贴文本中的邮箱与取信网址；支持可重复接口实时轮询，单次查询来源由你手动触发。',
    statTotal: '邮箱总数',
    statActive: '自动监听',
    statCodes: '已捕获验证码',
    statErrors: '异常来源',
    searchPlaceholder: '搜索邮箱或来源地址…',
    searchAria: '搜索邮箱',
    filterAria: '状态筛选',
    filterAll: '全部',
    filterCode: '有验证码',
    filterMonitoring: '监听中',
    filterError: '异常',
    lastSync: '最后同步',
    mailboxHeading: '邮箱信号',
    mailboxHint: '页面通过本地实时通道自动更新',
    emptyTitle: '等待第一组邮箱信号',
    emptyLead: '粘贴购买信息、邮箱清单或“邮箱----网址”文本，我们会自动拆分并配对。',
    emptyNoMatchTitle: '没有匹配的邮箱',
    emptyNoMatchLead: '试试清除搜索词或切换到“全部”状态。',
    startImport: '开始批量导入',
    githubHeading: '自有 GitHub 账号',
    githubHint: '逐账号人工授权 · 单目标确认操作 · 凭据保存在系统凭据库',
    githubPolicyTitle: '合规边界',
    githubPolicyText: '不自动注册、不自动提交验证码、不批量或定时制造 star / watch / fork / follow。',
    githubConfigRequired: '需要配置 OAuth',
    githubConfigHelp: '点击“连接 GitHub”，在页面里填写 OAuth Client ID；邮箱取信功能不受影响。',
    githubEmptyTitle: '尚未连接账号',
    githubEmptyLead: '先导入并选择一个邮箱，再通过 GitHub Device Flow 人工授权你的自有账号。',
    connectFirstGithub: '连接第一个账号',
    aboutHeading: '关于 Code Relay',
    aboutHint: '本地运行 · MIT License · 作者信息已固定到发布元数据',
    aboutAuthorLabel: '作者',
    aboutEmailLabel: '邮箱',
    aboutHomepageLabel: '主页',
    importTitle: '批量导入邮箱',
    close: '关闭',
    importLead: '直接粘贴原始购买文本。系统会自动寻找所有邮箱与距离最近的 HTTP/HTTPS 取信地址。',
    rawInput: '原始文本',
    importPlaceholder: '示例：\nname@example.com----https://mail.example.com/api?token=...\n\n也支持网址在邮箱前面的长段落',
    readFiles: '读取 TXT / CSV 文件',
    fileMessage: '可多选，内容会合并到上方',
    fileTooLarge: '文件总大小不能超过 1 MB',
    fileReadDone: '已读取 {count} 个文件',
    fileReadFailed: '文件读取失败，请改为复制粘贴',
    formatRuleTitle: '自动识别规则',
    formatRuleText: '支持网址在邮箱之前或之后 · 自动去重 · token 仅保存在本机',
    cancel: '取消',
    detectImport: '识别并导入',
    githubConnectTitle: '连接 GitHub 账号',
    githubConnectLead: '首次使用先填 OAuth Client ID，再选择用于人工收取 GitHub 邮件的邮箱。授权过程不会创建账号，也不会自动填写验证码。',
    createOauthApp: '去 GitHub 创建 OAuth App →',
    clientIdPlaceholder: '粘贴 GitHub OAuth App 的 Client ID',
    clientIdHelp: '创建后请在 OAuth App 设置中启用 Device Flow。Client ID 不是密码，将仅保存在本机数据文件。',
    linkedMailbox: '关联邮箱',
    openGithubVerify: '打开 GitHub 授权页面 →',
    waitingGithubConfirm: '等待你在 GitHub 页面确认…',
    generateDeviceCode: '生成授权码',
    githubWarning: '每次只执行一个目标。提交即表示你确认这是自有账号的真实、非批量操作。',
    confirmRun: '确认执行',
    shutdownTitle: '服务已安全关闭',
    shutdownLead: '自动取信和本地接口均已停止。关闭此页面即可；再次使用时双击“启动软件.cmd”。',
    defaultNever: '从未',
    statusChecking: '正在取信',
    statusError: '连接异常',
    statusCodeReady: '验证码就绪',
    statusMail: '已有邮件',
    statusEmpty: '暂无邮件',
    statusWaitingManual: '等待手动查询',
    statusWaitingMonitor: '等待监听',
    latestVerificationCode: 'LATEST VERIFICATION CODE',
    copy: '复制',
    noCodeYet: 'NO CODE YET',
    oneShotSource: '单次查询来源',
    repeatSource: '每 {seconds} 秒轮询',
    oneShotRestriction: '该网站限制同一 IP / 邮箱只查询一次',
    waitingNewMail: '等待新邮件与验证码',
    syncedAt: '同步',
    monitoring: '监听中',
    paused: '已暂停',
    oneShot: 'ONE-SHOT',
    queried: '已查询',
    fetchNow: '立即取信',
    delete: '删除',
    autoPause: '暂停全部自动 {enabled}/{eligible}',
    autoStart: '开启全部自动 {enabled}/{eligible}',
    githubAccountFallback: 'GitHub account',
    authorized: '已授权',
    reconnect: '需重连',
    mailboxDeleted: '邮箱已删除',
    copyGithubCode: '复制验证码 {code}',
    noPendingCode: '当前没有待核对验证码',
    actionSuccess: '成功',
    actionFailed: '失败',
    noActionRecord: '尚无操作记录',
    disconnect: '断开',
    needImportMailbox: '请先导入至少一个邮箱',
    pasteMailboxFirst: '请先粘贴邮箱文本。',
    detecting: '正在识别邮箱与取信网址…',
    importDone: '已新增 {added} 个，更新 {updated} 个，跳过 {duplicate} 个重复{rejected}',
    rejectedSuffix: '，{count} 个未配对',
    codeCopied: '验证码已复制',
    fetching: '取信中…',
    refreshCodeDone: '捕获到 {count} 个新验证码',
    refreshNoCode: '取信完成，暂无新验证码',
    confirmDeleteMailbox: '删除 {email}？',
    unknownMailbox: '这个邮箱',
    toggleOn: '已开启自动监听',
    toggleOff: '已暂停自动监听',
    refreshAllDone: '全部取信完成：成功 {refreshed}，失败 {failed}，跳过 {skipped}',
    autoAllOn: '已为 {count} 个账户开启自动取信',
    autoAllOff: '已暂停 {count} 个账户的自动取信',
    needClientId: '请先填写 GitHub OAuth Client ID。',
    requestingDevice: '正在保存 Client ID 并申请一次性设备授权码…',
    authLoaded: '授权完成，正在载入账号…',
    githubConnected: 'GitHub 账号已安全连接',
    githubAuthFailed: 'GitHub 授权失败',
    enterTarget: '请输入一个明确目标。',
    confirmGithubAction: '确认使用当前账号执行 {action}：{target}？',
    runningGithubAction: '正在执行单次 GitHub 操作…',
    githubActionDone: '{action} 已完成：{target}',
    confirmDisconnect: '断开 GitHub 账号 @{login}？系统凭据库中的授权会被删除。',
    githubDisconnected: 'GitHub 账号已断开',
    confirmShutdown: '确认关闭服务？所有自动取信会立即停止。',
    githubUnavailable: 'GitHub 模块不可用：{message}',
    githubActions: {
      star: { title: 'Star 仓库', lead: '为当前账号收藏一个真实需要关注的仓库。', label: '仓库 owner/repo', placeholder: 'octocat/Hello-World' },
      watch: { title: 'Watch 仓库', lead: '订阅一个仓库的 GitHub 通知。', label: '仓库 owner/repo', placeholder: 'octocat/Hello-World' },
      fork: { title: 'Fork 仓库', lead: '把一个仓库 Fork 到当前授权账号。', label: '仓库 owner/repo', placeholder: 'octocat/Hello-World' },
      follow: { title: 'Follow 用户', lead: '关注一个 GitHub 用户。', label: 'GitHub 用户名', placeholder: 'octocat' }
    }
  },
  en: {
    pageTitle: 'Code Relay · Mail Verification Code Console',
    brandEyebrow: 'LOCAL SIGNAL CONSOLE · LOCAL ONLY',
    liveConnecting: 'Connecting live channel',
    liveConnected: 'Live channel connected',
    liveReconnecting: 'Reconnecting live channel',
    refreshAll: 'Refresh All',
    connectGithub: 'Connect GitHub',
    bulkImport: 'Batch Import',
    shutdown: 'Shut Down',
    heroAria: 'Runtime overview',
    heroTitle: 'Turn scattered inboxes<br><em>into one code stream.</em>',
    heroLead: 'Detect mailboxes and retrieval URLs from pasted text, poll repeatable APIs in real time, and trigger one-shot sources manually.',
    statTotal: 'Total mailboxes',
    statActive: 'Auto monitoring',
    statCodes: 'Codes captured',
    statErrors: 'Sources with errors',
    searchPlaceholder: 'Search mailbox or source URL…',
    searchAria: 'Search mailbox',
    filterAria: 'Status filters',
    filterAll: 'All',
    filterCode: 'Has code',
    filterMonitoring: 'Monitoring',
    filterError: 'Error',
    lastSync: 'Last sync',
    mailboxHeading: 'Mailbox Signals',
    mailboxHint: 'The page updates through a local live channel',
    emptyTitle: 'Waiting for the first mailbox signal',
    emptyLead: 'Paste purchase text, mailbox lists, or “mailbox----url” entries. Code Relay will split and pair them.',
    emptyNoMatchTitle: 'No matching mailboxes',
    emptyNoMatchLead: 'Try clearing search or switching back to All.',
    startImport: 'Start Import',
    githubHeading: 'Owned GitHub Accounts',
    githubHint: 'Manual per-account authorization · Confirmed single-target actions · Credentials stay in the system vault',
    githubPolicyTitle: 'Compliance Boundary',
    githubPolicyText: 'No account registration, no automatic code submission, and no bulk or scheduled star / watch / fork / follow.',
    githubConfigRequired: 'OAuth Required',
    githubConfigHelp: 'Click “Connect GitHub” and enter an OAuth Client ID. Mail retrieval still works without it.',
    githubEmptyTitle: 'No accounts connected',
    githubEmptyLead: 'Import a mailbox first, then authorize your owned account through GitHub Device Flow.',
    connectFirstGithub: 'Connect First Account',
    aboutHeading: 'About Code Relay',
    aboutHint: 'Local only · MIT License · Author metadata is fixed for release',
    aboutAuthorLabel: 'Author',
    aboutEmailLabel: 'Email',
    aboutHomepageLabel: 'Homepage',
    importTitle: 'Batch Import Mailboxes',
    close: 'Close',
    importLead: 'Paste raw purchase text. Code Relay finds all mailboxes and the closest HTTP/HTTPS retrieval URLs.',
    rawInput: 'Raw input',
    importPlaceholder: 'Example:\nname@example.com----https://mail.example.com/api?token=...\n\nLong text with the URL before the mailbox is also supported',
    readFiles: 'Read TXT / CSV Files',
    fileMessage: 'Multiple files are allowed; contents are merged above',
    fileTooLarge: 'Total file size must be under 1 MB',
    fileReadDone: 'Read {count} file(s)',
    fileReadFailed: 'Could not read files. Paste the text instead.',
    formatRuleTitle: 'Detection Rules',
    formatRuleText: 'URL before or after mailbox · Automatic dedupe · Tokens stay local',
    cancel: 'Cancel',
    detectImport: 'Detect And Import',
    githubConnectTitle: 'Connect GitHub Account',
    githubConnectLead: 'Enter an OAuth Client ID, then choose the mailbox used for manual GitHub mail checks. Authorization does not create accounts or submit codes.',
    createOauthApp: 'Create OAuth App on GitHub →',
    clientIdPlaceholder: 'Paste the Client ID from your GitHub OAuth App',
    clientIdHelp: 'Enable Device Flow in the OAuth App settings. Client ID is not a password and is saved only in local app data.',
    linkedMailbox: 'Linked mailbox',
    openGithubVerify: 'Open GitHub authorization page →',
    waitingGithubConfirm: 'Waiting for confirmation on GitHub…',
    generateDeviceCode: 'Generate Device Code',
    githubWarning: 'Each submission runs one target only. Submit only when this is a real, non-bulk action from your owned account.',
    confirmRun: 'Confirm Run',
    shutdownTitle: 'Service Closed Safely',
    shutdownLead: 'Automatic retrieval and local APIs have stopped. Close this page; run “启动软件.cmd” again when needed.',
    defaultNever: 'Never',
    statusChecking: 'Checking',
    statusError: 'Connection error',
    statusCodeReady: 'Code ready',
    statusMail: 'Mail received',
    statusEmpty: 'No mail',
    statusWaitingManual: 'Waiting manual check',
    statusWaitingMonitor: 'Waiting monitor',
    latestVerificationCode: 'LATEST VERIFICATION CODE',
    copy: 'Copy',
    noCodeYet: 'NO CODE YET',
    oneShotSource: 'One-shot source',
    repeatSource: 'Every {seconds}s',
    oneShotRestriction: 'This site limits the same IP / mailbox to one query',
    waitingNewMail: 'Waiting for new mail and verification codes',
    syncedAt: 'Synced',
    monitoring: 'Monitoring',
    paused: 'Paused',
    oneShot: 'ONE-SHOT',
    queried: 'Queried',
    fetchNow: 'Fetch Now',
    delete: 'Delete',
    autoPause: 'Pause All Auto {enabled}/{eligible}',
    autoStart: 'Start All Auto {enabled}/{eligible}',
    githubAccountFallback: 'GitHub account',
    authorized: 'Authorized',
    reconnect: 'Reconnect',
    mailboxDeleted: 'Mailbox deleted',
    copyGithubCode: 'Copy code {code}',
    noPendingCode: 'No code to verify right now',
    actionSuccess: 'Success',
    actionFailed: 'Failed',
    noActionRecord: 'No actions yet',
    disconnect: 'Disconnect',
    needImportMailbox: 'Import at least one mailbox first',
    pasteMailboxFirst: 'Paste mailbox text first.',
    detecting: 'Detecting mailboxes and retrieval URLs…',
    importDone: 'Added {added}, updated {updated}, skipped {duplicate} duplicate(s){rejected}',
    rejectedSuffix: ', {count} unpaired',
    codeCopied: 'Code copied',
    fetching: 'Fetching…',
    refreshCodeDone: 'Captured {count} new code(s)',
    refreshNoCode: 'Fetch finished. No new code yet.',
    confirmDeleteMailbox: 'Delete {email}?',
    unknownMailbox: 'this mailbox',
    toggleOn: 'Auto monitoring enabled',
    toggleOff: 'Auto monitoring paused',
    refreshAllDone: 'Refresh complete: {refreshed} ok, {failed} failed, {skipped} skipped',
    autoAllOn: 'Enabled auto retrieval for {count} account(s)',
    autoAllOff: 'Paused auto retrieval for {count} account(s)',
    needClientId: 'Enter the GitHub OAuth Client ID first.',
    requestingDevice: 'Saving Client ID and requesting a one-time device code…',
    authLoaded: 'Authorization complete. Loading account…',
    githubConnected: 'GitHub account connected safely',
    githubAuthFailed: 'GitHub authorization failed',
    enterTarget: 'Enter one explicit target.',
    confirmGithubAction: 'Confirm {action} with the current account: {target}?',
    runningGithubAction: 'Running one confirmed GitHub action…',
    githubActionDone: '{action} completed: {target}',
    confirmDisconnect: 'Disconnect GitHub account @{login}? The token in the system credential vault will be removed.',
    githubDisconnected: 'GitHub account disconnected',
    confirmShutdown: 'Shut down the service? All automatic retrieval will stop immediately.',
    githubUnavailable: 'GitHub module unavailable: {message}',
    githubActions: {
      star: { title: 'Star Repository', lead: 'Star one repository that this account genuinely wants to follow.', label: 'Repository owner/repo', placeholder: 'octocat/Hello-World' },
      watch: { title: 'Watch Repository', lead: 'Subscribe this account to one repository’s GitHub notifications.', label: 'Repository owner/repo', placeholder: 'octocat/Hello-World' },
      fork: { title: 'Fork Repository', lead: 'Fork one repository into the currently authorized account.', label: 'Repository owner/repo', placeholder: 'octocat/Hello-World' },
      follow: { title: 'Follow User', lead: 'Follow one GitHub user from the current account.', label: 'GitHub username', placeholder: 'octocat' }
    }
  }
};

function t(key, params = {}) {
  const parts = key.split('.');
  let value = translations[state.language];
  for (const part of parts) value = value?.[part];
  if (value == null) {
    value = translations.zh;
    for (const part of parts) value = value?.[part];
  }
  const text = String(value ?? key);
  return text.replace(/\{(\w+)\}/g, (_, name) => params[name] ?? '');
}

function githubActionConfig(action) {
  return translations[state.language].githubActions[action] || translations.zh.githubActions[action];
}

function applyLanguage() {
  document.documentElement.lang = state.language === 'zh' ? 'zh-CN' : 'en';
  document.title = t('pageTitle');
  elements.languageToggle.textContent = state.language === 'zh' ? 'EN' : '中文';
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-html]').forEach((node) => {
    node.innerHTML = t(node.dataset.i18nHtml);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((node) => {
    node.setAttribute('aria-label', t(node.dataset.i18nAria));
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function formatTime(value, fallback = t('defaultNever')) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(state.language === 'zh' ? 'zh-CN' : 'en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).format(date);
}

function statusInfo(mailbox) {
  if (mailbox.status === 'checking') return ['checking', t('statusChecking')];
  if (mailbox.status === 'error') return ['error', t('statusError')];
  if (mailbox.latestCode) return ['code', t('statusCodeReady')];
  if (mailbox.status === 'mail') return ['', t('statusMail')];
  if (mailbox.status === 'empty') return ['', t('statusEmpty')];
  return ['', mailbox.pollMode === 'one-shot' ? t('statusWaitingManual') : t('statusWaitingMonitor')];
}

function visibleMailboxes() {
  const query = state.search.trim().toLowerCase();
  return state.mailboxes.filter((mailbox) => {
    const matchesSearch = !query || `${mailbox.email} ${mailbox.sourceHost} ${mailbox.sourceUrl}`.toLowerCase().includes(query);
    const matchesFilter = state.filter === 'all' ||
      (state.filter === 'code' && mailbox.latestCode) ||
      (state.filter === 'monitoring' && mailbox.enabled) ||
      (state.filter === 'error' && mailbox.status === 'error');
    return matchesSearch && matchesFilter;
  });
}

function renderMailbox(mailbox, index) {
  const [statusClass, statusText] = statusInfo(mailbox);
  const cardClass = `${mailbox.latestCode ? ' has-code' : ''}${mailbox.status === 'error' ? ' error' : ''}`;
  const oneShotDone = mailbox.pollMode === 'one-shot' && mailbox.usedOneShot;
  const sourceMode = mailbox.pollMode === 'one-shot' ? t('oneShotSource') : t('repeatSource', { seconds: mailbox.intervalSec });
  const detail = mailbox.lastError || mailbox.snippet || (mailbox.pollMode === 'one-shot'
    ? t('oneShotRestriction')
    : t('waitingNewMail'));
  return `
    <article class="mailbox-card${cardClass}" data-order="${Math.min(index, 8)}" data-id="${mailbox.id}">
      <div class="mailbox-title">
        <span class="provider-icon">@</span>
        <div>
          <h3 title="${escapeHtml(mailbox.email)}">${escapeHtml(mailbox.email)}</h3>
          <p title="${escapeHtml(mailbox.sourceUrl)}">${escapeHtml(mailbox.sourceHost)}</p>
        </div>
        <span class="status-badge ${statusClass}">${statusText}</span>
      </div>
      <div class="code-stage">
        <span>${t('latestVerificationCode')}</span>
        <div class="code-row">
          ${mailbox.latestCode
            ? `<strong class="code-value">${escapeHtml(mailbox.latestCode)}</strong><button class="copy-button" type="button" data-action="copy" data-code="${escapeHtml(mailbox.latestCode)}">${t('copy')}</button>`
            : `<strong class="code-placeholder">${t('noCodeYet')}</strong>`}
        </div>
        <p class="message-snippet${mailbox.lastError ? ' message-error' : ''}" title="${escapeHtml(detail)}">${escapeHtml(detail)}</p>
      </div>
      <div class="mailbox-meta">
        <span>${escapeHtml(sourceMode)}</span>
        <span>${t('syncedAt')} <strong>${formatTime(mailbox.lastChecked)}</strong></span>
      </div>
      <div class="card-actions">
        ${mailbox.pollMode === 'repeat'
          ? `<label class="switch-label"><input type="checkbox" data-action="toggle" ${mailbox.enabled ? 'checked' : ''}><span>${mailbox.enabled ? t('monitoring') : t('paused')}</span></label>`
          : `<span class="switch-label">${t('oneShot')}</span>`}
        <button class="mini-button" type="button" data-action="refresh" ${mailbox.status === 'checking' || oneShotDone ? 'disabled' : ''}>${oneShotDone ? t('queried') : t('fetchNow')}</button>
        <button class="mini-button danger" type="button" data-action="delete">${t('delete')}</button>
      </div>
    </article>`;
}

function renderGithubAccount(account) {
  const mailbox = state.mailboxes.find((item) => item.id === account.mailboxId);
  const latest = account.recentActions?.[0];
  const profileUrl = `https://github.com/${encodeURIComponent(account.login)}`;
  return `
    <article class="github-card" data-github-id="${escapeHtml(account.id)}">
      <div class="github-card-head">
        <span class="github-mark">GH</span>
        <div>
          <a href="${profileUrl}" target="_blank" rel="noopener noreferrer">@${escapeHtml(account.login)}</a>
          <p>${escapeHtml(account.name || t('githubAccountFallback'))}</p>
        </div>
        <span class="status-badge ${account.connected ? 'code' : 'error'}">${account.connected ? t('authorized') : t('reconnect')}</span>
      </div>
      <div class="github-mail-link">
        <span>${t('linkedMailbox')}</span>
        <strong>${escapeHtml(account.mailboxEmail || t('mailboxDeleted'))}</strong>
        ${mailbox?.latestCode
          ? `<button type="button" class="copy-button" data-github-copy="${escapeHtml(mailbox.latestCode)}">${t('copyGithubCode', { code: escapeHtml(mailbox.latestCode) })}</button>`
          : `<small>${t('noPendingCode')}</small>`}
      </div>
      <div class="github-action-grid">
        ${Object.keys(translations.zh.githubActions).map((action) => `<button type="button" data-github-action="${action}" ${account.connected ? '' : 'disabled'}>${githubActionConfig(action).title}</button>`).join('')}
      </div>
      <div class="github-card-foot">
        <span>${latest ? `${escapeHtml(latest.action)} · ${escapeHtml(latest.target)} · ${latest.status === 'success' ? t('actionSuccess') : t('actionFailed')}` : t('noActionRecord')}</span>
        <button type="button" data-github-disconnect>${t('disconnect')}</button>
      </div>
    </article>`;
}

function renderGithub() {
  elements.githubGrid.innerHTML = state.githubAccounts.map(renderGithubAccount).join('');
  elements.githubGrid.hidden = state.githubAccounts.length === 0;
  elements.githubEmpty.hidden = state.githubAccounts.length !== 0;
  const configured = Boolean(state.githubConfig.configured);
  elements.githubPolicy.classList.toggle('not-configured', !configured);
  elements.githubPolicy.querySelector('strong').textContent = configured ? t('githubPolicyTitle') : t('githubConfigRequired');
  elements.githubPolicy.querySelector('span').textContent = configured
    ? state.githubConfig.policy
    : t('githubConfigHelp');
  document.getElementById('openGithubButton').disabled = false;
  document.getElementById('emptyGithubButton').disabled = false;
}

function render() {
  const items = visibleMailboxes();
  elements.grid.innerHTML = items.map(renderMailbox).join('');
  elements.grid.hidden = items.length === 0;
  elements.empty.hidden = items.length !== 0 || (state.mailboxes.length > 0 && (state.search || state.filter !== 'all'));
  if (!items.length && state.mailboxes.length > 0) {
    elements.empty.hidden = false;
    elements.empty.querySelector('h3').textContent = t('emptyNoMatchTitle');
    elements.empty.querySelector('p').textContent = t('emptyNoMatchLead');
    elements.empty.querySelector('button').hidden = true;
  } else if (state.mailboxes.length === 0) {
    elements.empty.querySelector('h3').textContent = t('emptyTitle');
    elements.empty.querySelector('p').textContent = t('emptyLead');
    elements.empty.querySelector('button').hidden = false;
  }
  document.getElementById('totalStat').textContent = state.summary.total || 0;
  document.getElementById('activeStat').textContent = state.summary.active || 0;
  document.getElementById('codeStat').textContent = state.summary.withCode || 0;
  document.getElementById('errorStat').textContent = state.summary.errors || 0;
  document.getElementById('allCount').textContent = state.summary.total || 0;
  const autoEligible = state.summary.autoEligible || 0;
  const autoEnabled = state.summary.autoEnabled || 0;
  const allAuto = autoEligible > 0 && autoEnabled === autoEligible;
  elements.autoAllButton.textContent = allAuto
    ? t('autoPause', { enabled: autoEnabled, eligible: autoEligible })
    : t('autoStart', { enabled: autoEnabled, eligible: autoEligible });
  elements.autoAllButton.classList.toggle('active', allAuto);
  elements.autoAllButton.dataset.enabled = String(allAuto);
  renderGithub();
}

function applyState(payload) {
  state.mailboxes = payload.mailboxes || [];
  state.summary = payload.summary || {};
  document.getElementById('serverTime').textContent = formatTime(payload.serverTime, '--:--:--');
  render();
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || (state.language === 'zh' ? '操作失败' : 'Operation failed'));
  return payload;
}

let toastTimer;
function toast(message, type = '') {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.className = `toast show ${type}`;
  toastTimer = setTimeout(() => { elements.toast.className = 'toast'; }, 2600);
}

function openImport() {
  elements.importMessage.textContent = '';
  elements.dialog.showModal();
  setTimeout(() => elements.importText.focus(), 50);
}

elements.languageToggle.addEventListener('click', () => {
  state.language = state.language === 'zh' ? 'en' : 'zh';
  localStorage.setItem(LANGUAGE_STORAGE_KEY, state.language);
  applyLanguage();
  render();
});

document.getElementById('openImportButton').addEventListener('click', openImport);
document.getElementById('emptyImportButton').addEventListener('click', openImport);

elements.importButton.addEventListener('click', async () => {
  const text = elements.importText.value.trim();
  if (!text) {
    elements.importMessage.textContent = t('pasteMailboxFirst');
    return;
  }
  elements.importButton.disabled = true;
  elements.importMessage.textContent = t('detecting');
  try {
    const result = await api('/api/import', { method: 'POST', body: JSON.stringify({ text }) });
    const rejected = result.rejected.length;
    const updated = result.updated?.length || 0;
    elements.dialog.close();
    elements.importText.value = '';
    toast(t('importDone', {
      added: result.added.length,
      updated,
      duplicate: result.duplicate.length,
      rejected: rejected ? t('rejectedSuffix', { count: rejected }) : ''
    }));
  } catch (error) {
    elements.importMessage.textContent = error.message;
  } finally {
    elements.importButton.disabled = false;
  }
});

document.getElementById('fileInput').addEventListener('change', async (event) => {
  const files = [...event.target.files];
  const fileMessage = document.getElementById('fileMessage');
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > 1024 * 1024) {
    fileMessage.textContent = t('fileTooLarge');
    event.target.value = '';
    return;
  }
  try {
    const contents = await Promise.all(files.map((file) => file.text()));
    elements.importText.value = [elements.importText.value, ...contents].filter(Boolean).join('\n\n');
    fileMessage.textContent = t('fileReadDone', { count: files.length });
  } catch {
    fileMessage.textContent = t('fileReadFailed');
  }
});

elements.search.addEventListener('input', () => {
  state.search = elements.search.value;
  render();
});

elements.filters.addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  state.filter = button.dataset.filter;
  elements.filters.querySelectorAll('[data-filter]').forEach((item) => item.classList.toggle('active', item === button));
  render();
});

elements.grid.addEventListener('click', async (event) => {
  const action = event.target.closest('[data-action]');
  if (!action) return;
  const card = action.closest('[data-id]');
  const id = card?.dataset.id;
  if (!id) return;
  try {
    if (action.dataset.action === 'copy') {
      await navigator.clipboard.writeText(action.dataset.code);
      toast(t('codeCopied'));
    }
    if (action.dataset.action === 'refresh') {
      action.disabled = true;
      action.textContent = t('fetching');
      const result = await api(`/api/mailboxes/${id}/refresh`, { method: 'POST', body: '{}' });
      toast(result.newCodes.length ? t('refreshCodeDone', { count: result.newCodes.length }) : t('refreshNoCode'));
    }
    if (action.dataset.action === 'delete') {
      const mailbox = state.mailboxes.find((item) => item.id === id);
      if (!confirm(t('confirmDeleteMailbox', { email: mailbox?.email || t('unknownMailbox') }))) return;
      await api(`/api/mailboxes/${id}`, { method: 'DELETE' });
      toast(t('mailboxDeleted'));
    }
  } catch (error) {
    toast(error.message, 'error');
    action.disabled = false;
  }
});

elements.grid.addEventListener('change', async (event) => {
  const input = event.target.closest('[data-action="toggle"]');
  if (!input) return;
  const id = input.closest('[data-id]')?.dataset.id;
  try {
    await api(`/api/mailboxes/${id}`, { method: 'PATCH', body: JSON.stringify({ enabled: input.checked }) });
    toast(input.checked ? t('toggleOn') : t('toggleOff'));
  } catch (error) {
    input.checked = !input.checked;
    toast(error.message, 'error');
  }
});

document.getElementById('refreshAllButton').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const result = await api('/api/refresh-all', { method: 'POST', body: '{}' });
    toast(t('refreshAllDone', result));
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    button.disabled = false;
  }
});

elements.autoAllButton.addEventListener('click', async () => {
  const enable = elements.autoAllButton.dataset.enabled !== 'true';
  elements.autoAllButton.disabled = true;
  try {
    const result = await api('/api/auto-all', {
      method: 'POST',
      body: JSON.stringify({ enabled: enable })
    });
    toast(enable
      ? t('autoAllOn', { count: result.eligible })
      : t('autoAllOff', { count: result.eligible }));
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    elements.autoAllButton.disabled = false;
  }
});

async function refreshGithub() {
  const [config, result] = await Promise.all([
    api('/api/github/config'),
    api('/api/github/accounts')
  ]);
  state.githubConfig = config;
  state.githubAccounts = result.accounts || [];
  renderGithub();
}

let githubAuthPoll;

function closeGithubConnect() {
  clearInterval(githubAuthPoll);
  githubAuthPoll = null;
  elements.githubConnectDialog.close();
}

function openGithubConnect() {
  if (!state.mailboxes.length) {
    toast(t('needImportMailbox'), 'error');
    return;
  }
  const select = document.getElementById('githubMailboxSelect');
  select.innerHTML = state.mailboxes.map((mailbox) => `<option value="${escapeHtml(mailbox.id)}">${escapeHtml(mailbox.email)}</option>`).join('');
  document.getElementById('githubClientIdInput').value = state.githubConfig.clientId || '';
  document.getElementById('devicePanel').hidden = true;
  document.getElementById('githubConnectMessage').textContent = '';
  document.getElementById('startGithubConnect').disabled = false;
  elements.githubConnectDialog.showModal();
}

document.getElementById('openGithubButton').addEventListener('click', openGithubConnect);
document.getElementById('emptyGithubButton').addEventListener('click', openGithubConnect);
document.getElementById('closeGithubConnect').addEventListener('click', closeGithubConnect);
document.getElementById('cancelGithubConnect').addEventListener('click', closeGithubConnect);

document.getElementById('startGithubConnect').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  const message = document.getElementById('githubConnectMessage');
  const clientId = document.getElementById('githubClientIdInput').value.trim();
  if (!clientId) {
    message.textContent = t('needClientId');
    return;
  }
  button.disabled = true;
  message.textContent = t('requestingDevice');
  try {
    state.githubConfig = await api('/api/github/config', {
      method: 'POST',
      body: JSON.stringify({ clientId })
    });
    renderGithub();
    const started = await api('/api/github/auth/start', {
      method: 'POST',
      body: JSON.stringify({ mailboxId: document.getElementById('githubMailboxSelect').value })
    });
    document.getElementById('devicePanel').hidden = false;
    document.getElementById('githubDeviceCode').textContent = started.verification.userCode;
    document.getElementById('githubVerifyLink').href = started.verification.verificationUri;
    document.getElementById('githubAuthStatus').textContent = t('waitingGithubConfirm');
    message.textContent = '';
    clearInterval(githubAuthPoll);
    githubAuthPoll = setInterval(async () => {
      try {
        const status = await api(`/api/github/auth/${started.sessionId}`);
        if (status.status === 'complete') {
          clearInterval(githubAuthPoll);
          githubAuthPoll = null;
          document.getElementById('githubAuthStatus').textContent = t('authLoaded');
          await refreshGithub();
          closeGithubConnect();
          toast(t('githubConnected'));
        } else if (status.status === 'error') {
          clearInterval(githubAuthPoll);
          githubAuthPoll = null;
          message.textContent = status.error || t('githubAuthFailed');
          button.disabled = false;
        }
      } catch (error) {
        clearInterval(githubAuthPoll);
        githubAuthPoll = null;
        message.textContent = error.message;
        button.disabled = false;
      }
    }, 2000);
  } catch (error) {
    message.textContent = error.message;
    button.disabled = false;
  }
});

function closeGithubAction() {
  elements.githubActionDialog.close();
}

function openGithubAction(accountId, action) {
  const config = githubActionConfig(action);
  if (!config) return;
  elements.githubActionDialog.dataset.accountId = accountId;
  elements.githubActionDialog.dataset.action = action;
  document.getElementById('githubActionTitle').textContent = config.title;
  document.getElementById('githubActionLead').textContent = config.lead;
  document.getElementById('githubTargetLabel').textContent = config.label;
  const input = document.getElementById('githubTargetInput');
  input.value = '';
  input.placeholder = config.placeholder;
  document.getElementById('githubActionMessage').textContent = '';
  document.getElementById('submitGithubAction').disabled = false;
  elements.githubActionDialog.showModal();
  setTimeout(() => input.focus(), 50);
}

document.getElementById('closeGithubAction').addEventListener('click', closeGithubAction);
document.getElementById('cancelGithubAction').addEventListener('click', closeGithubAction);

elements.githubGrid.addEventListener('click', async (event) => {
  const card = event.target.closest('[data-github-id]');
  if (!card) return;
  const accountId = card.dataset.githubId;
  const actionButton = event.target.closest('[data-github-action]');
  if (actionButton) {
    openGithubAction(accountId, actionButton.dataset.githubAction);
    return;
  }
  const copyButton = event.target.closest('[data-github-copy]');
  if (copyButton) {
    await navigator.clipboard.writeText(copyButton.dataset.githubCopy);
    toast(t('codeCopied'));
    return;
  }
  if (event.target.closest('[data-github-disconnect]')) {
    const account = state.githubAccounts.find((item) => item.id === accountId);
    if (!confirm(t('confirmDisconnect', { login: account?.login || '' }))) return;
    try {
      await api(`/api/github/accounts/${accountId}/disconnect`, {
        method: 'POST',
        body: JSON.stringify({ confirmed: true })
      });
      await refreshGithub();
      toast(t('githubDisconnected'));
    } catch (error) {
      toast(error.message, 'error');
    }
  }
});

document.getElementById('submitGithubAction').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  const action = elements.githubActionDialog.dataset.action;
  const accountId = elements.githubActionDialog.dataset.accountId;
  const target = document.getElementById('githubTargetInput').value.trim();
  const message = document.getElementById('githubActionMessage');
  if (!target) {
    message.textContent = t('enterTarget');
    return;
  }
  const config = githubActionConfig(action);
  if (!confirm(t('confirmGithubAction', { action: config.title, target }))) return;
  button.disabled = true;
  message.textContent = t('runningGithubAction');
  try {
    const result = await api(`/api/github/accounts/${accountId}/actions`, {
      method: 'POST',
      body: JSON.stringify({ action, target, confirmed: true })
    });
    await refreshGithub();
    closeGithubAction();
    toast(t('githubActionDone', { action: config.title, target: result.target }));
  } catch (error) {
    message.textContent = error.message;
    button.disabled = false;
  }
});

let eventStream;
document.getElementById('shutdownButton').addEventListener('click', async (event) => {
  if (!confirm(t('confirmShutdown'))) return;
  event.currentTarget.disabled = true;
  try {
    await api('/api/shutdown', { method: 'POST', body: '{}' });
    eventStream?.close();
    elements.shutdownScreen.hidden = false;
  } catch (error) {
    event.currentTarget.disabled = false;
    toast(error.message, 'error');
  }
});

async function initialize() {
  try {
    applyState(await api('/api/state'));
  } catch (error) {
    toast(error.message, 'error');
  }
  try {
    await refreshGithub();
  } catch (error) {
    state.githubConfig = { configured: false };
    renderGithub();
    toast(`GitHub 模块不可用：${error.message}`, 'error');
  }
  eventStream = new EventSource('/api/events');
  eventStream.addEventListener('state', (event) => {
    elements.live.classList.remove('offline');
    elements.live.querySelector('span').textContent = t('liveConnected');
    applyState(JSON.parse(event.data));
  });
  eventStream.onerror = () => {
    elements.live.classList.add('offline');
    elements.live.querySelector('span').textContent = t('liveReconnecting');
  };
}

applyLanguage();
initialize();
