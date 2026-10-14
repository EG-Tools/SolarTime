'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function fixture(uploadMs=0){
 const frames=new Map(),calls=[],closed=[],window={SolarSurfaceStyle:require('../src/surface-style.js')};let serial=0;
 let elapsed=0;
 const context={window,performance:{now:()=>elapsed},requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial;},cancelAnimationFrame:id=>frames.delete(id),createImageBitmap:async(_source,x,y,width,height)=>({x,y,width,height,close(){closed.push(y);}})};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/surface.js'),'utf8'),context);
 const r=Object.create(window.SolarSurface.DirectRenderer.prototype),gl={activeTexture(){},bindTexture(_target,texture){this.bound=texture;},pixelStorei(){},texImage2D(...args){calls.push({texture:this.bound,allocate:args.length===9});},texSubImage2D(...args){elapsed+=uploadMs;const strip=args.at(-1);calls.push({texture:this.bound,y:args[3],pixels:strip.width*strip.height});}};
 Object.assign(r,{gl,resetTextureBindings(){}});
 const tick=async()=>{const ready=[...frames.values()];frames.clear();ready.forEach(fn=>fn());await new Promise(resolve=>setImmediate(resolve));};
 return {r,frames,calls,closed,tick};
}
test('concurrent large textures share one bounded upload per frame',async()=>{
 const f=fixture(),pending=[1,2].map(id=>f.r.uploadTexturePixels(id,{},4096,2048,null,()=>true));
 await new Promise(resolve=>setImmediate(resolve));let turns=0;
 while(f.frames.size){const before=f.calls.length;await f.tick();assert.equal(f.calls.length-before,1);assert.ok(++turns<40);}
 assert.deepEqual(await Promise.all(pending),[true,true]);
 assert.equal(f.calls.filter(c=>c.allocate).length,2);assert.equal(f.closed.length,32);
 for(const id of [1,2])assert.deepEqual(f.calls.filter(c=>c.texture===id&&!c.allocate).map(c=>c.y),Array.from({length:16},(_,i)=>i*128));
 assert.ok(f.calls.filter(c=>!c.allocate).every(c=>c.pixels<=512*1024));
});

test('cached small maps cannot upload together in the opening frame',async()=>{
 const f=fixture(),pending=[1,2,3,4].map(id=>f.r.uploadTexturePixels(id,{},256,128,null,()=>true));
 assert.equal(f.calls.length,0);
 for(let i=0;i<4;i++){await f.tick();assert.equal(f.calls.length,i+1);}
 assert.deepEqual(await Promise.all(pending),[true,true,true,true]);
});
test('cancelling a staged upload releases its bitmap and scheduled frame without publishing pixels',async()=>{
 const f=fixture(),controller=new AbortController(),pending=f.r.uploadTexturePixels(1,{},4096,2048,controller.signal,()=>!controller.signal.aborted);
 await f.tick();const rejected=assert.rejects(pending);controller.abort();await rejected;
 assert.equal(f.calls.length,1);assert.equal(f.closed.length,1);assert.equal(f.frames.size,0);
});
test('an obsolete texture stops between strips and keeps all decoded strips closed',async()=>{
 const f=fixture();let valid=true;const pending=f.r.uploadTexturePixels(1,{},4096,2048,null,()=>valid);
 await f.tick();await f.tick();valid=false;await f.tick();assert.equal(await pending,false);
 assert.equal(f.calls.filter(c=>!c.allocate).length,1);assert.equal(f.closed.length,2);
});

 test('slow uploads shrink subsequent strips without skipping rows',async()=>{
 const f=fixture(6),pending=f.r.uploadTexturePixels(1,{},4096,2048,null,()=>true);
 let turns=0;while(f.frames.size){await f.tick();assert.ok(++turns<140);}
 assert.equal(await pending,true);const strips=f.calls.filter(c=>!c.allocate);
 assert.equal(strips[0].pixels,512*1024);assert.equal(strips[1].pixels,256*1024);
 assert.equal(strips[2].pixels,128*1024);assert.equal(strips[3].pixels,64*1024);
 let rows=0;for(const strip of strips){assert.equal(strip.y,rows);rows+=strip.pixels/4096;}
 assert.equal(rows,2048);assert.equal(f.closed.length,strips.length);
 });
 test('medium textures also share the upload queue',async()=>{
 const f=fixture(),pending=[1,2].map(id=>f.r.uploadTexturePixels(id,{},1024,1024,null,()=>true));
 let turns=0;while(f.frames.size){const before=f.calls.length;await f.tick();assert.equal(f.calls.length-before,1);assert.ok(++turns<12);}
 assert.deepEqual(await Promise.all(pending),[true,true]);assert.equal(f.closed.length,4);
 });
