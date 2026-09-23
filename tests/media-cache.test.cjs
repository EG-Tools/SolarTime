'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {Miniflare,convertV4MiniflareOptions}=require('miniflare'); // Workerd runtime supplied by the project's pinned Wrangler install.
test('media uses complete cached objects for ranges, HEAD and ETag without modifying R2',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:fs.readFileSync(path.join(__dirname,'../cloudflare/worker.js'),'utf8'),compatibilityDate:'2026-09-14',r2Buckets:['SOLAR_TIME_MEDIA']}));
 try{
  const bucket=await mf.getR2Bucket('SOLAR_TIME_MEDIA'),caches=await mf.getCaches(),data='0123456789'.repeat(100);
  const url='https://solar.test/media/track.mp3';await bucket.put('track.mp3',data);
  const cold=await mf.dispatchFetch(url,{headers:{Range:'bytes=0-'}});assert.equal(cold.status,206);assert.equal(cold.headers.get('content-range'),'bytes 0-999/1000');assert.equal(await cold.text(),data);
  async function cached(key){for(let i=0;i<100;i++){const found=await caches.default.match(key);if(found)return found;await new Promise(r=>setTimeout(r,10));}assert.fail('full media did not enter cache');}
  let full=await cached(url);assert.equal(full.status,200);assert.equal(full.headers.get('content-length'),'1000');const etag=full.headers.get('etag');await full.text();
  await bucket.delete('track.mp3'); // Only this test's isolated in-memory bucket.
  let response=await mf.dispatchFetch(url,{headers:{Range:'bytes=10-19'}});assert.equal(response.status,206);assert.equal(await response.text(),'0123456789');
  response=await mf.dispatchFetch(url,{headers:{Range:'bytes=-3'}});assert.equal(response.status,206);assert.equal(await response.text(),'789');
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
  assert.equal((await mf.dispatchFetch(url,{method:'POST'})).status,405);
  assert.equal((await mf.dispatchFetch(url,{method:'OPTIONS'})).status,204);
  assert.equal((await mf.dispatchFetch('https://solar.test/media/%E0%A4%A')).status,400);
 }finally{await mf.dispose();}
});
