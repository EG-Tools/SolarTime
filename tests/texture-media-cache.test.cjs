'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),text=fs.readFileSync(path.join(root,'cloudflare/worker.js'),'utf8');
function worker({failCacheRead=false}={}){
 const store=new Map(),wait=[],body='public texture data';let reads=0;
 const cache={match:async req=>{if(failCacheRead)throw Error('cache unavailable');return store.get(req.url)?.clone();},put:async(req,res)=>store.set(req.url,res)};
 const context={URL,Request,Response,Headers,console:{warn(){},info(){},error(){}},caches:{default:cache}};
 vm.createContext(context);vm.runInContext(text.replace('export default {','globalThis.worker = {'),context);
 const env={SOLAR_TIME_MEDIA:{get:async()=>{reads++;return {body,size:body.length,httpEtag:'"content-hash"',writeHttpMetadata:h=>h.set('content-type','image/webp')};}}},ctx={waitUntil:p=>wait.push(p)};
 return {get:url=>context.worker.fetch(new Request(url),env,ctx),wait,reads:()=>reads,body};
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
test('helper API and private runtime records never inherit public media caching',async()=>{
 const f=worker();let r=await f.get('https://solar.test/api/windows-helper/health');assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('x-solar-media-cache'),null);
 r=await f.get('https://solar.test/media/releases/runtime/windows-helper-v2/operation/00000000000000000000000000000000');assert.equal(r.status,404);assert.equal(f.reads(),0);
 r=await f.get('https://solar.test/media/releases/content/ui/test.webp');assert.equal(r.headers.get('x-solar-media-cache'),'BYPASS');assert.doesNotMatch(r.headers.get('cache-control'),/immutable/);
});
test('verified production deployment includes bounded original texture delivery checks',()=>{
 const source=fs.readFileSync(path.join(root,'tools/deployment.cjs'),'utf8');assert.match(source,/tools\/verify-textures\.cjs/);
 const script=fs.readFileSync(path.join(root,'tools/verify-textures.cjs'),'utf8');assert.doesNotMatch(script,/method:\s*['"](?:POST|PUT|DELETE)/);assert.match(script,/sha256/);assert.match(script,/cacheHitObserved/);
});
