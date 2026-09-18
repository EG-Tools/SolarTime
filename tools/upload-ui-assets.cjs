'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process'),sharp=require('sharp'),{projectConfig}=require('./asset-pipeline.cjs');

const root=path.resolve(__dirname,'..'),{deployment}=projectConfig(root);
const wranglerBin=path.join(root,'node_modules','wrangler','bin','wrangler.js');
const HISTORICAL_REF='c1ee7e2b7f3c431a3702fe2f5d04675cab4f9dc6';
const UI_ASSETS=Object.freeze([
  {name:'apple-touch-icon.png',type:'image/png',width:180,height:180},
  {name:'app-icon-192.png',type:'image/png',width:192,height:192},
  {name:'app-icon-512.png',type:'image/png',width:512,height:512},
  {name:'life-user-watermark.webp',type:'image/webp'}
]);

async function restoreMissing(asset){
  const file=path.join(root,asset.name);
  if(fs.existsSync(file))return file;
  const url=`https://raw.githubusercontent.com/EG-Tools/SolarTime/${HISTORICAL_REF}/${asset.name}`;
  console.log(`Restoring missing ${asset.name} from Git history...`);
  const response=await fetch(url,{headers:{'user-agent':'SolarTime-R2-UI-Repair/1.0'}});
  if(!response.ok)throw Error(`Could not restore ${asset.name}: HTTP ${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(!bytes.length)throw Error('Restored file is empty: '+asset.name);
  fs.writeFileSync(file,bytes);
  return file;
}

(async()=>{
  if(!fs.existsSync(wranglerBin))throw Error('Run npm install before uploading UI assets.');
  for(const asset of UI_ASSETS){
    const file=await restoreMissing(asset);
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
