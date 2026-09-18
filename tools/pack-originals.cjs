/* Separate, checksummed original-source archive; upload only with --publish. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process'),sharp=require('sharp');
const {sourceFiles,projectConfig,atomicWrite}=require('./asset-pipeline.cjs'),{digest,assertOriginal}=require('./source-guard.cjs'),{putR2}=require('./r2-upload.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
 if(process.argv.slice(2).some(arg=>arg!=='--publish'))throw Error('Supported option: --publish');
 const {deployment}=projectConfig(root),manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
 const names=[...sourceFiles(root),'universe-optimized.webp'],music=path.join(root,'assets/music');
 if(fs.existsSync(music))for(const f of fs.readdirSync(music))if(f.toLowerCase().endsWith('.mp3'))names.push('music/'+f);
 const entries=names.map(name=>({path:name,...assertOriginal(root,path.join(root,'assets',name),manifest)}));
 for(const entry of entries)if(entry.path.endsWith('.webp')){const m=await sharp(path.join(root,'assets',entry.path)).metadata();if(m.format!=='webp'||Math.abs(m.width/m.height-2)>.03)throw Error('Invalid original texture: '+entry.path);}
 const staging=path.join(root,'.cloudflare/originals-package');fs.rmSync(staging,{recursive:true,force:true});fs.mkdirSync(staging,{recursive:true});
 for(const entry of entries){const dest=path.join(staging,entry.path);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,'assets',entry.path),dest);}
 atomicWrite(path.join(staging,'source-manifest.json'),JSON.stringify({schema:1,kind:'originals',files:entries},null,2)+'\n');
 const archive=path.join(root,'.cloudflare/originals.tar.gz'),packed=spawnSync('tar',['-czf',archive,'-C',staging,'.'],{stdio:'inherit'});if(packed.error)throw packed.error;if(packed.status)throw Error('Packing failed.');
 const bytes=fs.readFileSync(archive),sha256=digest(bytes),key=deployment.prefix+'/originals/'+sha256+'.tar.gz';console.log('Original archive: '+archive+'\nSHA-256: '+sha256);
 if(process.argv.includes('--publish')){putR2(root,{bucket:deployment.bucket,key,file:archive,type:'application/gzip'});deployment.originals={path:key,sha256,bytes:bytes.length};atomicWrite(path.join(root,'assets/deployment.json'),JSON.stringify(deployment,null,2)+'\n');}
 else console.log('No upload performed. Check that these are genuine masters before publishing.');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
