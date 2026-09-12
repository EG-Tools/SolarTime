'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const A=require('../src/astro.js'),S=require('../src/surface.js');
const rcode=fs.readFileSync(require.resolve('../src/renderer.js'),'utf8'),scode=fs.readFileSync(require.resolve('../src/surface.js'),'utf8');
const sandbox={window:{SolarAstro:A},performance:{now:()=>100}};vm.runInNewContext(rcode,sandbox);const R=sandbox.window.SolarRenderer;
const all=[A.SUN,...A.BODIES,A.MOON],ms=Date.UTC(2026,8,12);
function r(){const out=Object.create(R.prototype);Object.assign(out,{w:1648,h:928,dpr:1,lensStretch:1.72,options:{moon:true,pluto:true,quality:'auto',avoidLabels:false},camera:{azimuth:.4,elevation:.7,zoom:1,focus:null,panX:0,panY:0},labelStates:new Map(),hitTargets:[],lastLabelMono:null});return out;}
function near(a,b){assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);}
function service(){
 class Worker{constructor(){this.sent=[];}postMessage(x){this.sent.push(x);}terminate(){this.stopped=true;}}
 const box={Worker,OffscreenCanvas:class{},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},Blob:class{},setTimeout,clearTimeout};
 vm.runInNewContext(scode,box);return new box.SolarSurface.Service();
}
const job=(geom='same')=>({id:'earth',diam:512,textureWidth:4096,geometry:geom,phase:.2,light:[1,0,0],seconds:0});
function publish(s){s.update([job()],100);const b=s.worker.sent.at(-1),image={width:512,height:512,closed:false,close(){this.closed=true;}};s.receive({kind:'frame',revision:b.revision,epoch:b.epoch,job:b.jobs[0],bitmap:image});s.receive({kind:'done',...b,ms:1});return image;}

