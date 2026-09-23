'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{putR2}=require('./r2-upload.cjs'),{projectConfig}=require('./asset-pipeline.cjs'),{digest}=require('./source-guard.cjs');
const root=path.resolve(__dirname,'..'),file=path.join(root,'windows/SolarTimeShutdownHelper.cmd'),bridge=fs.readFileSync(path.join(root,'src/windows-shutdown.js'),'utf8'),{deployment}=projectConfig(root);
// Git and editors may keep the source as LF. The downloadable batch file must
// always be emitted as Windows CRLF or cmd.exe can truncate/misread commands.
const payload=Buffer.from(fs.readFileSync(file,'utf8').replace(/\r?\n/g,'\r\n'),'utf8');
const sha256=digest(payload).toUpperCase(),short=sha256.slice(0,16).toLowerCase(),key=`${deployment.prefix}/content/windows/SolarTimeShutdownHelper.${short}.cmd`,sourceKey=`${deployment.prefix}/content/windows/SolarTimeShutdownHelper.${short}.source.txt`,url=new URL(key,deployment.cdnBase).href,sourceUrl=new URL(sourceKey,deployment.cdnBase).href;
if(!bridge.includes(url)||!bridge.includes(sourceUrl)||!bridge.includes(sha256))throw Error('src/windows-shutdown.js does not match the helper file URLs and SHA-256.');
if(!process.argv.includes('--apply')){console.log(JSON.stringify({bucket:deployment.bucket,key,url,sourceKey,sourceUrl,sha256,bytes:payload.length,lineEndings:'CRLF'},null,2));console.log('No upload performed. Re-run with --apply after review.');process.exit(0);}
const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'solar-time-helper-')),prepared=path.join(tempDir,'SolarTimeShutdownHelper.cmd');
try{
 fs.writeFileSync(prepared,payload);
 putR2(root,{bucket:deployment.bucket,key,file:prepared,type:'application/octet-stream',contentDisposition:'attachment; filename="SolarTimeShutdownHelper.cmd"'});
 putR2(root,{bucket:deployment.bucket,key:sourceKey,file:prepared,type:'text/plain; charset=utf-8'});
 console.log(`Uploaded verified Windows helper: ${url}`);
}finally{fs.rmSync(tempDir,{recursive:true,force:true});}
