import fs from 'node:fs';
import path from 'node:path';
import {ROOT,projectRoot,safePath,fail,uid} from './core.mjs';
import {runProcess} from './runtime.mjs';

const SCRIPT=path.join(ROOT,'tools','screen.ps1');
function encode(request){return Buffer.from(JSON.stringify(request)).toString('base64');}
async function call(request,{output='',signal}={}){
 if(process.platform!=='win32')fail('电脑屏幕操作仅支持 Windows');
 const r=await runProcess('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',SCRIPT,'-Request',encode(request),'-Output',output],{signal,timeout:20000});
 if(r.exitCode!==0)throw new Error('Windows 屏幕操作失败：'+String(r.stderr||'').slice(0,1200));
 try{return JSON.parse(String(r.stdout||'').replace(/^\uFEFF/,''));}catch{throw new Error('无法读取屏幕操作结果');}
}
export async function screenCapture(projectId,handle,signal){
 const relative='screens/'+uid('screen')+'.png';
 const target=safePath(projectRoot(projectId),relative);
 fs.mkdirSync(path.dirname(target),{recursive:true});
 const r=await call({action:'capture',...(handle?{handle}:{})},{output:target,signal});
 const small=r.width<200||r.height<120;
 return {path:relative,width:r.width,height:r.height,screenshot:true,small,notice:small?'截图尺寸异常小，目标窗口可能处于最小化或未恢复；不要凭这张截图判断成功，请先 desktop_focus 目标窗口后重新截图。':'这是当前屏幕截图，已保存到研究空间；坐标使用 0-1000 归一化。'};
}
export async function computerInput(projectId,action,args,signal){
 const r=await call({action,...args},{signal});
 return {...r,notice:'动作已发送。请再次截屏核对实际结果，不要只凭动作返回成功判断任务完成。'};
}
