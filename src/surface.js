/* Solar Time v0.47 — surface implementation owner. */
(function(root){
'use strict';
const STYLE=root.SolarSurfaceStyle;
if(!STYLE)throw Error('surface-style.js must load before surface.js');
function surfaceKernel(style){
  const sun=style.sun;
  let assets={};
  const TAU=Math.PI*2,clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),smooth=(a,b,n)=>{const t=clamp((n-a)/(b-a),0,1);return t*t*(3-2*t);};
  const setAssets=value=>{if(value)assets=value;};
  function dataBlob(url){const [meta,data]=url.split(','),raw=atob(data),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return new Blob([bytes],{type:meta.split(':')[1].split(';')[0]});}
  function sourceFor(asset,width){
    if(typeof asset==='string')return {url:asset,fallback:'',key:asset};
    const tiers=asset?.tiers||[],tier=tiers.find(row=>row.width>=width)||tiers[tiers.length-1];if(!tier)return null;
    const remote=asset.base?new URL(tier.path,asset.base).href:'',url=remote||asset.fallback;
    return {url,fallback:remote&&asset.fallback!==remote?asset.fallback:'',key:url+'|'+(remote?asset.fallback:''),seamBaked:!!asset.seamBaked};
  }
  async function bitmapFor(source,width=null,height=null){
    const resize=width&&height?{resizeWidth:width,resizeHeight:height,resizeQuality:'high'}:{};
    let lastError;
    for(const url of [source.url,source.fallback].filter(Boolean))try{
      if(url.startsWith('data:'))return await createImageBitmap(dataBlob(url),resize);
      if(!url.startsWith('file:')){const response=await fetch(url,{mode:'cors',credentials:'omit',cache:'force-cache'});if(!response.ok)throw Error('HTTP '+response.status);return await createImageBitmap(await response.blob(),resize);}
      if(typeof document==='object'){const image=new Image();image.decoding='async';image.src=url;await image.decode();return await createImageBitmap(image,resize);}
    }catch(error){lastError=error;}
    throw lastError||Error('Material asset could not be decoded.');
  }
  function makeCanvas(n){const c=typeof OffscreenCanvas==='function'?new OffscreenCanvas(n,n):document.createElement('canvas');c.width=c.height=n;return c;}
  function materialCanvas(bitmap,w,h,readPixels=false,seamBaked=false){
    const c=makeCanvas(w);c.height=h;const ctx=c.getContext('2d',{willReadFrequently:readPixels});ctx.drawImage(bitmap,0,0,w,h);
    if(!seamBaked){
    const band=Math.max(style.seam.minBand,Math.min(style.seam.maxBand,Math.round(w*style.seam.ratio))),left=ctx.getImageData(0,0,band,h),right=ctx.getImageData(w-band,0,band,h);
    for(let y=0;y<h;y++)for(let x=0;x<band;x++){
      const t=1-x/(band-1),weight=t*t*(3-2*t),a=(y*band+x)*4,b=(y*band+band-1-x)*4;
      for(let k=0;k<4;k++){const lv=left.data[a+k],rv=right.data[b+k],middle=(lv+rv)*.5;left.data[a+k]=lv+(middle-lv)*weight;right.data[b+k]=rv+(middle-rv)*weight;}
    }
    ctx.putImageData(left,0,0);ctx.putImageData(right,w-band,0);
    }
    return {canvas:c,image:readPixels?ctx.getImageData(0,0,w,h):null};
  }
  function compile(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error(error);}return s;}
  const vertex=`attribute vec2 a; varying vec2 p; void main(){p=a;gl_Position=vec4(a,0.,1.);}`;
  const fragment=`precision highp float;
    varying vec2 p; uniform sampler2D colorMap; uniform sampler2D bumpMap; uniform sampler2D cloudsMap;
    uniform vec3 axisU,axisV,pole,light; uniform float phase,kind,hasBump,diameter,texel,effectTime,sunActivity;
    const float PI=3.141592653589793;
    vec3 world(vec3 q){return axisU*q.x+axisV*q.y+pole*q.z;}
    void main(){
      float rr=dot(p,p); if(rr>=1.){gl_FragColor=vec4(0.);return;}
      vec3 n=vec3(p.x,-p.y,sqrt(1.-rr));
      vec3 local=vec3(dot(n,axisU),dot(n,axisV),dot(n,pole));
      float angle=atan(local.y,local.x),latitude=asin(clamp(local.z,-1.,1.));
      vec2 uv=vec2(fract((angle+PI)/(2.*PI)-phase),.5-latitude/PI);
      ${style.warpGLSL}
      vec3 base=texture2D(colorMap,uv).rgb;
      if(kind==4.){
        float band=.5+.5*sin(latitude*18.+sin(latitude*4.)*.45);
        float haze=pow(max(0.,1.-abs(local.z)),2.);
        base*=.985+(band-.5)*.026;
        base+=vec3(.004,.012,.014)*haze;
      }
      vec3 normal=n;
      if(hasBump>.5){
        float dx=texture2D(bumpMap,uv+vec2(texel,0.)).r-texture2D(bumpMap,uv-vec2(texel,0.)).r;
        float dy=texture2D(bumpMap,uv+vec2(0.,texel*2.)).r-texture2D(bumpMap,uv-vec2(0.,texel*2.)).r;
        vec3 east=world(vec3(-sin(angle),cos(angle),0.));
        vec3 north=world(vec3(-sin(latitude)*cos(angle),-sin(latitude)*sin(angle),cos(latitude)));
        normal=normalize(n-east*dx*7.+north*dy*7.);
      }
      float mu=dot(normal,light),day=max(mu,0.);
      vec3 col=base*(.115+day*.98);
      if(kind==1.){
        float cloud=texture2D(cloudsMap,uv).r*.50;
        col=mix(col,vec3(.94,.965,1.)*(.14+day*.93),cloud);
        float ocean=smoothstep(.035,.14,base.b-base.r)*step(base.r,base.b)*step(base.g,base.b);
        vec3 halfdir=normalize(light+vec3(0.,0.,1.));
        col+=vec3(.63,.76,.85)*pow(max(0.,dot(n,halfdir)),70.)*day*ocean*.38;
        float rim=pow(1.-n.z,4.)*(.05+.8*day);
        col+=vec3(.075,.36,.72)*rim;
        col=mix(col,vec3(.065,.16,.32),pow(1.-n.z,6.)*.17);
      }else if(kind==2.){
      ${style.lightingGLSL}
      }else if(kind==3.||kind==4.){
        col+=vec3(.18,.26,.33)*pow(1.-n.z,5.)*day*.16;
      }
      float alpha=clamp((1.-sqrt(rr))*diameter,0.,1.);
      gl_FragColor=vec4(col,alpha);
    }`;
  class Engine{
    constructor({gpu=true}={}){
      this.disposed=false;this.canvas=makeCanvas(32);this.stats={renders:0,texturesBuilt:0,mapsBuilt:0,backend:'cpu'};this.mapPixels=0;this.textures=new Map();this.cpuMaps=new Map();this.gl=null;
      try{
        if(!gpu)throw Error('CPU compatibility adapter');
        const g=this.canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false,preserveDrawingBuffer:true});
        if(!g)throw Error('WebGL unavailable');this.gl=g;
        const vs=compile(g,g.VERTEX_SHADER,vertex),fs=compile(g,g.FRAGMENT_SHADER,fragment),program=g.createProgram();g.attachShader(program,vs);g.attachShader(program,fs);g.linkProgram(program);g.deleteShader(vs);g.deleteShader(fs);
        if(!g.getProgramParameter(program,g.LINK_STATUS))throw Error(g.getProgramInfoLog(program));this.program=program;
        this.buffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,this.buffer);g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),g.STATIC_DRAW);
        this.attribute=g.getAttribLocation(program,'a');
        this.uniforms=Object.fromEntries(['colorMap','bumpMap','cloudsMap','axisU','axisV','pole','light','phase','kind','hasBump','diameter','texel','effectTime','sunActivity'].map(k=>[k,g.getUniformLocation(program,k)]));this.stats.backend='gpu';
      }catch(error){if(this.gl){this.gl.getExtension('WEBGL_lose_context')?.loseContext();this.gl=null;}this.canvas=makeCanvas(32);this.ctx=this.canvas.getContext('2d');this.stats.fallback=error.message;}
    }
    async texture(id,width){
      const asset=assets[id]||assets.moon,source=sourceFor(asset,width);if(!source)throw Error('Material asset missing: '+id);
      const key=id+':'+width;let t=this.textures.get(key);if(t&&t.source!==source.key){if(this.gl)this.gl.deleteTexture(t.handle);this.textures.delete(key);t=null;}if(t){this.textures.delete(key);this.textures.set(key,t);return t;}
      const bitmap=await bitmapFor(source,width,width/2);
      if(this.disposed){bitmap.close();throw Error('Surface disposed');}
      const prepared=materialCanvas(bitmap,width,width/2,!this.gl,source.seamBaked);bitmap.close();
      if(this.gl){
        const g=this.gl,handle=g.createTexture();g.bindTexture(g.TEXTURE_2D,handle);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,prepared.canvas);
        g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.REPEAT);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);
        // atan/fract crosses longitude 0/1. Implicit mip derivatives there
        // selected a very blurred mip strip; bilinear base-level sampling avoids it.
        g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);
        t={handle,width,height:width/2};
      }else{
        t={width,height:width/2,data:prepared.image.data};
      }
      t.source=source.key;this.textures.set(key,t);this.stats.texturesBuilt++;
      // Bounded by pixels, not the number of times a body was visited.
      while(this.texturePixels>4096*2048*4&&this.textures.size>3){const oldest=this.textures.keys().next().value;const old=this.textures.get(oldest);if(this.gl)this.gl.deleteTexture(old.handle);this.textures.delete(oldest);}
      return t;
    }
    get texturePixels(){let n=0;for(const t of this.textures.values())n+=t.width*t.height;return n;}
    cpuMap(job,n){
      const {frame}=job,key=[n,...frame.u,...frame.v,...frame.pole].join(':');let map=this.cpuMaps.get(key);
      if(map){this.cpuMaps.delete(key);this.cpuMaps.set(key,map);return map;}
      const data=new Float32Array(n*n*7);let used=0;
      for(let y=0;y<n;y++)for(let x=0;x<n;x++){
        const nx=(x+.5)/n*2-1,ny=(y+.5)/n*2-1,rr=nx*nx+ny*ny;if(rr>=1)continue;
        const nz=Math.sqrt(1-rr),dot=a=>a[0]*nx+a[1]*ny+a[2]*nz;
        data[used++]=(y*n+x)*4;data[used++]=nx;data[used++]=ny;data[used++]=nz;
        data[used++]=(Math.atan2(dot(frame.v,nx,ny,nz),dot(frame.u,nx,ny,nz))+Math.PI)/TAU;
        data[used++]=Math.acos(clamp(dot(frame.pole),-1,1))/Math.PI;data[used++]=clamp((1-Math.sqrt(rr))*n,0,1)*255;
      }
      map=data.subarray(0,used);const budget=1024*1024+384*384*4;
      while(this.mapPixels+n*n>budget&&this.cpuMaps.size){const k=this.cpuMaps.keys().next().value;this.mapPixels-=this.cpuMaps.get(k).buffer.byteLength/28;this.cpuMaps.delete(k);}
      this.cpuMaps.set(key,map);this.mapPixels+=n*n;this.stats.mapsBuilt++;return map;
    }
    async render(job){
      if(this.disposed)throw Error('Surface disposed');
      if(this.gl?.isContextLost())throw Error('WebGL context lost');
      const {id,frame,phase,light,seconds=0,activity=false}=job;const n=this.gl?Math.min(1024,job.diam):Math.min(768,job.diam);
      const width=this.gl?job.textureWidth:Math.min(4096,job.textureWidth);
      const color=await this.texture(id,width),bump=assets[id+'-relief']?await this.texture(id+'-relief',width):color;
      const clouds=id==='earth'?await this.texture('clouds',Math.min(2048,width)):color;
      if(this.canvas.width!==n){this.canvas.width=this.canvas.height=n;}
      if(this.gl?.isContextLost())throw Error('WebGL context lost');
      if(this.gl){
        const g=this.gl,u=this.uniforms;g.viewport(0,0,n,n);g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT);g.useProgram(this.program);g.bindBuffer(g.ARRAY_BUFFER,this.buffer);
        const a=this.attribute;g.enableVertexAttribArray(a);g.vertexAttribPointer(a,2,g.FLOAT,false,0,0);
        for(const [i,t,name] of [[0,color,'colorMap'],[1,bump,'bumpMap'],[2,clouds,'cloudsMap']]){g.activeTexture(g.TEXTURE0+i);g.bindTexture(g.TEXTURE_2D,t.handle);g.uniform1i(u[name],i);}
        g.uniform3fv(u.axisU,frame.u);g.uniform3fv(u.axisV,frame.v);g.uniform3fv(u.pole,frame.pole);g.uniform3fv(u.light,light);
        g.uniform1f(u.phase,phase);g.uniform1f(u.kind,id==='earth'?1:id==='sun'?2:id==='uranus'?4:['jupiter','saturn','venus','neptune'].includes(id)?3:0);
        g.uniform1f(u.hasBump,bump!==color?1:0);g.uniform1f(u.diameter,n);g.uniform1f(u.texel,1/width);g.uniform1f(u.effectTime,seconds);g.uniform1f(u.sunActivity,activity?1:0);g.drawArrays(g.TRIANGLES,0,6);
        if(g.isContextLost())throw Error('WebGL context lost');
      }else{
        // Identical UV geometry, cooperatively rasterized when GPU is disabled.
        // Cached inverse spherical map prevents per-frame atan/acos work.
        const map=this.cpuMap(job,n);
        const im=this.ctx.createImageData(n,n),data=im.data,tex=color.data,w=color.width,h=color.height;
        let sliceStart=performance.now();
        for(let m=0;m<map.length;m+=7){
          const i=map[m],nx=map[m+1],ny=map[m+2],nz=map[m+3];let u=(map[m+4]-phase+2)%1,v=map[m+5];
          if(id==='sun'&&activity){const crawl=seconds*sun.crawl,wx=Math.sin(v*sun.warpY+Math.sin(u*Math.PI*sun.warpX+crawl)*1.7+crawl)*sun.warpAmountX,wy=Math.sin(u*Math.PI*sun.warpX2-Math.sin(v*sun.warpY2-crawl*.8)+crawl*.7)*sun.warpAmountY;u=(u+wx+1)%1;v=clamp(v+wy,.001,.999);}
          const tx=u*w-.5,ty=clamp(v*h-.5,0,h-1),ix=Math.floor(tx),y0=Math.floor(ty),fx=tx-ix,fy=ty-y0,x0=(ix+w)%w,x1=(x0+1)%w,y1=Math.min(h-1,y0+1);
          const a=(y0*w+x0)*4,b=(y0*w+x1)*4,c=(y1*w+x0)*4,d=(y1*w+x1)*4;
          const wa=(1-fx)*(1-fy),wb=fx*(1-fy),wc=(1-fx)*fy,wd=fx*fy;
          const day=Math.max(0,nx*light[0]+ny*light[1]+nz*light[2]);
          const lit=id==='sun'?1.05+.45*Math.sqrt(nz):.115+.98*day;
          for(let k=0;k<3;k++)data[i+k]=(tex[a+k]*wa+tex[b+k]*wb+tex[c+k]*wc+tex[d+k]*wd)*lit;
          if(id==='uranus'){
            const latitude=(.5-v)*Math.PI,band=.5+.5*Math.sin(latitude*18+Math.sin(latitude*4)*.45),haze=(1-Math.abs(Math.sin(latitude)))**2;
            data[i]=data[i]*(.985+(band-.5)*.026)+255*.004*haze*lit;data[i+1]=data[i+1]*(.985+(band-.5)*.026)+255*.012*haze*lit;data[i+2]=data[i+2]*(.985+(band-.5)*.026)+255*.014*haze*lit;
          }
          if(id==='sun'&&activity){
            const lum=(data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722)/(255*lit);
            const bright=smooth(.46,.72,lum),dark=1-smooth(.22,.35,lum);
            const waveA=Math.sin(u*Math.PI*sun.waveX+v*sun.waveY+seconds*.73),waveB=Math.sin(u*Math.PI*sun.waveX2-v*sun.waveY2-seconds*.41);
            const brightCycle=.5+.5*(waveA*.62+waveB*.38),darkCycle=.5+.5*(waveA*.32-waveB*.68);
            const gain=1+bright*(sun.brightBase+sun.brightAmount*brightCycle)+dark*(sun.darkBase+sun.darkAmount*darkCycle),facing=.4+.6*Math.sqrt(nz);
            data[i]=data[i]*gain+255*sun.glow[0]*bright*brightCycle*facing;
            data[i+1]=data[i+1]*gain+255*sun.glow[1]*bright*brightCycle*facing;
            data[i+2]=data[i+2]*gain+255*sun.glow[2]*bright*brightCycle*facing;
          }
          if(id==='earth'){
            const ci=(Math.min(clouds.height-1,Math.floor(v*clouds.height))*clouds.width+Math.floor(u*clouds.width))*4,cover=clouds.data[ci]/255*.50;
            const rim=(1-nz)**4*(.05+.8*day);
            data[i]=data[i]*(1-cover)+240*(.14+.93*day)*cover+19*rim;
            data[i+1]=data[i+1]*(1-cover)+246*(.14+.93*day)*cover+92*rim;
            data[i+2]=data[i+2]*(1-cover)+255*(.14+.93*day)*cover+184*rim;
          }
          data[i+3]=map[m+6];
          if((m/7)%8192===0&&performance.now()-sliceStart>6){await new Promise(resolve=>setTimeout(resolve,0));if(this.disposed)throw Error('Surface disposed');sliceStart=performance.now();}
        }
        this.ctx.putImageData(im,0,0);
      }
      this.stats.renders++;return this.canvas;
    }
    clear(){this.disposed=true;if(this.gl){for(const t of this.textures.values())this.gl.deleteTexture(t.handle);this.gl.deleteBuffer(this.buffer);this.gl.deleteProgram(this.program);this.gl.getExtension('WEBGL_lose_context')?.loseContext();}this.textures.clear();this.cpuMaps.clear();this.mapPixels=0;}
  }
  return {Engine,setAssets,sourceFor,materialCanvas,bitmapFor,shaderSources:{vertex,fragment}};
}
const materialSource=surfaceKernel(STYLE);
class SurfaceService{
  constructor({worker=true}={}){
    this.frames=new Map();this.desired=new Map();this.pending=null;this.inflight=false;this.disposed=false;
    this.epoch=0;this.revision=0;this.worker=null;this.sync=null;this.timer=null;this.assetsSent=false;this.batch=null;this.paused=false;
    this.stats={backend:'compatibility',submitted:0,accepted:0,discarded:0,workerMs:0,mapPixels:0,texturePixels:0};
    if(worker&&typeof Worker==='function'&&typeof OffscreenCanvas==='function'){
      let url;try{
        const boot=`const kernel=(${surfaceKernel.toString()})(${JSON.stringify(STYLE)});const engine=new kernel.Engine();onmessage=async e=>{const {jobs,revision,epoch,assets}=e.data;if(assets)kernel.setAssets(assets);const start=performance.now();try{for(const job of jobs){const canvas=await engine.render(job);const bitmap=canvas.transferToImageBitmap();postMessage({kind:'frame',revision,epoch,job,bitmap},[bitmap]);}postMessage({kind:'done',revision,epoch,ms:performance.now()-start,stats:engine.stats,mapPixels:engine.mapPixels,texturePixels:engine.texturePixels});}catch(error){postMessage({kind:'error',revision,epoch,message:error.message});}};`;
        url=URL.createObjectURL(new Blob([boot],{type:'text/javascript'}));this.worker=new Worker(url);this.worker.onmessage=e=>this.receive(e.data);this.worker.onerror=e=>{this.stats.workerError=e.message||'Worker unavailable';this.fallback();};this.stats.backend='worker';
      }catch(error){this.stats.workerError=error.message;this.fallback();}finally{if(url)URL.revokeObjectURL(url);}
    }
    if(!this.worker&&!this.sync)this.createSync();
  }
  createSync(){this.sync?.clear();const kernel=surfaceKernel(STYLE);kernel.setAssets(root.SolarAssets?.materials||{});this.sync=new kernel.Engine({gpu:!this.forceCPU});}
  fallback(){if(this.disposed)return;this.epoch++;this.revision++;this.worker?.terminate();this.worker=null;this.inflight=false;this.batch=null;this.forceCPU=true;this.createSync();this.stats.backend='compatibility';this.pump();}
  update(jobs,mono){if(this.disposed||this.paused)return;const assetRevision=root.SolarAssets?.materialRevision||0;if(this.assetRevision!==assetRevision){this.assetRevision=assetRevision;this.assetsSent=false;this.invalidate(false);if(this.sync)this.createSync();}this.desired=new Map(jobs.map(j=>[j.id,j]));for(const [id,e] of this.frames)if(!this.desired.has(id)){e.image.close?.();this.frames.delete(id);}this.pending={jobs,mono};this.pump();}
  compatibleView(current,job) {
    if(!current||!job||current.id!==job.id)return false;
    if(current.geometry===job.geometry)return true;
    // The same full-detail result contract handles manual and automatic
    // camera motion. Only a bounded same-body/material/quality view may lag.
    const a=current.viewState,b=job.viewState;
    if(!a||!b||typeof a.key!=='string'||a.key!==b.key||
       ![a.yaw,a.pitch,b.yaw,b.pitch,a.limit,b.limit].every(Number.isFinite))return false;
    const angle=Math.hypot(Math.atan2(Math.sin(a.yaw-b.yaw),Math.cos(a.yaw-b.yaw)),a.pitch-b.pitch);
    return angle<=Math.max(0,Math.min(a.limit,b.limit,Math.PI/36));
  }

