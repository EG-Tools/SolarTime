'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process'),{projectConfig}=require('./asset-pipeline.cjs');
const root=path.resolve(__dirname,'..'),media=path.join(root,'.cloudflare/media'),{deployment}=projectConfig(root);
const wranglerBin=path.join(root,'node_modules','wrangler','bin','wrangler.js');
if(!fs.existsSync(wranglerBin))throw Error('Run npm install before uploading.');
if(!fs.existsSync(media))throw Error('Run npm run build:assets before uploading.');
function filesUnder(dir,result=[]){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);entry.isDirectory()?filesUnder(full,result):result.push(full);}return result;}
const uploads=filesUnder(media).map(file=>({file,key:path.relative(media,file).split(path.sep).join('/')}));
const mime=file=>file.endsWith('.webp')?'image/webp':file.endsWith('.mp3')?'audio/mpeg':file.endsWith('.json')?'application/json; charset=utf-8':'application/octet-stream';
const total=uploads.length+1;
function upload(file,key,index,contentType=mime(file)){
 const object=`${deployment.bucket}/${key}`;process.stdout.write(`[${index}/${total}] ${key}\n`);
 const args=[wranglerBin,'r2','object','put',object,'--remote','--file',file,'--content-type',contentType,'--cache-control',file.endsWith('manifest.json')?'no-cache':'public, max-age=31536000, immutable','--force'];
 const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status||1);
}
for(let index=0;index<uploads.length;index++)upload(uploads[index].file,uploads[index].key,index+1);
if(!deployment.bundle?.path)throw Error('Run npm run pack:media before uploading.');
const bundleFile=path.join(root,'.cloudflare','bundles',path.basename(deployment.bundle.path));if(!fs.existsSync(bundleFile))throw Error('Media bundle file is missing.');
upload(bundleFile,deployment.bundle.path,total,'application/gzip');
console.log(`Uploaded ${total} immutable objects to ${deployment.bucket}.`);
