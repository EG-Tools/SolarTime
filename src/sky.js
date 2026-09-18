/* Solar Time v0.47 — sky implementation owner. */
(function(root){'use strict';
const TAU=Math.PI*2,DRIFT=.22*Math.PI/180,COS30=Math.sqrt(.75);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const edgeShadeStrength=()=>root.document?.documentElement?.classList?.contains('solar-phone-layout')?0:.24;
function samplePanorama(tex,u,v,out,index=0){
 const w=tex.width,h=tex.height,tx=((u%1+1)%1)*w-.5,ty=clamp(v*h-.5,0,h-1);
 const ix=Math.floor(tx),y0=Math.floor(ty),x0=(ix%w+w)%w,x1=(x0+1)%w,y1=Math.min(h-1,y0+1),fx=tx-ix,fy=ty-y0;
 const a=(y0*w+x0)*4,b=(y0*w+x1)*4,c=(y1*w+x0)*4,d=(y1*w+x1)*4;
 const wa=(1-fx)*(1-fy),wb=fx*(1-fy),wc=(1-fx)*fy,wd=fx*fy,data=tex.data;
 for(let k=0;k<3;k++)out[index+k]=data[a+k]*wa+data[b+k]*wb+data[c+k]*wc+data[d+k]*wd;
}
function cometPoint(path,t){
 const f=clamp(t,0,1),u=1-f,q={};
 for(const a of ['x','y','z'])q[a]=u*u*u*path.start[a]+3*u*u*f*path.control1[a]+3*u*f*f*path.control2[a]+f*f*f*path.end[a];
 const n=Math.hypot(q.x,q.y,q.z)||1;return {x:q.x/n,y:q.y/n,z:q.z/n};
}
function cometTail(path,t,project,samples=96){
 const points=[],start=Math.max(0,t-.115);
 for(let i=0;i<=samples;i++){
  const point=project(cometPoint(path,start+(t-start)*i/samples));
  if(!point){points.length=0;continue;}
  const previous=points[points.length-1];
  if(!previous||Math.hypot(point.x-previous.x,point.y-previous.y)>.03)points.push(point);
 }
 return points;
}
function drawCometRibbon(ctx,points,opacity=1){
 if(points.length<2)return;
 const first=points[0],last=points[points.length-1],count=points.length;
 let length=0;for(let i=1;i<count;i++)length+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);
 if(length<.1)return;
 const normals=points.map((point,i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(count-1,i+1)],d=Math.hypot(b.x-a.x,b.y-a.y)||1;return {x:-(b.y-a.y)/d,y:(b.x-a.x)/d};});
 ctx.save();ctx.globalCompositeOperation='screen';ctx.setLineDash([]);
 for(const [width,alpha] of [[5.2,.035],[3.6,.055],[2.3,.08],[1.25,.13],[.48,.21]]){
  const gradient=ctx.createLinearGradient(first.x,first.y,last.x,last.y);
  gradient.addColorStop(0,'rgba(143,178,208,0)');gradient.addColorStop(.28,`rgba(149,184,212,${alpha*.15*opacity})`);
  gradient.addColorStop(.72,`rgba(176,209,232,${alpha*.64*opacity})`);gradient.addColorStop(1,`rgba(229,240,249,${alpha*opacity})`);
  ctx.fillStyle=gradient;ctx.beginPath();
  for(let side=0;side<2;side++)for(let j=0;j<count;j++){
   const i=side?count-1-j:j,f=i/(count-1),p=points[i],n=normals[i];
   const envelope=Math.sin(Math.PI*Math.pow(f,.65))*.78+.12*f,offset=width*envelope*(side?-1:1);
   const x=p.x+n.x*offset,y=p.y+n.y*offset;if(!side&&!j)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  ctx.closePath();ctx.fill();
 }
 ctx.restore();
}
function rand(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function starField(source,total=4400){
 if(source instanceof Float32Array&&source.length>=6)return source;
 const field=(Array.isArray(source)?source:[]).filter(star=>Array.isArray(star)&&star.length>=6).map(star=>star.slice(0,6));
 const random=rand(204031),target=Math.max(total,field.length);
 while(field.length<target){
  const z=random()*2-1,angle=random()*TAU,radius=Math.sqrt(Math.max(0,1-z*z)),rare=random();
  field.push([Math.cos(angle)*radius,Math.sin(angle)*radius,z,.28+Math.pow(rare,7)*.92,.16+random()*.32+(rare>.985?.18:0),random()*12]);
 }
 return field;
}
function shader(g,type,source){
 const s=g.createShader(type);if(!s)throw Error('Cannot allocate sky shader');
 g.shaderSource(s,source);g.compileShader(s);
 if(!g.getShaderParameter(s,g.COMPILE_STATUS)){const error=g.getShaderInfoLog(s);g.deleteShader(s);throw Error(error||'Sky shader compilation failed');}
 return s;
}
function rotate(p,angle,axis){const c=Math.cos(angle),s=Math.sin(angle);return axis==='z'?{x:p.x*c-p.y*s,y:p.x*s+p.y*c,z:p.z}:{x:p.x,y:p.y*c-p.z*s,z:p.y*s+p.z*c};}
 function rasterSize(w,h,moving){
 const desired=moving?320:512,budget=moving?90000:160000;
 const width=Math.max(1,Math.floor(Math.min(desired,Math.sqrt(budget*w/h))));
  return [width,Math.max(1,Math.floor(Math.min(budget/width,width*h/w)))];
 }
 function skySources(asset,width=2048){
  if(typeof asset==='string')return [asset];
  const tiers=asset?.tiers||[],tier=tiers.find(row=>row.width>=width)||tiers[tiers.length-1],remote=tier&&asset.base?new URL(tier.path,asset.base).href:'';
  return [remote,asset?.fallback].filter((url,index,list)=>url&&list.indexOf(url)===index);
 }
 async function loadSkyImage(asset){
  let lastError;
  for(const url of skySources(asset))try{const image=new Image();image.decoding='async';if(!url.startsWith('file:')&&!url.startsWith('data:'))image.crossOrigin='anonymous';image.src=url;await image.decode();return image;}catch(error){lastError=error;}
  throw lastError||Error('Sky asset could not be decoded.');
 }
class Sky{
 constructor(canvas){
   this.canvas=canvas;this.ready=false;this.disposed=false;this.paused=false;
  this.abort=new AbortController();this.gl=null;this.initTicket=0;this.softwareEpoch=0;
  this.stats={backend:'loading',frames:0,skipped:0,starProjections:0};
  this.random=rand(610639);this.comet=null;this.nextComet=18+this.random()*22;this.lastTime=0;
   // Choose a fresh panorama longitude on every launch/reload, then retain it
   // for this page lifetime while the existing passive drift continues from it.
   this.offset=Math.random()*TAU;this.lastEffect=null;this.tanFov=Math.tan(38*Math.PI/180);this.lastGPU=-Infinity;
  this.rayTables=new Map();this.visibleStars=[];this.cameraMotionAt=-Infinity;
  this.gamma=new Float32Array(4096);for(let i=0;i<4096;i++)this.gamma[i]=Math.pow(i/4095,.95)*255*.5896;
  canvas.addEventListener('webglcontextlost',e=>{
   e.preventDefault();this.initTicket++;this.ready=false;this.stats.backend='context-lost';
   this.texture=this.buffer=this.program=this.starBuffer=this.starProgram=null;this.starA=this.starU=null;this.cancelSoftware();this.invalidate();
  },{signal:this.abort.signal});
  canvas.addEventListener('webglcontextrestored',()=>{if(!this.disposed){this.invalidate();this.initialize();}},{signal:this.abort.signal});
  this.initialize();
 }
 invalidate(){this.lastPose=null;this.lastKey='';this.lastGPU=-Infinity;this.starPose=null;}
  async initialize(){
  const ticket=++this.initTicket;
  try{
    if(!this.image){const image=await loadSkyImage(root.SolarAssets?.sky);if(this.disposed||ticket!==this.initTicket)return;this.image=image;}
   if(this.disposed||ticket!==this.initTicket)return;
   // The visible canvas is retained on unchanged poses, so a preserved buffer
   // is intentional. Disabling it while skipping draws produces a black sky.
   const g=this.canvas.getContext('webgl',{alpha:false,depth:false,stencil:false,antialias:false,preserveDrawingBuffer:true});
   if(!g)throw Error('WebGL unavailable');this.gl=g;
   if(g.isContextLost())return;
   this.releaseGPU();
   const precision=g.getShaderPrecisionFormat(g.FRAGMENT_SHADER,g.HIGH_FLOAT)?.precision?'highp':'mediump';
   const vs=shader(g,g.VERTEX_SHADER,'attribute vec2 a;varying vec2 p;void main(){p=a;gl_Position=vec4(a,0.,1.);}');
   let fs;
   try{fs=shader(g,g.FRAGMENT_SHADER,`precision ${precision} float;
    varying vec2 p;uniform sampler2D sky;uniform vec3 right,down,forward;uniform vec2 size;uniform float drift,fov,edgeShade;
    void main(){
     vec3 ray=normalize(vec3(p.x*size.x/size.y*fov,-p.y*fov,-1.));vec3 q=right*ray.x+down*ray.y+forward*ray.z;
     float cs=cos(drift),sn=sin(drift);q=vec3(q.x*cs-q.y*sn,q.x*sn+q.y*cs,q.z);
     q=normalize(vec3(q.x,q.y*.866025403784-q.z*.5,q.y*.5+q.z*.866025403784));
     float longitude=length(q.xy)>.0000001?atan(q.y,q.x):0.;
     vec2 uv=vec2(fract(longitude/6.28318530718+.5),.5-asin(clamp(q.z,-1.,1.))/3.14159265359);
     vec3 haze=texture2D(sky,uv).rgb;float vignette=1.-edgeShade*pow(clamp(length(p)*.6,0.,1.),2.);
     vec3 col=vec3(.001,.002,.006)+pow(haze,vec3(.95))*.5984;
     gl_FragColor=vec4(col*vignette,1.);
    }`);}catch(error){g.deleteShader(vs);throw error;}
   const program=g.createProgram();this.program=program;
   g.attachShader(program,vs);g.attachShader(program,fs);g.linkProgram(program);g.deleteShader(vs);g.deleteShader(fs);
   if(!g.getProgramParameter(program,g.LINK_STATUS))throw Error(g.getProgramInfoLog(program)||'Sky link failed');
   this.buffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,this.buffer);
   g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),g.STATIC_DRAW);
   // Cache all locations once. Never query driver state in the drawing loop.
   this.attribute=g.getAttribLocation(program,'a');g.enableVertexAttribArray(this.attribute);g.vertexAttribPointer(this.attribute,2,g.FLOAT,false,0,0);
   this.u=Object.fromEntries(['right','down','forward','size','drift','fov','sky','edgeShade'].map(k=>[k,g.getUniformLocation(program,k)]));
   const max=g.getParameter(g.MAX_TEXTURE_SIZE),source=this.image;
   const width=2**Math.floor(Math.log2(Math.min(source.width,max))),height=width/2;
   let upload=source;
   if(source.width!==width||source.height!==height){upload=document.createElement('canvas');upload.width=width;upload.height=height;upload.getContext('2d').drawImage(source,0,0,width,height);}
   this.texture=g.createTexture();g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,this.texture);
   g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,upload);
   g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.REPEAT);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);
   // Base-level linear sampling avoids the atan/fract derivative seam.
   g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);
   this.edgeShadeStrength=null;g.useProgram(program);g.uniform1i(this.u.sky,0);g.uniform1f(this.u.fov,this.tanFov);
   const sources=root.SolarVisualEffects.starShaderSources(precision);
   const starVertex=shader(g,g.VERTEX_SHADER,sources.vertex),starFragment=shader(g,g.FRAGMENT_SHADER,sources.fragment);
   this.starProgram=g.createProgram();g.attachShader(this.starProgram,starVertex);g.attachShader(this.starProgram,starFragment);g.linkProgram(this.starProgram);g.deleteShader(starVertex);g.deleteShader(starFragment);
   if(!g.getProgramParameter(this.starProgram,g.LINK_STATUS))throw Error(g.getProgramInfoLog(this.starProgram)||'Star link failed');
   const stars=starField(root.SolarAssets?.starData||root.SolarAssets?.stars),starData=stars instanceof Float32Array?stars:new Float32Array(stars.length*6);
   if(!(stars instanceof Float32Array))stars.forEach((star,index)=>starData.set(star,index*6));this.starCount=Math.floor(starData.length/6);
   this.starBuffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,this.starBuffer);g.bufferData(g.ARRAY_BUFFER,starData,g.STATIC_DRAW);
   this.starA={position:g.getAttribLocation(this.starProgram,'position'),appearance:g.getAttribLocation(this.starProgram,'appearance')};
   this.starU=Object.fromEntries(['right','down','forward','size','fov','pointScale','seconds'].map(k=>[k,g.getUniformLocation(this.starProgram,k)]));
   this.stats.backend='gpu';this.stats.textureSize=[width,height];this.stats.starCount=this.starCount;this.ready=true;this.invalidate();
  }catch(error){
   if(this.disposed||ticket!==this.initTicket)return;
   this.stats.error=String(error.message||error);this.toSoftware();
   }
  }
 releaseGPU(){
  const g=this.gl;if(!g)return;
  if(this.texture)g.deleteTexture(this.texture);if(this.buffer)g.deleteBuffer(this.buffer);if(this.program)g.deleteProgram(this.program);
  if(this.starBuffer)g.deleteBuffer(this.starBuffer);if(this.starProgram)g.deleteProgram(this.starProgram);
  this.texture=this.buffer=this.program=this.starBuffer=this.starProgram=null;this.starA=this.starU=null;
 }
 toSoftware(){
  const previous=this.gl;this.releaseGPU();this.gl=null;
  // A canvas that has acquired WebGL can never acquire a 2D context. Replace
  // ONLY that background canvas, preserving its id/classes/ARIA/CSS/size.
  let ctx=this.canvas.getContext('2d');
  if(!ctx){const replacement=this.canvas.cloneNode(false);replacement.width=this.canvas.width;replacement.height=this.canvas.height;this.canvas.replaceWith(replacement);this.canvas=replacement;ctx=replacement.getContext('2d');}
  this.ctx=ctx;this.stats.backend='compatibility';this.ready=false;this.invalidate();
  if(previous){this.abort.abort();previous.getExtension('WEBGL_lose_context')?.loseContext();}
  if(!ctx||!this.image){if(ctx){ctx.fillStyle='#010207';ctx.fillRect(0,0,this.canvas.width,this.canvas.height);}return;}
  try{
   const c=document.createElement('canvas');c.width=Math.min(2048,this.image.width);c.height=c.width/2;
   const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(this.image,0,0,c.width,c.height);this.pixels=x.getImageData(0,0,c.width,c.height);
   this.ready=true;
  }catch(error){this.stats.error=String(error.message||error);}
 }
 resize(w,h,dpr){
  w=Math.max(1,w);h=Math.max(1,h);dpr=Math.max(.1,dpr||1);
  // Prevent a 4K/5K HiDPI desktop from allocating several full-resolution sky
  // buffers; foreground planet resolution is entirely independent of this cap.
  const ratio=Math.min(dpr,1.5,Math.sqrt(8388608/(w*h)));
  const width=Math.max(1,Math.round(w*ratio)),height=Math.max(1,Math.round(h*ratio));
  if(this.w===w&&this.h===h&&this.canvas.width===width&&this.canvas.height===height)return;
  this.w=w;this.h=h;this.canvas.width=width;this.canvas.height=height;this.stats.bufferPixels=width*height;
  this.cancelSoftware();this.rayTables.clear();this.invalidate();
 }
 axes(camera){const a=camera.azimuth,e=camera.elevation,c=Math.cos(a),s=Math.sin(a),ce=Math.cos(e),se=Math.sin(e);return {right:[c,-s,0],down:[-s*se,-c*se,-ce],forward:[-s*ce,-c*ce,se]};}
 updateAxes(camera){
  if(!this.axesNow||this.axesA!==camera.azimuth||this.axesE!==camera.elevation){this.axesNow=this.axes(camera);this.axesA=camera.azimuth;this.axesE=camera.elevation;}
  if(!this.panAxes||this.panOffset!==this.offset||this.panSource!==this.axesNow){
   const cs=Math.cos(this.offset),sn=Math.sin(this.offset),transform=a=>{
    const x=a[0]*cs-a[1]*sn,y=a[0]*sn+a[1]*cs;return [x,y*COS30-a[2]*.5,y*.5+a[2]*COS30];
   };
   this.panAxes={right:transform(this.axesNow.right),down:transform(this.axesNow.down),forward:transform(this.axesNow.forward)};
   this.panOffset=this.offset;this.panSource=this.axesNow;
  }
 }
 draw(seconds,camera,options){
  if(this.disposed||this.paused)return;
  const drawCount=root.SolarVisualEffects.drawCount(this,options);
  if(this.lastEffect!==null&&options.skyMotion)this.offset=(this.offset+Math.max(0,seconds-this.lastEffect)*DRIFT)%TAU;
  this.lastEffect=seconds;this.camera=camera;this.updateAxes(camera);
  if(!this.ready||!this.w||!this.h)return;
  const now=performance.now(),a=camera.azimuth,e=camera.elevation,pose=this.lastPose,shade=edgeShadeStrength(),starTick=options.twinkle?Math.floor(seconds*30):0;
  const cameraChanged=!pose||pose.a!==a||pose.e!==e||pose.w!==this.w||pose.h!==this.h||pose.shade!==shade;
  const unchanged=!cameraChanged&&pose.offset===this.offset&&pose.starTick===starTick;
  if(unchanged){this.stats.skipped++;return;}
  if(!this.gl){
   if(this.softwareA!==a||this.softwareE!==e){this.cameraMotionAt=now;this.softwareA=a;this.softwareE=e;}
   const moving=now-this.cameraMotionAt<180;
   const key=[a,e,this.offset,this.w,this.h,moving,shade].join(':');
   if(this.softwareDesired?.key!==key)this.softwareDesired={key,revision:(this.softwareRevision=(this.softwareRevision||0)+1),a,e,
    moving,shade,axes:this.panAxes,offset:this.offset,w:this.w,h:this.h,epoch:this.softwareEpoch};
   this.softwarePump();return;
  }
  // Passive .22-degree/s drift: 30 updates/s. Actual camera movement stays at
  // the application's full RAF rate; planets, clock and twinkles are not capped.
  if(!cameraChanged&&now-this.lastGPU<1000/30-1){this.stats.skipped++;return;}
  const g=this.gl;if(g.isContextLost())return;
  g.viewport(0,0,this.canvas.width,this.canvas.height);g.disable(g.BLEND);g.useProgram(this.program);
  g.bindBuffer(g.ARRAY_BUFFER,this.buffer);g.enableVertexAttribArray(this.attribute);g.vertexAttribPointer(this.attribute,2,g.FLOAT,false,0,0);
  for(const k of ['right','down','forward'])g.uniform3fv(this.u[k],this.axesNow[k]);
  g.uniform2f(this.u.size,this.w,this.h);g.uniform1f(this.u.drift,this.offset);
  if(this.edgeShadeStrength!==shade){g.uniform1f(this.u.edgeShade,shade);this.edgeShadeStrength=shade;}
  g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,this.texture);g.drawArrays(g.TRIANGLES,0,6);
  if(options.twinkle&&this.starProgram&&drawCount){
   g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE);g.useProgram(this.starProgram);g.bindBuffer(g.ARRAY_BUFFER,this.starBuffer);
   g.enableVertexAttribArray(this.starA.position);g.vertexAttribPointer(this.starA.position,3,g.FLOAT,false,24,0);
   g.enableVertexAttribArray(this.starA.appearance);g.vertexAttribPointer(this.starA.appearance,3,g.FLOAT,false,24,12);
   for(const k of ['right','down','forward'])g.uniform3fv(this.starU[k],this.panAxes[k]);
   g.uniform2f(this.starU.size,this.w,this.h);g.uniform1f(this.starU.fov,this.tanFov);
   g.uniform1f(this.starU.pointScale,this.canvas.width/this.w);g.uniform1f(this.starU.seconds,seconds);
   g.drawArrays(g.POINTS,0,drawCount);g.disable(g.BLEND);
  }
  this.lastPose={a,e,offset:this.offset,w:this.w,h:this.h,starTick,shade};this.lastGPU=now;this.stats.frames++;
 }
 rayTable(sw,sh,aspect,shade=edgeShadeStrength()){
  const key=[sw,sh,aspect,this.tanFov,shade].join(':');let table=this.rayTables.get(key);if(table)return table;
  table=new Float32Array(sw*sh*4);
  for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){
   const sx=(x+.5)/sw*2-1,sy=(y+.5)/sh*2-1,qx=sx*aspect*this.tanFov,qy=sy*this.tanFov,inv=1/Math.hypot(qx,qy,1),i=(y*sw+x)*4;
   table[i]=qx*inv;table[i+1]=qy*inv;table[i+2]=inv;table[i+3]=1-shade*Math.min(1,Math.hypot(sx,sy)*.6)**2;
  }
  if(this.rayTables.size>=2)this.rayTables.delete(this.rayTables.keys().next().value);this.rayTables.set(key,table);return table;
 }
 softwarePump(){
  if(this.disposed||this.paused||this.softwareBusy||!this.ctx||!this.pixels||!this.softwareDesired)return;
  const request=this.softwareDesired;if(request.key===this.lastKey)return;
  const now=performance.now(),delay=Math.max(0,(request.moving?45:160)-(now-(this.lastSoftware??-Infinity)));
  if(delay>0){if(!this.softwareTimer)this.softwareTimer=setTimeout(()=>{this.softwareTimer=null;this.softwarePump();},delay);return;}
  if(this.softwareTimer){clearTimeout(this.softwareTimer);this.softwareTimer=null;}
  this.softwareBusy=true;this.lastSoftware=now;request.started=now;
  const [sw,sh]=rasterSize(request.w,request.h,request.moving),rays=this.rayTable(sw,sh,request.w/request.h,request.shade);this.edgeShadeStrength=request.shade;
  if(!this.softwareCanvas)this.softwareCanvas=document.createElement('canvas');
  const canvas=this.softwareCanvas;
  if(canvas.width!==sw||canvas.height!==sh||!this.softwareImage){canvas.width=sw;canvas.height=sh;this.softwareImage=canvas.getContext('2d').createImageData(sw,sh);}
  const image=this.softwareImage,tex=this.pixels,a=request.axes,sample=new Float32Array(3),gamma=this.gamma;
  let row=0;
  const chunk=()=>{
   this.softwareTimer=null;
   if(this.disposed||this.paused||request.epoch!==this.softwareEpoch){this.softwareBusy=false;return;}
   const start=performance.now();
   while(row<sh){
    const y=row++;
    for(let x=0;x<sw;x++){
     const i=(y*sw+x)*4,qx=rays[i],qy=rays[i+1],qz=rays[i+2];
     const px=a.right[0]*qx+a.down[0]*qy-a.forward[0]*qz,py=a.right[1]*qx+a.down[1]*qy-a.forward[1]*qz,pz=a.right[2]*qx+a.down[2]*qy-a.forward[2]*qz;
     const u=Math.atan2(py,px)/TAU+.5,v=.5-Math.asin(clamp(pz,-1,1))/Math.PI;
     samplePanorama(tex,u,v,sample);
     for(let k=0;k<3;k++)image.data[i+k]=gamma[clamp(Math.round(sample[k]*4095/255),0,4095)]*rays[i+3];
     image.data[i+3]=255;
    }
    if(performance.now()-start>3&&row<sh){this.softwareTimer=setTimeout(chunk,0);return;}
   }
   const latest=this.softwareDesired;
   const angle=latest?Math.abs(Math.atan2(Math.sin(latest.a-request.a),Math.cos(latest.a-request.a)))+Math.abs(latest.e-request.e):Infinity;
   if(latest&&latest.w===request.w&&latest.h===request.h&&request.revision>(this.softwareCommitted||0)&&
     (angle<1e-8||(angle<.12&&performance.now()-request.started<300))){
    canvas.getContext('2d').putImageData(image,0,0);this.ctx.drawImage(canvas,0,0,this.canvas.width,this.canvas.height);
    this.lastKey=request.key;this.softwareCommitted=request.revision;this.stats.frames++;
   }
   this.softwareBusy=false;this.softwarePump();
  };
  this.softwareTimer=setTimeout(chunk,0);
 }
 cancelSoftware(){this.softwareEpoch++;clearTimeout(this.softwareTimer);this.softwareTimer=null;this.softwareBusy=false;this.softwareDesired=null;}
 pause(){if(this.paused||this.disposed)return;this.paused=true;this.lastEffect=null;this.cancelSoftware();}
 resume(){if(this.disposed||!this.paused)return;this.paused=false;this.lastEffect=null;this.lastKey='';}
 toPanorama(world){return rotate(rotate(world,this.offset,'z'),Math.PI/6,'x');}
 fromPanorama(p){return rotate(rotate(p,-Math.PI/6,'x'),-this.offset,'z');}
 ray(x,y){const a=this.axesNow,qx=(x/this.w*2-1)*this.w/this.h*this.tanFov,qy=(y/this.h*2-1)*this.tanFov,len=Math.hypot(qx,qy,1);return {x:(a.right[0]*qx+a.down[0]*qy-a.forward[0])/len,y:(a.right[1]*qx+a.down[1]*qy-a.forward[1])/len,z:(a.right[2]*qx+a.down[2]*qy-a.forward[2])/len};}
 project(p){
  const axes=this.panAxes;
  // Preserve direct axes-based use by older tests/integrations.
  if(!axes){const world=this.fromPanorama(p),a=this.axesNow;if(!a)return null;const dot=v=>v[0]*world.x+v[1]*world.y+v[2]*world.z,z=dot(a.forward);if(z>=-.08)return null;return {x:(1+dot(a.right)/(-z*this.tanFov*this.w/this.h))*this.w/2,y:(1+dot(a.down)/(-z*this.tanFov))*this.h/2};}
  const dot=a=>a[0]*p.x+a[1]*p.y+a[2]*p.z,z=dot(axes.forward);if(z>=-.08)return null;
  return {x:(1+dot(axes.right)/(-z*this.tanFov*this.w/this.h))*this.w/2,y:(1+dot(axes.down)/(-z*this.tanFov))*this.h/2};
 }
 decorate(ctx,seconds,options,glow){
  if(!this.axesNow||this.paused||this.disposed)return;
  if(options.twinkle&&!this.gl){
   const stars=root.SolarVisualEffects.starsFor(this,options),pose=this.starPose;
   if(!pose||pose.source!==stars||pose.axes!==this.panAxes||pose.w!==this.w||pose.h!==this.h){
    this.visibleStars=[];
    for(const [x,y,z,r,brightness,phase]of stars){const p=this.project({x,y,z});if(p&&p.x>=0&&p.x<=this.w&&p.y>=0&&p.y<=this.h)this.visibleStars.push([p.x,p.y,r,brightness,phase]);}
    this.starPose={source:stars,axes:this.panAxes,w:this.w,h:this.h};this.stats.starProjections+=stars.length;
   }
   for(const [x,y,r,brightness,phase]of this.visibleStars){if(r<.55){glow(ctx,x,y,Math.max(.18,r*.58),brightness*.56);continue;}const period=5+Math.abs(Math.sin(phase*.754877666))*20,primary=.5+.5*Math.sin(seconds/period*TAU+phase),secondary=.5+.5*Math.sin(seconds/(period*1.618+3)*TAU+phase*.37),irregular=primary*.68+secondary*.32;glow(ctx,x,y,r*.66,brightness*(.62+.30*irregular));}
  }
  if(!options.comets){this.comet=null;this.nextComet=Math.max(this.nextComet,seconds+15);return;}
  if(seconds<this.lastTime){this.nextComet=seconds+20;this.comet=null;}this.lastTime=seconds;
  if(!this.comet&&seconds>=this.nextComet){
   const left=this.random()<.5,sy=this.h*(.12+this.random()*.28),ey=this.h*(.20+this.random()*.32);
   const bend=(this.random()<.5?-1:1)*this.h*(.19+this.random()*.16),direction=left?1:-1,x0=left?-this.w*.08:this.w*1.08,x1=left?this.w*1.08:-this.w*.08;
   const controlY=y=>clamp(y,this.h*.04,this.h*.76),point=(x,y)=>this.toPanorama(this.ray(x,y));
   this.comet={start:point(x0,sy),control1:point(x0+direction*this.w*.36,controlY(sy+bend)),control2:point(x1-direction*this.w*.36,controlY(ey+bend)),end:point(x1,ey),time:seconds,duration:11+this.random()*7};
   this.nextComet=seconds+50+this.random()*100;
  }
  if(!this.comet)return;const k=this.comet,t=(seconds-k.time)/k.duration;if(t>=1){this.comet=null;return;}if(t<0)return;
  const head=this.project(cometPoint(k,t));if(!head)return;const life=Math.sin(t*Math.PI)**.7;
  drawCometRibbon(ctx,cometTail(k,t,p=>this.project(p)),life*.9);
  ctx.save();ctx.globalAlpha=life*.7;glow(ctx,head.x,head.y,.90,.56);ctx.restore();
 }
 dispose(){
  if(this.disposed)return;this.disposed=true;this.initTicket++;this.cancelSoftware();this.abort.abort();
  const g=this.gl;this.releaseGPU();this.gl=null;if(g)g.getExtension('WEBGL_lose_context')?.loseContext();
  this.image=this.pixels=this.softwareImage=this.softwareCanvas=this.gamma=null;this.comet=null;this.visibleStars=[];this.rayTables.clear();
 }
}
Sky.cometPoint=cometPoint;Sky.cometTail=cometTail;Sky.drawCometRibbon=drawCometRibbon;Sky.samplePanorama=samplePanorama;Sky.rasterSize=rasterSize;root.SolarSky=Sky;
})(window);
