const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const steps = [
 ['检索近三年相关文献', '从 Google Scholar、arXiv、Web of Science 等检索高相关论文'],
 ['阅读并提取关键信息', '整理不同结构的效率、稳定性、制备方法等关键数据'],
 ['对比分析与可视化', '生成图表，对不同结构进行对比分析'],
 ['生成组会汇报报告', '整理为结构化的 PPT 或 Markdown 报告']
];
const papers = [
 {title:'Efficient and Stable Perovskite Solar Cells with Interfacial Engineering', journal:'Nature',year:2024,citations:342,summary:'此条为界面还原所用的示例文献，展示界面工程、缺陷钝化和载流子传输相关研究的详情布局。标题、期刊和引用量尚未通过文献数据库核验。'},
 {title:'Recent Advances in Perovskite Photovoltaics: Materials, Interfaces and Stability',journal:'Advanced Energy Materials',year:2023,citations:287,summary:'此条为示例数据，用于展示钙钛矿材料、界面设计与稳定性综述的阅读体验，尚未绑定真实论文全文。'},
 {title:'A Review of Perovskite Solar Cell Stability',journal:'Progress in Photovoltaics',year:2023,citations:196,summary:'此条为示例数据，用于展示湿度、热、光照等稳定性因素的文献阅读布局。实际结论需要接入并核验真实文献。'}
];
const series = [
 {name:'n-i-p',color:'#ff6b55',points:[[.60,26],[.95,24],[1.3,29],[1.8,34]]},
 {name:'p-i-n',color:'#a587ca',points:[[.5,29],[.9,26],[1.3,30]]},
 {name:'双层结构',color:'#60b8c2',points:[[.12,24],[.9,31]]},
 {name:'锐化策略',color:'#6b9bd9',points:[[.13,22],[.9,30],[1.32,31],[1.75,31]]},
 {name:'其他',color:'#a2a8b0',points:[[-.12,18],[.5,22],[1.4,33]]}
];
const activityTitles = ['Efficient and Stable Perovskite Solar Cells…','Interface Engineering for High-Performance…','Stability of Perovskite Solar Cells: A Review','Recent Advances in Perovskite Photovoltaics…'];
const check = `<span class="status check">${icon('check')}</span>`;
let currentTab = 'progress', chartMode = 'chart', mode = '研究模式', activityOpen = true, attachedName = '';
let toastTimer;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2800);}
function modal(title, html){$('#modal-title').textContent=title;$('#modal-body').innerHTML=html;$('#modal').showModal();}
$('#close-modal').onclick=()=>$('#modal').close();
$('#modal').addEventListener('click',event=>{if(event.target===$('#modal')){const r=$('#modal').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('#modal').close();}});
$('#plan').innerHTML=steps.map((s,i)=>`<div class="plan-row"><span class="step-number">${i+1}</span><div class="step-copy"><strong>${s[0]}</strong><small>${s[1]}</small></div>${i===0?check:i===1?'<span class="status spinner" aria-label="进行中"></span>':''}</div>`).join('');
$('#paper-list').innerHTML=papers.map((p,i)=>`<article class="paper"><span class="step-number">${i+1}</span><div class="paper-info"><div class="paper-title">${p.title}</div><div class="paper-meta">${p.journal} · ${p.year}　被引 ${p.citations}</div></div><button class="view" data-paper="${i}">${icon('file')}查看</button></article>`).join('');
function chart(){return `<p class="chart-title">不同结构的效率与稳定性对比（近三年）</p><svg class="chart" viewBox="0 0 340 220" role="img" aria-label="示例散点图：不同电池结构的效率与稳定性，非真实研究数据"><g>${[10,20,30,40].map((v,i)=>`<line x1="44" y1="${168-i*39}" x2="253" y2="${168-i*39}"/><text x="23" y="${171-i*39}">${v}</text>`).join('')}${[0,1,2,3].map((v,i)=>`<line x1="${44+i*69}" y1="47" x2="${44+i*69}" y2="168"/><text x="${36+i*69}" y="189">10<tspan baseline-shift="super" font-size="7">${v+1}</tspan></text>`).join('')}<line class="axis" x1="44" y1="47" x2="44" y2="168"/><line class="axis" x1="44" y1="168" x2="253" y2="168"/><text x="139" y="211" text-anchor="middle">稳定性（小时）</text><text transform="translate(13,113) rotate(-90)" text-anchor="middle">效率（%）</text>${series.map((s,i)=>`<g fill="${s.color}">${s.points.map(p=>`<circle cx="${65+p[0]*76}" cy="${168-(p[1]-10)*3.9}" r="3.5"><title>${s.name} · 效率 ${p[1]}% · 演示数据</title></circle>`).join('')}<circle cx="273" cy="${58+i*22}" r="4"/><text class="legend" x="284" y="${61+i*22}">${s.name}</text></g>`).join('')}</g></svg>`;}
function table(){return `<table class="data-table"><thead><tr><th>结构</th><th>效率范围</th><th>样本</th></tr></thead><tbody>${series.map(s=>`<tr><td><span style="color:${s.color}">●</span> ${s.name}</td><td>${Math.min(...s.points.map(p=>p[1]))}–${Math.max(...s.points.map(p=>p[1]))}%</td><td>${s.points.length}</td></tr>`).join('')}</tbody></table><p class="panel-note">界面演示数据，不能作为研究结论使用。</p>`;}
function preview(){return `<section class="preview card"><div class="card-heading">中间结果预览<div class="chart-tabs" role="tablist" aria-label="结果视图">${[['chart','图表'],['table','表格'],['summary','摘要']].map(([id,t])=>`<button role="tab" aria-selected="${chartMode===id}" data-chart="${id}" class="${chartMode===id?'active':''}">${t}</button>`).join('')}</div></div><div class="chart-body">${chartMode==='chart'?chart():chartMode==='table'?table():'<p class="summary-text">此处展示不同电池结构的效率与稳定性对比摘要。真实分析需统一测试条件、统计样本和稳定性评价方法后生成。</p><p class="panel-note">当前为示例摘要，未连接研究接口。</p>'}</div></section>`;}
function progress(){return `<section class="progress-summary card"><header><strong>研究任务进行中</strong><small>已用时 6 分钟</small></header><div class="progress-track" role="progressbar" aria-valuenow="38" aria-valuemin="0" aria-valuemax="100" aria-label="研究任务完成进度"><div class="progress-fill"></div></div></section><section class="timeline card">${steps.map((s,i)=>`<div class="timeline-row ${i===0?'done':i===1?'current':''}"><span class="step-number">${i===0?icon('check'):i+1}</span><div><strong>${s[0]}</strong><small>${i===0?'已完成 · 找到 216 篇相关论文':i===1?'正在进行 · 已分析 12 篇论文…':'等待中'}</small></div>${i===1?'<span class="status spinner" aria-label="进行中"></span>':''}</div>`).join('')}</section><section class="activity card"><button class="card-heading activity-heading" aria-expanded="${activityOpen}">当前执行内容<span>${activityOpen?'⌃':'⌄'}</span></button><div class="activity-detail" ${activityOpen?'':'hidden'}><div class="activity-subtitle">${icon('file')}正在阅读论文并提取关键信息...</div><div class="activity-files">${activityTitles.map((t,i)=>`<div class="activity-file">${icon('file')}<span class="filename">${t}</span>${i<2?check:i===2?'<span class="spinner"></span>':'<span class="clock">◷</span>'}</div>`).join('')}<div class="activity-file">${icon('file')}<span class="filename">...</span><span class="clock">◌</span></div></div></div></section>${preview()}`;}
function renderPanel(){
 $$('.inspector-tabs button').forEach(b=>{const selected=b.dataset.tab===currentTab;b.classList.toggle('active',selected);b.setAttribute('aria-selected',selected);});
 $('#inspector-content').innerHTML=currentTab==='progress'?progress():currentTab==='references'?`<h2 class="panel-heading">参考资料 <small>3 篇示例</small></h2><p class="panel-note">以下为截图还原使用的示例条目，尚未核验。</p>${papers.map((p,i)=>`<article class="card panel-paper"><h3>${p.title}</h3><p class="paper-meta">${p.journal} · ${p.year}</p><button class="view" data-paper="${i}">${icon('book')}查看详情</button></article>`).join('')}`:currentTab==='results'?`<h2 class="panel-heading">数据结果</h2>${preview()}<button class="download" data-export="csv">${icon('file')}导出示例数据 CSV</button>`:`<h2 class="panel-heading">产出文件</h2><div class="card panel-empty">报告尚未生成<p class="panel-note">可下载本地示例提纲，作为后续研究报告的起点。</p></div><button class="download" data-export="md">${icon('file')}下载报告提纲（Markdown）</button><button class="download" data-export="csv">${icon('file')}下载示例数据（CSV）</button>`;
}
renderPanel();
function paperDetail(index){const p=papers[index];modal('文献详情',`<h3>${p.title}</h3><p class="paper-meta">${p.journal} · ${p.year} · 示例引用量 ${p.citations}</p><p>${p.summary}</p><p class="panel-note">演示详情 · 未提供真实论文全文或 DOI。</p><a href="https://scholar.google.com/scholar?q=${encodeURIComponent(p.title)}" target="_blank" rel="noopener noreferrer">在 Google Scholar 搜索此标题 ↗</a>`);}
document.addEventListener('click',e=>{
 const p=e.target.closest('[data-paper]');if(p)paperDetail(Number(p.dataset.paper));
 const t=e.target.closest('[data-tab]');if(t){currentTab=t.dataset.tab;renderPanel();}
 const c=e.target.closest('[data-chart]');if(c){chartMode=c.dataset.chart;renderPanel();}
 if(e.target.closest('.activity-heading')){activityOpen=!activityOpen;const d=$('.activity-detail');d.hidden=!activityOpen;$('.activity-heading').setAttribute('aria-expanded',activityOpen);$('.activity-heading span').textContent=activityOpen?'⌃':'⌄';}
 const x=e.target.closest('[data-export]');if(x)download(x.dataset.export);
});
$$('.inspector-tabs button').forEach((b,i,buttons)=>b.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const next=buttons[(i+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length];next.click();next.focus();}}));
$$('.toggle').forEach(b=>b.onclick=()=>{const value=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',value);b.classList.toggle('selected',value);toast(`${b.textContent.trim()}已${value?'开启':'关闭'}（演示选项）`);});
$('#research-mode').onclick=()=>{mode=mode==='研究模式'?'快速模式':'研究模式';$('#research-mode span').textContent=mode;toast(`已切换至${mode}（演示选项）`);};
$('#attach').onclick=()=>$('#attachment').click();
$('#attachment').onchange=e=>{const f=e.target.files[0];attachedName=f?f.name:'';$('#attachment-label').textContent=attachedName?`已选择：${attachedName} · 仅本地演示，不会上传`:'';};
$('#composer').addEventListener('submit',e=>{e.preventDefault();const text=$('#message').value.trim();if(!text){$('#message').focus();toast('请先输入研究问题');return;}const user=document.createElement('div');user.className='extra-message user';const bubble=document.createElement('div');bubble.className='bubble';bubble.textContent=text+(attachedName?`\n附件：${attachedName}`:'');user.append(bubble);$('#conversation').append(user);const response=document.createElement('div');response.className='extra-message assistant';const badge=document.createElement('span');badge.className='bot-avatar';badge.innerHTML=icon('bot');const answer=document.createElement('p');answer.textContent='已记录你的研究问题。当前为可交互的前端演示，尚未连接 AI 或文献检索服务。\n你可以在右侧查看参考资料、切换结果视图，或下载示例数据和报告提纲。';response.append(badge,answer);$('#conversation').append(response);$('#message').value='';$('#message').style.height='auto';attachedName='';$('#attachment').value='';$('#attachment-label').textContent='';response.scrollIntoView({behavior:'smooth',block:'end'});});
$('#message').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('#composer').requestSubmit();}};
$('#message').oninput=()=>{$('#message').style.height='auto';$('#message').style.height=Math.min($('#message').scrollHeight,110)+'px';};
function titleDialog(){modal('重命名任务','<label for="task-name">任务名称</label><input id="task-name" maxlength="45"><button class="primary" id="save-title">保存名称</button>');$('#task-name').value=$('#project-title').textContent;$('#task-name').focus();$('#save-title').onclick=()=>{const v=$('#task-name').value.trim();if(!v)return;$('#project-title').textContent=v;$('.recent.active span').firstChild.textContent=v;$('#modal').close();toast('任务名称已更新');};}
$('#rename').onclick=titleDialog;
$('.new-task').onclick=()=>{modal('新建研究任务','<label for="new-question">输入新任务的问题，将作为新消息加入当前演示对话。</label><input id="new-question" placeholder="例如：比较两种电池结构的稳定性"><button class="primary" id="create-task">开始提问</button>');$('#new-question').focus();$('#create-task').onclick=()=>{const q=$('#new-question').value.trim();if(!q)return;$('#modal').close();$('#message').value=q;$('#composer').requestSubmit();};};
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('.new-task').click();}});
$$('[data-task]').forEach(b=>b.onclick=()=>{if(b.classList.contains('active')){toast('当前正在查看此任务');return;}modal(b.dataset.task,'<p>此历史任务是截图中的占位条目，当前演示仅包含钙钛矿太阳能电池综述的工作区。</p><p class="panel-note">后续可以在此接入任务列表和独立会话数据。</p>');});
$$('[data-nav]').forEach(b=>b.onclick=()=>{const n=b.dataset.nav;if(n==='文献库'){currentTab='references';renderPanel();showPanel();}else if(n==='数据集'){currentTab='results';renderPanel();showPanel();}else if(n==='工作台'||n==='研究空间'){currentTab='progress';renderPanel();showPanel();}else modal(n,`<p>${n}尚未连接服务，当前页面重点实现研究任务工作台。</p>`);});
function showPanel(){if(innerWidth<=1050)$('.app').classList.add('mobile-panel');else $('.app').classList.remove('panel-hidden');}
$('#toggle-panel').onclick=()=>{if(innerWidth<=1050)$('.app').classList.toggle('mobile-panel');else $('.app').classList.toggle('panel-hidden');};
document.addEventListener('pointerdown',e=>{if(innerWidth<=1050&&$('.app').classList.contains('mobile-panel')&&!e.target.closest('.inspector')&&!e.target.closest('#toggle-panel')&&!e.target.closest('[data-nav]'))$('.app').classList.remove('mobile-panel');});
document.addEventListener('keydown',e=>{if(e.key==='Escape')$('.app').classList.remove('mobile-panel');});
$$('[data-source]').forEach(b=>b.onclick=()=>{const name=b.dataset.source;modal(name,`<p>此处显示 ${name} 的示例检索结果计数。当前尚未连接文献检索接口。</p><p class="panel-note">可在参考资料页查看已有示例条目。</p><button class="primary" id="show-refs">查看参考资料</button>`);$('#show-refs').onclick=()=>{$('#modal').close();currentTab='references';renderPanel();showPanel();};});
$('#source-more').onclick=()=>modal('文献检索源','<p>Google Scholar · arXiv · Web of Science</p><p class="panel-note">后续可扩展 PubMed、Crossref 等数据源。目前计数均为演示数据。</p>');
$('.trash').onclick=()=>modal('回收站','<p>回收站为空。</p>');
$('#settings').onclick=()=>modal('账户设置','<p>Researcher · 本地演示账户</p><p class="panel-note">当前不涉及登录、上传或云端存储。</p>');
$('#more').onclick=()=>modal('工作台信息','<p>Verifoundry · 科研工作台 UI</p><p>这是基于参考截图实现的可交互前端。支持文献详情、数据视图切换、消息输入、附件选择和文件导出。</p><p class="panel-note">论文、进度和图表均为演示数据，未接入 AI 或检索后端。</p>');
function download(type){let text,name,mime;if(type==='csv'){text='\uFEFF结构,稳定性小时,效率百分比,数据性质\r\n'+series.flatMap(s=>s.points.map(p=>`${s.name},${Math.round(10**(1+(65+p[0]*76-44)/69))},${p[1]},示例数据`)).join('\r\n');name='电池结构对比-示例数据.csv';mime='text/csv;charset=utf-8';}else{text='# 钙钛矿太阳能电池研究报告提纲\n\n> 此文件为演示提纲，所有文献及数据需要真实检索和核验。\n\n## 1. 研究背景\n\n## 2. 文献检索方法与纳入标准\n\n## 3. 不同器件结构的效率对比\n\n## 4. 稳定性与测试条件\n\n## 5. 界面工程与材料策略\n\n## 6. 局限性与未来研究方向\n\n## 7. 经核验的参考文献\n';name='钙钛矿研究报告-示例提纲.md';mime='text/markdown;charset=utf-8';}const url=URL.createObjectURL(new Blob([text],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('文件已导出');}
