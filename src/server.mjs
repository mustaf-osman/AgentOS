import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {ROOT,DATA,db,bus,list,required,create,put,files,readText,writeFile,safePath,projectRoot,newProject,events,recover,publicSettings,saveSettings,redact,hash,fail} from './core.mjs';
import {startTask,publicTask,stopTask,answerApproval,runningCount} from './agent.mjs';
import {doctor} from './runtime.mjs';
import {testConnection} from './model.mjs';
import {zipProject} from './zip.mjs';
import {workspaceRoute} from './workspace-api.mjs';

const token=crypto.randomBytes(32).toString('hex');
const requestedPort=Number(process.env.AGENTOS_PORT||4330);let port=requestedPort;let lockOwned=false;
const instanceId=crypto.randomUUID(),instanceFile=path.join(DATA,'instance.json');
const responseJSON=(res,data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
async function body(req){let size=0;const parts=[];for await(const chunk of req){size+=chunk.length;if(size>20_000_000)fail('请求体不能超过 20 MB',413);parts.push(chunk);}try{return JSON.parse(Buffer.concat(parts).toString()||'{}');}catch{fail('请求不是有效 JSON');}}
function detail(id){return {project:required('project',id),tasks:list('task',id).map(publicTask),files:files(id),sources:list('source',id),approvals:list('approval',id).filter(a=>a.status==='PENDING'),modelCalls:list('model_call',id)};}
function idle(id){if(list('task',id).some(t=>['RUNNING','WAITING_APPROVAL'].includes(t.status)))fail('研究空间正在执行，请等待或停止任务后修改文件',409);}
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 try{
  if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host))fail('仅接受本机应用请求',403);
  const url=new URL(req.url,`http://127.0.0.1:${port}`),route=url.pathname;
  if(!['GET','HEAD'].includes(req.method)){if(req.headers.origin&&!['http://127.0.0.1:'+port,'http://localhost:'+port].includes(req.headers.origin))fail('请求来源不允许',403);if(req.headers['x-agentos-token']!==token)fail('会话已更新，请刷新页面',403);if(!req.headers['content-type']?.startsWith('application/json'))fail('请使用 JSON 请求',415);}
  if(req.method==='GET'&&route==='/api/health')return responseJSON(res,{service:'agentos',version:'0.1.0',pid:process.pid,instanceId});
  if(req.method==='GET'&&route==='/api/bootstrap')return responseJSON(res,{token,version:'0.1.0',projects:list('project').filter(p=>!p.archived),settings:publicSettings(),esp32:{enabled:false,connected:false},desktopAvailable:process.platform==='win32'});
  if(req.method==='GET'&&route==='/api/events'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache',Connection:'keep-alive'});const after=Number(req.headers['last-event-id']||url.searchParams.get('after')||0);const send=e=>res.write(`id: ${e.seq}\ndata: ${JSON.stringify(e)}\n\n`);for(const e of events(after))send(e);bus.on('event',send);const timer=setInterval(()=>res.write(': heartbeat\n\n'),15000);req.on('close',()=>{clearInterval(timer);bus.off('event',send);});return;}
  if(req.method==='GET'&&route==='/api/doctor')return responseJSON(res,await doctor());
  if(req.method==='GET'&&route==='/api/settings')return responseJSON(res,publicSettings());
  if(req.method==='PUT'&&route==='/api/settings'){if(runningCount())fail('任务执行期间不能修改模型或权限设置',409);return responseJSON(res,saveSettings(await body(req)));}
  if(req.method==='POST'&&route==='/api/model/test')return responseJSON(res,await testConnection());
  if(req.method==='POST'&&route==='/api/projects')return responseJSON(res,newProject(await body(req)),201);
  if(req.method==='GET'&&route==='/api/device')return responseJSON(res,{transport:null,enabled:false,connected:false,device:null,capabilities:[],message:'ESP32 接口已预留，当前不连接、不扫描、不烧录。'});
  if(route.startsWith('/api/device/')&&!['GET','HEAD'].includes(req.method))fail('ESP32 连接当前未启用',409);
  if(await workspaceRoute(req,url,{body:()=>body(req),json:(data,status)=>responseJSON(res,data,status)}))return;
  const taskMatch=route.match(/^\/api\/tasks\/([^/]+)(?:\/(stop))?$/);
  if(taskMatch){if(req.method==='GET')return responseJSON(res,publicTask(required('task',taskMatch[1])));if(req.method==='POST'&&taskMatch[2]==='stop')return responseJSON(res,stopTask(taskMatch[1]));}
  const approvalMatch=route.match(/^\/api\/approvals\/([^/]+)$/);if(approvalMatch&&req.method==='POST'){const b=await body(req);if(typeof b.approve!=='boolean')fail('请选择批准或拒绝');return responseJSON(res,answerApproval(approvalMatch[1],b.approve));}
  const pm=route.match(/^\/api\/projects\/([^/]+)(?:\/(.*))?$/);
  const cm=route.match(/^\/api\/chats\/([^/]+)(?:\/(messages))?$/);
  if(cm){const c=required('chat',cm[1]);
   if(req.method==='GET'){const tasks=list('task',c.projectId).filter(t=>t.chatId===c.id).reverse();const recent=tasks.slice(-50);const transcript=recent.flatMap(t=>db.prepare('SELECT * FROM events WHERE task_id=? ORDER BY seq').all(t.id).map(e=>({seq:e.seq,ts:e.ts,taskId:e.task_id,projectId:e.project_id,type:e.type,...JSON.parse(e.body)})));return responseJSON(res,{chat:c,tasks:tasks.map(publicTask),events:transcript,approvals:list('approval',c.projectId).filter(a=>a.status==='PENDING'&&tasks.some(t=>t.id===a.taskId))});}
   if(req.method==='POST'&&cm[2]==='messages'){if(c.archived)fail('请先从回收站恢复此任务',409);const input=await body(req);return responseJSON(res,startTask(c.projectId,{prompt:input.message,chatId:c.id,agentId:input.agentId,researchMode:input.researchMode,deepAnalysis:input.deepAnalysis,networkEnabled:input.networkEnabled}),202);}
  }
  if(pm){const id=pm[1],action=pm[2]||'';required('project',id);
   if(req.method==='GET'&&action==='chats')return responseJSON(res,{chats:list('chat',id).filter(c=>!c.archived)});
   if(req.method==='POST'&&action==='chats')return responseJSON(res,create('chat',{projectId:id,title:'新对话'}),201);
   if(req.method==='GET'&&!action)return responseJSON(res,detail(id));
   if(req.method==='POST'&&action==='tasks')return responseJSON(res,startTask(id,await body(req)),202);
   if(req.method==='GET'&&action==='file'){const relative=url.searchParams.get('path'),content=readText(id,relative,2_000_000);return responseJSON(res,{path:relative,content,sha256:hash(fs.readFileSync(safePath(projectRoot(id),relative)))});}
   if(req.method==='PUT'&&action==='file'){idle(id);const b=await body(req);const file=safePath(projectRoot(id),b.path);if(b.expectedHash&&fs.existsSync(file)&&hash(fs.readFileSync(file))!==b.expectedHash)fail('文件已变化，请重新打开后再保存',409);if(typeof b.content!=='string')fail('请输入文本内容');return responseJSON(res,writeFile(id,b.path,b.content));}
   if(req.method==='POST'&&action==='upload'){idle(id);const b=await body(req);if(!Array.isArray(b.files)||!b.files.length||b.files.length>20)fail('一次可导入 1—20 个文件');const allowed=new Set(['.md','.txt','.csv','.json','.py','.pdf','.bib','.tex','.svg','.png','.jpg','.jpeg','.html','.css','.js','.mjs','.xml','.log']);const validated=b.files.map(f=>{if(typeof f.name!=='string'||f.name!==path.basename(f.name)||!allowed.has(path.extname(f.name).toLowerCase()))fail('文件名或格式不支持');const content=Buffer.from(String(f.base64||''),'base64');if(content.length>12_000_000)fail('单个文件不能超过 12 MB');return {path:`inputs/${f.name}`,content};});for(const f of validated)if(fs.existsSync(safePath(projectRoot(id),f.path)))fail(`已有同名文件 ${f.path}，请重命名后导入`,409);return responseJSON(res,{files:validated.map(f=>writeFile(id,f.path,f.content,{binary:true,overwrite:false}))});}
   if(req.method==='GET'&&action==='artifact'){const relative=url.searchParams.get('path'),file=safePath(projectRoot(id),relative);if(!fs.existsSync(file)||!fs.statSync(file).isFile())fail('文件不存在',404);const ext=path.extname(file).toLowerCase(),preview=url.searchParams.get('view')==='1';const imageType={'.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg'};res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; sandbox");res.writeHead(200,{'Content-Type':preview&&imageType[ext]?imageType[ext]:'application/octet-stream','Content-Disposition':`${preview&&imageType[ext]?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(path.basename(file))}`,'Cache-Control':'no-store'});return fs.createReadStream(file).pipe(res);}
   if(req.method==='GET'&&action==='export'){idle(id);res.writeHead(200,{'Content-Type':'application/zip','Content-Disposition':`attachment; filename=agentos-${id}.zip`});return res.end(zipProject(id));}
  }
  if(req.method==='GET'&&(route==='/'||route==='/index.html'||route==='/styles.css'||route==='/app.js'||route.startsWith('/assets/'))){const relative=route==='/'||route==='/index.html'?(url.searchParams.has('advanced')?'advanced.html':'index.html'):route.slice(1),file=safePath(path.join(ROOT,'public'),relative);if(!fs.existsSync(file)||!fs.statSync(file).isFile())fail('资源不存在',404);const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});return fs.createReadStream(file).pipe(res);}
  fail('接口不存在',404);
 }catch(e){if(!res.headersSent)responseJSON(res,{error:redact(e.message)},e.status>=400&&e.status<600?e.status:500);else res.destroy();}
});
server.requestTimeout=180000;server.headersTimeout=15000;
async function acquire(){try{const fd=fs.openSync(instanceFile,'wx');fs.writeFileSync(fd,JSON.stringify({pid:process.pid,instanceId,port}));fs.closeSync(fd);lockOwned=true;}catch(e){if(e.code!=='EEXIST')throw e;let old;try{old=JSON.parse(fs.readFileSync(instanceFile,'utf8'));}catch{throw new Error('实例记录损坏，请先确认没有 AgentOS 服务运行，再检查 data/instance.json');}try{process.kill(old.pid,0);throw new Error(`AgentOS 已有进程 ${old.pid}，请打开 http://127.0.0.1:${old.port}/ ，不要重复启动同一数据目录。`);}catch(e){if(e.code!=='ESRCH')throw e;fs.unlinkSync(instanceFile);return acquire();}}}
function release(){if(lockOwned){try{const current=JSON.parse(fs.readFileSync(instanceFile,'utf8'));if(current.instanceId===instanceId)fs.unlinkSync(instanceFile);}catch{}lockOwned=false;}}
server.on('error',e=>{if(e.code==='EADDRINUSE'&&port<requestedPort+20&&port<65535){port++;server.listen(port,'127.0.0.1');}else{console.error('AgentOS 启动失败：'+e.message);release();db.close();process.exitCode=1;}});
server.on('listening',()=>{fs.writeFileSync(instanceFile,JSON.stringify({pid:process.pid,instanceId,port}));console.log(`AgentOS ready at http://127.0.0.1:${port}/`);process.send?.({type:'ready',port});});
function close(){for(const t of list('task').filter(t=>['RUNNING','WAITING_APPROVAL'].includes(t.status)))try{stopTask(t.id);}catch{}server.closeAllConnections();server.close(()=>{release();db.close();process.exit(0);});setTimeout(()=>{release();process.exit(0);},3000).unref();}
process.on('SIGINT',close);process.on('SIGTERM',close);
try{await acquire();recover();if(!list('project').length)newProject({name:'我的研究空间',description:'从研究问题出发，连接资料、工具与实验。'});server.listen(port,'127.0.0.1');}catch(e){console.error(e.message);db.close();process.exitCode=1;}
