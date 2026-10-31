import {files,readText,writeFile,fail,settings,create,event,list} from './core.mjs';
import {runPython,pdfText,desktopAction,runShell} from './runtime.mjs';
import {screenCapture,computerInput} from './computer.mjs';
import {readWeb,searchPapers,publicURL,browserSession} from './web.mjs';

const tool=(name,description,properties={},required=[])=>({type:'function',function:{name,description,parameters:{type:'object',properties,required,additionalProperties:false}}});
const str=description=>({type:'string',description});
export const toolDefinitions=[
 tool('list_files','列出当前研究空间中的实际文件。'),
 tool('read_file','读取研究空间内文本、CSV、代码或已有结果。',{path:str('相对文件路径')},['path']),
 tool('read_pdf','提取研究空间内 PDF 的前40页文字。扫描件不支持OCR。',{path:str('PDF 相对路径')},['path']),
 tool('write_file','在研究空间生成完整文本文件。覆盖会保留旧版本。',{path:str('相对路径，支持 md/csv/json/py/js/html/svg 等'),content:str('完整文件内容')},['path','content']),
 tool('search_papers','使用 Crossref 搜索真实论文元数据。不等于全文阅读。',{query:str('中英文文献检索词')},['query']),
 tool('read_web','读取公共网页或下载 PDF，保存来源。不能访问本机和内网。',{url:str('完整公共网址')},['url']),
 tool('run_python','运行科研 Python 代码。用户必须先审核批准；当前为本地进程，不是OS沙箱。请只读写当前研究空间并保留可复现文件。',{code:str('完整 Python 代码'),purpose:str('执行目的、预期输出与文件变化')},['code','purpose']),
 tool('set_plan','更新用户可见的执行计划。每步必须根据实际执行状态更新。',{steps:{type:'array',maxItems:10,items:{type:'object',properties:{title:str('步骤名称'),status:{type:'string',enum:['pending','running','done','failed']}},required:['title','status'],additionalProperties:false}}},['steps']),
 tool('browser_open','在独立研究浏览器中打开公共网页，返回文字、控件和截图。',{url:str('完整公共网址')},['url']),
 tool('browser_inspect','读取当前研究浏览器的可见内容和截图。'),
 tool('browser_click','点击研究浏览器中已经读取到的链接或控件；仅允许读取网页。',{selector:str('Playwright CSS 或 text= 选择器')},['selector']),
 tool('browser_fill','填写研究浏览器输入框，不提交，不输入账号密码。',{selector:str('已经读取到的输入框选择器'),value:str('输入内容')},['selector','value']),
 tool('desktop_windows','列出 Windows 窗口。需要先在设置中启用桌面权限。'),
 tool('desktop_apps','查找本机已注册应用，返回可打开的 appId。内置记事本、计算器和文件管理器。',{query:str('可选应用名称搜索词')}),
 tool('desktop_launch','打开已列出的应用；需要用户确认。之后列出窗口并读取控件以验证。',{appId:str('desktop_apps 返回的精确 appId'),purpose:str('打开应用的目的')},['appId','purpose']),
 tool('desktop_focus','将已读取的窗口切换到前台；需要用户确认。',{handle:{type:'integer'},purpose:str('切换窗口的目的')},['handle','purpose']),
 tool('desktop_inspect','读取选定 Windows 窗口的可访问控件，密码框不读取。',{handle:{type:'integer',description:'窗口 handle'}},['handle']),
 tool('desktop_invoke','点击已读取窗口中的可访问按钮；需用户审核。执行后必须检查实际状态。',{handle:{type:'integer'},controlId:str('desktop_inspect 返回的控件 id'),purpose:str('该操作会做什么')},['handle','controlId','purpose']),
 tool('desktop_set_value','填写已读取窗口中的可访问输入控件；需用户审核。',{handle:{type:'integer'},controlId:str('控件 id'),value:str('填写的内容'),purpose:str('填写目的')},['handle','controlId','value','purpose']),
 tool('screen_capture','截取屏幕，返回截图路径与尺寸。截图后用 0-1000 归一化坐标操作。可传窗口 handle 只截该窗口。',{handle:{type:'integer',description:'可选：desktop_windows 返回的窗口 handle'}}),
 tool('computer_click','按归一化坐标点击屏幕。需用户逐次确认。',{x:{type:'number'},y:{type:'number'},button:{type:'string',enum:['left','right','middle']},double:{type:'boolean'},purpose:str('点击目的与目标控件说明')},['x','y','purpose']),
 tool('computer_type','向当前焦点窗口输入文本（支持中文）。需用户逐次确认。',{text:str('要输入的文本'),purpose:str('输入目的与目标窗口')},['text','purpose']),
 tool('computer_key','发送按键组合，例如 ctrl+s、alt+tab、enter、esc。需用户确认。',{keys:str('按键组合'),purpose:str('按键目的')},['keys','purpose']),
 tool('computer_scroll','在当前焦点窗口滚动。正数向下，负数向上。需用户确认。',{amount:{type:'integer'},purpose:str('滚动目的')},['amount','purpose']),
 tool('computer_drag','从一点拖拽到另一点（归一化坐标），用于选择文本或拖动窗口。需用户确认。',{x1:{type:'number'},y1:{type:'number'},x2:{type:'number'},y2:{type:'number'},purpose:str('拖拽目的')},['x1','y1','x2','y2','purpose']),
 tool('run_shell','在本机 PowerShell 执行命令。需用户批准；不是操作系统沙箱。',{command:str('完整命令'),purpose:str('执行目的与预期输出')},['command','purpose'])
];

