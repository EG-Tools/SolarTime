'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),text=fs.readFileSync(path.join(root,'cloudflare/worker.js'),'utf8');
function worker({failCacheRead=false,failR2Read=false}={}){
 const store=new Map(),wait=[],logs=[],body='public texture data';let reads=0;
 const cache={match:async req=>{if(failCacheRead)throw Error('cache unavailable');return store.get(req.url)?.clone();},put:async(req,res)=>store.set(req.url,res)};
 const context={URL,Request,Response,Headers,console:{warn(){},info(value){logs.push(JSON.parse(value));},error(){}},caches:{default:cache}};
 vm.createContext(context);vm.runInContext(text.replace('export default {','globalThis.worker = {'),context);
 const env={SOLAR_TIME_MEDIA:{get:async()=>{reads++;if(failR2Read)throw Error('R2 unavailable');return {body,size:body.length,httpEtag:'"content-hash"',writeHttpMetadata:h=>h.set('content-type','image/webp')};}}},ctx={waitUntil:p=>wait.push(p)};
 return {get:(url,options)=>context.worker.fetch(new Request(url,options),env,ctx),wait,logs,reads:()=>reads,body};
}
test('media HIT/MISS is explicit and browser timing is exposed on cold and previously cached objects',async()=>{
 const f=worker(),url='https://solar.test/media/releases/content/textures/test.webp';
 let r=await f.get(url);assert.equal(r.headers.get('x-solar-media-cache'),'MISS');assert.equal(await r.text(),f.body);await Promise.all(f.wait);
 r=await f.get(url);assert.equal(r.headers.get('x-solar-media-cache'),'HIT');assert.equal(await r.text(),f.body);assert.equal(f.reads(),1);
 assert.equal(r.headers.get('timing-allow-origin'),'*');assert.match(r.headers.get('access-control-expose-headers'),/X-Solar-Media-Cache/);assert.match(r.headers.get('server-timing'),/HIT/);
});
test('cache read errors fall through to R2 without removing the preview-capable media response',async()=>{
 const f=worker({failCacheRead:true}),r=await f.get('https://solar.test/media/releases/content/textures/test.webp');assert.equal(r.status,200);assert.equal(await r.text(),f.body);assert.equal(r.headers.get('x-solar-media-cache'),'MISS');await Promise.all(f.wait);
});

test('HEAD logging records zero body bytes without losing object length',async()=>{
 const f=worker(),url='https://solar.test/media/releases/content/textures/test.webp';
 await(await f.get(url)).text();await Promise.all(f.wait);
 const res=await f.get(url,{method:'HEAD'});assert.equal(await res.text(),'');
 const log=f.logs.at(-1);assert.equal(log.method,'HEAD');assert.equal(log.bytes,0);assert.equal(log.contentLength,f.body.length);assert.equal(log.cache,'HIT');
 assert.equal(f.reads(),1);
});

