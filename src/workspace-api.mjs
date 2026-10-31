import fs from 'node:fs';
import path from 'node:path';
import {create,put,list,required,projectRoot,safePath,fail,event,now,db} from './core.mjs';
import {profiles,profile,builtinProfileIds} from './profiles.mjs';

function idle(projectId){if(list('task',projectId).some(t=>['RUNNING','WAITING_APPROVAL'].includes(t.status)))fail('请先等待当前任务完成或停止任务',409);}
function title(value){const name=String(value||'').trim();if(!name||name.length>100)fail('请输入不超过100字的名称');return name;}

// Additional workspace management endpoints; original execution APIs stay in server.mjs.
export async function workspaceRoute(req,url,{body,json}){
 const route=url.pathname;
 if(route==='/api/agents'){
  if(req.method==='GET'){json({agents:profiles(),execution:'single-model-role'});return true;}
  if(req.method==='POST'){const input=await body();const instructions=String(input.instructions||'').trim();if(!instructions||instructions.length>4000)fail('角色说明应为1至4000字');json(create('agent',{name:title(input.name),description:String(input.description||'').slice(0,500),instructions,archived:false}),201);return true;}
 }
 const am=route.match(/^\/api\/agents\/([^/]+)$/);
 if(am&&req.method==='PUT'){
  if(builtinProfileIds.has(am[1]))fail('内置角色不能修改，请创建自定义角色',409);
  const current=profile(am[1]),input=await body();const instructions=String(input.instructions??current.instructions).trim();if(!instructions||instructions.length>4000)fail('角色说明应为1至4000字');
  json(put('agent',{...current,name:input.name===undefined?current.name:title(input.name),description:String(input.description??current.description).slice(0,500),instructions,archived:input.archived===true}));return true;
 }
 const chat=route.match(/^\/api\/chats\/([^/]+)(?:\/(restore))?$/);
 if(chat&&['PUT','DELETE','POST'].includes(req.method)){
  const current=required('chat',chat[1]);
  if(req.method==='PUT'){const input=await body();json(put('chat',{...current,title:title(input.title)}));}
  else if(req.method==='DELETE'){if(list('task',current.projectId).some(t=>t.chatId===current.id&&['RUNNING','WAITING_APPROVAL'].includes(t.status)))fail('运行中的对话不能移入回收站',409);json(put('chat',{...current,archived:true,archivedAt:now()}));}
  else if(chat[2]==='restore')json(put('chat',{...current,archived:false,archivedAt:null}));
  else return false;
  event(current.projectId,null,'workspace',{text:'对话记录已更新'});return true;
 }
 const pm=route.match(/^\/api\/projects\/([^/]+)(?:\/(trash|sources))?$/);
 if(pm){
  const project=required('project',pm[1]);
  if(!pm[2]&&req.method==='PUT'){const input=await body();json(put('project',{...project,name:input.name===undefined?project.name:title(input.name),description:String(input.description??project.description).slice(0,3000)}));event(project.id,null,'workspace',{text:'研究空间已更新'});return true;}
  if(pm[2]==='sources'&&req.method==='GET'){json({sources:list('source',project.id)});return true;}
  if(pm[2]==='trash'&&req.method==='GET'){json({chats:list('chat',project.id).filter(c=>c.archived),files:list('trashed-file',project.id).filter(f=>!f.restoredAt)});return true;}
  if(pm[2]==='trash'&&req.method==='POST'){
   idle(project.id);const input=await body(),root=projectRoot(project.id),file=safePath(root,input.path);if(!fs.existsSync(file)||!fs.statSync(file).isFile())fail('文件不存在',404);
   const record=create('trashed-file',{projectId:project.id,path:input.path,bytes:fs.statSync(file).size,restoredAt:null});const storage=`.trash/${record.id}/${path.basename(file)}`;const target=safePath(root,storage);fs.mkdirSync(path.dirname(target),{recursive:true});
   try{fs.renameSync(file,target);}catch(e){put('trashed-file',{...record,restoredAt:now(),error:'移动失败'});throw e;}
   const saved=put('trashed-file',{...record,storage});event(project.id,null,'workspace',{text:'文件已移至回收站'});json(saved);return true;
  }
 }
 const restore=route.match(/^\/api\/trash\/([^/]+)\/restore$/);
 if(restore&&req.method==='POST'){
  const record=required('trashed-file',restore[1]);if(record.restoredAt)fail('文件已恢复',409);idle(record.projectId);const root=projectRoot(record.projectId),source=safePath(root,record.storage),target=safePath(root,record.path);if(fs.existsSync(target))fail('原位置已有同名文件，请先重命名现有文件',409);if(!fs.existsSync(source))fail('回收站文件不存在',404);fs.mkdirSync(path.dirname(target),{recursive:true});fs.renameSync(source,target);json(put('trashed-file',{...record,restoredAt:now()}));event(record.projectId,null,'workspace',{text:'文件已恢复'});return true;
 }
 const tm=route.match(/^\/api\/tasks\/([^/]+)\/events$/);
 if(tm&&req.method==='GET'){required('task',tm[1]);json({events:db.prepare('SELECT * FROM events WHERE task_id=? ORDER BY seq').all(tm[1]).map(e=>({seq:e.seq,ts:e.ts,taskId:e.task_id,projectId:e.project_id,type:e.type,...JSON.parse(e.body)}))});return true;}
 return false;
}
