import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(fs.existsSync(path.join(root,'.env')))process.loadEnvFile(path.join(root,'.env'));
const data=path.resolve(process.env.AGENTOS_DATA_DIR||path.join(root,'data'));
function open(url){if(process.env.AGENTOS_NO_OPEN==='1')return;const command=process.platform==='win32'?'rundll32.exe':process.platform==='darwin'?'open':'xdg-open';const args=process.platform==='win32'?['url.dll,FileProtocolHandler',url]:[url];spawn(command,args,{windowsHide:true,stdio:'ignore'}).on('error',()=>{});}
let existing;try{existing=JSON.parse(fs.readFileSync(path.join(data,'instance.json'),'utf8'));}catch{}
if(existing){try{const response=await fetch(`http://127.0.0.1:${existing.port}/api/health`,{signal:AbortSignal.timeout(2000)});const h=await response.json();if(h.service==='agentos'&&h.instanceId===existing.instanceId){const url=`http://127.0.0.1:${existing.port}/`;console.log(`AgentOS 正在运行：${url}`);open(url);process.exit(0);}}catch{}}
const child=spawn(process.execPath,[path.join(root,'src','server.mjs')],{cwd:root,stdio:['inherit','inherit','inherit','ipc'],windowsHide:true});child.on('message',message=>{if(message.type==='ready')open(`http://127.0.0.1:${message.port}/`);});child.on('exit',code=>{process.exitCode=code||0;});child.on('error',e=>{console.error('启动失败：'+e.message);process.exitCode=1;});process.on('SIGINT',()=>child.kill('SIGINT'));process.on('SIGTERM',()=>child.kill('SIGTERM'));
