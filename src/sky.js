/* Seamless celestial sphere. Camera rotation and decorative drift are independent
   of physical planetary time. Panorama/galaxies are artistic, not a star catalogue. */
(function(root){'use strict';
const TAU=Math.PI*2,DRIFT=.22*Math.PI/180;
// WebGL LINEAR-equivalent pixel-centre sampling for the software path. Wrap
// longitude *per texel*, including the neighbour across the -pi/+pi meridian.
// Latitude clamps to the single-colour poles baked in the panorama.
function samplePanorama(tex,u,v,out,index=0){
 const w=tex.width,h=tex.height,tx=((u%1+1)%1)*w-.5,ty=Math.max(0,Math.min(h-1,v*h-.5));
 const ix=Math.floor(tx),y0=Math.floor(ty),x0=(ix%w+w)%w,x1=(x0+1)%w,y1=Math.min(h-1,y0+1),fx=tx-ix,fy=ty-y0;
 const a=(y0*w+x0)*4,b=(y0*w+x1)*4,c=(y1*w+x0)*4,d=(y1*w+x1)*4;
 const wa=(1-fx)*(1-fy),wb=fx*(1-fy),wc=(1-fx)*fy,wd=fx*fy,data=tex.data;
 for(let k=0;k<3;k++)out[index+k]=data[a+k]*wa+data[b+k]*wb+data[c+k]*wc+data[d+k]*wd;
}
function cometPoint(path,t){
 const f=Math.max(0,Math.min(1,t)),u=1-f;
 const q={};for(const a of ['x','y','z'])q[a]=u*u*u*path.start[a]+3*u*u*f*path.control1[a]+3*u*f*f*path.control2[a]+f*f*f*path.end[a];
 const n=Math.hypot(q.x,q.y,q.z)||1;return {x:q.x/n,y:q.y/n,z:q.z/n};
}
// A tail is a single feathered ribbon, never individually round-capped dashes.
function cometTail(path,t,project,samples=96){
 const points=[];const start=Math.max(0,t-.115);
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
 const length=points.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-points[i].x,p.y-points[i].y),0);
 if(length<.1)return;
 const normals=points.map((point,i)=>{
  const a=points[Math.max(0,i-1)],b=points[Math.min(count-1,i+1)],d=Math.hypot(b.x-a.x,b.y-a.y)||1;
  return {x:-(b.y-a.y)/d,y:(b.x-a.x)/d};
 });
 ctx.save();ctx.globalCompositeOperation='screen';ctx.setLineDash([]);
 // Nested, continuous ribbons supply soft transverse edges without a heavy blur.
 for(const [width,alpha] of [[5.2,.035],[3.6,.055],[2.3,.08],[1.25,.13],[.48,.21]]){
  const gradient=ctx.createLinearGradient(first.x,first.y,last.x,last.y);
  gradient.addColorStop(0,'rgba(143,178,208,0)');
  gradient.addColorStop(.28,`rgba(149,184,212,${alpha*.15*opacity})`);
  gradient.addColorStop(.72,`rgba(176,209,232,${alpha*.64*opacity})`);
  gradient.addColorStop(1,`rgba(229,240,249,${alpha*opacity})`);
  ctx.fillStyle=gradient;ctx.beginPath();
  for(let side=0;side<2;side++)for(let j=0;j<count;j++){
   const i=side?count-1-j:j,f=i/(count-1),p=points[i],n=normals[i];
   const envelope=Math.sin(Math.PI*Math.pow(f,.65))*.78+.12*f;
   const offset=width*envelope*(side?-1:1);
   const x=p.x+n.x*offset,y=p.y+n.y*offset;
   if(!side&&!j)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  ctx.closePath();ctx.fill();
 }
 ctx.restore();
}
function rand(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function shader(g,type,source){const s=g.createShader(type);g.shaderSource(s,source);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(s));return s;}
function rotate(p,angle,axis){const c=Math.cos(angle),s=Math.sin(angle);return axis==='z'?{x:p.x*c-p.y*s,y:p.x*s+p.y*c,z:p.z}:{x:p.x,y:p.y*c-p.z*s,z:p.y*s+p.z*c};}
class Sky{
 constructor(canvas){
  this.canvas=canvas;this.ready=false;this.disposed=false;this.abort=new AbortController();this.gl=null;this.stats={backend:'loading',frames:0};this.random=rand(610639);this.comet=null;this.nextComet=18+this.random()*22;this.lastTime=0;
  this.offset=0;this.lastEffect=null;this.tanFov=Math.tan(38*Math.PI/180);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.ready=false;this.stats.backend='context-lost';},{signal:this.abort.signal});
  canvas.addEventListener('webglcontextrestored',()=>{if(!this.disposed)this.initialize();},{signal:this.abort.signal});
  this.initialize();
 }
 async initialize(){
  const image=new Image();image.src=root.SolarAssets.sky;
  try{await image.decode();if(this.disposed)return;this.image=image;
   const g=this.canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:true});if(!g)throw Error('WebGL unavailable');this.gl=g;
   const vs=shader(g,g.VERTEX_SHADER,'attribute vec2 a;varying vec2 p;void main(){p=a;gl_Position=vec4(a,0.,1.);}');
   const fs=shader(g,g.FRAGMENT_SHADER,`precision highp float;varying vec2 p;uniform sampler2D sky;uniform vec3 right,down,forward;uniform vec2 size;uniform float drift,fov;
    void main(){vec3 ray=normalize(vec3(p.x*size.x/size.y*fov,-p.y*fov,-1.));vec3 q=right*ray.x+down*ray.y+forward*ray.z;
    float cs=cos(drift),sn=sin(drift);q=vec3(q.x*cs-q.y*sn,q.x*sn+q.y*cs,q.z);
    q=normalize(vec3(q.x,q.y*.866025403784-q.z*.5,q.y*.5+q.z*.866025403784));
    float longitude=length(q.xy)>0.0000001?atan(q.y,q.x):0.;
    vec2 uv=vec2(fract(longitude/6.28318530718+.5),.5-asin(clamp(q.z,-1.,1.))/3.14159265359);
    vec3 col=texture2D(sky,uv).rgb;float vignette=1.-.24*pow(clamp(length(p)*.6,0.,1.),2.);
    col=pow(col,vec3(.95))*.67*vignette;gl_FragColor=vec4(col,1.);}`);
   this.program=g.createProgram();g.attachShader(this.program,vs);g.attachShader(this.program,fs);g.linkProgram(this.program);g.deleteShader(vs);g.deleteShader(fs);if(!g.getProgramParameter(this.program,g.LINK_STATUS))throw Error(g.getProgramInfoLog(this.program));
   this.buffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,this.buffer);g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),g.STATIC_DRAW);
   this.texture=g.createTexture();g.bindTexture(g.TEXTURE_2D,this.texture);g.texImage2D(g.TEXTURE_2D,0,g.RGB,g.RGB,g.UNSIGNED_BYTE,image);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.REPEAT);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);
   this.u=Object.fromEntries(['right','down','forward','size','drift','fov','sky'].map(k=>[k,g.getUniformLocation(this.program,k)]));this.stats.backend='gpu';this.ready=true;
  }catch(error){if(this.disposed)return;this.stats.error=error.message;this.stats.backend='compatibility';this.ready=!!this.image;
   // A small spherical software raster is used only when WebGL is unavailable.
   if(!this.gl){this.ctx=this.canvas.getContext('2d');const c=document.createElement('canvas');c.width=this.image?.width||1;c.height=this.image?.height||1;if(this.image){const cx=c.getContext('2d');cx.drawImage(this.image,0,0);this.pixels=cx.getImageData(0,0,c.width,c.height);}}
  }
 }
 resize(w,h,dpr){this.w=w;this.h=h;this.canvas.width=Math.max(1,Math.round(w*Math.min(dpr,1.5)));this.canvas.height=Math.max(1,Math.round(h*Math.min(dpr,1.5)));this.lastKey='';}
 axes(camera){const a=camera.azimuth,e=camera.elevation,c=Math.cos(a),s=Math.sin(a),ce=Math.cos(e),se=Math.sin(e);return {right:[c,-s,0],down:[-s*se,-c*se,-ce],forward:[-s*ce,-c*ce,se]};}
 draw(seconds,camera,options){
  if(this.lastEffect!==null&&options.skyMotion)this.offset=(this.offset+Math.max(0,seconds-this.lastEffect)*DRIFT)%TAU;this.lastEffect=seconds;
  this.camera=camera;this.axesNow=this.axes(camera);if(!this.ready||this.disposed)return;
  const key=[this.offset,camera.azimuth,camera.elevation,this.w,this.h].join(':');
  if(!this.gl){
    const now=performance.now(),angleKey=[camera.azimuth,camera.elevation].join(':');
    if(this.lastCameraKey!==angleKey)this.cameraMotionAt=now;this.lastCameraKey=angleKey;
    this.softwareDesired={key:key+':'+(now-this.cameraMotionAt<180?'320':'512'),geometry:[camera.azimuth,camera.elevation,this.w,this.h].join(':'),
      revision:(this.softwareRevision=(this.softwareRevision||0)+1),azimuth:camera.azimuth,elevation:camera.elevation,
      moving:now-this.cameraMotionAt<180,axes:this.axesNow,offset:this.offset,w:this.w,h:this.h};
    this.softwarePump();return;
  }
  if(key===this.lastKey)return;this.lastKey=key;
  if(this.gl){const g=this.gl;g.viewport(0,0,this.canvas.width,this.canvas.height);g.useProgram(this.program);g.bindBuffer(g.ARRAY_BUFFER,this.buffer);const a=g.getAttribLocation(this.program,'a');g.enableVertexAttribArray(a);g.vertexAttribPointer(a,2,g.FLOAT,false,0,0);
   for(const k of ['right','down','forward'])g.uniform3fv(this.u[k],this.axesNow[k]);g.uniform2f(this.u.size,this.w,this.h);g.uniform1f(this.u.drift,this.offset);g.uniform1f(this.u.fov,this.tanFov);g.uniform1i(this.u.sky,0);g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,this.texture);g.drawArrays(g.TRIANGLES,0,6);
  }this.stats.frames++;
 }
 softwarePump(){
  if(this.disposed||this.softwareBusy||!this.ctx||!this.pixels||!this.softwareDesired)return;
  const request=this.softwareDesired;
  if(request.key===this.lastKey)return;
  const delay=Math.max(0,(request.moving?45:160)-(performance.now()-(this.lastSoftware||-Infinity)));
  if(delay>0){if(!this.softwareTimer)this.softwareTimer=setTimeout(()=>{this.softwareTimer=null;this.softwarePump();},delay);return;}
  this.softwareBusy=true;this.lastSoftware=performance.now();
  const sw=request.moving?320:512,sh=Math.max(1,Math.round(sw*request.h/request.w));
  request.started=performance.now();
  if(!this.softwareCanvas)this.softwareCanvas=document.createElement('canvas');
  const canvas=this.softwareCanvas;
  if(canvas.width!==sw||canvas.height!==sh){canvas.width=sw;canvas.height=sh;this.softwareImage=canvas.getContext('2d').createImageData(sw,sh);}
  const image=this.softwareImage,tex=this.pixels,a=request.axes,fov=this.tanFov,sample=new Float32Array(3);
  const cs=Math.cos(request.offset),sn=Math.sin(request.offset),aspect=request.w/request.h;
  let row=0;
  const chunk=()=>{
    this.softwareTimer=null;if(this.disposed){this.softwareBusy=false;return;}
    const start=performance.now();
    while(row<sh){
      const y=row++,qy=((y+.5)/sh*2-1)*fov;
      for(let x=0;x<sw;x++){
        const qx=((x+.5)/sw*2-1)*aspect*fov,len=Math.hypot(qx,qy,1);
        const wx=(a.right[0]*qx+a.down[0]*qy-a.forward[0])/len,wy=(a.right[1]*qx+a.down[1]*qy-a.forward[1])/len,wz=(a.right[2]*qx+a.down[2]*qy-a.forward[2])/len;
        const px=wx*cs-wy*sn,ty=wx*sn+wy*cs,py=ty*.86602540378-wz*.5,pz=ty*.5+wz*.86602540378;
        const u=(Math.atan2(py,px)/TAU+1.5)%1,v=.5-Math.asin(Math.max(-1,Math.min(1,pz)))/Math.PI;
        const i=(y*sw+x)*4;
        samplePanorama(tex,u,v,sample);
        const pxScreen=(x+.5)/sw*2-1,pyScreen=(y+.5)/sh*2-1;
        const vignette=1-.24*Math.min(1,Math.hypot(pxScreen,pyScreen)*.6)**2;
        for(let channel=0;channel<3;channel++)image.data[i+channel]=Math.pow(sample[channel]/255,.95)*255*.67*vignette;
        image.data[i+3]=255;
      }
      if(performance.now()-start>5&&row<sh){this.softwareTimer=setTimeout(chunk,0);return;}
    }
    const latest=this.softwareDesired;
    const angle=latest?Math.abs(Math.atan2(Math.sin(latest.azimuth-request.azimuth),Math.cos(latest.azimuth-request.azimuth)))+Math.abs(latest.elevation-request.elevation):Infinity;
    // Software presentation permits a bounded older pose, but never regresses to
    // an older completed job or a resized/disposed owner. Exact-pose-only commit
    // starved every frame during a smooth camera move and then snapped at its end.
    if(latest&&latest.w===request.w&&latest.h===request.h&&request.revision>(this.softwareCommitted||0)&&
      (latest.geometry===request.geometry||(angle<.7&&performance.now()-request.started<300))){
      canvas.getContext('2d').putImageData(image,0,0);this.ctx.drawImage(canvas,0,0,this.canvas.width,this.canvas.height);
      this.lastKey=request.key;this.softwareCommitted=request.revision;this.stats.frames++;
    }
    this.softwareBusy=false;this.softwarePump();
  };
  this.softwareTimer=setTimeout(chunk,0);
 }

 toPanorama(world){return rotate(rotate(world,this.offset,'z'),Math.PI/6,'x');}
 fromPanorama(p){return rotate(rotate(p,-Math.PI/6,'x'),-this.offset,'z');}
 ray(x,y){const a=this.axesNow,qx=(x/this.w*2-1)*this.w/this.h*this.tanFov,qy=(y/this.h*2-1)*this.tanFov,len=Math.hypot(qx,qy,1);return {x:(a.right[0]*qx+a.down[0]*qy-a.forward[0])/len,y:(a.right[1]*qx+a.down[1]*qy-a.forward[1])/len,z:(a.right[2]*qx+a.down[2]*qy-a.forward[2])/len};}
 project(p){const world=this.fromPanorama(p),axes=this.axesNow;const dot=a=>a[0]*world.x+a[1]*world.y+a[2]*world.z,z=dot(axes.forward);if(z>=-.08)return null;return {x:(1+dot(axes.right)/(-z*this.tanFov*this.w/this.h))*this.w/2,y:(1+dot(axes.down)/(-z*this.tanFov))*this.h/2};}
 decorate(ctx,seconds,options,glow){
  if(!this.axesNow)return;
  if(options.twinkle)for(const [x,y,z,r,brightness,phase] of root.SolarAssets.stars){const p=this.project({x,y,z});if(!p||p.x<0||p.x>this.w||p.y<0||p.y>this.h)continue;const period=6+phase,t=((seconds+phase)%period)/period,pulse=Math.max(0,Math.sin(t*TAU))**16;glow(ctx,p.x,p.y,r*.8,brightness*(.32+pulse*.75));}
  if(!options.comets){this.comet=null;this.nextComet=Math.max(this.nextComet,seconds+15);return;}
  if(seconds<this.lastTime){this.nextComet=seconds+20;this.comet=null;}this.lastTime=seconds;
  if(!this.comet&&seconds>=this.nextComet){
   const left=this.random()<.5,sy=this.h*(.12+this.random()*.28),ey=this.h*(.20+this.random()*.32);
   const bend=(this.random()<.5?-1:1)*this.h*(.19+this.random()*.16);
   const direction=left?1:-1,x0=left?-this.w*.08:this.w*1.08,x1=left?this.w*1.08:-this.w*.08;
   const controlY=y=>Math.max(this.h*.04,Math.min(this.h*.76,y));
   const point=(x,y)=>this.toPanorama(this.ray(x,y));
   this.comet={start:point(x0,sy),control1:point(x0+direction*this.w*.36,controlY(sy+bend)),control2:point(x1-direction*this.w*.36,controlY(ey+bend)),end:point(x1,ey),time:seconds,duration:11+this.random()*7};
   this.nextComet=seconds+50+this.random()*100;
  }
  if(!this.comet)return;const k=this.comet,t=(seconds-k.time)/k.duration;if(t>=1){this.comet=null;return;}if(t<0)return;
  // World-space cubic arc with a fully continuous, feathered dust ribbon.
  const head=this.project(cometPoint(k,t));if(!head)return;
  const life=Math.sin(t*Math.PI)**.7;
  drawCometRibbon(ctx,cometTail(k,t,p=>this.project(p)),life*.9);
  ctx.save();ctx.globalAlpha=life*.7;glow(ctx,head.x,head.y,.90,.56);ctx.restore();

 }
 dispose(){this.disposed=true;clearTimeout(this.softwareTimer);this.softwareTimer=null;this.softwareDesired=null;this.softwareImage=null;this.softwareCanvas=null;this.abort.abort();if(this.gl){this.gl.deleteTexture(this.texture);this.gl.deleteBuffer(this.buffer);this.gl.deleteProgram(this.program);this.gl.getExtension('WEBGL_lose_context')?.loseContext();}this.image=null;this.pixels=null;this.comet=null;}
}
Sky.cometPoint=cometPoint;Sky.cometTail=cometTail;Sky.drawCometRibbon=drawCometRibbon;Sky.samplePanorama=samplePanorama;root.SolarSky=Sky;
})(window);
