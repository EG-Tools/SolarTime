// Isolated GPU regression: a fully faded billboard must not cut the solid
// rock at its centre, and entry's blended near plane must retain foreground.
(()=>{
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
 const gl=canvas.getContext('webgl',{alpha:true,depth:true,antialias:false,preserveDrawingBuffer:true});
 const frame={u:{x:1,y:0,z:0},pole:{x:0,y:-1,z:0},v:{x:0,y:0,z:-1}};
 const t=new SolarRingTour({frame,radius:100,width:256,height:256,screen:{x:128,y:128},seed:123});
 t.atlasImage.src='';t.atlasImage=null;
 t.fogPoints=new Float32Array(0);
 t.chipPoints=new Float32Array(0);t.buildInstanceLayers();
 t.points=new Float32Array([1.77,0,.2,.018,.013]);t.age=10;t.visualAge=2;t.light=[0,0,-1];
 t.pose={eye:[1.77,0,0],right:[1,0,0],up:[0,1,0],forward:[0,0,1],basis:new Float32Array([1,0,0,0,1,0,0,0,1]),offset:[0,0],perspective:1,orthoScale:.5,fov:72};
 const textures=[];
 function texture(){const tex=gl.createTexture();textures.push(tex);gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);return tex;}
 const tex=texture(),quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quad);
 gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,1,1,-1,-1,1,1,-1,1]),gl.STATIC_DRAW);
 const gpu={gl,quad,textures:new Map([['saturn',{texture:tex,width:1}],['saturn-ring',{texture:tex,width:1}]]),resetBindings(){},stats:{drawCalls:0}};
 let draw;const sceneDraw=gl.drawArrays;
 try{
  gl.viewport(0,0,256,256);t.prepare(gpu);t.draw(gpu,256,256);t.resources.atlas=texture();t.resources.atlasAge=0;
  const ext=t.resources.instances;draw=ext.drawArraysInstancedANGLE;
  function render(skipBillboard){
   // The fixture mutates the normally immutable pool; rebuild membership only here.
   t.buildInstanceLayers();
   ext.drawArraysInstancedANGLE=function(mode,first,vertices,count){if(!skipBillboard||vertices!==6)draw.call(ext,mode,first,vertices,count);};
   gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);t.draw(gpu,256,256);
   const bytes=new Uint8Array(256*256*4);gl.readPixels(0,0,256,256,gl.RGBA,gl.UNSIGNED_BYTE,bytes);return bytes;
  }
  let maxDifference=0,minVisible=Infinity;
  for(let slot=0;slot<8;slot++)for(const variant of [.25,.75]){
   t.points[4]=(slot+variant)/8;const both=render(false),mesh=render(true);let visible=0;
   for(let i=0;i<both.length;i++){maxDifference=Math.max(maxDifference,Math.abs(both[i]-mesh[i]));if(i%4===3&&mesh[i]>128)visible++;}
   minVisible=Math.min(minVisible,visible);
  }
  const lodOpacity=[];
  // Keep every LOD sample inside the fully detailed region, independently
  // of the deliberate ring-to-debris distance fade under test below.
  t.points[3]=.012;
  for(const pixels of [1.8,2.5,3,4,5,6,7,8,9]){
   t.points[2]=t.points[3]*(256/(2*Math.tan(72*Math.PI/360)))/pixels;
   const both=render(false);let maximum=0;for(let i=3;i<both.length;i+=4)maximum=Math.max(maximum,both[i]);lodOpacity.push({pixels,maximum});
  }
  // Follow an actual opaque instance from beyond the reveal radius, through
  // the foreground, and out through the near fade. Isolate its alpha from the
  // underlying disk. Both travel directions must have gradual fades, including
  // subpixel sprites and solid meshes; no per-frame representation switch.
  const passage=[];gl.drawArrays=()=>{};
  for(const size of [.002,.018])for(const direction of [-1,1]){
   t.points[2]=0;t.points[3]=size;
   const halfPixel=Math.tan(72*Math.PI/360)/256;
   t.pose={eye:[1.77,0,0],right:[direction,0,0],up:[0,1,0],forward:[0,0,direction],basis:new Float32Array([direction,0,0,0,1,0,0,0,direction]),offset:[halfPixel,halfPixel],perspective:1,orthoScale:.5,fov:72};
   let previous=0,maximum=0,jump=0,middle=0,first,last;
   for(let i=0;i<=310;i++){
    const distance=3.12-i*.01;t.pose.eye[2]=-distance*direction;
    const bytes=render(false),alpha=bytes[(128*256+128)*4+3];
    first??=alpha;last=alpha;maximum=Math.max(maximum,alpha);jump=Math.max(jump,Math.abs(alpha-previous));
    if(alpha>10&&alpha<240)middle++;previous=alpha;
   }
   passage.push({size,direction,first,last,maximum,jump,middle});
  }
  gl.drawArrays=sceneDraw;t.pose={eye:[1.77,0,0],right:[1,0,0],up:[0,1,0],forward:[0,0,1],basis:new Float32Array([1,0,0,0,1,0,0,0,1]),offset:[0,0],perspective:1,orthoScale:.5,fov:72};
  t.points[3]=.018;t.pose.perspective=.5;t.points[2]=-.1;
  const entry=render(false);let entryVisible=0;for(let i=3;i<entry.length;i+=4)if(entry[i]>20)entryVisible++;
  // Compare the real scene shader with/without debris readiness. Distant
  // pixels must not disappear as entry progresses, including a grazing view.
  ext.drawArraysInstancedANGLE=()=>{};
  const unit=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);};
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  function band(eye,target,perspective,ready){
   const forward=unit(target.map((v,i)=>v-eye[i])),right=unit(cross([0,1,0],forward)),up=cross(forward,right);
   // Aim at the sampled pixel centre, not the boundary between four pixels.
   const halfPixel=Math.tan(72*Math.PI/360)/256;
   t.pose={eye,right,up,forward,basis:new Float32Array([...right,...up,...forward]),offset:[halfPixel,halfPixel],perspective,orthoScale:.5,fov:72};
   t.visualAge=ready?2:0;gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);t.draw(gpu,256,256);
   const pixel=new Uint8Array(4);gl.readPixels(128,128,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);return pixel[3];
  }
  const farBand=[];
  for(const height of [.04,.12,.6])for(const perspective of [.35,.65,.85,1]){
   const eye=[1.77,height,0],target=[-.8,0,2];
   farBand.push({height,perspective,before:band(eye,target,perspective,false),after:band(eye,target,perspective,true)});
  }
  const nearBand={before:band([1.77,.04,0],[1.77,0,.65],1,false),after:band([1.77,.04,0],[1.77,0,.65],1,true)};
  const approachBand=[.8,.6,.4,.2,.1].map(height=>({height,before:band([1.77,height,0],[1.77,0,.3],1,false),after:band([1.77,height,0],[1.77,0,.3],1,true)}));
  band([1.77,.04,0],[1.77,0,.65],1,true);t.returnDetail=t.ringDetailState();t.returnFrom=t.pose;t.state='returning';t.returnDuration=5;
  const retreatBand=[0,.25,.5,.75,1].map(fraction=>{t.returnAge=5*fraction;return {fraction,before:band([1.77,1.2,0],[1.77,0,.65],1,false),after:band([1.77,1.2,0],[1.77,0,.65],1,true)};});
  // Looking along the ring from above: upper/right rays point AWAY from
  // both the disk and Saturn. Below the ring, the lower/right rays do so.
  // A blended ray origin must never invent a hit behind its effective eye.
  const wrongSideBand=[];t.visualAge=0;
  for(const height of [.03,.12])for(const hemisphere of [1,-1])for(const orthoScale of [.5,2,5])for(const perspective of [.35,.65,.85,.95,1]){
   t.pose={eye:[1.77,height*hemisphere,0],right:[1,0,0],up:[0,1,0],forward:[0,0,1],basis:new Float32Array([1,0,0,0,1,0,0,0,1]),offset:[0,0],perspective,orthoScale,fov:72};
   gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);t.draw(gpu,256,256);
   const pixels=new Uint8Array(128*64*4);gl.readPixels(128,hemisphere>0?192:0,128,64,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
   let opaque=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>0)opaque++;
   wrongSideBand.push({height,hemisphere,orthoScale,perspective,opaque});
   if(opaque)throw Error('Ring projected behind the effective camera: '+JSON.stringify(wrongSideBand.at(-1)));
  }
  for(const p of passage){if(p.first!==0||p.last!==0||p.maximum<240||p.jump>50||p.middle<50)throw Error('Abrupt debris passage: '+JSON.stringify(p));}
  // Same immutable pools and shaders, culling on/off: less GPU work must not
  // change any pixels, including free-look, offset lens and portrait views.
  gl.drawArrays=sceneDraw;ext.drawArraysInstancedANGLE=draw;
  const culling=[],pool=new SolarRingTour({frame,radius:100,width:256,height:256,screen:{x:128,y:128},seed:321});
  pool.atlasImage.src='';pool.atlasImage=null;
  const original=pool.visibleInstances,optimization=[];
  try{
   pool.prepare(gpu);pool.draw(gpu,256,256);pool.resources.atlas=texture();pool.resources.atlasAge=0;
   for(const age of [3,8,12,23])for(const fov of [35,100])for(const [width,height] of [[256,128],[128,256]]){
    canvas.width=width;canvas.height=height;gl.viewport(0,0,width,height);
    pool.age=age;pool.visualAge=age+2;pool.state=age<10?'entering':'cruising';pool.fov=fov;pool.yaw=.7;pool.pitch=-.3;pool.pose=pool.cameraPose();
    const renderCull=enabled=>{
     pool.visibleInstances=function(...args){if(!enabled)args[6]=null;return original.apply(this,args);};
     gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);pool.draw(gpu,width,height);
     if(pool.flightField.routeKind!=='orbit')throw Error('Only the fixed orbit particle field should exist');
     if(Math.abs(pool.flightField.alpha-pool.entryLayers().particles)>1e-9)throw Error('Entry particles must follow the shared proximity fade');
     const pixels=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
     return {pixels,count:pool.submittedInstances};
    };
    const before=renderCull(false),after=renderCull(true);let difference=0;
    for(let i=0;i<before.pixels.length;i++)difference=Math.max(difference,Math.abs(before.pixels[i]-after.pixels[i]));
    if(difference>1)throw Error('Frustum clipped visible geometry: '+JSON.stringify({age,fov,width,height,difference}));
    culling.push({age,fov,width,height,before:before.count,after:after.count,difference});
   }
   if(!culling.some(s=>s.age>=10&&s.after<s.before*.7))throw Error('Culling did not reduce submitted instances');
   pool.visibleInstances=original;
   for(const fov of [35,72,100]){
    canvas.width=512;canvas.height=256;gl.viewport(0,0,512,256);
    pool.age=12;pool.visualAge=14;pool.state='cruising';pool.fov=fov;pool.pose=pool.cameraPose();
    const fog=pool.instanceLayers.find(l=>l.fog),selected=fog.indices,full=Array.from({length:pool.fogPoints.length/5},(_,i)=>i*5);
    const renderOptimized=enabled=>{
     // Compare LOD pixels with identical dust; dense-pool thinning intentionally
     // changes coverage and is checked separately by its submitted counts.
     fog.indices=selected;
     pool.visibleInstances=function(...args){
      if(!enabled&&args[7]){if(args[7].level===0)return 0;args[7]=null;}
      return original.apply(this,args);
     };
     gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);pool.draw(gpu,512,256);
     const pixels=new Uint8Array(512*256*4);gl.readPixels(0,0,512,256,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
     return {vertices:pool.submittedVertices,instances:pool.submittedInstances,fog:pool.fogCount,pixels};
    };
    const before=renderOptimized(false),after=renderOptimized(true);let difference=0,changed=0;
    for(let i=0;i<before.pixels.length;i++){const d=Math.abs(before.pixels[i]-after.pixels[i]);difference+=d;if(d>16)changed++;}
    const meanDifference=difference/before.pixels.length,changedFraction=changed/before.pixels.length;
    // A telephoto lens may legitimately retain all detailed geometry. Require
    // no regression per lens, and a meaningful saving in at least one view.
    const candidateFog=original.call(pool,pool.fogPoints,1.85,pool.instanceData,pool.instanceOrder,full,true,pool.instanceFrustum(512,256));
    if(after.vertices>before.vertices||after.fog>=candidateFog)throw Error('No geometry/dust reduction');
    if(meanDifference>3||changedFraction>.025)throw Error('Optimization changed too much of the image: '+JSON.stringify({fov,meanDifference,changedFraction,before:before.vertices,after:after.vertices,fogBefore:before.fog,fogAfter:after.fog}));
    optimization.push({fov,before:{vertices:before.vertices,fog:before.fog},after:{vertices:after.vertices,fog:after.fog},meanDifference,changedFraction});
   }
   if(!optimization.some(s=>s.after.vertices<s.before.vertices*.9))throw Error('No meaningful LOD vertex saving');
  }finally{pool.visibleInstances=original;pool.dispose();}
  return {maxDifference,minVisible,entryVisible,lodOpacity,passage,farBand,nearBand,approachBand,retreatBand,wrongSideBand,culling,optimization,error:gl.getError()};
 }finally{
  gl.drawArrays=sceneDraw;
  if(draw&&t.resources)t.resources.instances.drawArraysInstancedANGLE=draw;
  t.dispose();gl.deleteBuffer(quad);for(const tex of textures)gl.deleteTexture(tex);gl.getExtension('WEBGL_lose_context')?.loseContext();
 }
})();