  needs(job,mono){const old=this.frames.get(job.id);if(!old||old.epoch!==this.epoch||old.job.geometry!==job.geometry)return true;if(job.phase===old.job.phase&&job.seconds===old.job.seconds&&job.light.every((v,i)=>v===old.job.light[i]))return false;const turn=Math.abs(job.phase-old.job.phase);return mono-old.mono>=120||Math.min(turn,1-turn)*Math.PI*job.diam>.18;}
  pump(){
    if(this.disposed||this.paused||this.inflight||!this.pending)return;const {mono}=this.pending;let jobs=this.pending.jobs.filter(j=>this.needs(j,mono));this.pending=null;if(!jobs.length)return;
    this.inflight=true;this.stats.submitted++;const revision=++this.revision,epoch=this.epoch;jobs=jobs.map(job=>({...job,requestedMono:mono}));
    this.batch={revision,epoch,jobs:new Map(jobs.map(job=>[job.id,job]))};
    if(this.worker){this.worker.postMessage({jobs,revision,epoch,assets:this.assetsSent?undefined:root.SolarAssets?.materials});this.assetsSent=true;}
    else{
      const engine=this.sync;
      this.timer=setTimeout(async()=>{
        this.timer=null;if(this.disposed)return;const start=performance.now();
        try{
          for(const job of jobs){
            if(this.disposed||revision!==this.revision||epoch!==this.epoch)break;
            const current=this.desired.get(job.id);if(!this.compatibleView(current,job))continue;
            const canvas=await engine.render(job);if(this.disposed)return;
            let image;if(canvas.transferToImageBitmap)image=canvas.transferToImageBitmap();else image=await createImageBitmap(canvas);
            this.receive({kind:'frame',revision,epoch,job,bitmap:image});
          }
          this.receive({kind:'done',revision,epoch,ms:performance.now()-start,stats:engine.stats,mapPixels:engine.mapPixels,texturePixels:engine.texturePixels});
        }catch(error){if(!this.disposed){this.inflight=false;this.batch=null;this.stats.error=error.message;this.pump();}}
      },0);
    }
  }
  receive(msg){
    if(this.disposed){msg.bitmap?.close?.();return;}
    const belongs=this.batch&&msg.revision===this.batch.revision&&msg.epoch===this.batch.epoch;
    if(msg.kind==='error'){
      if(!belongs)return;
      if(msg.epoch!==this.epoch){this.inflight=false;this.batch=null;this.pump();return;}
      this.stats.error=msg.message;this.fallback();return;
    }
    if(msg.kind==='done'){
      if(!belongs)return;
      this.inflight=false;this.batch=null;
      if(msg.epoch===this.epoch){this.stats.workerMs=msg.ms;this.stats.kernel=msg.stats;this.stats.mapPixels=msg.mapPixels;this.stats.texturePixels=msg.texturePixels;}
      this.pump();return;
    }
    const requested=this.batch?.jobs.get(msg.job?.id),current=this.desired.get(msg.job?.id),bitmap=msg.bitmap;
    const validImage=bitmap&&Number.isFinite(bitmap.width)&&bitmap.width>0&&bitmap.width===bitmap.height&&bitmap.width<=1024;
    if(!belongs||msg.epoch!==this.epoch||!requested||!this.compatibleView(current,msg.job)||
      requested.geometry!==msg.job.geometry||requested.phase!==msg.job.phase||requested.requestedMono!==msg.job.requestedMono||!validImage){
      bitmap?.close?.();this.stats.discarded++;return;
    }
    // Publish a complete per-body replacement before retiring the prior resource.
    // Source/quality changes retain the last good image instead of exposing a blank/flat disk.
    const previous=this.frames.get(msg.job.id);
    this.frames.set(msg.job.id,{image:bitmap,job:msg.job,epoch:msg.epoch,mono:msg.job.requestedMono});
    previous?.image.close?.();this.stats.accepted++;
  }
  get(id){return this.frames.get(id)?.image;}
  invalidate(clear=false){this.epoch++;this.pending=null;if(clear){for(const e of this.frames.values())e.image.close?.();this.frames.clear();}this.desired.clear();}
  pause(){
    if(this.disposed||this.paused)return;
    this.paused=true;this.invalidate(false);
    // Keep complete visible frames and decoded materials. At most the current
    // bounded batch finishes; stale completions cannot publish while hidden.
  }
  resume(){if(this.disposed)return;this.paused=false;this.pump();}
  suspend(){this.invalidate(true);this.worker?.terminate();this.worker=null;clearTimeout(this.timer);this.timer=null;this.inflight=false;this.batch=null;this.sync?.clear();}
  dispose(){this.suspend();this.disposed=true;}
}

