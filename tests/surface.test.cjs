'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync(require.resolve('../src/surface.js'),'utf8');
function owner(){
 class Worker {constructor(){this.sent=[];}postMessage(v){this.sent.push(v);}terminate(){this.stopped=true;}}
 const sandbox={Worker,OffscreenCanvas:class{},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},Blob:class{},setTimeout,clearTimeout};
 vm.runInNewContext(code,sandbox);return new sandbox.SolarSurface.Service();
}
const job=(phase=0,geometry='g')=>({id:'moon',diam:64,textureWidth:256,phase,geometry,light:[1,0,0],seconds:0,activity:false});
const image=()=>({closed:false,close(){this.closed=true;}});
test('Worker has at most one producer batch and coalesces intermediate snapshots',()=>{
 const s=owner();s.update([job(0)],0);s.update([job(.1)],20);s.update([job(.2)],40);
 assert.equal(s.worker.sent.length,1);assert.equal(s.pending.jobs[0].phase,.2);
 const first=s.worker.sent[0];s.receive({kind:'done',...first,ms:2});assert.equal(s.worker.sent.length,2);assert.equal(s.worker.sent[1].jobs[0].phase,.2);s.dispose();
});
test('Stale geometry, hidden targets, invalidated time and disposed work never commit',()=>{
 const s=owner();s.update([job()],0);const batch=s.worker.sent[0],old={kind:'frame',revision:batch.revision,epoch:batch.epoch,job:batch.jobs[0]};
 s.update([job(0,'new')],1);let b=image();s.receive({...old,bitmap:b});assert.ok(b.closed);assert.equal(s.get('moon'),undefined);
 s.update([],2);b=image();s.receive({...old,bitmap:b});assert.ok(b.closed);
 s.invalidate();s.update([job()],3);b=image();s.receive({...old,bitmap:b});assert.ok(b.closed);
 const w=s.worker;s.dispose();assert.ok(w.stopped);b=image();s.receive({...old,bitmap:b});assert.ok(b.closed);
});
test('Accepted images replace and close old bitmaps; identical paused state is reused',()=>{
 const s=owner();s.update([job()],0);let batch=s.worker.sent[0],b=image();
 s.receive({kind:'frame',revision:batch.revision,epoch:batch.epoch,job:batch.jobs[0],bitmap:b});
 assert.equal(s.get('moon'),b);assert.equal(s.needs(job(),500),false);assert.equal(s.needs(job(.000001),121),true);
 s.receive({kind:'done',...batch,ms:1});s.update([job(.2)],200);batch=s.worker.sent[1];const b2=image();
 s.receive({kind:'frame',revision:batch.revision,epoch:batch.epoch,job:batch.jobs[0],bitmap:b2});assert.ok(b.closed);assert.equal(s.get('moon'),b2);
 s.update([],202);assert.ok(b2.closed);s.dispose();
});
test('Both source and offline build load surface before renderer; release identity is consistent',()=>{
 const root=require('node:path').join(__dirname,'..'),read=p=>fs.readFileSync(require('node:path').join(root,p),'utf8');
 const html=read('index.html'),build=read('tools/build.cjs'),app=read('src/app.js');
 assert.ok(html.indexOf('src/surface.js')<html.indexOf('src/renderer.js'));assert.match(build,/'assets','materials','astro','surface','sky','renderer','app'/);
 assert.ok(html.includes('Life User <span>/</span> v0.08'));
 assert.match(app,/version:'0\.08'/);assert.equal(JSON.parse(read('package.json')).version,'0.0.8');
 assert.ok(!html.includes('EG TOOLS'));assert.ok(html.includes('Life User / Solar Time v0.08 /')); // Historical release comparisons are allowed in help.
});
