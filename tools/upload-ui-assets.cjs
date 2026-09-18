/* Validate every approved UI file before writing. Default: dry run, icons only. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const {putR2}=require('./r2-upload.cjs'),{projectConfig,atomicWrite}=require('./asset-pipeline.cjs'),{digest}=require('./source-guard.cjs');
const root=path.resolve(__dirname,'..'),{deployment}=projectConfig(root),args=new Set(process.argv.slice(2));
const assets=[{name:'apple-touch-icon.png',size:180,type:'image/png'},{name:'app-icon-192.png',size:192,type:'image/png'},{name:'app-icon-512.png',size:512,type:'image/png'}];
if(args.has('--watermark'))assets.push({name:'life-user-watermark.webp',type:'image/webp'});
(async()=>{
 for(const arg of args)if(!['--watermark','--approve','--apply'].includes(arg))throw Error('Unknown option: '+arg);
 if(args.has('--approve')&&args.has('--apply'))throw Error('Approval and upload must be separate commands.');
 const approvalFile=path.join(root,'assets/ui-approval.json'),approved=fs.existsSync(approvalFile)?JSON.parse(fs.readFileSync(approvalFile,'utf8')):{schema:1,files:{}};
 if(approved.schema!==1||!approved.files||typeof approved.files!=='object')throw Error('Invalid approval record.');
 const consumers=['index.html','manifest.webmanifest','src/app.js'].map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n'),ready=[];
 for(const asset of assets){
  const file=path.join(root,asset.name);if(!fs.existsSync(file))throw Error('Missing '+asset.name+'. Supply the current approved file; history recovery is separate.');
  const bytes=fs.readFileSync(file),meta=await sharp(bytes).metadata(),format=asset.type==='image/png'?'png':'webp';
  if(meta.format!==format||!(meta.width>0&&meta.height>0)||asset.size&&(meta.width!==asset.size||meta.height!==asset.size))throw Error('Invalid image format/dimensions: '+asset.name);
  const escaped=asset.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const versions=[...new Set([...consumers.matchAll(new RegExp(escaped+'\\?v=([^\\s"\'<>]+)','g'))].map(m=>m[1]))];
  if(versions.length!==1||!/^\d+(?:\.\d+)+-r\d+(?:-[a-z0-9-]+)?$/i.test(versions[0]))throw Error('One versioned consumer URL is required: '+asset.name);
  const sha256=digest(bytes),previous=approved.files[asset.name];
  if(previous&&previous.sha256!==sha256&&previous.version===versions[0])throw Error('Image changed but cache version did not: '+asset.name);
  ready.push({...asset,file,sha256,version:versions[0],bytes:bytes.length});
 }
 if(args.has('--approve')){for(const row of ready)approved.files[row.name]={sha256:row.sha256,version:row.version,bytes:row.bytes};atomicWrite(approvalFile,JSON.stringify(approved,null,2)+'\n');console.log('Local approvals recorded. Review and commit the approval record; no upload performed.');return;}
 for(const row of ready){const ok=approved.files[row.name]?.sha256===row.sha256&&approved.files[row.name]?.version===row.version;console.log((ok?'APPROVED ':'UNAPPROVED ')+row.name+' '+row.sha256);if(args.has('--apply')&&!ok)throw Error('Unapproved image: '+row.name);}
 if(!args.has('--apply')){console.log('Dry run. Use --apply explicitly. Watermark is excluded unless --watermark is specified.');return;}
 let completed=0;
 for(const row of ready){try{putR2(root,{bucket:deployment.bucket,key:deployment.prefix+'/content/ui/'+row.name,file:row.file,type:row.type,cacheControl:'public, max-age=3600, must-revalidate'});completed++;}catch(error){throw Error('Stopped after '+completed+' uploads; completed objects are not rolled back. '+error.message);}}
 console.log('Approved uploads completed: '+completed);
})().catch(error=>{console.error(error.message);process.exitCode=1;});
