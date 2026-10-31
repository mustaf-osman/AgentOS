import {settings,redact,fail,create} from './core.mjs';

function friendly(status){return ({400:'模型请求参数不兼容，请检查模型是否支持工具调用',401:'模型鉴权失败，请检查 API Key 是否属于当前服务',403:'该账号没有模型访问权限',404:'模型或 API 地址不存在，请检查配置',402:'模型服务余额或额度不足',429:'请求过于频繁或额度受限，请稍后重试',500:'模型服务暂时异常',503:'模型服务暂时不可用'})[status]||`模型请求失败（HTTP ${status}）`;}
export async function chat(messages,tools=[],{signal,projectId,taskId,maxTokens=6000,record=true}={}){
 const s=settings();if(!s.apiKey&&!['localhost','127.0.0.1','[::1]'].includes(new URL(s.baseURL).hostname))fail('请先在连接设置中配置 Qwen API Key',409);
 const vision=messages.some(m=>Array.isArray(m.content)&&m.content.some(p=>p&&p.type==='image_url'));
 const model=vision?(s.visionModel||'Qwen3-VL-30B-A3B-Instruct'):s.model;
 const started=Date.now();let response;
 const endpoint=new URL(s.baseURL),dashscope=endpoint.hostname==='dashscope.aliyuncs.com'||endpoint.hostname.endsWith('.maas.aliyuncs.com');
 try{response=await fetch(s.baseURL.replace(/\/$/,'')+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${s.apiKey}`},body:JSON.stringify({model,messages,...(tools.length?{tools,tool_choice:'auto'}:{}),stream:false,max_tokens:maxTokens,...(dashscope?{enable_thinking:false}:{})}),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(120000)]):AbortSignal.timeout(120000)});}catch(e){throw new Error(signal?.aborted?'任务已停止':e.name==='TimeoutError'?'模型响应超时，请重试':'无法连接模型服务，请检查网络和 API 地址');}
 if(!response.ok){let reason='';try{const data=await response.json();const message=data.error?.message||data.message;if(typeof message==='string')reason=redact(message).slice(0,400);}catch{}throw new Error(friendly(response.status)+(reason?'：'+reason:''));}
 let data;try{data=await response.json();}catch{throw new Error('模型服务返回了无法解析的响应');}
 let message=data.choices?.[0]?.message;if(!message)throw new Error('模型没有返回有效内容');
 if(data.choices?.[0]?.finish_reason==='length')throw new Error('模型输出超过长度限制，本次任务未完成，请缩小任务范围');
 const asText=v=>Array.isArray(v)?v.map(p=>typeof p==='string'?p:(p?.text||p?.content||'')).join(''):(v==null?'':String(v));
 let content=asText(message.content);
 if(vision&&!String(content).trim()&&!(message.tool_calls||[]).length){try{const retry=[...messages,{role:'user',content:[{type:'text',text:'请根据上面的截图，直接用中文回答用户的问题，不要调用工具。'}]}];const r2=await fetch(s.baseURL.replace(/\/$/,'')+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${s.apiKey}`},body:JSON.stringify({model,messages:retry,stream:false,max_tokens:600}),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(120000)]):AbortSignal.timeout(120000)});if(r2.ok){const d2=await r2.json();const m2=d2.choices?.[0]?.message;const c2=asText(m2?.content);if(String(c2).trim()){data=d2;message=m2;content=c2;}}}catch{}}
 if(record)create('model_call',{projectId,taskId,model,requestId:data.id||null,durationMs:Date.now()-started,usage:data.usage||null,toolNames:(message.tool_calls||[]).map(t=>t.function?.name),status:'SUCCESS'});
 return {message:{role:'assistant',content:content||null,...(message.tool_calls?{tool_calls:message.tool_calls}:{})},model,usage:data.usage};
}
export async function testConnection(){const started=Date.now();const r=await chat([{role:'user',content:'只回复 OK。'}],[],{maxTokens:64,record:false});return {ok:true,model:r.model,latencyMs:Date.now()-started,message:'模型对话调用成功。该检测使用了少量模型 Token。'};}