// Direct GPU scene renderer. Planet textures stay resident in WebGL and every
// frame changes only geometry, rotation and lighting uniforms. No per-planet
// canvas, ImageBitmap transfer or producer queue exists on this path.
const DIRECT_QUAD_VERTEX=`attribute vec2 a;
  uniform vec2 center,viewport;uniform float radius;varying vec2 p;
  void main(){p=a;vec2 q=center+a*radius;gl_Position=vec4(q.x/viewport.x*2.-1.,1.-q.y/viewport.y*2.,0.,1.);}`;
const DIRECT_PLANET_FRAGMENT=`precision highp float;
  varying vec2 p;uniform sampler2D colorMap,bumpMap,cloudsMap;
  uniform vec3 axisU,axisV,pole,light;uniform float phase,kind,hasBump,diameter,texel,effectTime,sunActivity;
  const float PI=3.141592653589793;
  vec3 world(vec3 q){return axisU*q.x+axisV*q.y+pole*q.z;}
  void main(){
    float rr=dot(p,p);if(rr>=1.)discard;
    // p is already in screen/view coordinates (top is negative Y). Flipping Y
    // again here made the surface interpret the shared body frame differently
    // from its child rings, producing camera-following rotation while dragging.
    vec3 n=vec3(p.x,p.y,sqrt(1.-rr));
    vec3 local=vec3(dot(n,axisU),dot(n,axisV),dot(n,pole));
    float angle=atan(local.y,local.x),latitude=asin(clamp(local.z,-1.,1.));
    vec2 uv=vec2((angle+PI)/(2.*PI)-phase,.5-latitude/PI);
    ${STYLE.warpGLSL}
    vec3 base=texture2D(colorMap,uv).rgb,normal=n;
    if(kind==4.){
      float band=.5+.5*sin(latitude*18.+sin(latitude*4.)*.45);
      float haze=pow(max(0.,1.-abs(local.z)),2.);
      base*=.985+(band-.5)*.026;
      base+=vec3(.004,.012,.014)*haze;
    }
    if(hasBump>.5){
      float dx=texture2D(bumpMap,uv+vec2(texel,0.)).r-texture2D(bumpMap,uv-vec2(texel,0.)).r;
      float dy=texture2D(bumpMap,uv+vec2(0.,texel*2.)).r-texture2D(bumpMap,uv-vec2(0.,texel*2.)).r;
      vec3 east=world(vec3(-sin(angle),cos(angle),0.));
      vec3 north=world(vec3(-sin(latitude)*cos(angle),-sin(latitude)*sin(angle),cos(latitude)));
      normal=normalize(n-east*dx*7.+north*dy*7.);
    }
    float mu=dot(normal,light),day=max(mu,0.);vec3 col=base*(.115+day*.98);
    if(kind==1.){
      float cloud=texture2D(cloudsMap,uv).r*.50;
      col=mix(col,vec3(.94,.965,1.)*(.14+day*.93),cloud);
      float ocean=smoothstep(.035,.14,base.b-base.r)*step(base.r,base.b)*step(base.g,base.b);
      vec3 halfdir=normalize(light+vec3(0.,0.,1.));
      col+=vec3(.63,.76,.85)*pow(max(0.,dot(n,halfdir)),70.)*day*ocean*.38;
      float rim=pow(1.-n.z,4.)*(.05+.8*day);col+=vec3(.075,.36,.72)*rim;
      col=mix(col,vec3(.065,.16,.32),pow(1.-n.z,6.)*.17);
    }else if(kind==2.){
      ${STYLE.lightingGLSL}
    }else if(kind==3.||kind==4.)col+=vec3(.18,.26,.33)*pow(1.-n.z,5.)*day*.16;
    float alpha=clamp((1.-sqrt(rr))*diameter,0.,1.);gl_FragColor=vec4(col,alpha);
  }`;
