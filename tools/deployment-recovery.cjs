/* Capture the last known Worker + Pages pair before publication. This tool is
 * intentionally read-only: a failed deployment records an exact recovery
 * target and command but never changes production automatically. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const ACCOUNT='4640527a19614f7b65a034f422704b64',WORKER='solar-time',ORIGIN='https://solartime.app/';
const validVersion=value=>typeof value==='string'&&/^[a-f0-9-]{32,64}$/i.test(value);
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
function currentVersion(status){
 for(const value of [status?.latest_version,status?.latestVersion,status?.deployment?.latest_version])if(validVersion(value))return value;
 const lists=[status?.versions,status?.deployment?.versions,status?.latest_deployment?.versions].filter(Array.isArray);
 const rows=lists.flat().map(row=>({id:row?.version_id||row?.versionId,percentage:Number(row?.percentage??row?.traffic_percentage??row?.trafficPercentage??0)})).filter(row=>validVersion(row.id)).sort((a,b)=>b.percentage-a.percentage);
 if(!rows.length)throw Error('Current Worker version was not present in Wrangler status.');return rows[0].id;
}
function wranglerStatus(root){
 const result=spawnSync(process.execPath,[path.join(root,'node_modules/wrangler/bin/wrangler.js'),'deployments','status','--json'],{cwd:root,encoding:'utf8',env:{...process.env,CLOUDFLARE_ACCOUNT_ID:ACCOUNT}});
 if(result.error)throw result.error;if(result.status!==0)throw Error((result.stderr||result.stdout||'Wrangler status failed.').trim());return JSON.parse(result.stdout);
}
async function pageSnapshot(request,url,{retainBytes=false}={}){
 const response=await request(url+(url.includes('?')?'&':'?')+'recovery-check='+Date.now(),{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(20000)});if(response.status!==200)throw Error(url+': HTTP '+response.status);
 const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>5_000_000)throw Error(url+': recovery snapshot is unexpectedly large.');return {url,bytes:bytes.length,sha256:digest(bytes),...(retainBytes?{bodyBase64:bytes.toString('base64')}:{} )};
}
function recordFile(root){return path.join(root,'.cloudflare/deployment-recovery.json');}
function writeRecord(root,record){const file=recordFile(root),temporary=file+'.tmp';fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(temporary,JSON.stringify(record,null,2)+'\n');fs.renameSync(temporary,file);return record;}
async function capture(root=path.resolve(__dirname,'..'),{request=fetch,status=null,now=()=>new Date().toISOString()}={}){
 const workerStatus=status||wranglerStatus(root),files=[];for(const name of ['version.json','index.html','src/assets.js'])files.push(await pageSnapshot(request,new URL(name,ORIGIN).href,{retainBytes:true}));
 const versionId=currentVersion(workerStatus);return writeRecord(root,{schema:1,capturedAt:now(),targetSha:process.env.TARGET_SHA||null,previousPair:{worker:{name:WORKER,versionId},pages:{origin:ORIGIN,files}},failure:null,manualRecovery:{workerCommand:`npx wrangler rollback ${versionId} --message "Restore the Worker paired with the previous Pages release"`,note:'Run only after checking whether Pages published; recover both origins from one commit if it did.'}});
}
function validateSnapshots(record){
 for(const file of record.previousPair?.pages?.files||[]){
  if(file.bodyBase64===undefined)continue; // Older hash-only evidence remains readable.
  if(typeof file.bodyBase64!=='string')throw Error('Invalid recovery snapshot encoding.');
  const body=Buffer.from(file.bodyBase64,'base64');
  if(body.toString('base64')!==file.bodyBase64||body.length!==file.bytes||digest(body)!==file.sha256)throw Error('Recovery snapshot integrity check failed: '+file.url);
 }
 return record;
}
function readRecord(root){const file=recordFile(root);if(!fs.existsSync(file))throw Error('Deployment recovery record is missing.');const record=JSON.parse(fs.readFileSync(file,'utf8'));if(record.schema!==1||record.previousPair?.worker?.name!==WORKER||!validVersion(record.previousPair?.worker?.versionId))throw Error('Deployment recovery record is invalid.');return validateSnapshots(record);}
async function reportFailure(root=path.resolve(__dirname,'..'),{env=process.env,request=fetch,now=()=>new Date().toISOString()}={}){
 let record;try{record=readRecord(root);}catch(_){record={schema:1,capturedAt:null,targetSha:env.TARGET_SHA||null,previousPair:null,manualRecovery:null};}
 const workerPublished=fs.existsSync(path.join(root,'.cloudflare/worker-publication.json'));
 let pagesState=env.PAGES_OUTCOME==='success'?'published':'unknown',observation=null;
 try{
  const observed=await pageSnapshot(request,new URL('version.json',ORIGIN).href);
  const target=fs.readFileSync(path.join(root,'version.json'));
  const previous=record.previousPair?.pages?.files.find(file=>file.url===observed.url);
  observation={...observed,matchesTarget:observed.sha256===digest(target),matchesPrevious:observed.sha256===previous?.sha256};
  if(observation.matchesTarget)pagesState='published';
  // A timed-out publication can still complete after this observation. Only a
  // skipped publication and an unchanged public fingerprint prove no update.
  else if(env.PAGES_OUTCOME==='skipped'&&observation.matchesPrevious)pagesState='not-published';
 }catch(error){observation={error:error.message};}
 const pagesPublished=pagesState==='published'?true:pagesState==='not-published'?false:null;
 record.failure={recordedAt:now(),workerOutcome:env.WORKER_OUTCOME||null,pagesOutcome:env.PAGES_OUTCOME||null,pagesVerificationOutcome:env.PAGES_VERIFY_OUTCOME||null,workerPublished,pagesPublished,pagesState,observation,recovery:pagesPublished===true?'Pages published; recover Worker and Pages together from one known commit.':pagesPublished===false?'Pages publication was skipped and the previous fingerprint remains; inspect the recorded Worker rollback target.':'Pages publication state is unknown; check the deployment and both public origins again before rollback or retry.'};return writeRecord(root,record);
}
async function main(args=process.argv.slice(2)){const root=path.resolve(__dirname,'..'),action=args[0];if(action==='capture'){await capture(root);console.log('Captured the active Worker and Pages recovery fingerprint.');}else if(action==='report'){await reportFailure(root);console.log('Recorded read-only deployment recovery evidence.');}else throw Error('Use capture or report.');}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={capture,currentVersion,pageSnapshot,readRecord,reportFailure,validateSnapshots,validVersion,writeRecord,wranglerStatus};
