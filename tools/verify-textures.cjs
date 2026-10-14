/* Verify a fixed visual baseline plus every media URL changed since the
 * currently published Pages manifest. Full bytes are downloaded once; cache
 * observations use HEAD so verification does not redownload large objects. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function parseRuntimeManifest(source){
 if(typeof source!=='string'||source.length>5_000_000)throw Error('Published runtime manifest is invalid.');
 const start=source.indexOf('const manifest=');if(start<0)throw Error('Published runtime manifest was not found.');
 const from=start+'const manifest='.length,end=source.indexOf(',configuredBase=',from);if(end<0)throw Error('Published runtime manifest terminator was not found.');
 const manifest=JSON.parse(source.slice(from,end));if(!manifest||typeof manifest!=='object'||!manifest.materials||!manifest.sky||!manifest.music)throw Error('Published runtime manifest is incomplete.');
 return manifest;
}
function manifestPaths(manifest){
 const out=new Set();
 for(const entry of Object.values(manifest.materials||{}))for(const tier of entry.tiers||[])if(tier.path)out.add(tier.path);
 for(const tier of manifest.sky?.tiers||[])if(tier.path)out.add(tier.path);
 if(manifest.sky?.galaxyAtlas?.path)out.add(manifest.sky.galaxyAtlas.path);
 for(const entry of Object.values(manifest.effects||{}))if(entry.path)out.add(entry.path);
 for(const entry of Object.values(manifest.music||{}))if(entry.path)out.add(entry.path);
 return out;
}
function mediaEntries(manifest){
 const entries=[];
 for(const [id,entry] of Object.entries(manifest.effects||{}))entries.push({kind:'effect',id,...entry});
 for(const [id,material] of Object.entries(manifest.materials||{}))for(const tier of material.tiers||[])entries.push({kind:'texture',id,width:tier.width,...tier});
 for(const tier of manifest.sky?.tiers||[])entries.push({kind:'background',id:'sky',width:tier.width,...tier});
 if(manifest.sky?.galaxyAtlas?.path){
  const atlas=manifest.sky.galaxyAtlas,match=/\.([a-f0-9]{16})\.[^.]+$/i.exec(atlas.path);if(!match)throw Error('Galaxy atlas path is not content-addressed.');
  entries.push({kind:'background',id:'galaxy-atlas',path:atlas.path,hashPrefix:match[1].toLowerCase(),bytes:atlas.bytes,sha256:atlas.sha256});
 }
 for(const [id,entry] of Object.entries(manifest.music||{}))entries.push({kind:'music',id,...entry});
 return entries;
}
function verificationPlan(manifest,previous){
 const previousPaths=manifestPaths(previous),selected=new Map(),add=(entry,reason)=>{const row=selected.get(entry.path)||{...entry,reasons:[]};if(!row.reasons.includes(reason))row.reasons.push(reason);selected.set(entry.path,row);};
 const entries=mediaEntries(manifest);
 for(const id of ['earth','moon'])for(const width of [1024,4096]){const entry=entries.find(row=>row.kind==='texture'&&row.id===id&&row.width===width);if(!entry)throw Error(`Missing baseline media: ${id} ${width}`);add(entry,'baseline');}
 for(const entry of entries)if(!previousPaths.has(entry.path))add(entry,'changed');
 return [...selected.values()].sort((a,b)=>a.path.localeCompare(b.path));
}
function publicHeaders(entry,res){
 if(!res.headers.get('cache-control')?.includes('immutable')||res.headers.get('access-control-allow-origin')!=='*'||res.headers.get('timing-allow-origin')!=='*')throw Error(entry.id+': missing public media cache/CORS contract');
 const status=res.headers.get('x-solar-media-cache');if(!['HIT','MISS'].includes(status))throw Error(entry.id+': media cache status is not observable');return status;
}
async function publishedManifest(request){
 const url='https://solartime.app/src/assets.js?deployment-check='+Date.now(),res=await request(url,{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(20000)});
 if(res.status!==200)throw Error('Published runtime manifest: HTTP '+res.status);return parseRuntimeManifest(await res.text());
}
async function verifyEntry(entry,base,{request,delay}){
 const url=new URL(entry.path,base).href,row={kind:entry.kind,id:entry.id,width:entry.width||null,path:entry.path,bytes:entry.bytes||null,sha256:entry.sha256||null,reasons:entry.reasons,samples:[],cacheHitObserved:false,rangeVerified:false};
 const start=performance.now(),res=await request(url,{signal:AbortSignal.timeout(30000)}),headersAt=performance.now();if(res.status!==200)throw Error(entry.id+': HTTP '+res.status);
 const bytes=Buffer.from(await res.arrayBuffer()),hash=sha256(bytes);
 if(entry.bytes!=null&&bytes.length!==entry.bytes)throw Error(entry.id+': media byte length differs from manifest');
 if(entry.sha256&&hash!==entry.sha256)throw Error(entry.id+': media content differs from manifest');
 if(entry.hashPrefix&&!hash.startsWith(entry.hashPrefix))throw Error(entry.id+': media content differs from its immutable URL');
 const status=publicHeaders(entry,res);row.samples.push({method:'GET',cache:status,firstByteMs:Math.round(headersAt-start),totalMs:Math.round(performance.now()-start)});row.cacheHitObserved=status==='HIT';
 const etag=res.headers.get('etag');
 if(entry.kind==='music'){
  if(!etag)throw Error(entry.id+': music ETag is missing');const rangeStart=performance.now(),range=await request(url,{headers:{range:'bytes=0-1023','if-range':etag},signal:AbortSignal.timeout(20000)}),rangeHeadersAt=performance.now();
  const expectedLength=Math.min(1024,bytes.length),expectedRange=`bytes 0-${expectedLength-1}/${bytes.length}`;
  if(range.status!==206||range.headers.get('content-range')!==expectedRange||range.headers.get('etag')!==etag)throw Error(entry.id+': music byte range metadata is invalid');
  const part=Buffer.from(await range.arrayBuffer());
  if(part.length!==expectedLength||!part.equals(bytes.subarray(0,expectedLength)))throw Error(entry.id+': music byte range content is invalid');
  const rangeStatus=publicHeaders(entry,range);row.samples.push({method:'RANGE',cache:rangeStatus,firstByteMs:Math.round(rangeHeadersAt-rangeStart),totalMs:Math.round(performance.now()-rangeStart)});row.cacheHitObserved||=rangeStatus==='HIT';row.rangeVerified=true;
 }
 for(let i=0;!row.cacheHitObserved&&i<3;i++){await delay(250);const headStart=performance.now(),head=await request(url,{method:'HEAD',signal:AbortSignal.timeout(20000)}),headHeadersAt=performance.now();if(head.status!==200)throw Error(entry.id+': HEAD HTTP '+head.status);const headStatus=publicHeaders(entry,head);row.samples.push({method:'HEAD',cache:headStatus,firstByteMs:Math.round(headHeadersAt-headStart),totalMs:Math.round(performance.now()-headStart)});row.cacheHitObserved=headStatus==='HIT';}
 if(!row.cacheHitObserved)throw Error(entry.id+': no media cache HIT observed in bounded requests');return row;
}
async function verifyTextures(root=path.resolve(__dirname,'..'),{request=fetch,delay=ms=>new Promise(resolve=>setTimeout(resolve,ms)),previous=null}={}){
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8')),deployment=JSON.parse(fs.readFileSync(path.join(root,'assets/deployment.json'),'utf8'));
 const base=new URL(deployment.cdnBase);if(base.protocol!=='https:'||base.hostname!=='solar-time.keg0320.workers.dev'||base.pathname!=='/media/')throw Error('Unreviewed media delivery origin.');
 previous=previous||await publishedManifest(request);const plan=verificationPlan(manifest,previous),report={at:new Date().toISOString(),base:base.href,assetRevision:manifest.revision,previousAssetRevision:previous.revision||null,requestsArePublicReadOnly:true,baselineFiles:plan.filter(row=>row.reasons.includes('baseline')).length,changedFiles:plan.filter(row=>row.reasons.includes('changed')).length,files:[]};
 for(const entry of plan)report.files.push(await verifyEntry(entry,base,{request,delay}));
 // Probe unchanged music too, without downloading every full track again.
 // A regional MISS is diagnostic, not proof of a global cache outage.
 const music=Object.entries(manifest.music||{}).map(([id,entry])=>({id,...entry}));
 const largest=music.reduce((a,b)=>!a||b.bytes>a.bytes?b:a,null);
 report.musicOperations=[];
 for(const entry of [...new Map([largest,music.at(-1)].filter(Boolean).map(entry=>[entry.path,entry])).values()])report.musicOperations.push(await verifyMusicOperations(entry,base,{request,delay}));
 const file=path.join(root,'.cloudflare/media-delivery.json');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');return report;
}
async function verifyMusicOperations(entry,base,{request,delay}){
 const url=new URL(entry.path,base).href,samples=[],observed=[];
 const read=async(method,headers={})=>{
  const start=performance.now(),res=await request(url,{method,headers,signal:AbortSignal.timeout(20000)}),status=publicHeaders(entry,res);
  const bytes=Buffer.from(await res.arrayBuffer());
  samples.push({method,status:res.status,cache:status,colo:res.headers.get('cf-ray')?.split('-').at(-1)||null,bytes:bytes.length,totalMs:Math.round(performance.now()-start)});
  return {res,bytes};
 };
 const {res:head,bytes:headBytes}=await read('HEAD'),etag=head.headers.get('etag'),length=Number(head.headers.get('content-length'));
 if(head.status!==200||headBytes.length||!etag||length!==entry.bytes)throw Error(entry.id+': operational HEAD mismatch');
 const conditional=await read('HEAD',{'if-none-match':etag});
 if(conditional.res.status!==304||conditional.bytes.length)throw Error(entry.id+': operational conditional HEAD mismatch');
 const size=Math.min(1024,length);
 for(let i=0;i<3;i++){
  if(i)await delay(500);
  const part=await read('GET',{range:`bytes=0-${size-1}`,'if-range':etag});
  if(part.res.status!==206||part.res.headers.get('etag')!==etag||part.res.headers.get('content-range')!==`bytes 0-${size-1}/${length}`||part.bytes.length!==size)throw Error(entry.id+': operational Range mismatch');
  if(observed.length&&!part.bytes.equals(observed[0]))throw Error(entry.id+': repeated Range content changed');
  observed.push(part.bytes);
  if(i>0&&samples.at(-1).cache==='HIT')break;
 }
 return {id:entry.id,samples,cacheHitObserved:samples.some(row=>row.cache==='HIT'),limitations:'Bounded edge observations; not an account-wide hit rate or actual completed-transfer billing.'};
}
if(require.main===module)verifyTextures().then(report=>console.log(`Verified ${report.files.length} media files (${report.changedFiles} changed; ${report.baselineFiles} baseline).`)).catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={manifestPaths,mediaEntries,parseRuntimeManifest,publishedManifest,verificationPlan,verifyEntry,verifyMusicOperations,verifyTextures};