// The corona keeps the established filament texture, but all per-frame
// rotation, pulsing, halo composition and blending now run in this GPU pass.
// One procedural texture upload replaces two large Canvas2D drawImage calls
// and a radial-gradient allocation on every frame.
const DIRECT_CORONA_FRAGMENT=`precision highp float;
  varying vec2 p;uniform sampler2D coronaMap;uniform float effectTime;
  vec2 rotatePoint(vec2 q,float angle){float c=cos(angle),s=sin(angle);return vec2(c*q.x-s*q.y,s*q.x+c*q.y);}
  vec4 filament(vec2 q,float angle,float scale,float opacity){
    vec2 uv=rotatePoint(q,-angle)/(6.6*scale)+.5;
    if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return vec4(0.);
    vec4 sample=texture2D(coronaMap,uv);sample.a*=opacity;return sample;
  }
  void over(inout vec3 premul,inout float alpha,vec3 color,float layerAlpha){
    premul+=color*layerAlpha*(1.-alpha);alpha+=layerAlpha*(1.-alpha);
  }
  void main(){
    vec2 q=p*5.1;float distanceFromSun=length(q);if(distanceFromSun<.98||distanceFromSun>5.1)discard;
    float halo=distanceFromSun<1.63?mix(.25,.095,clamp((distanceFromSun-.92)/.71,0.,1.)):
      distanceFromSun<3.01?mix(.095,.026,(distanceFromSun-1.63)/1.38):mix(.026,0.,(distanceFromSun-3.01)/2.09);
    float t=effectTime*24.;
    vec4 nearLayer=filament(q,t*.003,1.,.8*(1.+sin(t*.19)*.035));
    vec4 farLayer=filament(q,1.73-t*.003,1.08,.37*(1.+sin(t*.19+1.)*.035));
    vec3 premul=vec3(0.);float alpha=0.;
    over(premul,alpha,vec3(1.,.655,.263),halo);
    over(premul,alpha,nearLayer.rgb,nearLayer.a);
    over(premul,alpha,farLayer.rgb,farLayer.a);
    if(alpha<.001)discard;gl_FragColor=vec4(premul/alpha,alpha);
  }`;
