'use strict';
const {seam}=require('../src/surface-style.js');
const {assertOriginal}=require('./source-guard.cjs');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
let sharpApi;
function imageProcessor(){return sharpApi||(sharpApi=require('sharp'));}

const TEXTURE_WIDTHS=Object.freeze([256,512,1024,2048,4096]);
const SKY_FILE='universe-optimized.webp';
const REQUIRED=Object.freeze(['sun','mercury','venus','earth','earth-night','mars','jupiter','saturn','uranus','neptune','pluto','moon','europa','triton','clouds']);
// High-resolution colour maps already carry their photographed surface detail.
// Reapplying the older synthetic relief maps would exaggerate the same craters.
const EXCLUDED=new Set(['universe.webp',SKY_FILE,'pluto-relief.webp','mercury-relief.webp','moon-relief.webp','mars-relief.webp']);

const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const slash=value=>value.split(path.sep).join('/');
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
function atomicWrite(file,value){
 const temporary=file+'.tmp';fs.mkdirSync(path.dirname(file),{recursive:true});
 try{fs.writeFileSync(temporary,value);fs.renameSync(temporary,file);}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
}
function projectConfig(root){
 const revision=readJson(path.join(root,'assets/revision.json')).version;
 if(!/^assetpack-[a-z0-9-]+$/i.test(revision))throw Error('Invalid assets/revision.json version.');
 const deployment=readJson(path.join(root,'assets/deployment.json'));
 if(!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/i.test(deployment.bucket))throw Error('Invalid R2 bucket name.');
 deployment.prefix=String(deployment.prefix||'releases').replace(/^\/+|\/+$/g,'');
 deployment.cdnBase=String(deployment.cdnBase||'').trim();
 return {revision,deployment};
}
function sourceFiles(root){
 for(const id of REQUIRED)if(!fs.existsSync(path.join(root,'assets',id+'.webp')))throw Error('Missing original asset: assets/'+id+'.webp');
 return fs.readdirSync(path.join(root,'assets')).filter(name=>name.endsWith('.webp')&&!EXCLUDED.has(name)).sort();
}
async function seamBakedVariant(source,width,height,lossless=false){
 const sharp=imageProcessor();
 const image=sharp(source).resize(width,height,{fit:'fill',kernel:sharp.kernel.lanczos3});
 const {data,info}=await image.raw().toBuffer({resolveWithObject:true}),channels=info.channels;
 const band=Math.max(seam.minBand,Math.min(seam.maxBand,Math.round(width*seam.ratio)));
 for(let y=0;y<height;y++)for(let x=0;x<band;x++){
  const t=1-x/(band-1),weight=t*t*(3-2*t),leftPixel=y*width+x,rightPixel=y*width+(width-1-x);
  for(let k=0;k<channels;k++){
   const a=leftPixel*channels+k,b=rightPixel*channels+k,left=data[a],right=data[b],middle=(left+right)*.5;
   data[a]=Math.round(left+(middle-left)*weight);data[b]=Math.round(right+(middle-right)*weight);
  }
 }
 return sharp(data,{raw:{width,height,channels}}).webp(lossless?{lossless:true,effort:6}:{quality:95,effort:6,smartSubsample:true}).toBuffer();
}
async function textureVariants(root,output,prefix,file,group='textures'){
 const sharp=imageProcessor();
 const source=path.join(root,'assets',file),metadata=await sharp(source).metadata();
 if(!metadata.width||!metadata.height||Math.abs(metadata.width/metadata.height-2)>.03)throw Error(file+' must be a 2:1 texture.');
 const widths=TEXTURE_WIDTHS.filter(width=>width<=metadata.width);if(!widths.includes(metadata.width))widths.push(metadata.width);widths.sort((a,b)=>a-b);
 const tiers=[];
 // Cache encoded bytes outside the disposable media output. Include source,
 // encoder versions and transformation code/settings so changes cannot reuse
 // an obsolete conversion. Every hit is verified before it reaches output.
 const cache=path.join(root,'.cloudflare','texture-cache');
 const recipe=digest(JSON.stringify({source:digest(fs.readFileSync(source)),file,group,versions:sharp.versions,seam,code:seamBakedVariant.toString()+textureVariants.toString()}));
 for(const width of widths){
  const cached=path.join(cache,recipe+'-'+width+'.webp');let bytes;
  try{const candidate=fs.readFileSync(cached);if(digest(candidate)===fs.readFileSync(cached+'.sha256','utf8'))bytes=candidate;}catch(_){/* Missing/incomplete caches are rebuilt from the master. */}
  if(!bytes){
   const seamBaked=group==='textures',lossless=file==='earth-night.webp';
   bytes=seamBaked?await seamBakedVariant(source,width,width/2,lossless):(width===metadata.width?fs.readFileSync(source):await sharp(source).resize(width,width/2,{fit:'fill',kernel:sharp.kernel.lanczos3}).webp(lossless?{lossless:true,effort:6}:{quality:88,effort:6,smartSubsample:true}).toBuffer());
   atomicWrite(cached,bytes);atomicWrite(cached+'.sha256',digest(bytes));
  }
  const hash=digest(bytes).slice(0,16),stem=path.basename(file,'.webp'),relative=slash(path.join(prefix,'content',group,`${stem}-${width}.${hash}.webp`));
  const destination=path.join(output,...relative.split('/'));fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,bytes);
  tiers.push({width,height:width/2,path:relative,bytes:bytes.length,sha256:digest(bytes)});
 }
 return {source:file,width:metadata.width,height:metadata.height,seamBaked:group==='textures',tiers};
}
function musicAssets(root,output,prefix){
 const music={},musicDir=path.join(root,'assets/music');
 if(fs.existsSync(musicDir))for(const file of fs.readdirSync(musicDir).filter(name=>name.toLowerCase().endsWith('.mp3')).sort()){
  const bytes=fs.readFileSync(path.join(musicDir,file)),hash=digest(bytes),relative=slash(path.join(prefix,'content','music',`${path.basename(file,'.mp3')}.${hash.slice(0,16)}.mp3`));
  atomicWrite(path.join(output,...relative.split('/')),bytes);
  music[file]={source:'music/'+file,path:relative,bytes:bytes.length,sha256:hash};
 }
 return music;
}
async function buildMedia(root,output,{musicOnly=false}={}){
 const {revision,deployment}=projectConfig(root),resolved=path.resolve(output),cloudflareRoot=path.resolve(root,'.cloudflare');
 if(resolved!==cloudflareRoot&&!resolved.startsWith(cloudflareRoot+path.sep))throw Error('Generated media must stay inside .cloudflare.');
 const previousFile=path.join(root,'assets/manifest.json'),previous=fs.existsSync(previousFile)?readJson(previousFile):null;
 if(musicOnly){
  if(!previous)throw Error('Music-only build requires an existing asset manifest.');
  const music=musicAssets(root,resolved,deployment.prefix);
  const manifest={...previous,music};
  if(JSON.stringify(previous.music)!==JSON.stringify(music))manifest.generatedAt=new Date().toISOString();
  const text=JSON.stringify(manifest,null,2)+'\n';atomicWrite(previousFile,text);
  atomicWrite(path.join(resolved,deployment.prefix,'manifests',manifest.revision+'.json'),text);
  return {manifest,deployment};
 }
 for(const file of sourceFiles(root))assertOriginal(root,path.join(root,'assets',file),previous);
 fs.rmSync(resolved,{recursive:true,force:true});fs.mkdirSync(resolved,{recursive:true});
 const materials={};
 // Immutable, already-published auxiliary maps need no local master or upload.
 for(const [id,entry] of Object.entries(previous?.materials||{}))if(entry.remoteOnly)materials[id]=entry;
 for(const file of sourceFiles(root))materials[path.basename(file,'.webp')]=await textureVariants(root,resolved,deployment.prefix,file);
 const sky=await textureVariants(root,resolved,deployment.prefix,SKY_FILE,'backgrounds');
 // A cloud-hosted preview may be selected only by file:// and local dev hosts.
 // Preserve that opt-in metadata when rebuilding release media; published pages
 // continue to use the immutable release tiers above.
 if(previous?.sky?.localPreview)sky.localPreview=previous.sky.localPreview;
 if(previous?.sky?.galaxyAtlas){sky.galaxyAtlas=previous.sky.galaxyAtlas;sky.galaxyIndices=previous.sky.galaxyIndices||[0];}
 const music=musicAssets(root,resolved,deployment.prefix);
 const effects={...previous?.effects};
 for(const entry of Object.values(effects)){
  const bytes=fs.readFileSync(path.join(root,'assets',entry.source));
  if(digest(bytes)!==entry.sha256)throw Error('Effect source changed; rebuild its immutable manifest entry: '+entry.source);
  atomicWrite(path.join(resolved,...entry.path.split('/')),bytes);
 }
 const manifestFile=path.join(root,'assets/manifest.json'),body={schema:1,revision,materials,sky,music,effects};let generatedAt=new Date().toISOString();
 if(fs.existsSync(manifestFile))try{const previous=readJson(manifestFile),previousBody={schema:previous.schema,revision:previous.revision,materials:previous.materials,sky:previous.sky,music:previous.music,effects:previous.effects||{}};if(JSON.stringify(previousBody)===JSON.stringify(body)&&typeof previous.generatedAt==='string')generatedAt=previous.generatedAt;}catch(_){/* Regenerate invalid metadata. */}
 const manifest={schema:body.schema,revision:body.revision,generatedAt,materials,sky,music,effects};
 const text=JSON.stringify(manifest,null,2)+'\n';atomicWrite(manifestFile,text);
 atomicWrite(path.join(resolved,deployment.prefix,'manifests',revision+'.json'),text);
 return {manifest,deployment};
}
function compactRuntimeManifest(manifest){
 const tiers=entry=>entry.tiers.map(row=>({width:row.width,path:row.path}));
 return {revision:manifest.revision,effects:Object.fromEntries(Object.entries(manifest.effects||{}).map(([id,entry])=>[id,{path:entry.path}])),
  materials:Object.fromEntries(Object.entries(manifest.materials).map(([id,entry])=>[id,{seamBaked:!!entry.seamBaked,tiers:tiers(entry),...(entry.localPreview?{localPreview:true}:{})}])),
   sky:{tiers:tiers(manifest.sky),...(manifest.sky.galaxyAtlas?{galaxyAtlas:manifest.sky.galaxyAtlas,galaxyIndices:manifest.sky.galaxyIndices||[0]}:{}),...(manifest.sky.localPreview?{localPreview:manifest.sky.localPreview}:{})},
  music:Object.fromEntries(Object.entries(manifest.music).map(([file,entry])=>[file,{path:entry.path}]))};
}
function runtimeScripts(root,manifest,deployment,{cdnBase=deployment.cdnBase}={}){
 // Optional, unpublished effects also need an origin-clean file:// preview.
 // Use the runtime profiles as the source list; HTTP still loads the WebP.
 const effectSource=fs.readFileSync(path.join(root,'src/renderer.js'),'utf8'),localEffectData={};
 for(const match of effectSource.matchAll(/atlasPath:'(assets\/effects\/[^']+\.webp)'/g))localEffectData[match[1]]='data:image/webp;base64,'+fs.readFileSync(path.join(root,match[1])).toString('base64');
 const localEffects='/* Generated by tools/build-assets.cjs; lazy file-preview images. */\n(function(root){const modules=root.SolarModules||(root.SolarModules={});modules.LocalEffectAtlases=Object.freeze('+JSON.stringify(localEffectData)+');})(window);\n';
 const stars=null;
 const materialInfo=readJson(path.join(root,'assets/material-info.json'));
 const compact=compactRuntimeManifest(manifest);
 for(const [id,entry] of Object.entries(manifest.materials))if(entry.localPreview){
  compact.materials[id].fileTiers=entry.tiers.map(row=>({width:row.width,path:'data:image/webp;base64,'+fs.readFileSync(path.join(root,'.cloudflare/media',row.path)).toString('base64')}));
 }
 const prelude=`/* Generated by tools/build-assets.cjs; cloud URL manifest only, no media bytes. */\n(function(root){'use strict';\nconst manifest=${JSON.stringify(compact)},configuredBase=${JSON.stringify(String(cdnBase||''))};\nconst base=configuredBase?new URL(configuredBase,location.href).href.replace(/\\/?$/,'/'):'';\nif(!base)throw Error('Solar Time media service is not configured.');\nconst remote=path=>new URL(path,base).href;\nconst asset=(id,entry)=>{const local=id==='earth-night'&&location.protocol==='file:'?new URL('assets/earth-night.webp',location.href).href:'';return Object.freeze({base:local?'':base,seamBaked:!!entry.seamBaked,tiers:Object.freeze(entry.tiers.map(row=>Object.freeze({width:row.width,path:row.path}))),fallback:local||remote(entry.tiers[0].path)});};\nconst materials={};for(const [id,entry] of Object.entries(manifest.materials))materials[id]=asset(id,entry);\nconst music={};for(const [file,entry] of Object.entries(manifest.music))music[file]=Object.freeze({base,path:entry.path,fallback:remote(entry.path)});\nroot.SolarAssets={materials:Object.freeze(materials),materialInfo:${JSON.stringify(materialInfo)},materialRevision:manifest.revision,music:Object.freeze(music),effects:Object.freeze(Object.fromEntries(Object.entries(manifest.effects).map(([id,entry])=>[id,remote(entry.path)]))),stars:${JSON.stringify(stars)},sky:null,skyVersion:manifest.revision};\nroot.SolarAssetManifest=Object.freeze(manifest);\n})(window);\n`;
 const sky=`/* Generated sky URL payload; load after src/assets.js. */\n(function(root){'use strict';if(!root.SolarAssets)throw Error('SolarAssets must load before sky-asset.js');const entry=root.SolarAssetManifest.sky,base=Object.values(root.SolarAssets.materials)[0]?.base||'';if(!base)throw Error('Solar Time media service is not configured.');const local=location.protocol==='file:'||['localhost','127.0.0.1','[::1]'].includes(location.hostname),selected=local&&entry.localPreview?entry.localPreview:entry;root.SolarAssets.sky=Object.freeze({base,tiers:Object.freeze(selected.tiers.map(row=>Object.freeze({width:row.width,path:row.path}))),fallback:new URL(selected.tiers[0].path,base).href,galaxyAtlas:selected.galaxyAtlas?new URL(selected.galaxyAtlas.path,base).href:'',galaxyIndices:Object.freeze(selected.galaxyIndices||[0,1,2])});})(window);\n`;
 // Preview-only media uses generated local LOD files, never an unpublished R2
 // URL. A normal media build replaces this marker with published tier metadata.
 const assets=prelude.replace("const local=id==='earth-night'&&location.protocol==='file:'?new URL('assets/earth-night.webp',location.href).href:'';","if(entry.localPreview){if(location.protocol!=='file:'&&!['localhost','127.0.0.1','[::1]'].includes(location.hostname))throw Error('Unpublished local material: '+id);return Object.freeze({base:new URL('.cloudflare/media/',location.href).href,seamBaked:!!entry.seamBaked,tiers:location.protocol==='file:'?entry.fileTiers:entry.tiers,fallback:(location.protocol==='file:'?entry.fileTiers[0].path:new URL(entry.tiers[0].path,new URL('.cloudflare/media/',location.href)).href)});}const local='';");
 return {assets,sky,localEffects};
}
module.exports={TEXTURE_WIDTHS,SKY_FILE,REQUIRED,atomicWrite,buildMedia,textureVariants,compactRuntimeManifest,projectConfig,runtimeScripts,sourceFiles};
