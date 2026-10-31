/* AgentOS 研究空间前端：保留 Verifoundry 视觉风格，接入真实本地 API。 */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const toastEl = $('#toast');
  let toastTimer;
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('visible'), 3200); }
  function modal(title, html) { $('#modal-title').textContent = title; $('#modal-body').innerHTML = html; const d = $('#modal'); if (!d.open) d.showModal(); }
  function closeModal() { const d = $('#modal'); if (d.open) d.close(); }

  const S = {
    token: '', projectId: '', settings: {}, chats: [], chatId: '', detail: null, project: null,
    agents: [], agentId: 'general', mode: 'research', deep: false, network: true,
    attachments: [], active: false, pollTimer: null, refreshTimer: null, lastRefresh: 0
  };

  async function api(path, { method = 'GET', body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (S.token) headers['x-agentos-token'] = S.token;
    const res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    let data; try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
    if (!res.ok) throw new Error(data.error || `请求失败（HTTP ${res.status}）`);
    return data;
  }

  /* ---------------- 渲染工具 ---------------- */
  const toolNames = {
    list_files: '查看研究文件', read_file: '读取文件', read_pdf: '阅读 PDF', write_file: '保存成果',
    run_python: '运行分析代码', search_papers: '检索公开文献', read_web: '阅读网页',
    browser_open: '打开网页', browser_click: '点击网页', browser_fill: '填写网页',
    desktop_apps: '查找应用', desktop_launch: '打开应用', desktop_focus: '切换窗口',
    desktop_windows: '读取窗口', desktop_inspect: '查看控件', desktop_invoke: '点击控件', desktop_set_value: '填写控件',
    screen_capture: '截取屏幕', computer_click: '点击屏幕', computer_type: '输入文字', computer_key: '按键',
    computer_scroll: '滚动屏幕', computer_drag: '拖动屏幕', run_shell: '执行命令', set_plan: '整理步骤',
    local_experiment: '运行本地实验'
  };
  const stateText = { RUNNING: '任务进行中', WAITING_APPROVAL: '等待你确认', COMPLETED: '本轮已完成', NEEDS_REVIEW: '结果待复核', FAILED: '执行失败', CANCELLED: '已停止', INTERRUPTED: '已中断' };
  const artifacts = path => `/api/projects/${S.projectId}/artifact?path=${encodeURIComponent(path)}`;
  const artifactView = path => artifacts(path) + '&view=1';
  const parseResult = v => { try { return JSON.parse(v); } catch { return null; } };

  function markdown(text) {
    const src = String(text || '');
    const parts = src.split(/```/);
    return parts.map((part, i) => {
      if (i % 2) return `<pre class="code-block"><code>${esc(part.replace(/^[a-zA-Z0-9_-]*\n/, ''))}</code></pre>`;
      const blocks = part.split(/\n{2,}/).map(block => {
        const lines = block.split('\n');
        if (lines.every(l => /^\s*[-*]\s+/.test(l) || !l.trim())) {
          return `<ul>${lines.filter(l => l.trim()).map(l => `<li>${inline(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')}</ul>`;
        }
        if (lines.every(l => /^\s*\d+\.\s+/.test(l) || !l.trim())) {
          return `<ol>${lines.filter(l => l.trim()).map(l => `<li>${inline(l.replace(/^\s*\d+\.\s+/, ''))}</li>`).join('')}</ol>`;
        }
        return `<p>${inline(block).replace(/\n/g, '<br>')}</p>`;
      }).join('');
      return `<div class="markdown">${blocks}</div>`;
    }).join('');
  }
  function inline(text) {
    return esc(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/(https?:\/\/[^\s<)]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  }
  function planCard(steps) {
    if (!Array.isArray(steps) || !steps.length) return '';
    return `<section class="plan card">${steps.map((s, i) => `
      <div class="plan-row"><span class="step-number">${s.status === 'done' ? icon('check') : i + 1}</span>
      <div class="step-copy"><strong>${esc(s.title)}</strong><small>${s.status === 'done' ? '已完成' : s.status === 'running' ? '进行中' : s.status === 'failed' ? '失败' : '等待中'}</small></div>
      ${s.status === 'done' ? '<span class="status check">' + icon('check') + '</span>' : s.status === 'running' ? '<span class="status spinner" aria-label="进行中"></span>' : s.status === 'failed' ? '<span class="status failed">!</span>' : '<span class="clock">◷</span>'}</div>`).join('')}</section>`;
  }
  function activityBlock(events) {
    const tools = events.filter(e => e.type === 'tool');
    if (!tools.length) return '';
    const errors = events.filter(e => e.type === 'tool_error');
    const rows = tools.map(e => {
      const failed = errors.some(x => x.name === e.name);
      return `<div class="tool-row"><span class="tool-name">${esc(toolNames[e.name] || e.name)}</span><span class="tool-state ${failed ? 'failed' : 'ok'}">${failed ? '未成功' : '完成'}</span></div>`;
    }).join('');
    return `<details class="tool-activity card" ${errors.length ? 'open' : ''}><summary>${icon('file')}已执行 ${tools.length} 步操作${errors.length ? ` · ${errors.length} 项未成功` : ''}</summary><div class="tool-list">${rows}</div></details>`;
  }
  function screenStrip(events) {
    const shots = events.filter(e => e.type === 'tool_result' && e.name === 'screen_capture').map(e => parseResult(e.result)).filter(r => r && r.path);
    if (!shots.length) return '';
    return `<div class="screen-strip">${shots.slice(-4).map(r => `<button class="shot" data-preview="${esc(r.path)}" title="屏幕截图"><img src="${artifactView(r.path)}" alt="屏幕截图" loading="lazy"></button>`).join('')}</div>`;
  }
  function approvalCard(a) {
    const args = a.args || {};
    return `<section class="approval-card card"><strong>${icon('check')} 这一步需要你确认</strong><p>${esc(args.purpose || toolNames[a.tool] || a.tool)}</p>${args.code ? `<pre class="code-block">${esc(String(args.code).slice(0, 4000))}</pre>` : ''}<div class="approval-actions"><button class="primary-btn" data-approve="yes" data-approval="${esc(a.id)}">允许这次操作</button><button class="ghost-btn" data-approve="no" data-approval="${esc(a.id)}">拒绝</button></div><p class="panel-note">${a.tool === 'run_python' ? '代码会在本机运行。' : a.tool === 'run_shell' ? '命令会在本机 PowerShell 运行。' : a.tool && a.tool.startsWith('computer_') ? '将操作鼠标或键盘，请核对坐标和目标。' : '即将操作 Windows 应用，请核对目标。'}</p></section>`;
  }
  function renderTask(task, events, approvals) {
    const taskEvents = events.filter(e => e.taskId === task.id);
    const tools = taskEvents.filter(e => e.type === 'tool');
    const replies = taskEvents.filter(e => e.type === 'assistant').map(e => e.text);
    const reply = task.summary || replies.join('\n\n');
    const pending = ['RUNNING', 'WAITING_APPROVAL'].includes(task.status);
    const intro = pending ? (task.status === 'WAITING_APPROVAL' ? '我停在这一步，等你确认。' : task.turns > 1 ? '正在根据实际结果继续推进。' : '开始处理这个任务。') : '';
    return `<div class="user-message"><div class="bubble">${esc(task.prompt)}</div><span class="avatar">R</span></div>
    <div class="assistant-message"><span class="bot-avatar">${icon('bot')}</span><div class="assistant-body">
      ${intro ? `<p class="intro">${esc(intro)}</p>` : ''}
      ${planCard(task.steps)}
      ${pending ? `<div class="source-caption">正在调用本地工具<span class="ellipsis">...</span></div>` : ''}
      ${activityBlock(taskEvents)}
      ${screenStrip(taskEvents)}
      ${reply ? `<div class="message-rich">${markdown(reply)}</div>` : pending ? '<div class="thinking"><span class="spinner"></span>正在思考</div>' : ''}
      ${approvals.map(approvalCard).join('')}
      ${task.error ? `<p class="chat-error">${esc(task.error)}</p>` : ''}
      ${task.status === 'NEEDS_REVIEW' ? `<p class="review-note">${icon('check')}${esc(task.reviewReason || '请复核结果；你可以继续追问或补充要求。')}</p>` : ''}
      ${task.status === 'CANCELLED' || task.status === 'INTERRUPTED' ? '<p class="review-note">本轮已停止，已有内容仍保留。</p>' : ''}
    </div></div>`;
  }
  function welcome() {
    return `<div class="welcome-state"><div class="welcome-mark">${icon('bot')}</div><h2>想做什么，直接说。</h2><p>让 AgentOS 查资料、看文件，或直接操作电脑。代码执行与电脑操作会逐次请你确认。</p><div class="welcome-actions"><button class="ghost-btn" data-prompt="列出当前研究空间的文件，并指出哪些内容可以用于分析。">帮我看看文件</button><button class="ghost-btn" data-prompt="打开记事本，输入今天的研究待办，然后截图确认。">操作电脑试一试</button></div></div>`;
  }
  function renderConversation() {
    const el = $('#conversation');
    const d = S.detail;
    if (!d || !d.tasks || !d.tasks.length) { el.innerHTML = welcome(); return; }
    el.innerHTML = d.tasks.map(t => renderTask(t, d.events || [], (d.approvals || []).filter(a => a.taskId === t.id))).join('') + '<div class="conversation-end"></div>';
    el.scrollTop = el.scrollHeight;
  }

  /* ---------------- 侧栏 / 标题 ---------------- */
  function renderShell() {
    const chat = S.detail?.chat;
    $('#project-title').textContent = chat ? chat.title : '研究空间';
    const label = $('.demo-label');
    if (label) { label.textContent = S.settings.model ? `${S.settings.model} · 本地` : '本地研究空间'; label.title = S.settings.baseURL || ''; label.style.cursor = 'pointer'; label.onclick = openSettings; }
    const list = $('.recent-list');
    if (!list) return;
    if (!S.chats.length) { list.innerHTML = '<p class="panel-note" style="padding:6px 12px">还没有任务记录，发一条消息开始。</p>'; return; }
    list.innerHTML = S.chats.filter(c => !c.archived).map(c => `<button class="recent ${c.id === S.chatId ? 'active' : ''}" data-chat="${esc(c.id)}">${icon('file')}<span>${esc(c.title)}<small>${timeLabel(c.updatedAt || c.createdAt)}</small></span></button>`).join('');
    $$('[data-chat]', list).forEach(b => b.onclick = () => selectChat(b.dataset.chat));
  }
  function timeLabel(iso) {
    if (!iso) return '';
    const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return `今天 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }

  /* ---------------- 右侧检查器 ---------------- */
  let inspectorTab = 'progress';
  function renderInspector() {
    $$('.inspector-tabs button').forEach(b => { const on = b.dataset.tab === inspectorTab; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
    const d = S.detail;
    const tasks = d?.tasks || [];
    const task = tasks[tasks.length - 1];
    const events = d?.events || [];
    const files = S.project?.files || [];
    if (inspectorTab === 'progress') {
      if (!task) { $('#inspector-content').innerHTML = `<h2 class="panel-heading">任务进度</h2><div class="card panel-empty">还没有执行中的任务<p class="panel-note">发送消息后，这里会显示计划、工具调用和确认记录。</p></div>`; return; }
      const taskEvents = events.filter(e => e.taskId === task.id);
      const steps = task.steps || [];
      const done = steps.filter(s => s.status === 'done').length;
      const pct = task.status === 'COMPLETED' ? 100 : steps.length ? Math.round(done / steps.length * 100) : 0;
      const timeline = steps.length ? steps.map((s, i) => `<div class="timeline-row ${s.status === 'done' ? 'done' : s.status === 'running' ? 'current' : ''}"><span class="step-number">${s.status === 'done' ? icon('check') : i + 1}</span><div><strong>${esc(s.title)}</strong><small>${s.status === 'done' ? '已完成' : s.status === 'running' ? '进行中' : s.status === 'failed' ? '失败' : '等待中'}</small></div>${s.status === 'running' ? '<span class="status spinner" aria-label="进行中"></span>' : ''}</div>`).join('') : taskEvents.slice(-8).map(e => `<div class="timeline-row ${e.type === 'tool_error' ? 'failed' : ''}"><span class="step-number">${e.type === 'tool' ? '·' : e.type === 'tool_error' ? '!' : '✓'}</span><div><strong>${esc(toolNames[e.name] || eventTitle(e.type))}</strong><small>${esc((e.text || '').slice(0, 120))}</small></div></div>`).join('');
      $('#inspector-content').innerHTML = `
        <section class="progress-summary card"><header><strong>${esc(stateText[task.status] || task.status)}</strong><small>${task.agentName ? esc(task.agentName) : ''}${task.turns ? ` · ${task.turns} 轮` : ''}</small></header><div class="progress-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill" style="width:${pct}%"></div></div><p class="panel-note">${pct}% · 工具 ${task.toolCount || 0} 次${task.status === 'WAITING_APPROVAL' ? ' · 等待你在对话中确认操作' : ''}</p></section>
        <section class="timeline card">${timeline || '<p class="panel-note">本轮是直接回答，没有工具调用。</p>'}</section>
        <section class="activity card"><div class="card-heading">模型调用</div><div class="activity-detail">${(S.project?.modelCalls || []).filter(c => c.taskId === task.id).slice(-4).map(c => `<p class="panel-note">${esc(c.model)} · ${c.status} · ${c.durationMs} ms${c.usage ? ` · ${c.usage.prompt_tokens}+${c.usage.completion_tokens} tokens` : ''}</p>`).join('') || '<p class="panel-note">尚无调用记录。</p>'}</div></section>`;
      return;
    }
    if (inspectorTab === 'references') {
      const papers = [];
      for (const e of events) {
        if (e.type !== 'tool_result' || e.name !== 'search_papers') continue;
        const r = parseResult(e.result); if (!r || !Array.isArray(r.items)) continue;
        for (const p of r.items) papers.push(p);
      }
      const sources = S.project?.sources || [];
      $('#inspector-content').innerHTML = `<h2 class="panel-heading">参考资料 <small>${papers.length + sources.length} 项</small></h2>
        ${sources.length ? sources.map(s => `<article class="card panel-paper"><h3>${esc(s.title || s.url)}</h3><p class="paper-meta">${esc(s.url || '')}</p><button class="view" data-preview="${esc(s.path || '')}">${icon('book')}查看</button></article>`).join('') : ''}
        ${papers.length ? papers.map(p => `<article class="card panel-paper"><h3>${esc(p.title || '(无标题)')}</h3><p class="paper-meta">${esc([p.authors, p.date].filter(Boolean).join(' · '))}</p><p class="panel-note">${esc((p.abstract || '').slice(0, 180))}</p>${p.doi ? `<p class="paper-meta">DOI ${esc(p.doi)}</p>` : ''}</article>`).join('') : ''}
        ${!sources.length && !papers.length ? '<div class="card panel-empty">还没有检索来源<p class="panel-note">让 AgentOS 检索文献或读取网页后，真实来源会出现在这里。</p></div>' : ''}`;
      bindPreviewButtons('#inspector-content');
      return;
    }
    if (inspectorTab === 'results') {
      const results = files.find(f => f.path.endsWith('/results.json')) || files.find(f => f.path === 'results.json');
      const charts = files.filter(f => /\.(svg|png)$/i.test(f.path) && (f.path.includes('experiment') || f.path.includes('chart')));
      const csvs = files.filter(f => /\.csv$/i.test(f.path));
      $('#inspector-content').innerHTML = `<h2 class="panel-heading">数据结果</h2>
        ${charts.length ? `<div class="card chart-wrap">${charts.slice(0, 2).map(c => `<button class="shot" data-preview="${esc(c.path)}"><img src="${artifactView(c.path)}" alt="实验图表" loading="lazy"></button>`).join('')}</div>` : ''}
        ${results ? `<section class="card"><div class="card-heading">${esc(results.path)}</div><pre class="code-block" id="results-json">正在读取…</pre></section>` : '<div class="card panel-empty">还没有实验产物<p class="panel-note">运行内置对照实验或分析代码后，结果会保存在研究空间。</p></div>'}
        ${csvs.length ? `<section class="card"><div class="card-heading">数据文件</div>${csvs.slice(0, 5).map(f => `<p class="file-row"><span>${esc(f.path)}</span><a class="view" href="${artifacts(f.path)}" download>下载</a></p>`).join('')}</section>` : ''}`;
      if (results) {
        api(`/api/projects/${S.projectId}/file?path=${encodeURIComponent(results.path)}`).then(r => {
          const el = $('#results-json'); if (!el) return;
          const parsed = parseResult(r.content);
          el.textContent = parsed ? JSON.stringify(parsed, null, 2).slice(0, 6000) : String(r.content).slice(0, 6000);
        }).catch(e => { const el = $('#results-json'); if (el) el.textContent = e.message; });
      }
      bindPreviewButtons('#inspector-content');
      return;
    }
    const groups = files.reduce((acc, f) => { const dir = f.path.split('/').slice(0, -1).join('/') || '根目录'; (acc[dir] ||= []).push(f); return acc; }, {});
    $('#inspector-content').innerHTML = `<h2 class="panel-heading">产出文件 <small>${files.length} 个</small></h2>${Object.entries(groups).map(([dir, fs2]) => `<section class="card file-group"><div class="card-heading">${esc(dir)}</div>${fs2.map(f => `<p class="file-row"><button class="file-link" data-preview="${esc(f.path)}">${icon('file')}${esc(f.path.split('/').pop())}</button><a class="view" href="${artifacts(f.path)}" download>下载</a></p>`).join('')}</section>`).join('') || '<div class="card panel-empty">研究空间还没有文件</div>'}`;
    bindPreviewButtons('#inspector-content');
  }
  function eventTitle(type) { return ({ thinking: '分析中', task: '任务开始', done: '任务结束', assistant: '回复', plan: '更新计划', notice: '提示', error: '错误' }[type]) || type; }
  function bindPreviewButtons(root) {
    const scope = $(root); if (!scope) return;
    $$('[data-preview]', scope).forEach(b => b.onclick = () => previewFile(b.dataset.preview));
  }
  async function previewFile(path) {
    if (!path) { toast('文件路径为空'); return; }
    const ext = (path.split('.').pop() || '').toLowerCase();
    if (['png', 'jpg', 'jpeg', 'svg'].includes(ext)) {
      modal('预览', `<img class="preview-image" src="${artifactView(path)}" alt="${esc(path)}"><p class="panel-note"><a href="${artifacts(path)}" download>下载 ${esc(path.split('/').pop())}</a></p>`);
      return;
    }
    try {
      const r = await api(`/api/projects/${S.projectId}/file?path=${encodeURIComponent(path)}`);
      modal('预览', `<p class="panel-note">${esc(path)}</p><pre class="code-block">${esc(String(r.content).slice(0, 20000))}</pre><p class="panel-note"><a href="${artifacts(path)}" download>下载文件</a></p>`);
    } catch (e) { toast(e.message); }
  }

  /* ---------------- 数据加载 ---------------- */
  async function refreshProject() {
    S.project = await api(`/api/projects/${S.projectId}`);
    S.chats = (await api(`/api/projects/${S.projectId}/chats`)).chats.sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
    renderShell();
  }
  async function selectChat(id) {
    if (!id) { S.chatId = ''; S.detail = null; renderShell(); renderConversation(); renderInspector(); return; }
    S.chatId = id; localStorage.setItem('agentos.lastChat', id);
    S.detail = await api(`/api/chats/${id}`);
    S.active = (S.detail.tasks || []).some(t => ['RUNNING', 'WAITING_APPROVAL'].includes(t.status));
    renderShell(); renderConversation(); renderInspector(); schedulePoll();
  }
  async function refreshChat() {
    if (!S.chatId) return;
    const now = Date.now(); if (now - S.lastRefresh < 500) return; S.lastRefresh = now;
    try {
      const prev = (S.detail?.tasks || []).map(t => t.status).join(',');
      S.detail = await api(`/api/chats/${S.chatId}`);
      S.active = (S.detail.tasks || []).some(t => ['RUNNING', 'WAITING_APPROVAL'].includes(t.status));
      renderShell(); renderConversation(); renderInspector();
      if (prev !== (S.detail.tasks || []).map(t => t.status).join(',')) await refreshProject().catch(() => {});
      schedulePoll();
    } catch (e) { console.warn(e); }
  }
  function schedulePoll() {
    clearTimeout(S.pollTimer);
    if (S.active) S.pollTimer = setTimeout(async () => { await refreshChat(); }, 1600);
  }
  function connectEvents() {
    try {
      const es = new EventSource('/api/events');
      es.onmessage = () => { clearTimeout(S.refreshTimer); S.refreshTimer = setTimeout(() => refreshChat().catch(() => {}), 700); };
    } catch { /* 轮询兜底 */ }
  }

  /* ---------------- 交互 ---------------- */
  async function send() {
    const input = $('#message');
    const text = input.value.trim();
    if (!text) { input.focus(); toast('先说说你想做什么'); return; }
    let chatId = S.chatId;
    try {
      if (!chatId) {
        const c = await api(`/api/projects/${S.projectId}/chats`, { method: 'POST', body: {} });
        chatId = c.id; S.chatId = chatId;
      }
      let message = text;
      if (S.attachments.length) message += `\n\n已上传资料：${S.attachments.join('、')}`;
      input.value = ''; syncComposer();
      await api(`/api/chats/${chatId}/messages`, { method: 'POST', body: { message, agentId: S.agentId, researchMode: S.mode, deepAnalysis: S.deep, networkEnabled: S.network } });
      S.attachments = []; renderAttachments();
      await selectChat(chatId);
    } catch (e) { toast(e.message); }
  }
  function syncComposer() {
    const b = $('.send'); if (!b) return;
    const has = $('#message').value.trim().length > 0;
    b.classList.toggle('primary', has);
  }
  function renderAttachments() {
    const el = $('#attachment-label');
    el.innerHTML = S.attachments.map((p, i) => `<span class="attach-chip">${esc(p)}<button data-detach="${i}" aria-label="移除附件">×</button></span>`).join('');
    $$('[data-detach]', el).forEach(b => b.onclick = () => { S.attachments.splice(Number(b.dataset.detach), 1); renderAttachments(); });
  }
  async function attachFiles(fileList) {
    const files = [...fileList]; if (!files.length) return;
    if (files.length > 20) { toast('一次最多 20 个文件'); return; }
    const payload = [];
    for (const file of files) {
      if (file.size > 12_000_000) { toast(`${file.name} 超过 12MB`); continue; }
      const base64 = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1] || ''); r.onerror = reject; r.readAsDataURL(file); });
      payload.push({ name: file.name, base64 });
    }
    if (!payload.length) return;
    try {
      const r = await api(`/api/projects/${S.projectId}/upload`, { method: 'POST', body: { files: payload } });
      S.attachments.push(...r.files.map(f => f.path)); renderAttachments(); toast(`已上传 ${r.files.length} 个文件`);
      await refreshProject();
    } catch (e) { toast(e.message); }
  }
  async function answerApproval(id, approve) {
    try { await api(`/api/approvals/${id}`, { method: 'POST', body: { approve } }); toast(approve ? '已允许这次操作' : '已拒绝'); await refreshChat(); }
    catch (e) { toast(e.message); }
  }

  /* ---------------- 弹窗 ---------------- */
  function openSettings() {
    const s = S.settings;
    modal('模型与权限', `<form class="settings-form" id="settings-form">
      <label>模型服务地址<input name="baseURL" type="url" required value="${esc(s.baseURL || '')}"></label>
      <label>模型<input name="model" required value="${esc(s.model || '')}"></label>
      <label>视觉模型（截图操作时使用）<input name="visionModel" value="${esc(s.visionModel || '')}" placeholder="Qwen3-VL-30B-A3B-Instruct"></label>
      <label>API Key<input name="apiKey" type="password" autocomplete="new-password" placeholder="${s.hasKey ? '已保存，留空保留' : '填写当前服务的 API Key'}"></label>
      <label class="check-row"><input type="checkbox" name="networkEnabled" ${s.networkEnabled ? 'checked' : ''}> 允许 AgentOS 检索公开网页</label>
      <label class="check-row"><input type="checkbox" name="desktopEnabled" ${s.desktopEnabled ? 'checked' : ''}> 允许 AgentOS 操作本机电脑（点击/输入仍逐次确认）</label>
      <p class="panel-note">聊天与工具读取的内容会发送到所配置的模型服务。ESP32 当前未启用。</p>
      <div class="modal-actions"><button class="primary-btn" type="submit">保存</button><button class="ghost-btn" type="button" id="test-connection">检查连接</button></div>
      <p class="panel-note" id="settings-status" role="status"></p></form>`);
    $('#settings-form').onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        S.settings = await api('/api/settings', { method: 'PUT', body: { ...S.settings, ...Object.fromEntries(f), apiKey: f.get('apiKey') || '', networkEnabled: f.has('networkEnabled'), desktopEnabled: f.has('desktopEnabled') } });
        S.network = S.settings.networkEnabled;
        $('#settings-status').textContent = '设置已保存。'; toast('设置已保存'); renderShell();
      } catch (err) { $('#settings-status').textContent = err.message; }
    };
    $('#test-connection').onclick = async e => {
      const label = $('#settings-status'); e.target.disabled = true; label.textContent = '正在调用一次模型…';
      try { const r = await api('/api/model/test', { method: 'POST', body: {} }); label.textContent = `连接正常 · ${r.model} · ${r.latencyMs} ms`; }
      catch (err) { label.textContent = err.message; }
      finally { e.target.disabled = false; }
    };
  }
  async function openAgents() {
    try {
      const r = await api('/api/agents');
      S.agents = r.agents || [];
      modal('研究角色', `<div class="agents-grid">${S.agents.map(a => `<article class="card agent-card ${a.id === S.agentId ? 'selected' : ''}"><h3>${esc(a.name)}</h3><p class="panel-note">${esc(a.description || '')}</p><button class="ghost-btn" data-agent="${esc(a.id)}">${a.id === S.agentId ? '当前角色' : '设为当前角色'}</button></article>`).join('')}</div><p class="panel-note">当前为单模型多角色：不同角色用系统提示约束同一个 Qwen 模型，执行记录会保存角色名称。</p>`);
      $$('[data-agent]').forEach(b => b.onclick = () => { S.agentId = b.dataset.agent; const a = S.agents.find(x => x.id === S.agentId); const label = $('#research-mode span'); if (label) label.textContent = a ? a.name : '研究模式'; closeModal(); toast(`已切换为「${a ? a.name : S.agentId}」`); });
    } catch (e) { toast(e.message); }
  }
  async function openTrash() {
    try {
      const r = await api(`/api/projects/${S.projectId}/trash`);
      modal('回收站', `${(r.chats || []).length ? `<section class="card"><div class="card-heading">已归档对话</div>${r.chats.map(c => `<p class="file-row"><span>${esc(c.title)}</span><button class="ghost-btn" data-restore-chat="${esc(c.id)}">恢复</button></p>`).join('')}</section>` : ''}
        ${(r.files || []).length ? `<section class="card"><div class="card-heading">已移除文件</div>${r.files.map(f => `<p class="file-row"><span>${esc(f.path)}</span><button class="ghost-btn" data-restore-file="${esc(f.id)}">恢复</button></p>`).join('')}</section>` : ''}
        ${!(r.chats || []).length && !(r.files || []).length ? '<div class="card panel-empty">回收站是空的</div>' : ''}`);
      $$('[data-restore-chat]').forEach(b => b.onclick = async () => { try { await api(`/api/chats/${b.dataset.restoreChat}/restore`, { method: 'POST', body: {} }); await refreshProject(); openTrash(); } catch (e) { toast(e.message); } });
      $$('[data-restore-file]').forEach(b => b.onclick = async () => { try { await api(`/api/trash/${b.dataset.restoreFile}/restore`, { method: 'POST', body: {} }); await refreshProject(); openTrash(); } catch (e) { toast(e.message); } });
    } catch (e) { toast(e.message); }
  }
  function openMore() {
    modal('任务操作', `<div class="modal-actions vertical"><button class="ghost-btn" data-more="rename">重命名当前任务</button><button class="ghost-btn" data-more="trash">移入回收站</button><a class="ghost-btn" href="/api/projects/${S.projectId}/export" download>导出研究空间 ZIP</a><button class="ghost-btn" data-more="advanced">打开高级工作台</button></div>`);
    $$('[data-more]').forEach(b => b.onclick = () => {
      if (b.dataset.more === 'rename') openRename();
      if (b.dataset.more === 'trash') trashChat();
      if (b.dataset.more === 'advanced') location.href = '/?advanced=1';
    });
  }
  function openRename() {
    const t = S.detail?.chat?.title || '';
    modal('重命名任务', `<form class="settings-form" id="rename-form"><label>任务名称<input name="title" required maxlength="100" value="${esc(t)}"></label><div class="modal-actions"><button class="primary-btn" type="submit">保存</button><button class="ghost-btn" type="button" data-close>取消</button></div></form>`);
    $('#rename-form').onsubmit = async e => {
      e.preventDefault();
      try { await api(`/api/chats/${S.chatId}`, { method: 'PUT', body: { title: new FormData(e.target).get('title') } }); closeModal(); await selectChat(S.chatId); await refreshProject(); }
      catch (err) { toast(err.message); }
    };
    $$('[data-close]').forEach(b => b.onclick = closeModal);
  }
  async function trashChat() {
    if (!S.chatId) { toast('当前没有任务'); return; }
    try { await api(`/api/chats/${S.chatId}`, { method: 'DELETE', body: {} }); closeModal(); const prevId = S.chatId; await refreshProject(); const next = S.chats.filter(c => !c.archived && c.id !== prevId)[0]?.id || ''; await selectChat(next); toast('已移入回收站'); }
    catch (e) { toast(e.message); }
  }
  async function newChat() {
    try {
      const c = await api(`/api/projects/${S.projectId}/chats`, { method: 'POST', body: {} });
      await refreshProject(); await selectChat(c.id); $('#message').focus();
    } catch (e) { toast(e.message); }
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind() {
    $('#composer').addEventListener('submit', e => { e.preventDefault(); send(); });
    const input = $('#message');
    input.addEventListener('input', syncComposer);
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    $('#attach').onclick = () => $('#attachment').click();
    $('#attachment').onchange = e => { attachFiles(e.target.files).catch(err => toast(err.message)); e.target.value = ''; };
    $('#settings').onclick = openSettings;
    $('#rename').onclick = openRename;
    $('#more').onclick = openMore;
    $('.trash').onclick = openTrash;
    $('#toggle-panel').onclick = () => $('#inspector').classList.toggle('panel-hidden');
    $('#close-modal').onclick = closeModal;
    $('#modal').addEventListener('click', e => { if (e.target === $('#modal')) closeModal(); });
    $('.new-task').onclick = newChat;
    $('#research-mode').onclick = openAgents;
    const toggles = $$('.tool.toggle');
    const netToggle = toggles[0], deepToggle = toggles[1];
    if (netToggle) netToggle.onclick = () => { S.network = !S.network; netToggle.setAttribute('aria-pressed', String(S.network)); toast(S.network ? '已允许联网检索' : '已关闭联网检索'); };
    if (deepToggle) deepToggle.onclick = () => { S.deep = !S.deep; deepToggle.setAttribute('aria-pressed', String(S.deep)); toast(S.deep ? '已启用深度分析' : '已关闭深度分析'); };
    $$('.main-nav button').forEach(b => b.onclick = () => {
      const nav = b.dataset.nav;
      $$('.main-nav button').forEach(x => x.classList.toggle('active', x === b));
      if (nav === '工作台') inspectorTab = 'progress';
      else if (nav === '研究空间') inspectorTab = 'files';
      else if (nav === '文献库') inspectorTab = 'references';
      else if (nav === '数据集') inspectorTab = 'results';
      else if (nav === '智能体团队') { openAgents(); return; }
      else if (nav === '工具箱') { toast('文件、代码、网页和电脑操作都在对话里直接调用'); return; }
      renderInspector();
    });
    $$('.inspector-tabs button').forEach(b => b.onclick = () => { inspectorTab = b.dataset.tab; renderInspector(); });
    document.addEventListener('click', e => {
      const ap = e.target.closest('[data-approval]');
      if (ap) { e.preventDefault(); answerApproval(ap.dataset.approval, ap.dataset.approve === 'yes'); return; }
      const prompt = e.target.closest('[data-prompt]');
      if (prompt) { input.value = prompt.dataset.prompt; input.focus(); return; }
    });
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); newChat(); }
      if (e.key === 'Escape') closeModal();
    });
  }

  function renderBootError(message) {
    $('#conversation').innerHTML = `<div class="card panel-empty"><h2>无法连接本地 AgentOS 服务</h2><p class="panel-note">${esc(message)}</p><p class="panel-note">请确认本机 AgentOS 服务正在运行，然后刷新页面。</p></div>`;
  }

  async function boot() {
    try {
      bind();
      const b = await api('/api/bootstrap');
      S.token = b.token; S.settings = b.settings || {};
      S.network = S.settings.networkEnabled !== false;
      const netToggle = $$('.tool.toggle')[0];
      if (netToggle) netToggle.setAttribute('aria-pressed', String(S.network));
      let projects = b.projects || [];
      if (!projects.length) projects = [await api('/api/projects', { method: 'POST', body: { name: '我的研究空间' } })];
      S.projectId = projects[0].id;
      S.agents = (await api('/api/agents').catch(() => ({ agents: [] }))).agents || [];
      await refreshProject();
      const last = localStorage.getItem('agentos.lastChat');
      const id = S.chats.some(c => c.id === last) ? last : S.chats[0]?.id;
      if (id) await selectChat(id);
      else { S.chatId = ''; S.detail = null; renderConversation(); renderInspector(); }
      connectEvents();
      document.title = 'AgentOS · 研究空间';
    } catch (e) { renderBootError(e.message); }
  }

  boot();
})();