// Orbit vertices stay in model space in STATIC_DRAW buffers. Camera rotation,
// anamorphic lens stretch and dolly perspective are evaluated by the vertex
// shader, so dragging the camera no longer projects and uploads every orbit
// point again on the CPU.
const DIRECT_LINE_VERTEX=`attribute vec3 a;
  uniform vec2 center,viewport;uniform vec3 worldOffset,anchor;
  uniform vec4 camera;uniform float lens,travel,scale;
  void main(){
    vec3 p=a+worldOffset-anchor;
    float x=p.x*camera.x-p.y*camera.y;
    float y=p.x*camera.y+p.y*camera.x;
    vec3 v=vec3(x*lens,-(y*camera.w+p.z*camera.z),-y*camera.z+p.z*camera.w);
    float perspective=1.;
    if(abs(travel)>.00000001){
      float denominator=5000.-v.z*travel;
      if(denominator<=10.){gl_Position=vec4(2.,2.,2.,-1.);return;}
      perspective=clamp(5000./denominator,.002,32.);
    }
    vec2 q=center+v.xy*perspective*scale;
    gl_Position=vec4(q.x/viewport.x*2.-1.,1.-q.y/viewport.y*2.,0.,1.);
  }`;
const DIRECT_COLOR_FRAGMENT=`precision mediump float;uniform vec4 color;void main(){gl_FragColor=color;}`;
const DIRECT_RING_VERTEX=`attribute vec2 a;uniform vec2 center,viewport,axisU,axisV;uniform float radius,outer;uniform vec2 depthAxis;
  varying vec2 local;varying float depth;
  void main(){local=a*outer;depth=dot(local,depthAxis);vec2 q=center+(axisU*local.x+axisV*local.y)*radius;gl_Position=vec4(q.x/viewport.x*2.-1.,1.-q.y/viewport.y*2.,0.,1.);}`;
 const DIRECT_RING_FRAGMENT=`precision highp float;varying vec2 local;varying float depth;
   uniform vec2 axisU,axisV;uniform float radius,inner,outer,front,saturn,pixel;uniform vec3 ringColor;
   float lineBand(float f,float center,float width,float aa){return 1.-smoothstep(width,width+aa,abs(f-center));}
   void main(){float r=length(local);if(r<inner||r>outer||(front>.5&&depth<0.)||(front<.5&&depth>=0.))discard;
     float f=(r-inner)/(outer-inner),span=outer-inner;
     vec2 radial=local/max(r,.0001),screenRadial=axisU*radial.x+axisV*radial.y;
     float aa=max(pixel/span,1.15/(max(radius*length(screenRadial),1.)*span));
     float edge=max(pixel,aa*span),alpha=smoothstep(inner,inner+edge,r)*(1.-smoothstep(outer-edge,outer,r));
     if(saturn>.5){
       float gap=smoothstep(.56-aa*1.5,.56+aa*1.5,f)*(1.-smoothstep(.62-aa*1.5,.62+aa*1.5,f));
       float cyclePixels=3.14159265/(75.*aa),detail=smoothstep(2.,5.,cyclePixels);
       float bands=.19+.48*mix(.5,pow(sin(f*75.),2.),detail);
     alpha*=bands*(1.-gap)*(f>.85?.6:1.);
     }
     else{
      float lines=0.;
      lines+=lineBand(f,.07,.007,aa)*.22;lines+=lineBand(f,.16,.006,aa)*.28;
      lines+=lineBand(f,.27,.008,aa)*.18;lines+=lineBand(f,.39,.006,aa)*.30;
      lines+=lineBand(f,.53,.009,aa)*.24;lines+=lineBand(f,.68,.007,aa)*.34;
      lines+=lineBand(f,.83,.009,aa)*.27;lines+=lineBand(f,.95,.010,aa)*.62;
      float separationPixels=.09/max(aa,.0001);
      float detail=smoothstep(2.5,5.5,separationPixels);
      float coverage=min(1.,.012/max(aa,.012));
      float unresolved=.035+.025*smoothstep(.70,1.,f);
      alpha*=mix(unresolved,min(lines*coverage,.68),detail);
    }
    gl_FragColor=vec4(ringColor,alpha);}`;
