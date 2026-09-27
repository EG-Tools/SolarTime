/* Bounded public GET-only texture delivery verification. Never opens the R2
 * bucket or executes native commands; use the existing protected Worker route. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
async function verifyTextures(root=path.resolve(__dirname,'..'),{request=fetch,delay=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
 const deployment=JSON.parse(fs.readFileSync(path.join(root,'assets/deployment.json'),'utf8'));
 const base=new URL(deployment.cdnBase);if(base.protocol!=='https:'||base.hostname!=='solar-time.keg0320.workers.dev'||base.pathname!=='/media/')throw Error('Unreviewed texture delivery origin.');
 const report={at:new Date().toISOString(),base:base.href,assetRevision:manifest.revision,requestsArePublicGetOnly:true,files:[]};
 for(const id of ['earth','moon'])for(const width of [1024,4096]){
  const tier=manifest.materials[id].tiers.find(t=>t.width===width);if(!tier)throw Error('Missing texture tier.');
  const url=new URL(tier.path,base).href,row={id,width,bytes:tier.bytes,sha256:tier.sha256,samples:[],cacheHitObserved:false};
  report.files.push(row);
  for(let i=0;i<4;i++){
   const start=performance.now(),res=await request(url,{signal:AbortSignal.timeout(20000)}),headersAt=performance.now();
   if(res.status!==200)throw Error(id+': HTTP '+res.status);
   const bytes=Buffer.from(await res.arrayBuffer()),hash=crypto.createHash('sha256').update(bytes).digest('hex');
   if(bytes.length!==tier.bytes||hash!==tier.sha256)throw Error(id+': texture content differs from original manifest');
   if(!res.headers.get('cache-control')?.includes('immutable')||res.headers.get('access-control-allow-origin')!=='*'||res.headers.get('timing-allow-origin')!=='*')throw Error(id+': missing public texture cache/CORS contract');
   const status=res.headers.get('x-solar-media-cache');if(!['HIT','MISS'].includes(status))throw Error(id+': texture cache status is not observable');
   row.samples.push({cache:status,firstByteMs:Math.round(headersAt-start),totalMs:Math.round(performance.now()-start)});
   row.cacheHitObserved ||= status==='HIT';
   if(row.cacheHitObserved)break;await delay(250);
  }
  if(!row.cacheHitObserved)throw Error(id+': no texture cache HIT observed in four bounded requests');
 }
 const file=path.join(root,'.cloudflare/texture-delivery.json');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');return report;
}
if(require.main===module)verifyTextures().then(r=>console.log('Verified original texture hashes and observed cache HITs for '+r.files.length+' files.')).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={verifyTextures};
