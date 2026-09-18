'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process'),sharp=require('sharp'),{projectConfig}=require('./asset-pipeline.cjs');

const root=path.resolve(__dirname,'..'),{deployment}=projectConfig(root);
const wranglerBin=path.join(root,'node_modules','wrangler','bin','wrangler.js');
const UI_ASSETS=Object.freeze([
  {name:'apple-touch-icon.png',type:'image/png',width:180,height:180},
  {name:'app-icon-192.png',type:'image/png',width:192,height:192},
  {name:'app-icon-512.png',type:'image/png',width:512,height:512},
  {name:'life-user-watermark.webp',type:'image/webp'}
]);

(async()=>{
  if(!fs.existsSync(wranglerBin))throw Error('Run npm install before uploading UI assets.');
  for(const asset of UI_ASSETS){
    const file=path.join(root,asset.name);
    if(!fs.existsSync(file))throw Error('Missing local UI asset: '+asset.name);
    if(asset.width){
      const metadata=await sharp(file).metadata();
      if(metadata.width!==asset.width||metadata.height!==asset.height)throw Error(`${asset.name} must be ${asset.width}x${asset.height}.`);
    }
    const key=`${deployment.prefix}/content/ui/${asset.name}`;
    const object=`${deployment.bucket}/${key}`;
    console.log(`Uploading ${asset.name} -> ${key}`);
    const result=spawnSync(process.execPath,[wranglerBin,'r2','object','put',object,'--remote','--file',file,'--content-type',asset.type,'--cache-control','public, max-age=31536000, immutable','--force'],{cwd:root,stdio:'inherit'});
    if(result.error)throw result.error;
    if(result.status!==0)process.exit(result.status||1);
  }
  console.log('R2 UI assets uploaded.');
})().catch(error=>{console.error('UI asset upload failed: '+error.message);process.exitCode=1;});
