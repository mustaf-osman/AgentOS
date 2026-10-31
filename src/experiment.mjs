import fs from 'node:fs';
import path from 'node:path';
import {ROOT,projectRoot,safePath,writeFile,fail} from './core.mjs';
import {pythonPath,runProcess} from './runtime.mjs';

export async function experiment(projectId,taskId,{source,seed=42}={},signal){
 const input=source?safePath(projectRoot(projectId),source):'';if(input&&(!fs.existsSync(input)||path.extname(input).toLowerCase()!=='.csv'))fail('请选择研究空间中的 CSV 数据');
 const output=`experiments/${taskId}`;fs.mkdirSync(safePath(projectRoot(projectId),output),{recursive:true});
 const result=await runProcess(pythonPath(),['-I','-X','utf8',path.join(ROOT,'tools','experiment.py'),'--output',safePath(projectRoot(projectId),output),'--seed',String(Number.isInteger(Number(seed))?Number(seed):42),...(input?['--source',input]:[])],{cwd:projectRoot(projectId),signal,timeout:45000});
 writeFile(projectId,`${output}/execution.log`,JSON.stringify(result,null,2));if(signal?.aborted)throw new Error('实验已停止');if(result.exitCode!==0)throw new Error('实验执行失败：'+result.stderr.slice(0,1500));
 const summary=JSON.parse(fs.readFileSync(safePath(projectRoot(projectId),`${output}/results.json`),'utf8'));
 return {output,summary,files:['sensor.csv','results.json','predictions.csv','chart.svg','report.md','reproduce.py','execution.log'].map(n=>`${output}/${n}`),notice:summary.dataSource==='synthetic'?'使用明确标注的合成数据完成真实本地计算；非 ESP32 实测，非 Qwen 生成。':'使用用户提供的数据完成真实本地计算；非 Qwen 生成。'};
}
