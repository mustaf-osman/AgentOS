import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { EventEmitter } from 'node:events';

export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const DATA=path.resolve(process.env.AGENTOS_DATA_DIR||path.join(ROOT,'data'));
fs.mkdirSync(DATA,{recursive:true});
export const db=new DatabaseSync(path.join(DATA,'agentos.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS records(kind TEXT NOT NULL,id TEXT NOT NULL,project_id TEXT,created_at TEXT,body TEXT NOT NULL,PRIMARY KEY(kind,id)); CREATE INDEX IF NOT EXISTS records_project ON records(kind,project_id); CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT,ts TEXT NOT NULL,project_id TEXT,task_id TEXT,type TEXT NOT NULL,body TEXT NOT NULL);`);
export const bus=new EventEmitter();bus.setMaxListeners(100);
export const now=()=>new Date().toISOString();
export const uid=(prefix='id')=>`${prefix}-${crypto.randomUUID()}`;
export const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
export function fail(message,status=400){throw Object.assign(new Error(message),{status});}
export function get(kind,id){const r=db.prepare('SELECT body FROM records WHERE kind=? AND id=?').get(kind,id);return r?JSON.parse(r.body):null;}
export function required(kind,id){return get(kind,id)||fail('记录不存在',404);}
export function list(kind,projectId){const rows=projectId?db.prepare('SELECT body FROM records WHERE kind=? AND project_id=? ORDER BY created_at DESC').all(kind,projectId):db.prepare('SELECT body FROM records WHERE kind=? ORDER BY created_at DESC').all(kind);return rows.map(r=>JSON.parse(r.body));}
export function put(kind,value){const item={...value,updatedAt:now()};db.prepare('INSERT INTO records(kind,id,project_id,created_at,body) VALUES(?,?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET body=excluded.body').run(kind,item.id,item.projectId||null,item.createdAt||now(),JSON.stringify(item));return item;}
export function create(kind,value){return put(kind,{id:uid(kind),createdAt:now(),...value});}
export function event(projectId,taskId,type,data){const ts=now(),r=db.prepare('INSERT INTO events(ts,project_id,task_id,type,body) VALUES(?,?,?,?,?)').run(ts,projectId||null,taskId||null,type,JSON.stringify(data));const e={seq:Number(r.lastInsertRowid),ts,projectId,taskId,type,...data};bus.emit('event',e);return e;}
export function events(after=0){return db.prepare('SELECT * FROM events WHERE seq>? ORDER BY seq DESC LIMIT 400').all(after).reverse().map(r=>({seq:r.seq,ts:r.ts,projectId:r.project_id,taskId:r.task_id,type:r.type,...JSON.parse(r.body)}));}
export function safePath(root,relative){
 if(typeof relative!=='string'||!relative||relative.length>500||relative.includes('\0')||path.isAbsolute(relative)||relative.includes(':'))fail('文件路径无效');
 const normalized=relative.replaceAll('\\','/');if(normalized.split('/').some(s=>['..','.git','.env'].includes(s)||s.toLowerCase()==='settings.json'))fail('文件路径超出研究空间');
 const target=path.resolve(root,normalized);if(!target.startsWith(path.resolve(root)+path.sep))fail('文件路径超出研究空间');
 let parent=target;while(parent.startsWith(path.resolve(root)+path.sep)){if(fs.existsSync(parent)&&fs.lstatSync(parent).isSymbolicLink())fail('不支持符号链接');parent=path.dirname(parent);}return target;
}
export function projectRoot(id){required('project',id);return path.join(DATA,'workspaces',id);}
export function files(id){const root=projectRoot(id),out=[];function walk(dir,prefix=''){if(!fs.existsSync(dir))return;for(const d of fs.readdirSync(dir,{withFileTypes:true})){if(d.name.startsWith('.')||d.isSymbolicLink())continue;const name=prefix+d.name;if(d.isDirectory()){if(out.length<500)walk(path.join(dir,d.name),name+'/');}else if(d.isFile()){const stat=fs.statSync(path.join(dir,d.name));out.push({path:name,bytes:stat.size,modifiedAt:stat.mtime.toISOString(),ext:path.extname(name).slice(1)});}if(out.length>=500)break;}}walk(root);return out;}
const textExt=new Set(['.md','.txt','.csv','.json','.py','.js','.mjs','.html','.css','.svg','.yaml','.yml','.log','.xml','.bib','.tex']);
export function readText(id,relative,max=100000){const file=safePath(projectRoot(id),relative);if(!fs.existsSync(file)||!fs.statSync(file).isFile())fail('文件不存在',404);if(!textExt.has(path.extname(file).toLowerCase()))fail('此文件请下载，或使用 PDF 阅读工具');if(fs.statSync(file).size>2_000_000)fail('文件过大，请按需读取');return fs.readFileSync(file,'utf8').slice(0,max);}
export function writeFile(id,relative,content,{binary=false,overwrite=true}={}){const file=safePath(projectRoot(id),relative);if(!binary&&!textExt.has(path.extname(file).toLowerCase()))fail('生成文件格式不支持');if(Buffer.byteLength(content)>12_000_000)fail('文件不能超过 12 MB');if(fs.existsSync(file)){if(!overwrite)fail('同名文件已存在',409);const previous=fs.readFileSync(file);create('revision',{projectId:id,path:relative,content:previous.toString('base64'),sha256:hash(previous)});}fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content);return {path:relative,bytes:fs.statSync(file).size,sha256:hash(fs.readFileSync(file))};}
export function newProject(input){const name=String(input.name||'新的研究').trim().slice(0,100);if(!name)fail('请输入研究名称');const p=create('project',{name,description:String(input.description||'').slice(0,3000),archived:false});fs.mkdirSync(projectRoot(p.id),{recursive:true});return p;}
export function snapshot(id){const manifest=files(id).map(f=>({...f,sha256:hash(fs.readFileSync(safePath(projectRoot(id),f.path)))}));return {files:manifest,sha256:hash(JSON.stringify(manifest.map(({path,sha256})=>({path,sha256}))))};}
export function redact(value){let s=String(value||'').replace(/\bsk-[A-Za-z0-9_-]{10,}/g,'[已隐藏凭据]').replace(/Bearer\s+\S+/gi,'Bearer [已隐藏]');const key=settings().apiKey;if(key)s=s.replaceAll(key,'[已隐藏凭据]');return s.slice(0,12000);}
export function settings(){let saved={};try{saved=JSON.parse(fs.readFileSync(path.join(DATA,'settings.json'),'utf8'));}catch{}return {baseURL:process.env.QWEN_BASE_URL||'https://dashscope.aliyuncs.com/compatible-mode/v1',model:process.env.QWEN_MODEL||'qwen-plus',apiKey:process.env.DASHSCOPE_API_KEY||'',python:process.env.AGENTOS_PYTHON||'',desktopEnabled:false,networkEnabled:true,visionModel:'Qwen3-VL-30B-A3B-Instruct',...saved};}
export function publicSettings(){const {apiKey,...rest}=settings();return {...rest,hasKey:!!apiKey};}
export function saveSettings(input){const current=settings(),url=new URL(String(input.baseURL||current.baseURL));if(url.username||url.password||!['https:','http:'].includes(url.protocol)||url.search||url.hash)fail('请输入有效模型 API 地址');if(url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))fail('远程模型地址必须使用 HTTPS');const model=String(input.model||current.model).trim();if(!model||model.length>150)fail('模型名称无效');const visionModel=String(input.visionModel||current.visionModel||'Qwen3-VL-30B-A3B-Instruct').trim().slice(0,150);const same=new URL(current.baseURL).origin===url.origin;const next={baseURL:url.href.replace(/\/$/,''),model,visionModel,apiKey:input.clearKey?'':String(input.apiKey||'').trim()||(same?current.apiKey:''),python:String(input.python??current.python),desktopEnabled:input.desktopEnabled===true,networkEnabled:input.networkEnabled!==false};const temp=path.join(DATA,'settings.tmp');fs.writeFileSync(temp,JSON.stringify(next,null,2),{mode:0o600});fs.renameSync(temp,path.join(DATA,'settings.json'));return publicSettings();}
export function recover(){for(const t of list('task').filter(t=>['RUNNING','WAITING_APPROVAL','QUEUED'].includes(t.status))){put('task',{...t,status:'INTERRUPTED',error:'服务已重启。已有文件和执行记录已保留，请检查后重新发起任务。',finishedAt:now()});}for(const a of list('approval').filter(a=>a.status==='PENDING'))put('approval',{...a,status:'EXPIRED'});}
