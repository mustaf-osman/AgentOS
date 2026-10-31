// Research workspace: presentation over the existing local chat and tool APIs.
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = {
  plus:'M12 5v14M5 12h14', send:'m4 4 17 8-17 8 4-8-4-8Zm4 8h13',
  stop:'M6 6h12v12H6z', folder:'M3 7V5a1 1 0 0 1 1-1h6l2 3h8a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z',
  settings:'M4 7h16M4 17h16M8 4v6M16 14v6', menu:'M4 6h16M4 12h16M4 18h16',
  chat:'M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 3V6a2 2 0 0 1 1-2Z',
  arrow:'M5 12h14m-6-6 6 6-6 6', close:'m6 6 12 12M6 18 18 6',
  file:'M5 3h9l5 5v13H5V3Zm9 0v6h5M8 13h8M8 17h5', check:'m5 12 4 4L20 5',
  chevron:'m9 5 7 7-7 7', down:'m6 9 6 6 6-6',
  search:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 6 6',
  grid:'M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z',
  book:'M12 6c-3-3-7-3-10-2v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 2Zm0 0v15',
  chart:'M4 3v17h17M8 15v-4m5 4V7m5 8v-6',
  layers:'m12 3 10 5-10 5L2 8l10-5Zm-10 9 10 5 10-5M2 16l10 5 10-5',
  globe:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z',
  panel:'M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm11 0v16',
  chip:'M7 7h10v10H7V7ZM9 2v5m6-5v5M9 17v5m6-5v5M2 9h5m-5 6h5m10-6h5m-5 6h5',
  monitor:'M3 4h18v13H3V4Zm5 17h8m-4-4v4',
  spark:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z',
  clock:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2',
  external:'M14 3h7v7m-1-6-9 9M10 5H4v15h15v-6',
  download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  copy:'M8 8h12v13H8V8ZM4 16H2V2h12v2', shield:'m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6',
};
const icon = name => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.chat}"/></svg>`;
const mark = () => `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2.7 28 9.5v13L16 29.3 4 22.5v-13Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="m10 21 6-12 6 12m-9.5-5h7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const S = {token:'', projectId:null, projects:[], settings:{}, chats:[], chatId:null, detail:null, project:null, draft:'', attachments:[], sending:false, uploading:false, menu:false, inspector:false, collapsed:false, tab:'progress', query:'', loading:false};
let refreshTimer, toastTimer, stream, requestSerial = 0, projectSerial = 0, renderKey = '';
const base = () => `/api/projects/${S.projectId}`;
const active = () => S.detail?.tasks?.find(t => ['RUNNING','WAITING_APPROVAL'].includes(t.status));
const projectActive = () => S.project?.tasks?.find(t => ['RUNNING','WAITING_APPROVAL'].includes(t.status));
const latest = () => active() || S.detail?.tasks?.at(-1);
const artifact = (path, preview = false) => `${base()}/artifact?path=${encodeURIComponent(path)}${preview ? '&view=1' : ''}`;
const date = value => value ? new Intl.DateTimeFormat('zh-CN', {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value)) : '';
const size = bytes => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes/1024).toFixed(1)} KB` : `${(bytes/1048576).toFixed(1)} MB`;
const safeURL = value => { try { const u = new URL(value); return ['http:','https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
const parseResult = e => { try { return typeof e.result === 'string' ? JSON.parse(e.result) : e.result || {}; } catch { return {}; } };
const toolNames = {list_files:'查看研究文件',read_file:'读取文件',read_pdf:'阅读 PDF',write_file:'保存研究成果',run_python:'运行分析代码',search_papers:'检索公开文献',read_web:'阅读网页',browser_open:'打开研究网页',browser_click:'操作网页控件',browser_fill:'填写网页内容',desktop_apps:'查找电脑应用',desktop_launch:'打开应用',desktop_focus:'切换窗口',desktop_windows:'读取窗口',desktop_inspect:'查看应用控件',desktop_invoke:'操作应用',desktop_set_value:'输入文字',set_plan:'制定研究计划',screen_capture:'查看电脑屏幕',computer_click:'点击屏幕',computer_type:'输入文本',computer_key:'操作键盘',computer_scroll:'滚动屏幕',computer_drag:'拖拽屏幕',run_shell:'执行本机命令'};
const states = {RUNNING:['任务进行中','running'],WAITING_APPROVAL:['等待你确认','waiting'],COMPLETED:['本轮已完成','complete'],NEEDS_REVIEW:['结果待复核','waiting'],FAILED:['执行遇到问题','error'],CANCELLED:['本轮已停止','idle'],INTERRUPTED:['本轮已中断','idle']};
function toast(message) {
  $('#toast').textContent = message; $('#toast').classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 5000);
}
async function api(url, options = {}) {
  const response = await fetch(url, {...options, headers:{'Content-Type':'application/json','x-agentos-token':S.token}, body:options.body === undefined ? undefined : JSON.stringify(options.body)});
  const data = await response.json();
  if (!response.ok) throw Error(data.error || '请求失败，请重试。');
  return data;
}
function inline(text) {
  let out = '', last = 0;
  for (const m of text.matchAll(/`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g)) {
    out += esc(text.slice(last,m.index));
    out += m[1] ? `<code>${esc(m[1])}</code>` : m[2] ? `<strong>${esc(m[2])}</strong>` : `<a href="${esc(safeURL(m[4]))}" target="_blank" rel="noreferrer">${esc(m[3])}${icon('external')}</a>`;
    last = m.index + m[0].length;
  }
  return out + esc(text.slice(last));
}
function rich(text) {
  let code = false, buffer = [], out = '', list = false;
  for (const line of String(text || '').split('\n')) {
    if (line.startsWith('```')) {
      if (list) { out += '</ul>'; list = false; }
      if (code) { out += `<pre><code>${esc(buffer.join('\n'))}</code></pre>`; buffer = []; }
      code = !code; continue;
    }
    if (code) { buffer.push(line); continue; }
    const bullet = line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/);
    if (bullet) { if (!list) out += '<ul>'; list = true; out += `<li>${inline(bullet[1])}</li>`; continue; }
    if (list) { out += '</ul>'; list = false; }
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    out += heading ? `<h3>${inline(heading[1])}</h3>` : line.trim() ? `<p>${inline(line)}</p>` : '<div class="message-gap"></div>';
  }
  if (list) out += '</ul>';
  if (code) out += `<pre><code>${esc(buffer.join('\n'))}</code></pre>`;
  return out;
}
function layout() {
  document.body.classList.add('chat-ui');
  document.title = 'AgentOS · 研究工作台';
  $('#app').innerHTML = `<div class="chat-app">
    <aside class="chat-sidebar" aria-label="工作区导航">
      <div class="sidebar-brand-row"><a class="chat-brand" href="#chat" data-do="workspace"><span class="brand-symbol">${mark()}</span><span>AgentOS</span></a><button class="chat-icon" data-do="spaces" aria-label="切换研究空间" title="切换研究空间">${icon('layers')}</button></div>
      <button class="new-chat" data-do="new">${icon('plus')}<span>新建任务</span><kbd>Ctrl K</kbd></button>
      <nav class="sidebar-nav" aria-label="主导航">
        <button class="nav-item" data-do="workspace" aria-current="page">${icon('grid')}<span>研究工作台</span><small>AI</small></button>
        <button class="nav-item" data-do="spaces">${icon('layers')}<span>研究空间</span></button>
        <button class="nav-item" data-tab="sources">${icon('book')}<span>文献与资料</span></button>
        <button class="nav-item" data-tab="data">${icon('chart')}<span>数据与结果</span></button>
        <button class="nav-item" data-do="tools">${icon('settings')}<span>工具与设备</span></button>
      </nav>
      <div class="history-heading"><span>最近的任务</span><button class="chat-icon" data-do="search" aria-label="搜索历史任务" title="搜索历史任务">${icon('search')}</button></div>
      <div class="history-search" hidden><input id="history-search" type="search" placeholder="搜索任务…" aria-label="搜索任务"></div>
      <nav id="chat-history" aria-label="历史任务"></nav>
      <div class="sidebar-footer">
        <button class="device-status" data-do="device">${icon('chip')}<div><strong>ESP32 设备</strong><small>尚未连接</small></div><span class="status-dot gray"></span></button>
        <button class="profile-button" data-do="spaces"><span class="profile-avatar">R</span><div><strong>我的研究空间</strong><small id="workspace-name">本地工作空间</small></div>${icon('down')}</button>
      </div>
    </aside>
    <button class="chat-shade" data-do="menu" aria-label="关闭导航"></button>
    <div class="chat-main">
      <header class="chat-top"><div class="chat-top-left"><button class="chat-icon mobile-menu" data-do="menu" aria-label="展开导航" aria-expanded="false">${icon('menu')}</button><div class="title-stack"><span class="title-overline">RESEARCH WORKSPACE</span><h1 class="chat-page-title" id="chat-title">新的研究，从这里开始</h1></div></div>
      <div class="chat-top-right"><button class="model-pill" data-do="settings" title="模型与连接设置"><span class="status-dot ${S.settings.hasKey ? 'green' : 'gray'}"></span><span class="model-label">${esc(modelLabel())}</span>${icon('down')}</button><button class="chat-icon" data-do="inspector" aria-label="切换任务面板" title="任务面板">${icon('panel')}</button></div></header>
      <main class="chat-thread" id="chat-thread" aria-label="对话内容"></main>
      <div class="composer-dock"><div class="attachment-chips" id="attachment-chips"></div>
        <form class="chat-composer" id="chat-form"><textarea id="chat-input" aria-label="给 AgentOS 发消息" placeholder="描述你的目标，让 AgentOS 帮你推进…" maxlength="12000" rows="2"></textarea>
        <div class="chat-composer-actions"><div class="composer-tools">
          <button type="button" class="chat-icon" data-do="upload" aria-label="添加研究文件" title="添加研究文件">${icon('plus')}</button>
          <button type="button" class="composer-tool ${S.settings.networkEnabled ? 'enabled' : ''}" data-do="network" title="查看联网搜索设置">${icon('globe')}<span>联网搜索</span></button>
          <button type="button" class="composer-tool" data-do="tools" title="查看可用研究工具">${icon('spark')}<span>研究工具</span>${icon('down')}</button>
        </div><div class="composer-send-group"><small class="input-hint">Enter</small><button type="button" class="chat-stop" id="chat-stop" data-do="stop" hidden aria-label="停止当前任务">${icon('stop')}</button><button class="chat-send" id="chat-send" type="submit" aria-label="发送消息">${icon('send')}</button></div></div></form>
        <div class="composer-caption"><span>${icon('shield')} 执行过程可查看，关键操作由你确认</span><span>Shift + Enter 换行</span></div>
      </div>
    </div>
    <button class="inspector-shade" data-do="close-inspector" aria-label="关闭任务面板"></button>
    <aside class="research-panel" aria-label="任务详情">
      <header class="panel-header"><span class="panel-eyebrow">RESEARCH DESK</span><div class="panel-title-row"><h2>任务空间</h2><button class="chat-icon" data-do="close-inspector" aria-label="收起任务面板" title="收起任务面板">${icon('panel')}</button></div>
        <div class="inspector-tabs" role="tablist" aria-label="任务详情分类">${[['progress','任务进度'],['sources','参考资料'],['data','数据结果'],['files','产出文件']].map(([id,label]) => `<button id="tab-${id}" role="tab" data-tab="${id}" aria-controls="inspector-body" aria-selected="${S.tab===id}" tabindex="${S.tab===id ? 0 : -1}">${label}</button>`).join('')}</div>
      </header><div id="inspector-body" class="panel-body" role="tabpanel" aria-labelledby="tab-progress"></div>
      <div class="panel-bottom">${icon('shield')} 记录与文件保存在当前研究空间</div>
    </aside>
  </div>`;
  renderHistory(); renderThread(true); renderInspector(); syncPanels(); syncSettings();
}
function modelLabel() { return /qwen/i.test(S.settings.model || '') ? 'Qwen' : S.settings.model || '连接模型'; }
function renderHistory() {
  const chats = S.chats.filter(c => c.title.toLowerCase().includes(S.query.toLowerCase()));
  $('#chat-history').innerHTML = chats.length ? chats.map(c => `<button class="history-item ${c.id===S.chatId ? 'selected' : ''}" data-chat="${esc(c.id)}" title="${esc(c.title)}" ${c.id===S.chatId ? 'aria-current="true"' : ''}>${icon('chat')}<span class="history-copy"><strong>${esc(c.title)}</strong><span>${date(c.updatedAt)}</span></span></button>`).join('') : `<p class="no-history">${S.query ? '没有找到相关任务' : '每一次探索，都从一个问题开始。<br>任务记录会保存在这里。'}</p>`;
  $('#chat-title').textContent = S.chats.find(c => c.id===S.chatId)?.title || '新的研究，从这里开始';
  $('#workspace-name').textContent = S.projects.find(p => p.id===S.projectId)?.name || '本地工作空间';
}
const prompts = [
  ['book','探索研究方向','寻找文献，梳理脉络','我想围绕一个研究主题开展文献调研，请先问我研究主题、时间范围和希望得到的成果。'],
  ['chart','让数据说话','分析数据，发现线索','我想分析一份数据并生成图表，请先帮我确认数据文件、分析目标和需要的输出。'],
  ['file','读懂研究资料','阅读论文，提炼要点','请先查看研究空间中可用的文档，帮我选择一份资料进行阅读、总结和关键结论提取。'],
  ['monitor','把操作交给 AI','连接工具，推进任务','我想让你协助操作电脑，请先介绍目前可用的电脑操作能力和需要我确认的事项。'],
];
function welcome() {
  const count = S.project?.files?.length || 0;
  return `<div class="chat-welcome"><div class="welcome-kicker"><span class="welcome-logo">${mark()}</span><span>YOUR RESEARCH COMPANION</span></div>
    <h1>从一个问题，<br><span>走向新的发现。</span></h1><p class="welcome-description">把想法交给 AgentOS。一起读资料、分析数据，<br>让研究的每一步，都有迹可循。</p>
    <div class="starter-prompts">${prompts.map(([i,title,desc,prompt]) => `<button class="prompt-card" data-prompt="${esc(prompt)}"><span class="prompt-icon">${icon(i)}</span><strong>${title}</strong><p>${desc}</p>${icon('arrow')}</button>`).join('')}</div>
    <div class="workspace-context">${icon('folder')}<span>${count ? `研究空间中有 ${count} 个文件，随时可用` : '带上你的论文、数据或一个想法'}</span><button data-do="${count ? 'files' : 'upload'}">${count ? '查看文件' : '添加资料'} ${icon('plus')}</button></div>
  </div>`;
}
function planSteps(steps) {
  return steps.map((step,i) => `<div class="plan-step ${esc(step.status)}"><span class="step-index">${step.status==='done' ? icon('check') : i+1}</span><div class="step-copy"><strong>${esc(step.title)}</strong><small>${{done:'已完成',running:'正在进行',failed:'需要检查',pending:'等待执行'}[step.status] || '等待执行'}</small></div>${step.status==='running' ? '<span class="spinner"></span>' : ''}</div>`).join('');
}
function approvalCard(a) {
  return `<section class="inline-approval"><strong>${icon('shield')} 这一步，需要你确认</strong><p>${esc(a.args?.purpose || toolNames[a.tool] || a.tool)}</p><details data-detail-key="approval-${esc(a.id)}"><summary>查看具体操作</summary><pre>${esc(a.args?.code || JSON.stringify(a.args,null,2))}</pre></details><p class="approval-caption">${a.tool==='run_python' ? '代码将在本机运行，请核对读写内容。' : a.tool==='run_shell' ? '命令将在本机 PowerShell 运行，请核对内容。' : a.tool?.startsWith('computer_') ? '即将操作鼠标、键盘或屏幕，请核对目标。' : '即将操作 Windows 应用，请核对目标。'}</p><div><button data-approval="${esc(a.id)}" data-allow="yes" class="approve-yes">允许这次操作 ${icon('arrow')}</button><button data-approval="${esc(a.id)}" data-allow="no">拒绝</button></div></section>`;
}
function turn(task) {
  const events = (S.detail.events || []).filter(e => e.taskId===task.id);
  const tools = events.filter(e => e.type==='tool');
  const pending = ['RUNNING','WAITING_APPROVAL'].includes(task.status);
  const reply = task.summary || events.filter(e => e.type==='assistant').map(e => e.text).join('\n\n');
  const approvals = (S.detail.approvals || []).filter(a => a.taskId===task.id);
  const shots = events.filter(e => e.type==='tool_result' && e.name==='screen_capture').map(parseResult).filter(r => r.path);
  return `<section class="chat-turn" data-task="${esc(task.id)}"><div class="user-message-row"><div class="user-message">${esc(task.prompt)}</div><span class="user-avatar">R</span></div>
    <div class="assistant-message"><div class="assistant-avatar">${mark()}</div><div class="assistant-body">
    <div class="assistant-meta"><strong>AgentOS</strong><span>研究伙伴</span><time>${date(task.startedAt)}</time></div>
    ${task.steps?.length ? `<div class="inline-plan"><div class="inline-plan-heading">${icon('layers')} 研究执行计划 <span>${task.steps.filter(s=>s.status==='done').length}/${task.steps.length}</span></div>${planSteps(task.steps)}</div>` : ''}
    ${tools.length ? `<details class="tool-activity" data-detail-key="tools-${esc(task.id)}"><summary>${icon(pending ? 'clock' : 'check')}<span>${pending ? toolNames[tools.at(-1).name] || '正在处理' : `已执行 ${tools.length} 步操作`}</span>${icon('down')}</summary><div class="tool-lines">${tools.map(e => `<p>${icon('chevron')} ${esc(toolNames[e.name] || e.name)}</p>`).join('')}</div></details>` : ''}
    ${shots.length ? `<div class="screen-strip">${shots.slice(-4).map(shot => `<button data-file="${esc(shot.path)}"><img src="${artifact(shot.path,true)}" alt="执行时的屏幕截图" loading="lazy"></button>`).join('')}</div>` : ''}
    ${reply ? `<div class="message-rich">${rich(reply)}</div>` : pending ? `<div class="thinking"><span class="spinner"></span>${task.status==='WAITING_APPROVAL' ? '等待你的确认' : '正在理解问题，准备下一步…'}</div>` : ''}
    ${approvals.map(approvalCard).join('')}${task.error ? `<div class="chat-error">${esc(task.error)}</div>` : ''}
    ${task.status==='NEEDS_REVIEW' ? `<p class="review-note">${icon('shield')}${esc(task.reviewReason || '请复核结果；你可以继续追问或补充要求。')}</p>` : ''}
    ${['CANCELLED','INTERRUPTED'].includes(task.status) ? '<p class="review-note">本轮已停止，已有内容仍然保留。</p>' : ''}
    ${!pending && reply ? `<div class="reply-actions"><button data-copy="${esc(task.id)}" title="复制回答" aria-label="复制回答">${icon('copy')}</button><button data-tab="progress">${icon('layers')} 查看执行记录</button></div>` : ''}
    </div></div></section>`;
}
function renderThread(force = false) {
  const thread = $('#chat-thread'); if (!thread) return;
  const tasks = S.detail?.tasks || [];
  const key = JSON.stringify([S.chatId,S.loading,S.detail,S.project?.files?.length]);
  if (force || key!==renderKey) {
    const nearBottom = thread.scrollHeight-thread.scrollTop-thread.clientHeight < 130;
    const top = thread.scrollTop;
    const open = [...thread.querySelectorAll('details[open]')].map(d => d.dataset.detailKey);
    thread.innerHTML = S.loading ? `<div class="loading-state"><span class="spinner"></span><p>正在打开任务记录…</p></div>` : tasks.length ? `<div class="messages">${tasks.map(turn).join('')}</div>` : welcome();
    for (const d of thread.querySelectorAll('details')) d.open = open.includes(d.dataset.detailKey);
    thread.scrollTop = force || (tasks.length && nearBottom) ? thread.scrollHeight : top;
    renderKey = key;
  }
  const running = active(), busy = !!projectActive() || !!running || S.sending || S.loading || S.uploading;
  $('#chat-send').disabled = busy || !S.draft.trim();
  $('#chat-stop').hidden = !running; $('#chat-send').hidden = !!running;
  renderHistory(); renderInspector();
}
function sourceRecords() {
  const collected = (S.project?.sources || []).filter(s => !S.chatId || S.detail?.tasks?.some(t => t.id===s.taskId)).map(s => ({...s,kind:'已阅读网页'}));
  for (const event of S.detail?.events || []) {
    if (event.type==='tool_result' && event.name==='search_papers') {
      const result = parseResult(event);
      for (const item of result.items || []) collected.push({...item,kind:`${result.provider || '文献'} · 检索记录`});
    }
  }
  return [...new Map(collected.filter(s => safeURL(s.url)).map(s => [s.url,s])).values()];
}
function emptyPanel(i,title,description) { return `<div class="empty-panel"><span class="empty-panel-icon">${icon(i)}</span><h3>${title}</h3><p>${description}</p></div>`; }
function fileRows(files) {
  return files.map(f => `<button class="asset-row" data-file="${esc(f.path)}"><span class="asset-type">${esc((f.ext || 'FILE').slice(0,4).toUpperCase())}</span><div><strong>${esc(f.path.split('/').pop())}</strong><small>${size(f.bytes)} · ${date(f.modifiedAt)}</small></div>${icon('chevron')}</button>`).join('');
}
function elapsed(task) {
  if (!task?.startedAt) return '';
  const seconds = Math.max(0,Math.floor((new Date(task.finishedAt || Date.now())-new Date(task.startedAt))/1000));
  return seconds < 60 ? `${seconds} 秒` : `${Math.floor(seconds/60)} 分 ${seconds%60} 秒`;
}
function renderInspector() {
  const body = $('#inspector-body'); if (!body) return;
  document.querySelectorAll('.inspector-tabs [role=tab]').forEach(b => { const selected = b.dataset.tab===S.tab; b.setAttribute('aria-selected',selected); b.tabIndex = selected ? 0 : -1; });
  body.setAttribute('aria-labelledby',`tab-${S.tab}`);
  const task = latest(), files = (S.project?.files || []).slice().sort((a,b) => b.modifiedAt.localeCompare(a.modifiedAt));
  let html = '';
  if (S.tab==='progress') {
    const [label,status] = states[task?.status] || ['准备就绪','idle'];
    const steps = task?.steps || [], done = steps.filter(s=>s.status==='done').length;
    const taskEvents = (S.detail?.events || []).filter(e=>e.taskId===task?.id);
    const events = taskEvents.filter(e=>['tool','tool_result','tool_error'].includes(e.type)).slice(-4).reverse();
    html = `<section class="inspector-card progress-summary"><div class="card-heading"><span class="progress-icon">${icon('layers')}</span><span class="status-pill ${status}">${label}</span></div><h3>${task ? '研究正在逐步展开' : '让想法，开始行动'}</h3><p>${task ? `执行记录随任务实时更新${task.startedAt ? ' · '+elapsed(task) : ''}` : '发出一个目标，计划与执行过程会在这里展开。'}</p>
      ${steps.length ? `<div class="progress-track" role="progressbar" aria-label="计划完成进度" aria-valuenow="${done}" aria-valuemin="0" aria-valuemax="${steps.length}"><span style="width:${done/steps.length*100}%"></span></div><div class="progress-count"><strong>${done}<small> / ${steps.length} 步</small></strong><span>已完成的计划</span></div>` : `<div class="progress-track ${task?.status==='RUNNING' ? 'indeterminate' : ''}"><span style="width:0%"></span></div><div class="progress-count"><span>${task ? '等待任务计划或直接回答' : '计划 · 执行 · 复核'}</span>${icon('arrow')}</div>`}</section>`;
    html += steps.length ? `<section class="inspector-card inspector-plan"><div class="card-heading"><h3>执行步骤</h3><span>${steps.length} 步</span></div>${planSteps(steps)}</section>` : `<section class="inspector-card"><div class="card-heading"><h3>每一步，都清晰可见</h3>${icon('shield')}</div><div class="execution-row">${icon('book')}<div><strong>资料与来源</strong><small>查过的文献和读过的网页</small></div></div><div class="execution-row">${icon('chart')}<div><strong>分析与执行</strong><small>任务步骤和工具运行记录</small></div></div><div class="execution-row">${icon('file')}<div><strong>结果与交付</strong><small>图表、报告与可复核文件</small></div></div></section>`;
    if (events.length) html += `<section class="inspector-card"><div class="card-heading"><h3>最近执行</h3><span>实时记录</span></div>${events.map(e => `<div class="execution-row">${icon(e.type==='tool_error' ? 'close' : e.type==='tool_result' ? 'check' : 'clock')}<div><strong>${esc(toolNames[e.name] || e.name)}</strong><small>${e.type==='tool_result' ? '结果已返回' : e.type==='tool_error' ? '执行失败，请查看记录' : '开始执行'}</small></div></div>`).join('')}</section>`;
    html += `<div class="session-stats"><div><strong>${S.detail?.tasks?.length || 0}</strong><small>对话轮次</small></div><div><strong>${S.detail?.tasks?.reduce((n,t)=>n+(t.toolCount||0),0) || 0}</strong><small>工具调用</small></div><div><strong>${files.length}</strong><small>空间文件</small></div></div><button class="device-mini" data-do="device">${icon('chip')}<div><strong>ESP32 · 连接真实世界</strong><small>设备尚未连接</small></div><span class="status-dot gray"></span></button>`;
  } else if (S.tab==='sources') {
    const sources = sourceRecords();
    html = `<div class="panel-section-label"><span>${S.chatId ? '当前对话的参考资料' : '研究空间参考资料'}</span><span>${sources.length}</span></div>` + (sources.length ? sources.map(s => `<a class="source-item inspector-card" href="${esc(safeURL(s.url))}" target="_blank" rel="noreferrer"><div class="source-icon">${icon('book')}</div><div><strong>${esc(s.title || s.url)}</strong><small>${esc(s.kind)}${s.date ? ' · '+esc(s.date) : ''}</small></div>${icon('external')}</a>`).join('') : emptyPanel('book','为每个结论，找到来源','开始一次文献检索或网页阅读，引用资料会自动汇集在这里。'));
    html += '<p class="panel-note">检索记录与已阅读的网页分别标注，方便回到原始来源核对。</p>';
  } else if (S.tab==='data') {
    const data = files.filter(f=>['csv','json','svg','png','jpg','jpeg'].includes(f.ext));
    const image = data.find(f=>['svg','png','jpg','jpeg'].includes(f.ext) && !f.path.startsWith('screenshots/'));
    html = `<div class="panel-section-label"><span>研究空间的数据与图表</span><span>${data.length}</span></div>`;
    if (image) html += `<button class="inspector-card data-preview" data-file="${esc(image.path)}"><img src="${artifact(image.path,true)}" alt="${esc(image.path.split('/').pop())}" loading="lazy"><span class="data-preview-caption">${esc(image.path.split('/').pop())}${icon('external')}</span></button>`;
    html += data.length ? `<section class="inspector-card">${fileRows(data)}</section>` : emptyPanel('chart','让结果，有据可查','上传数据或完成一次分析后，在这里查看数据文件与生成的图表。');
  } else {
    html = `<div class="panel-section-label"><span>当前研究空间的全部文件</span><span>${files.length}</span></div>`;
    html += files.length ? `<section class="inspector-card">${fileRows(files)}</section><a class="text-link" href="${base()}/export">${icon('download')} 导出研究空间</a>` : emptyPanel('folder','为研究留下成果','添加的资料、生成的报告和运行记录都会保存在这里。') + '<button class="btn" data-do="upload">添加研究文件</button>';
  }
  if (body.innerHTML!==html) { const scroll = body.scrollTop; body.innerHTML = html; body.scrollTop = scroll; }
}
function syncPanels() {
  const app = $('.chat-app'); if (!app) return;
  const mobile = matchMedia('(max-width:760px)').matches, narrow = matchMedia('(max-width:1150px)').matches;
  app.classList.toggle('drawer-open',S.menu); app.classList.toggle('inspector-open',S.inspector); app.classList.toggle('panel-collapsed',S.collapsed);
  $('.chat-sidebar').inert = mobile && !S.menu;
  $('.research-panel').inert = narrow ? !S.inspector : S.collapsed;
  $('.mobile-menu').setAttribute('aria-expanded',String(S.menu));
  $('[data-do="inspector"]').setAttribute('aria-expanded',String(narrow ? S.inspector : !S.collapsed));
}
function showPanel(tabName = S.tab) {
  S.tab = tabName; S.collapsed = false; S.inspector = true; S.menu = false; syncPanels(); renderInspector();
}
function remember() { localStorage.setItem('agentos.chat',S.chatId || 'new'); localStorage.setItem('agentos.project',S.projectId); }
async function refreshProject() {
  const id = S.projectId, serial = ++projectSerial;
  const data = await api(`/api/projects/${id}`);
  if (id!==S.projectId || serial!==projectSerial) return;
  S.project = data; renderThread();
}
async function listChats() {
  const id = S.projectId, data = await api(`/api/projects/${id}/chats`);
  if (id!==S.projectId) return;
  S.chats = (data.chats || []).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)); renderHistory();
}
async function loadChat(id, force = true) {
  const serial = ++requestSerial, detail = await api(`/api/chats/${id}`);
  if (serial!==requestSerial || S.chatId!==id) return;
  S.detail = detail; S.loading = false; renderThread(force);
}
async function chooseChat(id) {
  if (S.sending || S.uploading) return;
  S.chatId = id; S.detail = null; S.loading = true; S.attachments = []; S.menu = false;
  remember(); renderAttachments(); syncPanels(); renderThread();
  try { await loadChat(id); } catch(e) { S.loading = false; renderThread(); throw e; }
}
function newChat() {
  if (S.sending || S.uploading) return;
  requestSerial++; S.chatId = null; S.detail = null; S.loading = false; S.draft = ''; S.attachments = []; S.menu = false;
  $('#chat-input').value = ''; $('#chat-input').style.height = '';
  remember(); renderAttachments(); renderThread(true); syncPanels(); $('#chat-input').focus();
}
function renderAttachments() {
  $('#attachment-chips').innerHTML = S.attachments.map((p,i) => `<span>${icon('file')}${esc(p.split('/').pop())}<button data-remove="${i}" aria-label="移除附件 ${esc(p)}">${icon('close')}</button></span>`).join('');
}
async function send() {
  const input = $('#chat-input'), text = input.value.trim();
  if (!text || S.sending || S.loading || S.uploading || active()) return;
  if (projectActive()) { toast('研究空间中已有任务在运行，请等待它完成后再发送。'); return; }
  S.sending = true; renderThread();
  try {
    if (!S.chatId) { const chat = await api(`${base()}/chats`,{method:'POST',body:{}}); S.chatId = chat.id; remember(); }
    const message = text + (S.attachments.length ? '\n\n本次附件：'+S.attachments.join('、') : '');
    await api(`/api/chats/${S.chatId}/messages`,{method:'POST',body:{message}});
    input.value = ''; input.style.height = ''; S.draft = ''; S.attachments = []; renderAttachments();
    await listChats(); await loadChat(S.chatId); await refreshProject();
  } catch(e) { toast(e.message); } finally { S.sending = false; renderThread(); }
}
function modal(title, html, wide = false) {
  const d = $('#modal'); d.classList.toggle('wide-dialog',wide);
  d.innerHTML = `<div class="dialog-head"><h2>${esc(title)}</h2><button class="chat-icon" data-close aria-label="关闭">${icon('close')}</button></div>${html}`;
  if (!d.open) d.showModal();
  d.querySelector('[data-close]').onclick = () => d.close();
}
async function previewFile(path) {
  const f = S.project?.files?.find(item=>item.path===path);
  const ext = path.split('.').at(-1).toLowerCase();
  modal(path.split('/').pop(),`<p class="dialog-subtitle">${esc(path)}${f ? ' · '+size(f.bytes) : ''}</p><div class="preview-content"><span class="spinner"></span></div><div class="actions"><a class="btn primary" href="${artifact(path)}">${icon('download')} 下载文件</a><button class="btn" data-attach="${esc(path)}">${icon('plus')} 添加到对话</button></div>`,true);
  const content = $('.preview-content');
  if (['svg','png','jpg','jpeg'].includes(ext)) content.innerHTML = `<img class="preview-image" src="${artifact(path,true)}" alt="${esc(path)}">`;
  else if (ext==='pdf') content.innerHTML = emptyPanel('book','PDF 已就绪','下载查看原文，或添加到对话，让 AgentOS 阅读与提炼内容。');
  else try {
    const data = await api(`${base()}/file?path=${encodeURIComponent(path)}`);
    if (content.isConnected) content.innerHTML = ext==='md' ? `<div class="message-rich">${rich(data.content)}</div>` : `<pre>${esc(data.content)}</pre>`;
  } catch(e) { if (content.isConnected) content.innerHTML = `<p class="chat-error">${esc(e.message)}</p>`; }
}
function syncSettings() {
  const pill = $('.model-pill'); if (!pill) return;
  pill.querySelector('.model-label').textContent = modelLabel();
  pill.title = `${S.settings.model || '连接模型'} · ${S.settings.hasKey ? '凭据已配置' : '尚未配置凭据'}`;
  pill.querySelector('.status-dot').className = `status-dot ${S.settings.hasKey ? 'green' : 'gray'}`;
  $('[data-do="network"]').classList.toggle('enabled',!!S.settings.networkEnabled);
}
function showSettings() {
  const s = S.settings;
  modal('模型与连接设置',`<p class="dialog-subtitle">连接你的模型，为研究提供动力。</p><form id="chat-settings" class="form">
    <label>模型服务地址<input name="baseURL" type="url" required value="${esc(s.baseURL)}"></label>
    <label>对话模型<input name="model" required value="${esc(s.model)}"></label>
    <label>视觉模型<input name="visionModel" value="${esc(s.visionModel || '')}" placeholder="Qwen3-VL-30B-A3B-Instruct"></label>
    <label>API Key<input name="apiKey" type="password" autocomplete="new-password" placeholder="${s.hasKey ? '已保存，留空保留' : '填写服务商提供的 API Key'}"></label>
    <label class="check"><input name="networkEnabled" type="checkbox" ${s.networkEnabled ? 'checked' : ''}><span>允许检索公开网页<small>查找文献与阅读公开资料</small></span></label>
    <label class="check"><input name="desktopEnabled" type="checkbox" ${s.desktopEnabled ? 'checked' : ''}><span>启用电脑操作<small>点击、输入等操作仍需逐次确认</small></span></label>
    <p class="hint">对话和工具读取的内容会发送至你配置的模型服务。</p>
    <div class="actions"><button class="btn primary" type="submit">保存设置</button><button type="button" class="btn" data-do="check">检查已保存的连接</button></div><p class="hint" id="settings-status" role="status"></p></form>`);
}
function showSpaces() {
  modal('研究空间',`<p class="dialog-subtitle">资料、任务与成果，按研究空间整理。</p><div class="workspace-list">${S.projects.map(p=>`<button data-project="${esc(p.id)}" class="${p.id===S.projectId ? 'selected' : ''}">${icon('layers')}<div><strong>${esc(p.name)}</strong><small>${esc(p.description || '本地研究空间')}</small></div>${p.id===S.projectId ? icon('check') : icon('chevron')}</button>`).join('')}</div><form class="form" id="new-space"><label>创建新的研究空间<input name="name" required maxlength="100" placeholder="例如：新能源材料研究"></label><button class="btn primary" type="submit">${icon('plus')} 创建研究空间</button></form>`);
}
function showTools(device = false) {
  modal(device ? 'ESP32 · 设备连接' : '研究工具与设备', device ? `<div class="device-intro">${icon('chip')}<h3>把智能体，握在手中。</h3><p>ESP32 是 AgentOS 的硬件扩展入口。当前设备尚未连接，电脑端研究工具可独立使用。</p><span class="status-pill idle">未连接</span></div>` : `<p class="dialog-subtitle">从理解问题到执行任务，在同一个工作空间里完成。</p><div class="tool-grid">${[
    ['book','资料阅读','读取文本、PDF 与研究文件','可用'],['chart','分析与实验','处理数据，运行分析脚本','运行需确认'],['globe','公开资料检索','检索文献，阅读公开网页',S.settings.networkEnabled ? '已启用' : '未启用'],['monitor','电脑操作','查看应用，协助点击与输入',S.settings.desktopEnabled ? '已启用' : '未启用']
  ].map(([i,title,desc,status])=>`<div class="tool-card">${icon(i)}<strong>${title}</strong><p>${desc}</p><span class="status-pill idle">${status}</span></div>`).join('')}</div><button class="device-mini" data-do="device">${icon('chip')}<div><strong>ESP32 硬件设备</strong><small>尚未连接</small></div>${icon('chevron')}</button><div class="actions"><button class="btn primary" data-do="settings">连接与权限设置</button><a class="btn" href="?advanced=1#devices">完整工具管理 ${icon('external')}</a></div>`,!device);
}
async function switchProject(id) {
  if (S.sending || S.uploading) return;
  S.projectId = id; S.project = null; S.chats = []; S.detail = null; S.chatId = null; requestSerial++; projectSerial++;
  $('#modal').close(); newChat();
  await Promise.all([listChats(),refreshProject()]); renderThread(true);
}
async function upload(selected) {
  if (!selected.length) return;
  if (selected.length > 20) throw Error('一次最多添加 20 个文件。');
  if (selected.reduce((n,f)=>n+f.size,0)>14_000_000) throw Error('一次添加的文件总大小请控制在 14 MB 内。');
  S.uploading = true; renderThread();
  try {
    const files = [];
    for (const f of selected) {
      if (f.size>12_000_000) throw Error('单个文件不能超过 12 MB。');
      const base64 = await new Promise((resolve,reject) => { const r = new FileReader(); r.onload=()=>resolve(String(r.result).split(',')[1]); r.onerror=()=>reject(Error('文件读取失败')); r.readAsDataURL(f); });
      files.push({name:f.name,base64});
    }
    const d = await api(`${base()}/upload`,{method:'POST',body:{files}});
    S.attachments.push(...d.files.map(f=>f.path)); renderAttachments(); await refreshProject(); toast('资料已添加，告诉 AgentOS 你想怎么处理。');
  } finally { S.uploading = false; renderThread(); }
}
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-do],[data-chat],[data-prompt],[data-approval],[data-remove],[data-tab],[data-file],[data-attach],[data-copy],[data-project]');
  if (!el) return; e.preventDefault();
  try {
    if (el.dataset.chat) { await chooseChat(el.dataset.chat); return; }
    if (el.dataset.project) { await switchProject(el.dataset.project); return; }
    if (el.dataset.tab) { showPanel(el.dataset.tab); return; }
    if (el.dataset.file) { await previewFile(el.dataset.file); return; }
    if (el.dataset.attach) { if (!S.attachments.includes(el.dataset.attach)) S.attachments.push(el.dataset.attach); renderAttachments(); $('#modal').close(); $('#chat-input').focus(); return; }
    if (el.dataset.prompt) { S.draft = el.dataset.prompt; $('#chat-input').value = S.draft; resizeInput(); renderThread(); $('#chat-input').focus(); return; }
    if (el.dataset.remove!==undefined) { S.attachments.splice(Number(el.dataset.remove),1); renderAttachments(); return; }
    if (el.dataset.copy) { const t = S.detail.tasks.find(t=>t.id===el.dataset.copy); const reply = t.summary || S.detail.events.filter(e=>e.taskId===t.id && e.type==='assistant').map(e=>e.text).join('\n\n'); await navigator.clipboard.writeText(reply); toast('回答已复制。'); return; }
    if (el.dataset.approval) {
      el.disabled = true;
      try { await api(`/api/approvals/${el.dataset.approval}`,{method:'POST',body:{approve:el.dataset.allow==='yes'}}); await loadChat(S.chatId,false); }
      finally { if (el.isConnected) el.disabled = false; } return;
    }
    switch (el.dataset.do) {
      case 'menu': S.menu = !S.menu; S.inspector = false; syncPanels(); break;
      case 'workspace': S.menu = false; syncPanels(); $('#chat-input').focus(); break;
      case 'new': newChat(); break;
      case 'search': { const box=$('.history-search'); box.hidden=!box.hidden; if (!box.hidden) $('#history-search').focus(); else { S.query=''; $('#history-search').value=''; renderHistory(); } break; }
      case 'upload': $('#upload').click(); break;
      case 'files': showPanel('files'); break;
      case 'spaces': showSpaces(); break;
      case 'tools': showTools(); break;
      case 'device': showTools(true); break;
      case 'settings': case 'network': showSettings(); break;
      case 'inspector': if (matchMedia('(max-width:1150px)').matches) S.inspector = !S.inspector; else S.collapsed = !S.collapsed; S.menu=false; syncPanels(); break;
      case 'close-inspector': S.inspector=false; S.collapsed=true; syncPanels(); break;
      case 'stop': { const task=active(); if (task) { await api(`/api/tasks/${task.id}/stop`,{method:'POST',body:{}}); await loadChat(S.chatId,false); await refreshProject(); } break; }
      case 'check': {
        const label=$('#settings-status'); label.textContent='正在检查已保存的连接…'; el.disabled=true;
        try { const d=await api('/api/model/test',{method:'POST',body:{}}); label.textContent=`连接正常 · ${d.latencyMs} ms`; }
        catch(e) { label.textContent=e.message; } finally { el.disabled=false; } break;
      }
    }
  } catch(e) { toast(e.message); }
});
document.addEventListener('submit', async e => {
  if (e.target.id==='chat-form') { e.preventDefault(); await send(); return; }
  if (!['chat-settings','new-space'].includes(e.target.id)) return;
  e.preventDefault(); const f = new FormData(e.target), btn = e.submitter; if (btn) btn.disabled=true;
  try {
    if (e.target.id==='chat-settings') {
      S.settings=await api('/api/settings',{method:'PUT',body:{...S.settings,...Object.fromEntries(f),networkEnabled:f.has('networkEnabled'),desktopEnabled:f.has('desktopEnabled')}});
      syncSettings(); $('#modal').close(); toast('设置已保存。');
    } else {
      const p=await api('/api/projects',{method:'POST',body:{name:f.get('name')}});
      S.projects.push(p); await switchProject(p.id);
    }
  } catch(e) { toast(e.message); } finally { if (btn?.isConnected) btn.disabled=false; }
});
function resizeInput() { const input=$('#chat-input'); input.style.height='auto'; input.style.height=Math.min(input.scrollHeight,180)+'px'; }
document.addEventListener('input', e => {
  if (e.target.id==='chat-input') { S.draft=e.target.value; resizeInput(); $('#chat-send').disabled=!S.draft.trim() || !!active() || !!projectActive() || S.sending || S.uploading; }
  if (e.target.id==='history-search') { S.query=e.target.value; renderHistory(); }
});
document.addEventListener('keydown', e => {
  if (e.target.id==='chat-input' && e.key==='Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==='k' && !$('#modal').open) { e.preventDefault(); newChat(); }
  if (e.key==='Escape') { S.menu=false; S.inspector=false; syncPanels(); }
  if (e.target.matches('[role=tab]') && ['ArrowLeft','ArrowRight'].includes(e.key)) {
    e.preventDefault(); const tabs=[...document.querySelectorAll('.inspector-tabs [role=tab]')]; const i=tabs.indexOf(e.target); const next=tabs[(i+(e.key==='ArrowRight'?1:3))%4]; showPanel(next.dataset.tab); next.focus();
  }
  if (e.key==='Tab') {
    const drawer = matchMedia('(max-width:760px)').matches && S.menu ? $('.chat-sidebar') : matchMedia('(max-width:1150px)').matches && S.inspector ? $('.research-panel') : null;
    if (drawer) {
      const focusable=[...drawer.querySelectorAll('button,a,input')].filter(n=>!n.hidden && n.getClientRects().length);
      if (e.shiftKey && document.activeElement===focusable[0]) { e.preventDefault(); focusable.at(-1)?.focus(); }
      else if (!e.shiftKey && document.activeElement===focusable.at(-1)) { e.preventDefault(); focusable[0]?.focus(); }
    }
  }
});
$('#upload').addEventListener('change',async e => { try { await upload([...e.target.files]); } catch(err) { toast(err.message); } finally { e.target.value=''; } });
$('#modal').addEventListener('click',e => { if (e.target===$('#modal')) { const r=e.target.getBoundingClientRect(); if (e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom) e.target.close(); } });
matchMedia('(max-width:760px)').addEventListener('change',syncPanels);
matchMedia('(max-width:1150px)').addEventListener('change',syncPanels);
async function boot() {
  try {
    const data=await api('/api/bootstrap'); S.token=data.token; S.settings=data.settings; S.projects=data.projects || [];
    if (!S.projects.length) S.projects.push(await api('/api/projects',{method:'POST',body:{name:'我的研究空间'}}));
    S.projectId=S.projects.find(p=>p.id===localStorage.getItem('agentos.project'))?.id || S.projects[0].id;
    const list=await api(`${base()}/chats`); S.chats=(list.chats || []).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
    S.chatId=S.chats.find(c=>c.id===localStorage.getItem('agentos.chat'))?.id || null;
    layout(); remember(); history.replaceState(null,'','#chat');
    await refreshProject(); if (S.chatId) await loadChat(S.chatId);
    stream=new EventSource('/api/events');
    stream.onmessage=e => {
      const item=JSON.parse(e.data); if (item.projectId!==S.projectId) return;
      clearTimeout(refreshTimer); refreshTimer=setTimeout(async()=> {
        try { await Promise.all([listChats(),refreshProject(),S.chatId ? loadChat(S.chatId,false) : Promise.resolve()]); } catch(err) { toast(err.message); }
      },250);
    };
    stream.onerror=()=> { $('.model-pill').title='本地连接正在恢复'; };
    stream.onopen=syncSettings;
  } catch(e) {
    $('#app').innerHTML=`<div class="boot">暂时无法打开研究空间<span>${esc(e.message)}</span><p><a href="/">重新连接 →</a></p></div>`;
  }
}
boot();
