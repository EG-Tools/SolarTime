'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {putR2}=require('./r2-upload.cjs'),{projectConfig}=require('./asset-pipeline.cjs'),{digest}=require('./source-guard.cjs');
function helperPlan(root){
 const file=path.join(root,'windows/SolarTimeShutdownHelper.cmd'),bridge=fs.readFileSync(path.join(root,'src/windows-shutdown.js'),'utf8'),{deployment}=projectConfig(root);
 const payload=Buffer.from(fs.readFileSync(file,'utf8').replace(/\r?\n/g,'\r\n'),'utf8');
 const sha256=digest(payload).toUpperCase(),short=sha256.slice(0,16).toLowerCase(),key=`${deployment.prefix}/content/windows/SolarTimeShutdownHelper.${short}.cmd`,sourceKey=`${deployment.prefix}/content/windows/SolarTimeShutdownHelper.${short}.source.txt`,url=new URL(key,deployment.cdnBase).href,sourceUrl=new URL(sourceKey,deployment.cdnBase).href;
 if(!bridge.includes(url)||!bridge.includes(sourceUrl)||!bridge.includes(sha256))throw Error('src/windows-shutdown.js does not match the helper URLs and SHA-256.');
 return {bucket:deployment.bucket,key,url,sourceKey,sourceUrl,sha256,payload};
}
async function matchesRemote(url,expected,{attachment=false,fetchFn=fetch}={}){
 const response=await fetchFn(url,{cache:'no-store',signal:AbortSignal.timeout(30000)});
 if(response.status===404)return false;
 if(!response.ok)throw Error('Helper preflight HTTP '+response.status);
 const bytes=Buffer.from(await response.arrayBuffer());
 if(digest(bytes).toUpperCase()!==expected)throw Error('Immutable helper URL has mismatched bytes; refusing to overwrite it.');
 if(attachment&&!/attachment/i.test(response.headers.get('content-disposition')||''))throw Error('Existing installer is not served as an attachment.');
 if(!attachment&&!/text\/plain/i.test(response.headers.get('content-type')||''))throw Error('Existing helper source has the wrong content type.');
 return true;
}
async function uploadWindowsHelper(root,{apply=false,fetchFn=fetch,putFn=putR2}={}){
 const plan=helperPlan(root),{payload,...publicPlan}=plan,report={...publicPlan,bytes:payload.length,lineEndings:'CRLF',uploaded:[],skipped:[]};
 if(!apply)return {...report,writes:false};
 const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'solar-time-helper-')),prepared=path.join(tempDir,'SolarTimeShutdownHelper.cmd');
 try{
  fs.writeFileSync(prepared,payload);
  for(const item of [{key:plan.key,url:plan.url,type:'application/octet-stream',attachment:true},{key:plan.sourceKey,url:plan.sourceUrl,type:'text/plain; charset=utf-8',attachment:false}]){
   if(await matchesRemote(item.url,plan.sha256,{attachment:item.attachment,fetchFn})){report.skipped.push(item.key);continue;}
   await putFn(root,{bucket:plan.bucket,key:item.key,file:prepared,type:item.type,contentDisposition:item.attachment?'attachment; filename="SolarTimeShutdownHelper.cmd"':''});
   if(!await matchesRemote(item.url,plan.sha256,{attachment:item.attachment,fetchFn}))throw Error('Uploaded helper is not available for verification.');
   report.uploaded.push(item.key);
  }
 }finally{fs.rmSync(tempDir,{recursive:true,force:true});}
 fs.mkdirSync(path.join(root,'.cloudflare'),{recursive:true});fs.writeFileSync(path.join(root,'.cloudflare/helper-upload.json'),JSON.stringify(report,null,2)+'\n');
 return report;
}
if(require.main===module){const args=process.argv.slice(2);if(args.some(a=>a!=='--apply'))throw Error('Unknown helper upload option.');uploadWindowsHelper(path.resolve(__dirname,'..'),{apply:args.includes('--apply')}).then(report=>console.log(JSON.stringify(report,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});}
module.exports={helperPlan,matchesRemote,uploadWindowsHelper};
