'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync(require.resolve('../src/surface.js'),'utf8');
function owner(){
 class Worker {constructor(){this.sent=[];}postMessage(v){this.sent.push(v);}terminate(){this.stopped=true;}}
 const sandbox={Worker,OffscreenCanvas:class{},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},Blob:class{},setTimeout,clearTimeout};
 vm.runInNewContext(code,sandbox);return new sandbox.SolarSurface.Service();
}
const job=(phase=0,geometry='g')=>({id:'moon',diam:64,textureWidth:256,phase,geometry,light:[1,0,0],seconds:0,activity:false});
const image=()=>({width:64,height:64,closed:false,close(){this.closed=true;}});
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
 assert.ok(html.includes('Life User <span>/</span> v0.13'));
 assert.match(app,/version:'0\.13'/);assert.equal(JSON.parse(read('package.json')).version,'0.0.13');
 assert.ok(!html.includes('EG TOOLS'));assert.ok(html.includes('Life User / Solar Time v0.13 /')); // Historical release comparisons are allowed in help.
});

test('Material revision changes keep the last good planet frame until its replacement is ready',()=>{
 const s=owner();s.update([job()],0);let b=s.worker.sent[0],good=image();
 s.receive({kind:'frame',revision:b.revision,epoch:b.epoch,job:b.jobs[0],bitmap:good});s.receive({kind:'done',...b,ms:1});
 s.assetRevision=-1;s.update([job(.01)],500);assert.equal(s.get('moon'),good);assert.equal(good.closed,false);
 b=s.worker.sent.at(-1);const replacement=image();s.receive({kind:'frame',revision:b.revision,epoch:b.epoch,job:b.jobs[0],bitmap:replacement});
 assert.equal(s.get('moon'),replacement);assert.equal(good.closed,true);s.dispose();
});

test('Invalid, empty or misrouted image frames cannot replace a healthy planet image',()=>{
 const s=owner();s.update([job()],0);const b=s.worker.sent[0],msg={kind:'frame',revision:b.revision,epoch:b.epoch,job:b.jobs[0]};
 const good=image();s.receive({...msg,bitmap:good});
 for(const broken of [{width:0},{height:32},{width:2048,height:2048}]){
  const bitmap=Object.assign(image(),broken);s.receive({...msg,bitmap});assert.equal(bitmap.closed,true);assert.equal(s.get('moon'),good);
 }
 const bitmap=image();s.receive({...msg,job:{...msg.job,phase:.2},bitmap});assert.equal(bitmap.closed,true);assert.equal(good.closed,false);
 const other=image();s.receive({...msg,job:{...msg.job,id:'jupiter'},bitmap:other});assert.equal(other.closed,true);assert.equal(s.get('jupiter'),undefined);s.dispose();
});

test('Late worker failures cannot reset a newer camera/material generation',()=>{
 const s=owner();s.update([job()],0);const first=s.worker.sent[0],w=s.worker;
 s.invalidate();s.update([job(.4,'new')],100);
 s.receive({kind:'error',revision:first.revision,epoch:first.epoch,message:'old GPU failure'});
 assert.equal(s.worker,w);assert.equal(s.stats.error,undefined);assert.equal(w.sent.length,2);
 s.receive({kind:'error',revision:first.revision,epoch:first.epoch,message:'duplicate old failure'});
 assert.equal(s.worker,w);assert.equal(w.sent.length,2);s.dispose();
});

test('GPU loss guard does not return a corrupted or transparent surface as successful output',()=>{
 assert.match(code,/isContextLost\(\)\)throw Error\('WebGL context lost'\)/);
 assert.match(code,/this.forceCPU=true/);assert.match(code,/new kernel.Engine\(\{gpu:!this.forceCPU\}\)/);
});

test('Slow automatic yaw accepts a completed intermediate surface within 1.5 degrees',()=>{
 const s=owner();const start={...job(),viewState:{key:'session:moon:texture:quality:elevation',yaw:0,pitch:0,limit:Math.PI/120}};
 s.update([start],0);const batch=s.worker.sent[0],bitmap=image();
 s.update([{...start,geometry:'new-yaw',viewState:{...start.viewState,yaw:.01}}],200);
 s.receive({kind:'frame',revision:batch.revision,epoch:batch.epoch,job:batch.jobs[0],bitmap});
 assert.equal(s.get('moon'),bitmap);assert.equal(bitmap.closed,false);s.dispose();
});

test('Automatic-yaw tolerance never mixes planets, materials, sessions or manual camera movement',()=>{
 const s=owner(),a={...job(),viewState:{key:'session:moon:texture:quality:elevation',yaw:0,pitch:0,limit:Math.PI/120}};
 for(const b of [
  {...a,id:'jupiter',geometry:'other'},
  {...a,geometry:'other',viewState:{key:'different-session',yaw:.001}},
  {...a,geometry:'other',viewState:{key:'different-texture',yaw:.001}},
  {...a,geometry:'other',viewState:{...a.viewState,yaw:.04}},
  {...a,geometry:'other',viewState:{...a.viewState,yaw:NaN}},
  {...a,geometry:'other',viewState:null}])assert.equal(s.compatibleView(b,a),false);
 const wrapped={...a,geometry:'near-wrap',viewState:{...a.viewState,yaw:Math.PI*2-.005}};
 assert.equal(s.compatibleView(wrapped,a),true);s.dispose();
});