export async function executeTool(name,args,ctx){
 const {projectId,taskId,signal}=ctx;if(signal.aborted)throw new Error('任务已停止');
 if(!toolDefinitions.some(t=>t.function.name===name))fail('模型请求了未注册的工具');
 if(!args||typeof args!=='object'||Array.isArray(args))fail('工具参数无效');
 if(ctx.networkEnabled===false&&['search_papers','read_web','browser_open','browser_inspect','browser_click','browser_fill'].includes(name))fail('本轮任务已关闭联网检索',409);
 switch(name){
 case 'list_files':return {files:files(projectId)};
 case 'read_file':return {path:args.path,content:readText(projectId,args.path)};
 case 'read_pdf':return pdfText(projectId,args.path,signal);
 case 'write_file':return writeFile(projectId,args.path,args.content);
 case 'search_papers':{const result=await searchPapers(args.query,signal);for(const item of result.items||[]){if(!list('source',projectId).some(s=>s.taskId===taskId&&s.url===item.url))create('source',{projectId,taskId,kind:'paper',provider:result.provider,query:result.query,...item});}return result;}
 case 'read_web':{const result=await readWeb(projectId,args.url,signal);create('source',{projectId,taskId,url:result.url,title:result.title||result.url,path:result.path});return result;}
 case 'set_plan':{if(!Array.isArray(args.steps)||args.steps.length>10||args.steps.some(s=>!s.title||!['pending','running','done','failed'].includes(s.status)))fail('计划格式无效');await ctx.setPlan(args.steps);return {saved:true};}
 case 'run_python':await ctx.approve(name,args);return runPython(projectId,args.code,signal);
 case 'browser_open':{if(!settings().networkEnabled)fail('网页访问已关闭');await publicURL(args.url);ctx.browser ||= await browserSession(projectId,signal);await ctx.browser.page.goto(args.url,{waitUntil:'domcontentloaded',timeout:25000});return ctx.browser.inspect();}
 case 'browser_inspect':if(!ctx.browser)fail('请先打开研究网页');return ctx.browser.inspect();
 case 'browser_click':if(!ctx.browser)fail('请先打开研究网页');await ctx.browser.page.locator(String(args.selector).slice(0,500)).first().click();await ctx.browser.page.waitForTimeout(400);return ctx.browser.inspect();
 case 'browser_fill':{if(!ctx.browser)fail('请先打开研究网页');const el=ctx.browser.page.locator(String(args.selector).slice(0,500)).first();if(await el.getAttribute('type')==='password')fail('研究浏览器不填写密码');await el.fill(String(args.value).slice(0,5000));return ctx.browser.inspect();}
 case 'desktop_windows':return desktopAction('windows',{},signal);
 case 'desktop_apps':return desktopAction('apps',{query:String(args.query||'').slice(0,100)},signal);
 case 'desktop_launch':{const app=await desktopAction('resolve_app',{appId:String(args.appId||'')},signal);await ctx.approve(name,{...args,appName:app.name,purpose:`${args.purpose||'打开应用'}\n目标应用：${app.name}`});return desktopAction('launch',{appId:app.appId},signal);}
 case 'desktop_focus':{const window=await desktopAction('inspect',{handle:args.handle},signal);await ctx.approve(name,{...args,windowTitle:window.title,purpose:`${args.purpose||'切换窗口'}\n目标窗口：${window.title}`});return desktopAction('focus',{handle:args.handle},signal);}
 case 'desktop_inspect':return desktopAction('inspect',{handle:args.handle},signal);
 case 'desktop_invoke':{if(!settings().desktopEnabled)fail('请先在连接设置中启用 Windows 应用操作',409);const win=await desktopAction('inspect',{handle:args.handle},signal);const ctl=(win.controls||[]).find(c=>c.id===String(args.controlId));await ctx.approve(name,{...args,windowTitle:win.title,controlName:ctl?.name||'',controlType:ctl?.type||'',purpose:(args.purpose||'点击控件')+'\n窗口：'+win.title+'\n控件：'+(ctl?(ctl.name||'(无名称)')+' / '+ctl.type:'未找到该控件 '+args.controlId)});return desktopAction('invoke',args,signal);}
 case 'desktop_set_value':{if(!settings().desktopEnabled)fail('请先在连接设置中启用 Windows 应用操作',409);const win=await desktopAction('inspect',{handle:args.handle},signal);const ctl=(win.controls||[]).find(c=>c.id===String(args.controlId));await ctx.approve(name,{...args,windowTitle:win.title,controlName:ctl?.name||'',controlType:ctl?.type||'',purpose:(args.purpose||'填写控件')+'\n窗口：'+win.title+'\n控件：'+(ctl?(ctl.name||'(无名称)')+' / '+ctl.type:'未找到该控件 '+args.controlId)});return desktopAction('set_value',args,signal);}
 case 'screen_capture':if(!settings().desktopEnabled)fail('请先在连接设置中启用电脑操作',409);return screenCapture(projectId,args.handle,signal);
 case 'computer_click':{if(!settings().desktopEnabled)fail('请先在连接设置中启用电脑操作',409);await ctx.approve(name,{...args,purpose:(args.purpose||'点击屏幕')+'\n点击坐标：('+args.x+', '+args.y+')'+(args.double?'（双击）':'')+(args.button?' 按键：'+args.button:'')});return computerInput(projectId,'click',args,signal);}
 case 'computer_type':{if(!settings().desktopEnabled)fail('请先在连接设置中启用电脑操作',409);const text=String(args.text||'');await ctx.approve(name,{...args,purpose:(args.purpose||'输入文本')+'\n将输入：'+text.slice(0,200)+(text.length>200?'…':'')});return computerInput(projectId,'type',{text},signal);}
 case 'computer_key':{if(!settings().desktopEnabled)fail('请先在连接设置中启用电脑操作',409);await ctx.approve(name,{...args,purpose:(args.purpose||'发送按键')+'\n按键：'+args.keys});return computerInput(projectId,'key',{keys:args.keys},signal);}
 case 'computer_scroll':{if(!settings().desktopEnabled)fail('请先在连接设置中启用电脑操作',409);await ctx.approve(name,{...args,purpose:(args.purpose||'滚动屏幕')+'\n滚动量：'+args.amount});return computerInput(projectId,'scroll',{amount:args.amount},signal);}
 case 'computer_drag':{if(!settings().desktopEnabled)fail('请先在连接设置中启用电脑操作',409);await ctx.approve(name,{...args,purpose:(args.purpose||'拖动鼠标')+'\n从 ('+args.x1+', '+args.y1+') 到 ('+args.x2+', '+args.y2+')'});return computerInput(projectId,'drag',args,signal);}
 case 'run_shell':await ctx.approve(name,{...args,purpose:(args.purpose||'执行命令')+'\n命令：'+String(args.command||'').slice(0,400)});return runShell(projectId,args.command,signal);
 default:fail('工具暂不可用');
 }
}