test('Extended 256x close-up is continuous at 64x and never scales unrelated bodies',()=>{
 for(const b of all){const x=r();x.camera.focus=b.id;let last=0;
  for(const z of [1.00001,2,10,32,63.99999,64,64.00001,80,128,200,256]){x.camera.zoom=z;const radius=x.bodyRadiusAtZoom(b);assert.ok(radius>=last);last=radius;}
  near(last,928*1.10);x.camera.zoom=256;for(const other of all.filter(o=>o!==b))near(x.bodyRadiusAtZoom(other),other.size*x.baseBodyScale()*8);
  x.camera.zoom=64;const edge=x.bodyRadiusAtZoom(b);x.camera.zoom=64.00001;assert.ok(Math.abs(edge-x.bodyRadiusAtZoom(b))<.001);
 }
});
test('Double-click focus begins at 50% screen diameter while preserving simulation',()=>{
 for(const b of all){const x=r();const before=A.rotationAt(b,ms);x.focusBody(b.id);near(x.bodyRadiusAtZoom(b)*2,928*.5);assert.equal(A.rotationAt(b,ms),before);}
});
test('Moving/returning camera requests the same texture and raster quality as settled camera',()=>{
 for(const b of all){const x=r();x.focusBody(b.id);x.setZoom(64);
  x.cameraChangeAt=100;const a=x.surfaceJob(b,{},320,ms,0,105);x.cameraChangeAt=-Infinity;const c=x.surfaceJob(b,{},320,ms,0,9999);
  assert.equal(a.textureWidth,4096);assert.equal(a.diam,c.diam);assert.equal(a.textureWidth,c.textureWidth);assert.equal(a.geometry,c.geometry);
  assert.ok(a.diam<=1024);assert.ok(!rcode.includes('const diam=moving'));
 }
});
test('Visibility pause retains visible images, worker and decoded material ownership',()=>{
 const s=service(),image=publish(s),worker=s.worker,count=worker.sent.length;s.pause();
 assert.equal(s.get('earth'),image);assert.equal(image.closed,false);assert.equal(worker.stopped,undefined);
 s.update([job('changed')],500);assert.equal(worker.sent.length,count);s.resume();s.update([job()],600);
 assert.equal(s.worker,worker);assert.equal(s.get('earth'),image);assert.equal(worker.sent.length,count+1);
 s.dispose();assert.equal(image.closed,true);assert.equal(worker.stopped,true);
});
test('A hidden in-flight batch may finish but cannot replace retained pixels or queue more work',()=>{
 const s=service(),good=publish(s);s.update([job('next')],200);const batch=s.worker.sent.at(-1),count=s.worker.sent.length;s.pause();
 const image={width:512,height:512,close(){this.closed=true;}};
 s.receive({kind:'frame',revision:batch.revision,epoch:batch.epoch,job:batch.jobs[0],bitmap:image});
 s.receive({kind:'done',...batch,ms:1});assert.equal(image.closed,true);assert.equal(s.get('earth'),good);assert.equal(s.worker.sent.length,count);assert.equal(s.inflight,false);s.dispose();
});
test('Full-detail motion result tolerance is bounded and rejects other materials and bodies',()=>{
 const s=service(),a={...job('old'),viewState:{key:'earth:4:768:4096',yaw:0,pitch:.3,limit:Math.PI/36}};
 const b={...a,geometry:'new',viewState:{...a.viewState,yaw:.02}};assert.equal(s.compatibleView(b,a),true);
 for(const c of [{...b,id:'moon'},{...b,viewState:{...b.viewState,key:'earth:5:768:4096'}},{...b,viewState:{...b.viewState,yaw:.1}},{...b,viewState:{...b.viewState,pitch:NaN}}])assert.equal(s.compatibleView(c,a),false);
 s.dispose();
});
test('Every type of texture uses the same wrap repair without moving interior landmarks',()=>{
 const {stitchLongitude}=S.kernel();
 for(const w of [256,1024,2048,4096]){const h=6,data=new Uint8ClampedArray(w*h*4);
  for(let i=0;i<data.length;i++)data[i]=(i*37+i%13)%256;const before=new Uint8ClampedArray(data);stitchLongitude(data,w,h);
  for(let y=0;y<h;y++)for(let k=0;k<4;k++)assert.equal(data[(y*w)*4+k],data[(y*w+w-1)*4+k]);
  // Korea's 126.98 degree longitude stays far from the Pacific antimeridian.
  for(const x of [Math.round(w*.35),Math.round(w*.5),Math.round(w*.8527)])for(let y=0;y<h;y++)for(let k=0;k<4;k++)assert.equal(data[(y*w+x)*4+k],before[(y*w+x)*4+k]);
 }
 assert.match(scode,/const prepared=materialCanvas\(bitmap,width,width\/2\)/);assert.ok(!scode.includes('LINEAR_MIPMAP_LINEAR'));assert.match(scode,/TEXTURE_MIN_FILTER,g.LINEAR/);
});
test('Fixed default names stay below their own bodies even when another body crosses them',()=>{
 for(const b of all){const x=r(),c={measureText:t=>({width:t.length*7}),beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(){}};
  const p={body:b,screen:{x:220,y:220,z:0},r:20},obstacle={body:{id:'obstacle'},screen:{x:220,y:253,z:1},r:30};
  x.labels(c,[p],0);const first={...x.labelStates.get(b.id)};
  for(let t=20;t<1000;t+=20)x.labels(c,[p,obstacle],t);
  const last=x.labelStates.get(b.id);assert.equal(last.slot,0);near(last.dx,first.dx);near(last.dy,first.dy);
 }
});
test('One shared four-action camera dialog, one mode toggle and no old footer button',()=>{
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8'),app=fs.readFileSync(require.resolve('../src/app.js'),'utf8');
 assert.equal((html.match(/id="preset-dialog"/g)||[]).length,1);
 for(const id of ['preset-apply','preset-save','preset-delete','preset-cancel','zen-toggle'])assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
 for(const id of ['hide-ui','show-ui','preset-confirm']){assert.ok(!html.includes('id="'+id+'"'));assert.ok(!app.includes("$('"+id+"')"));}
 assert.match(app,/contextmenu',event=>openPresetDialog\(i,event\)/);
 assert.ok(html.includes('id="seconds-group" hidden'));assert.ok(html.includes('id="show-seconds" type="checkbox" role="switch"'));assert.ok(app.includes('showSeconds=false'));
});