function directCompile(gl,type,source){
  const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(shader)||'GPU shader compilation failed';gl.deleteShader(shader);throw Error(message);}
  return shader;
}
function directProgram(gl,vertex,fragment,uniforms){
  const vs=directCompile(gl,gl.VERTEX_SHADER,vertex),fs=directCompile(gl,gl.FRAGMENT_SHADER,fragment),program=gl.createProgram();
  gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)){const message=gl.getProgramInfoLog(program)||'GPU program link failed';gl.deleteProgram(program);throw Error(message);}
  return {program,a:gl.getAttribLocation(program,'a'),u:Object.fromEntries(uniforms.map(name=>[name,gl.getUniformLocation(program,name)]))};
}
function directPower(value){return Math.max(128,Math.min(4096,2**Math.round(Math.log2(Math.max(128,value)))));}
class DirectRenderer{
  constructor(canvas){
    if(!canvas)throw Error('Direct GPU canvas is missing.');
    // GPU colors are blended into a transparent backing store as premultiplied
    // values. Tell Chromium compositors the truth so thin orbit alpha is not
    // multiplied a second time (notably visible in Microsoft Edge).
    this.canvas=canvas;this.gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:true,preserveDrawingBuffer:false});
    if(!this.gl)throw Error('WebGL is required for the direct planet renderer.');
    this.disposed=false;this.paused=false;this.generation=0;this.textureToken=0;this.width=1;this.height=1;this.dpr=1;
    this.textures=new Map();this.frames=new Map();this.desired=new Map();this.orbitBuffers=new Map();this.textureSources=new Map();this.coronaTexture=null;this.pendingCount=0;this.loadQueue=[];this.activeLoads=0;
    this.boundProgram=null;this.boundBuffer=null;this.boundAttrib=-1;this.boundAttribSize=0;this.boundAttribBuffer=null;this.activeTextureUnit=-1;this.boundTextures=[null,null,null,null];this.canvasViewportW=0;this.canvasViewportH=0;this.orbitState={valid:false};
    this.stats={backend:'gpu-direct',accepted:0,discarded:0,drawCalls:0,frames:0,texturesLoaded:0,texturePixels:0,orbitUploads:0,kernel:{backend:'gpu-direct'}};
    this.contextLost=false;this.onLost=event=>{event.preventDefault();this.contextLost=true;this.generation++;this.loadQueue=[];this.pendingCount=0;this.orbitBuffers.clear();this.resetBindings();this.stats.contextLost=true;};
    this.onRestored=()=>{this.contextLost=false;this.textures.clear();this.frames.clear();this.desired.clear();this.orbitBuffers.clear();this.coronaTexture=null;this.stats.texturePixels=0;this.stats.contextLost=false;this.stats.recoveries=(this.stats.recoveries||0)+1;this.resetBindings();this.setup();};
    canvas.addEventListener('webglcontextlost',this.onLost,false);canvas.addEventListener('webglcontextrestored',this.onRestored,false);
    this.setup();
  }
  resetBindings(){
    if(this.orbitState)this.orbitState.valid=false;
    this.boundProgram=null;this.boundBuffer=null;this.boundAttrib=-1;this.boundAttribSize=0;this.boundAttribBuffer=null;this.activeTextureUnit=-1;
    for(let i=0;i<this.boundTextures.length;i++)this.boundTextures[i]=null;this.canvasViewportW=0;this.canvasViewportH=0;
  }
  resetTextureBindings(){this.activeTextureUnit=-1;for(let i=0;i<this.boundTextures.length;i++)this.boundTextures[i]=null;}
  applyCanvasViewport(){
    const w=this.canvas.width,h=this.canvas.height;if(this.canvasViewportW===w&&this.canvasViewportH===h)return;
    this.gl.viewport(0,0,w,h);this.canvasViewportW=w;this.canvasViewportH=h;
  }
  bindTextureUnit(unit,texture){
    const g=this.gl;if(this.activeTextureUnit!==unit){g.activeTexture(g.TEXTURE0+unit);this.activeTextureUnit=unit;}
    if(this.boundTextures[unit]!==texture){g.bindTexture(g.TEXTURE_2D,texture);this.boundTextures[unit]=texture;}
  }
  textureSource(name,asset,target){
    const key=name+':'+target,cached=this.textureSources.get(key);if(cached?.asset===asset)return cached.source;
    const source=materialSource.sourceFor(asset,target);this.textureSources.set(key,{asset,source});return source;
  }
  setup(){
    const g=this.gl;
    this.maxTextureSize=Math.min(4096,2**Math.floor(Math.log2(g.getParameter(g.MAX_TEXTURE_SIZE))));
    this.viewportLimit=g.getParameter(g.MAX_VIEWPORT_DIMS);
    this.planetProgram=directProgram(g,DIRECT_QUAD_VERTEX,DIRECT_PLANET_FRAGMENT,['center','viewport','radius','colorMap','bumpMap','cloudsMap','axisU','axisV','pole','light','phase','kind','hasBump','diameter','texel','effectTime','sunActivity']);
    this.coronaProgram=directProgram(g,DIRECT_QUAD_VERTEX,DIRECT_CORONA_FRAGMENT,['center','viewport','radius','coronaMap','effectTime']);
    this.line=directProgram(g,DIRECT_LINE_VERTEX,DIRECT_COLOR_FRAGMENT,['center','viewport','worldOffset','anchor','camera','lens','travel','scale','color']);
    this.ring=directProgram(g,DIRECT_RING_VERTEX,DIRECT_RING_FRAGMENT,['center','viewport','axisU','axisV','radius','outer','depthAxis','inner','front','saturn','pixel','ringColor']);
    this.quad=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,this.quad);g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),g.STATIC_DRAW);
    this.black=g.createTexture();g.bindTexture(g.TEXTURE_2D,this.black);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,1,1,0,g.RGBA,g.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));
    g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);
    g.useProgram(this.planetProgram.program);g.uniform1i(this.planetProgram.u.colorMap,0);g.uniform1i(this.planetProgram.u.bumpMap,1);g.uniform1i(this.planetProgram.u.cloudsMap,2);
    g.useProgram(this.coronaProgram.program);g.uniform1i(this.coronaProgram.u.coronaMap,3);
    for(const p of [this.planetProgram,this.coronaProgram,this.line,this.ring]){p.viewportWidth=NaN;p.viewportHeight=NaN;}
    g.enable(g.BLEND);g.blendFuncSeparate(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA,g.ONE,g.ONE_MINUS_SRC_ALPHA);g.disable(g.DEPTH_TEST);g.clearColor(0,0,0,0);this.resetBindings();
  }
  resize(width,height,dpr=1){
    this.width=Math.max(1,width);this.height=Math.max(1,height);
    this.dpr=Math.max(.25,Math.min(Math.max(1,dpr),this.viewportLimit[0]/this.width,this.viewportLimit[1]/this.height));this.stats.pixelRatio=this.dpr;
    const w=Math.round(this.width*this.dpr),h=Math.round(this.height*this.dpr);
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;this.canvasViewportW=0;this.canvasViewportH=0;}
    this.applyCanvasViewport();
  }
  get inflight(){return this.pendingCount>0;}
  begin(){
    if(this.disposed||this.paused||this.contextLost)return false;
    const g=this.gl;this.applyCanvasViewport();g.clear(g.COLOR_BUFFER_BIT);
    this.stats.frames++;this.stats.drawCalls=0;this.desired.clear();return true;
  }
  bind(program,buffer=this.quad,size=2){
    const g=this.gl;
    if(this.boundProgram!==program.program){g.useProgram(program.program);this.boundProgram=program.program;}
    if(this.boundBuffer!==buffer){g.bindBuffer(g.ARRAY_BUFFER,buffer);this.boundBuffer=buffer;}
    if(this.boundAttrib!==program.a||this.boundAttribSize!==size||this.boundAttribBuffer!==buffer){
      g.enableVertexAttribArray(program.a);g.vertexAttribPointer(program.a,size,g.FLOAT,false,0,0);
      this.boundAttrib=program.a;this.boundAttribSize=size;this.boundAttribBuffer=buffer;
    }
  }
  viewport(program){
    if(program.viewportWidth===this.width&&program.viewportHeight===this.height)return;
    this.gl.uniform2f(program.u.viewport,this.width,this.height);program.viewportWidth=this.width;program.viewportHeight=this.height;
  }
  queueTexture(task){this.loadQueue.push(task);this.pendingCount++;this.pumpTextureQueue();}
  pumpTextureQueue(){
    if(this.disposed||this.contextLost)return;
    while(this.activeLoads<2&&this.loadQueue.length){
      const task=this.loadQueue.shift(),record=this.textures.get(task.name);
      if(task.generation!==this.generation||!record||record.token!==task.token||record.source.key!==task.source.key){if(task.generation===this.generation)this.pendingCount=Math.max(0,this.pendingCount-1);continue;}
      this.activeLoads++;this.loadTexture(task.name,task.source,task.target,task.token,task.generation).finally(()=>{this.activeLoads=Math.max(0,this.activeLoads-1);this.pumpTextureQueue();});
    }
  }
  async loadTexture(name,source,target,token,generation){
    let bitmap,canvas,texture;
    try{
      const requested=this.textures.get(name);if(!requested||requested.token!==token||requested.source.key!==source.key||generation!==this.generation)return;
      bitmap=await materialSource.bitmapFor(source);if(this.disposed||generation!==this.generation)return;
      const natural=2**Math.floor(Math.log2(Math.max(2,bitmap.width))),width=Math.max(2,Math.min(target,natural)),height=width/2;
      let upload=bitmap;
      if(!source.seamBaked||bitmap.width!==width||bitmap.height!==height){
        canvas=materialSource.materialCanvas(bitmap,width,height,false,source.seamBaked).canvas;upload=canvas;
      }
      if(this.disposed||generation!==this.generation)return;
      const g=this.gl;texture=g.createTexture();g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,texture);this.resetTextureBindings();g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,false);
      g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,upload);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.REPEAT);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);
      // Explicit screen-size texture tiers provide LOD without the longitude
      // derivative seam that implicit mip selection creates on a sphere.
      g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);
      const record=this.textures.get(name);if(!record||record.token!==token||record.source.key!==source.key){g.deleteTexture(texture);texture=null;this.stats.discarded++;return;}
      if(record.texture){g.deleteTexture(record.texture);this.stats.texturePixels-=record.width*record.height;}
      Object.assign(record,{texture,width,height,pending:false,error:null,retryAt:0});texture=null;this.stats.accepted++;this.stats.texturesLoaded++;this.stats.texturePixels+=width*height;
    }catch(error){const record=this.textures.get(name);if(record&&record.token===token){record.pending=false;record.error=error.message;record.retryAt=Date.now()+30000;this.stats.error=error.message;}}
    finally{bitmap?.close?.();if(generation===this.generation)this.pendingCount=Math.max(0,this.pendingCount-1);}
  }
  texture(name,target){const result=this.textureFor(name,target);root.SolarPerformance?.touchTexture(this,name);return result;}
  textureFor(name,target){
    const asset=root.SolarAssets?.materials?.[name];if(!asset)return null;
    target=directPower(Math.min(target,this.maxTextureSize));const source=this.textureSource(name,asset,target);if(!source)return null;let record=this.textures.get(name);
    const sourceChanged=!record||record.source.key!==source.key,upgrade=!record?.texture||record.width<target,downgrade=record?.texture&&record.width>target*2,retryReady=sourceChanged||!record?.retryAt||Date.now()>=record.retryAt;
    if(retryReady&&(sourceChanged||upgrade||downgrade)&&(!record?.pending||record.pendingTarget!==target||record.source.key!==source.key)){
      const old=record?.texture||null,token=++this.textureToken,generation=this.generation;
      record={source,texture:old,width:record?.width||0,height:record?.height||0,pending:true,pendingTarget:target,token};
      this.textures.set(name,record);this.queueTexture({name,source,target,token,generation});
    }
    return record?.texture?record:null;
  }
  orbit(key,xyz,worldOffset,camera,scale,centerX,centerY,color,alpha){
    if(!key||!xyz?.length||!(alpha>0))return;
    const g=this.gl,p=this.line,data=xyz instanceof Float32Array?xyz:new Float32Array(xyz);
    let record=this.orbitBuffers.get(key);
    if(!record){record={buffer:g.createBuffer(),source:null,count:0};this.orbitBuffers.set(key,record);}
    this.bind(p,record.buffer,3);
    if(record.source!==xyz){g.bufferData(g.ARRAY_BUFFER,data,g.STATIC_DRAW);record.source=xyz;record.count=data.length/3;this.stats.orbitUploads++;}
    const offset=worldOffset||{x:0,y:0,z:0},anchor=camera.anchor||{x:0,y:0,z:0};
    this.viewport(p);
    const s=this.orbitState;
    if(!s.valid||s.centerX!==centerX||s.centerY!==centerY||s.anchorX!==anchor.x||s.anchorY!==anchor.y||s.anchorZ!==anchor.z||
      s.ca!==camera.ca||s.sa!==camera.sa||s.ce!==camera.ce||s.se!==camera.se||s.lens!==camera.lens||s.travel!==camera.travel||s.scale!==scale){
      g.uniform2f(p.u.center,centerX,centerY);g.uniform3f(p.u.anchor,anchor.x,anchor.y,anchor.z);
      g.uniform4f(p.u.camera,camera.ca,camera.sa,camera.ce,camera.se);g.uniform1f(p.u.lens,camera.lens);g.uniform1f(p.u.travel,camera.travel);g.uniform1f(p.u.scale,scale);
      Object.assign(s,{valid:true,centerX,centerY,anchorX:anchor.x,anchorY:anchor.y,anchorZ:anchor.z,ca:camera.ca,sa:camera.sa,ce:camera.ce,se:camera.se,lens:camera.lens,travel:camera.travel,scale});
    }
    g.uniform3f(p.u.worldOffset,offset.x,offset.y,offset.z);g.uniform4f(p.u.color,color[0],color[1],color[2],alpha);
    g.drawArrays(g.LINE_STRIP,0,record.count);this.stats.drawCalls++;
  }
  corona(source,screen,radius,time){
    if(!source||radius<=0)return;
    const g=this.gl;let record=this.coronaTexture;
    if(!record||record.source!==source){
      const texture=g.createTexture();g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,texture);this.resetTextureBindings();g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,false);
      g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,source);
      g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);
      g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);
      if(record?.texture)g.deleteTexture(record.texture);record=this.coronaTexture={source,texture,width:source.width};
    }
    const p=this.coronaProgram;this.bind(p);this.viewport(p);g.uniform2f(p.u.center,screen.x,screen.y);g.uniform1f(p.u.radius,radius*5.1);g.uniform1f(p.u.effectTime,time);
    this.bindTextureUnit(3,record.texture);
    g.drawArrays(g.TRIANGLES,0,6);this.stats.drawCalls++;
  }
  rings(body,frame,screen,radius,front){
    const saturn=body.id==='saturn',inner=saturn?1.28:1.58,outer=saturn?2.26:1.94,g=this.gl,p=this.ring;
    this.bind(p);this.viewport(p);g.uniform2f(p.u.center,screen.x,screen.y);g.uniform2f(p.u.axisU,frame.u[0],frame.u[1]);g.uniform2f(p.u.axisV,frame.v[0],frame.v[1]);g.uniform2f(p.u.depthAxis,frame.u[2],frame.v[2]);
    g.uniform1f(p.u.radius,radius);g.uniform1f(p.u.inner,inner);g.uniform1f(p.u.outer,outer);g.uniform1f(p.u.front,front?1:0);g.uniform1f(p.u.saturn,saturn?1:0);g.uniform1f(p.u.pixel,1/Math.max(radius,1));
    g.uniform3f(p.u.ringColor,saturn?.88:.62,saturn?.75:.78,saturn?.55:.80);g.drawArrays(g.TRIANGLES,0,6);this.stats.drawCalls++;
  }
  planet(job,body,screen,radius,time,activity){
    this.desired.set(job.id,job);const color=this.texture(job.id,job.textureWidth);if(!color)return false;
    const bump=root.SolarAssets?.materials?.[job.id+'-relief']?this.texture(job.id+'-relief',job.textureWidth):null;
    const clouds=job.id==='earth'?this.texture('clouds',Math.min(2048,job.textureWidth)):null;
    // Rings are children of this body: the surface and both ring halves share
    // exactly one parent transform and cannot drift into separate orientations.
    const frame=job.frame;
    if(body.id==='saturn'||body.id==='uranus')this.rings(body,frame,screen,radius,false);
    const g=this.gl,p=this.planetProgram;this.bind(p);this.viewport(p);g.uniform2f(p.u.center,screen.x,screen.y);g.uniform1f(p.u.radius,radius);g.uniform3fv(p.u.axisU,frame.u);g.uniform3fv(p.u.axisV,frame.v);g.uniform3fv(p.u.pole,frame.pole);g.uniform3fv(p.u.light,job.light);
    g.uniform1f(p.u.phase,job.phase);g.uniform1f(p.u.kind,job.id==='earth'?1:job.id==='sun'?2:job.id==='uranus'?4:['jupiter','saturn','venus','neptune'].includes(job.id)?3:0);g.uniform1f(p.u.hasBump,bump?1:0);g.uniform1f(p.u.diameter,radius*2*this.dpr);g.uniform1f(p.u.texel,1/color.width);g.uniform1f(p.u.effectTime,time);g.uniform1f(p.u.sunActivity,activity?1:0);
    this.bindTextureUnit(0,color.texture);this.bindTextureUnit(1,bump?.texture||color.texture);this.bindTextureUnit(2,clouds?.texture||this.black);
    g.drawArrays(g.TRIANGLES,0,6);this.stats.drawCalls++;
    if(body.id==='saturn'||body.id==='uranus')this.rings(body,frame,screen,radius,true);
    let frameRecord=this.frames.get(job.id);if(!frameRecord){frameRecord={job:null,image:{width:0,height:0,gpu:true}};this.frames.set(job.id,frameRecord);}
    frameRecord.job=job;frameRecord.image.width=Math.round(radius*2*this.dpr);frameRecord.image.height=Math.round(radius*2*this.dpr);return true;
  }
  end(){for(const id of this.frames.keys())if(!this.desired.has(id))this.frames.delete(id);root.SolarPerformance?.enforceTextureBudget(this);}
  flush(){if(!this.disposed&&!this.contextLost)this.gl.flush();}
  get(id){return this.frames.get(id)?.image;}
  invalidate(){this.generation++;this.loadQueue=[];this.pendingCount=0;for(const record of this.textures.values())record.pending=false;}
  pause(){this.paused=true;}
  resume(){this.paused=false;this.pumpTextureQueue();}
  suspend(){this.pause();}
  dispose(){
    if(this.disposed)return;this.disposed=true;this.generation++;this.loadQueue=[];this.pendingCount=0;const g=this.gl;
    for(const record of this.textures.values())if(record.texture)g.deleteTexture(record.texture);
    for(const record of this.orbitBuffers.values())g.deleteBuffer(record.buffer);
    for(const p of [this.planetProgram,this.coronaProgram,this.line,this.ring])g.deleteProgram(p.program);
    if(this.coronaTexture?.texture)g.deleteTexture(this.coronaTexture.texture);
    g.deleteTexture(this.black);g.deleteBuffer(this.quad);this.textures.clear();this.textureSources.clear();this.frames.clear();this.desired.clear();this.orbitBuffers.clear();this.coronaTexture=null;
    this.canvas.removeEventListener('webglcontextlost',this.onLost);this.canvas.removeEventListener('webglcontextrestored',this.onRestored);
  }
}
root.SolarSurface={kernel:()=>surfaceKernel(STYLE),Service:SurfaceService,DirectRenderer,effectRevision:'solar-surface-v047',shaderSources:Object.freeze({planet:DIRECT_PLANET_FRAGMENT})};if(typeof module==='object'&&module.exports)module.exports=root.SolarSurface;
})(typeof window==='object'?window:globalThis);