test('operational music checks use bounded ranges and conditional HEAD without full downloads',async()=>{
 const {verifyMusicOperations}=require('../tools/verify-textures.cjs'),calls=[];
 const entry={id:'track',path:'track.mp3',bytes:4096};let ranges=0;
 const request=async(_url,options)=>{
  calls.push(options);const conditional=options.headers['if-none-match'],range=options.headers.range;
  const status=conditional?304:range?206:200;
  const headers={'cache-control':'public, max-age=31536000, immutable','access-control-allow-origin':'*','timing-allow-origin':'*','x-solar-media-cache':ranges>0?'HIT':'MISS',etag:'"track"','cf-ray':'sample-PDX'};
  if(status!==304)headers['content-length']=range?'1024':'4096';
  if(range){ranges++;headers['content-range']='bytes 0-1023/4096';}
  return new Response(range?Buffer.alloc(1024,3):null,{status,headers});
 };
 const report=await verifyMusicOperations(entry,'https://solar.test/',{request,delay:async()=>{}});
 assert.equal(report.cacheHitObserved,true);assert.equal(calls.length,4);
 assert.equal(report.samples.reduce((n,row)=>n+row.bytes,0),2048);
 assert.ok(calls.filter(c=>c.method==='GET').every(c=>c.headers.range==='bytes=0-1023'));
 await assert.rejects(verifyMusicOperations(entry,'https://solar.test/',{request:async(u,o)=>{
  const res=await request(u,o);if(o.headers.range)res.headers.set('content-range','bytes 1-1024/4096');return res;
 },delay:async()=>{}}),/Range mismatch/);
});
test('public media failures retain observable no-store CORS headers',async()=>{
 const r=await worker({failR2Read:true}).get('https://solar.test/media/releases/content/textures/test.webp');assert.equal(r.status,500);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('access-control-allow-origin'),'*');assert.equal(r.headers.get('x-solar-media-error'),'internal');assert.equal(r.headers.get('x-solar-media-cache'),'BYPASS');assert.match(r.headers.get('server-timing'),/BYPASS/);
});
test('helper API and private runtime records never inherit public media caching',async()=>{
 const f=worker();let r=await f.get('https://solar.test/api/windows-helper/health');assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('x-solar-media-cache'),null);
 r=await f.get('https://solar.test/media/releases/runtime/windows-helper-v2/operation/00000000000000000000000000000000');assert.equal(r.status,404);assert.equal(f.reads(),0);
 r=await f.get('https://solar.test/media/releases/content/ui/test.webp');assert.equal(r.headers.get('x-solar-media-cache'),'BYPASS');assert.doesNotMatch(r.headers.get('cache-control'),/immutable/);
});
test('verified production deployment includes bounded original texture delivery checks',()=>{
 const source=fs.readFileSync(path.join(root,'tools/deployment.cjs'),'utf8');assert.match(source,/tools\/verify-textures\.cjs/);
 const script=fs.readFileSync(path.join(root,'tools/verify-textures.cjs'),'utf8');assert.doesNotMatch(script,/method:\s*['"](?:POST|PUT|DELETE)/);assert.match(script,/sha256/);assert.match(script,/cacheHitObserved/);
});
test('deployment verifies the visual baseline and every changed texture, sky and music URL',()=>{
 const {parseRuntimeManifest,verificationPlan}=require('../tools/verify-textures.cjs'),manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
 const previous=parseRuntimeManifest(fs.readFileSync(path.join(root,'src/assets.js'),'utf8'));
 previous.materials.venus.tiers=previous.materials.venus.tiers.filter(tier=>tier.width!==512);
 previous.sky.tiers=previous.sky.tiers.filter(tier=>tier.width!==2048);previous.sky.galaxyAtlas.path='releases/content/backgrounds/galaxy-atlas.old.webp';
 delete previous.music['08 - Deep Space Journey.mp3'];
 const plan=verificationPlan(manifest,previous),changed=plan.filter(row=>row.reasons.includes('changed'));
 assert.ok(changed.some(row=>row.kind==='texture'&&row.id==='venus'&&row.width===512));assert.ok(changed.some(row=>row.kind==='background'&&row.id==='sky'&&row.width===2048));
 assert.ok(changed.some(row=>row.id==='galaxy-atlas'));assert.ok(changed.some(row=>row.kind==='music'&&row.id==='08 - Deep Space Journey.mp3'));
 assert.equal(plan.filter(row=>row.reasons.includes('baseline')).length,4);assert.equal(new Set(plan.map(row=>row.path)).size,plan.length);
});

test('Saturn debris shares the manifest and incremental verification path',()=>{
 const {parseRuntimeManifest,verificationPlan}=require('../tools/verify-textures.cjs');
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
 const previous=parseRuntimeManifest(fs.readFileSync(path.join(root,'src/assets.js'),'utf8'));
 const effect=manifest.effects.saturnDebris;
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'assets',effect.source))).digest('hex'),effect.sha256);
 delete previous.effects;
 const plan=verificationPlan(manifest,previous),entry=plan.find(row=>row.id==='saturnDebris');
 assert.equal(entry.kind,'effect');assert.deepEqual(entry.reasons,['changed']);
 assert.equal(entry.path,effect.path);
 const runtime=fs.readFileSync(path.join(root,'src/ring-tour.js'),'utf8');
 assert.match(runtime,/SolarAssets\?\.effects\?\.saturnDebris/);
 assert.doesNotMatch(runtime,/workers\.dev\/media/);
});
test('media verification downloads full bytes once, then uses HEAD and validates music ranges',async()=>{
 const {verifyEntry}=require('../tools/verify-textures.cjs'),bytes=Buffer.from('verified media bytes'),hash=crypto.createHash('sha256').update(bytes).digest('hex'),common={'cache-control':'public, max-age=31536000, immutable','access-control-allow-origin':'*','timing-allow-origin':'*',etag:'"media"'};
 const methods=[],textureRequest=async(_url,options={})=>{const method=options.method||'GET';methods.push(method);return method==='GET'?new Response(bytes,{status:200,headers:{...common,'x-solar-media-cache':'MISS'}}):new Response(null,{status:200,headers:{...common,'x-solar-media-cache':'HIT'}});};
 const texture=await verifyEntry({kind:'texture',id:'earth',width:1024,path:'release.webp',bytes:bytes.length,sha256:hash,reasons:['baseline']},new URL('https://example.test/media/'),{request:textureRequest,delay:async()=>{}});assert.deepEqual(methods,['GET','HEAD']);assert.equal(texture.cacheHitObserved,true);
 const musicMethods=[],musicRequest=async(_url,options={})=>{const range=options.headers?.range;musicMethods.push(range?'RANGE':options.method||'GET');return range?new Response(bytes.subarray(0,Math.min(1024,bytes.length)),{status:206,headers:{...common,'content-range':`bytes 0-${bytes.length-1}/${bytes.length}`,'x-solar-media-cache':'HIT'}}):new Response(bytes,{status:200,headers:{...common,'x-solar-media-cache':'MISS'}});};
 const music=await verifyEntry({kind:'music',id:'track.mp3',path:'track.mp3',bytes:bytes.length,sha256:hash,reasons:['changed']},new URL('https://example.test/media/'),{request:musicRequest,delay:async()=>{}});assert.deepEqual(musicMethods,['GET','RANGE']);assert.equal(music.rangeVerified,true);
});

