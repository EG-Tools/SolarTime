'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {Miniflare,convertV4MiniflareOptions}=require('miniflare'); // Workerd runtime supplied by the project's pinned Wrangler install.
test('media uses complete cached objects for ranges, HEAD and ETag without modifying R2',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:fs.readFileSync(path.join(__dirname,'../cloudflare/worker.js'),'utf8'),compatibilityDate:'2026-09-14',r2Buckets:['SOLAR_TIME_MEDIA']}));
 try{
  const bucket=await mf.getR2Bucket('SOLAR_TIME_MEDIA'),caches=await mf.getCaches(),data='0123456789'.repeat(100);
  const url='https://solar.test/media/track.mp3';await bucket.put('track.mp3',data);
  const conditionalUrl='https://solar.test/media/conditional.mp3';await bucket.put('conditional.mp3',data);
  let response=await mf.dispatchFetch(conditionalUrl,{method:'HEAD'}),conditionalEtag=response.headers.get('etag'),conditionalDate=response.headers.get('last-modified');
  assert.ok(conditionalEtag);assert.ok(conditionalDate);
  response=await mf.dispatchFetch(conditionalUrl,{headers:{Range:'bytes=10-19','If-Range':conditionalEtag}});assert.equal(response.status,206);assert.equal(await response.text(),'0123456789');
  response=await mf.dispatchFetch(conditionalUrl+'?mismatch=1',{headers:{Range:'bytes=10-19','If-Range':'"outdated"'}});assert.equal(response.status,200);assert.equal(await response.text(),data);
  response=await mf.dispatchFetch(conditionalUrl+'?date=1',{headers:{Range:'bytes=-3','If-Range':conditionalDate}});assert.equal(response.status,206);assert.equal(await response.text(),'789');
  await bucket.put('invalid.mp3',data);response=await mf.dispatchFetch('https://solar.test/media/invalid.mp3',{headers:{Range:'bytes=2000-3000'}});assert.equal(response.status,416);assert.equal(response.headers.get('content-range'),'bytes */1000');assert.equal(response.headers.get('x-solar-media-error'),'range-not-satisfiable');
  const cold=await mf.dispatchFetch(url,{headers:{Range:'bytes=0-'}});assert.equal(cold.status,206);assert.equal(cold.headers.get('content-range'),'bytes 0-999/1000');assert.equal(await cold.text(),data);
  async function cached(key){for(let i=0;i<100;i++){const found=await caches.default.match(key);if(found)return found;await new Promise(r=>setTimeout(r,10));}assert.fail('full media did not enter cache');}
  let full=await cached(url);assert.equal(full.status,200);assert.equal(full.headers.get('content-length'),'1000');const etag=full.headers.get('etag'),lastModified=full.headers.get('last-modified');assert.ok(lastModified);await full.text();
  await bucket.delete('track.mp3'); // Only this test's isolated in-memory bucket.
  response=await mf.dispatchFetch(url,{headers:{Range:'bytes=10-19'}});assert.equal(response.status,206);assert.equal(await response.text(),'0123456789');
  response=await mf.dispatchFetch(url,{headers:{Range:'bytes=-3'}});assert.equal(response.status,206);assert.equal(await response.text(),'789');
  response=await mf.dispatchFetch(url,{headers:{Range:'bytes=2000-3000'}});assert.equal(response.status,416);assert.equal(response.headers.get('x-solar-media-error'),'range-not-satisfiable');assert.equal(response.headers.get('x-solar-media-cache'),'HIT');
  response=await mf.dispatchFetch(url,{headers:{Range:'bytes=20-29','If-Range':etag}});assert.equal(response.status,206);assert.equal(await response.text(),'0123456789');assert.equal(response.headers.get('x-solar-media-cache'),'HIT');
  response=await mf.dispatchFetch(url,{headers:{Range:'bytes=20-29','If-Range':'W/'+etag}});assert.equal(response.status,200);assert.equal(await response.text(),data);
  response=await mf.dispatchFetch(url,{headers:{Range:'bytes=20-29','If-Range':'"outdated"'}});assert.equal(response.status,200);assert.equal(await response.text(),data);
  response=await mf.dispatchFetch(url,{headers:{Range:'bytes=-3','If-Range':lastModified}});assert.equal(response.status,206);assert.equal(await response.text(),'789');
  response=await mf.dispatchFetch(url,{headers:{Range:'bytes=-3','If-Range':'Sun, 06 Nov 1994 08:49:37 GMT'}});assert.equal(response.status,200);assert.equal(await response.text(),data);
  response=await mf.dispatchFetch(url,{method:'HEAD'});assert.equal(response.status,200);assert.equal(response.headers.get('content-length'),'1000');assert.equal(await response.text(),'');
  response=await mf.dispatchFetch(url,{headers:{'If-None-Match':etag}});assert.equal(response.status,304);
  response=await mf.dispatchFetch(url,{headers:{'If-None-Match':'"other", W/'+etag}});assert.equal(response.status,304);
  response=await mf.dispatchFetch(url+'?revision=another');assert.equal(response.status,200);assert.equal(await response.text(),data);
  await bucket.put('partial.mp3',data);const partialUrl='https://solar.test/media/partial.mp3';
  response=await mf.dispatchFetch(partialUrl,{headers:{Range:'bytes=-4'}});assert.equal(response.status,206);assert.equal(response.headers.get('content-range'),'bytes 996-999/1000');assert.equal(await response.text(),'6789');
  full=await cached(partialUrl);assert.equal(await full.text(),data);
  const ui='releases/content/ui/icon.webp';await bucket.put(ui,'old');response=await mf.dispatchFetch('https://solar.test/media/'+ui);assert.equal(await response.text(),'old');
  await bucket.put(ui,'new');response=await mf.dispatchFetch('https://solar.test/media/'+ui);assert.equal(await response.text(),'new');
  assert.equal(await caches.default.match('https://solar.test/media/'+ui),undefined);
  response=await mf.dispatchFetch(url,{method:'POST'});assert.equal(response.status,405);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('access-control-allow-origin'),'*');assert.equal(response.headers.get('x-solar-media-error'),'method-not-allowed');assert.equal(response.headers.get('x-solar-media-cache'),'BYPASS');
  assert.equal((await mf.dispatchFetch(url,{method:'OPTIONS'})).status,204);
  response=await mf.dispatchFetch('https://solar.test/media/missing.webp');assert.equal(response.status,404);assert.equal(response.headers.get('x-solar-media-error'),'not-found');assert.equal(response.headers.get('x-solar-media-cache'),'MISS');assert.match(response.headers.get('server-timing'),/MISS/);
  response=await mf.dispatchFetch('https://solar.test/media/%E0%A4%A');assert.equal(response.status,400);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('access-control-allow-origin'),'*');assert.equal(response.headers.get('x-solar-media-error'),'bad-path');assert.match(response.headers.get('access-control-expose-headers'),/X-Solar-Media-Error/);
 }finally{await mf.dispose();}
});

test('helper installation completion is an anonymous one-time R2 signal',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:fs.readFileSync(path.join(__dirname,'../cloudflare/worker.js'),'utf8'),compatibilityDate:'2026-09-14',r2Buckets:['SOLAR_TIME_MEDIA']}));
 try{
  const token='0123456789abcdef0123456789abcdef',status='https://solar.test/api/windows-helper/install-status?token='+token,complete='https://solar.test/api/windows-helper/install-complete?token='+token;
  let response=await mf.dispatchFetch(status);assert.equal(response.status,200);assert.deepEqual(await response.json(),{installed:false});assert.equal(response.headers.get('access-control-allow-origin'),'*');
  assert.equal((await mf.dispatchFetch(complete,{method:'OPTIONS'})).status,204);
  assert.equal((await mf.dispatchFetch(complete,{method:'POST'})).status,204);
  response=await mf.dispatchFetch(status);assert.deepEqual(await response.json(),{installed:true});
  await new Promise(resolve=>setTimeout(resolve,20));response=await mf.dispatchFetch(status);assert.deepEqual(await response.json(),{installed:false});
  assert.equal((await mf.dispatchFetch('https://solar.test/api/windows-helper/install-status?token=bad')).status,400);
 }finally{await mf.dispose();}
});