test('music verification rejects same-length corrupt ranges and false range metadata',async()=>{
 const {verifyEntry}=require('../tools/verify-textures.cjs'),bytes=Buffer.alloc(2048,7);
 for(const fault of ['body','end','total','etag']){
  const request=async(_url,opt={})=>{
   const range=!!opt.headers?.range,headers={'cache-control':'public, immutable','access-control-allow-origin':'*','timing-allow-origin':'*','x-solar-media-cache':'HIT',etag:range&&fault==='etag'?'"wrong"':'"correct"'};
   if(range)headers['content-range']=fault==='end'?'bytes 0-1000/2048':fault==='total'?'bytes 0-1023/3000':'bytes 0-1023/2048';
   return new Response(range?(fault==='body'?Buffer.alloc(1024,8):bytes.subarray(0,1024)):bytes,{status:range?206:200,headers});
  };
  await assert.rejects(verifyEntry({kind:'music',id:'song',path:'song.mp3'},'https://example.test/',{request,delay:async()=>{}}),/music byte range/);
 }
});

test('R2 checks conditions before ranges and only maps explicit range errors to 416',async()=>{
 for(const scenario of ['invalid','conditional','suffix','mismatch','rangeError','storageError','ordinary']){
  const context={URL,Request,Response,Headers,console:{warn(){},info(){},error(){}},caches:{default:null}};
  vm.createContext(context);vm.runInContext(text.replace('export default {','globalThis.worker = {'),context);
  let heads=0,gets=0;const metadata={size:10,httpEtag:'"test"',writeHttpMetadata(){}};
  const env={SOLAR_TIME_MEDIA:{head:async()=>{heads++;return metadata;},get:async(_key,opt)=>{
   gets++;if(scenario==='rangeError')throw Object.assign(Error('InvalidRange'),{code:10039});
   if(scenario==='storageError')throw Error('storage unavailable');
   return {...metadata,body:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(opt?.range?'89':'0123456789'));c.close();}}),...(opt?.range?{range:{suffix:2}}:{})};
  }}};
  const headers=scenario==='ordinary'?{}:{range:scenario==='invalid'||scenario==='conditional'?'bytes=99-100':'bytes=-2'};
  if(scenario==='conditional')headers['if-none-match']='"test"';if(scenario==='mismatch')headers['if-range']='"old"';
  const response=await context.worker.fetch(new Request('https://solar.test/media/releases/content/ui/test.webp',{headers}),env,{waitUntil(){}});
  assert.equal(response.status,{invalid:416,conditional:304,suffix:206,mismatch:200,rangeError:416,storageError:500,ordinary:200}[scenario],scenario);
  if(response.status===416)assert.equal(response.headers.get('content-range'),'bytes */10');
  if(scenario==='invalid'||scenario==='conditional')assert.equal(gets,0);
  if(scenario==='ordinary')assert.equal(heads,0,'ordinary GET stays one read');
 }
});
