/* Solar Time v0.10. One bounded producer of analytic spherical surfaces.
   GPU/CPU are explicit adapters of the same job and material coordinates.
   All body positions, axes and physical rotation come from SolarAstro. */
(function(root){
'use strict';
function surfaceKernel(){
  let assets={};
  const TAU=Math.PI*2,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const setAssets=value=>{if(value)assets=value;};
  function blob(url){const [meta,data]=url.split(','),raw=atob(data),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return new Blob([bytes],{type:meta.split(':')[1].split(';')[0]});}
  function makeCanvas(n){const c=typeof OffscreenCanvas==='function'?new OffscreenCanvas(n,n):document.createElement('canvas');c.width=c.height=n;return c;}
  function compile(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error(error);}return s;}
  const vertex=`attribute vec2 a; varying vec2 p; void main(){p=a;gl_Position=vec4(a,0.,1.);}`;
  const fragment=`precision highp float;
    varying vec2 p; uniform sampler2D colorMap; uniform sampler2D bumpMap; uniform sampler2D cloudsMap;
    uniform vec3 axisU,axisV,pole,light; uniform float phase,kind,hasBump,diameter,texel;
    const float PI=3.141592653589793;
    vec3 world(vec3 q){return axisU*q.x+axisV*q.y+pole*q.z;}
    void main(){
      float rr=dot(p,p); if(rr>=1.){gl_FragColor=vec4(0.);return;}
      vec3 n=vec3(p.x,-p.y,sqrt(1.-rr));
      vec3 local=vec3(dot(n,axisU),dot(n,axisV),dot(n,pole));
      float angle=atan(local.y,local.x),latitude=asin(clamp(local.z,-1.,1.));
      vec2 uv=vec2(fract((angle+PI)/(2.*PI)-phase),.5-latitude/PI);
      vec3 base=texture2D(colorMap,uv).rgb;
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
        col=base*(.70+.30*pow(n.z,.5));
      }else if(kind==3.){
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
        this.uniforms=Object.fromEntries(['colorMap','bumpMap','cloudsMap','axisU','axisV','pole','light','phase','kind','hasBump','diameter','texel'].map(k=>[k,g.getUniformLocation(program,k)]));this.stats.backend='gpu';
      }catch(error){if(this.gl){this.gl.getExtension('WEBGL_lose_context')?.loseContext();this.gl=null;}this.canvas=makeCanvas(32);this.ctx=this.canvas.getContext('2d');this.stats.fallback=error.message;}
    }
    async texture(id,width){
      const source=assets[id]||assets.moon;if(!source)throw Error('Material asset missing: '+id);
      const key=id+':'+width;let t=this.textures.get(key);if(t&&t.source!==source){if(this.gl)this.gl.deleteTexture(t.handle);this.textures.delete(key);t=null;}if(t){this.textures.delete(key);this.textures.set(key,t);return t;}
      const bitmap=await createImageBitmap(blob(source),{resizeWidth:width,resizeHeight:width/2,resizeQuality:'high'});
      if(this.disposed){bitmap.close();throw Error('Surface disposed');}
      if(this.gl){
        const g=this.gl,handle=g.createTexture();g.bindTexture(g.TEXTURE_2D,handle);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,bitmap);
        g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.REPEAT);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR_MIPMAP_LINEAR);g.generateMipmap(g.TEXTURE_2D);
        const ext=g.getExtension('EXT_texture_filter_anisotropic');if(ext)g.texParameterf(g.TEXTURE_2D,ext.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,g.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
        t={handle,width,height:width/2};
      }else{
        const c=makeCanvas(width);c.height=width/2;const ctx=c.getContext('2d');ctx.drawImage(bitmap,0,0,width,width/2);t={width,height:width/2,data:ctx.getImageData(0,0,width,width/2).data};
      }
      bitmap.close();t.source=source;this.textures.set(key,t);this.stats.texturesBuilt++;
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
      const {id,frame,phase,light}=job;const n=this.gl?Math.min(1024,job.diam):Math.min(768,job.diam);
      const width=this.gl?job.textureWidth:Math.min(4096,job.textureWidth);
      const color=await this.texture(id,width),bump=assets[id+'-relief']?await this.texture(id+'-relief',width):color;
      const clouds=id==='earth'?await this.texture('clouds',Math.min(2048,width)):color;
      if(this.canvas.width!==n){this.canvas.width=this.canvas.height=n;}
      if(this.gl?.isContextLost())throw Error('WebGL context lost');
      if(this.gl){
        const g=this.gl,u=this.uniforms;g.viewport(0,0,n,n);g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT);g.useProgram(this.program);g.bindBuffer(g.ARRAY_BUFFER,this.buffer);
        const a=g.getAttribLocation(this.program,'a');g.enableVertexAttribArray(a);g.vertexAttribPointer(a,2,g.FLOAT,false,0,0);
        for(const [i,t,name] of [[0,color,'colorMap'],[1,bump,'bumpMap'],[2,clouds,'cloudsMap']]){g.activeTexture(g.TEXTURE0+i);g.bindTexture(g.TEXTURE_2D,t.handle);g.uniform1i(u[name],i);}
        g.uniform3fv(u.axisU,frame.u);g.uniform3fv(u.axisV,frame.v);g.uniform3fv(u.pole,frame.pole);g.uniform3fv(u.light,light);
        g.uniform1f(u.phase,phase);g.uniform1f(u.kind,id==='earth'?1:id==='sun'?2:['jupiter','saturn','venus','uranus','neptune'].includes(id)?3:0);
        g.uniform1f(u.hasBump,bump!==color?1:0);g.uniform1f(u.diameter,n);g.uniform1f(u.texel,1/width);g.drawArrays(g.TRIANGLES,0,6);
        if(g.isContextLost())throw Error('WebGL context lost');
      }else{
        // Identical UV geometry, cooperatively rasterized when GPU is disabled.
        // Cached inverse spherical map prevents per-frame atan/acos work.
        const map=this.cpuMap(job,n);
        const im=this.ctx.createImageData(n,n),data=im.data,tex=color.data,w=color.width,h=color.height;
        let sliceStart=performance.now();
        for(let m=0;m<map.length;m+=7){
          const i=map[m],nx=map[m+1],ny=map[m+2],nz=map[m+3],u=(map[m+4]-phase+2)%1,v=map[m+5];
          const tx=u*w,ty=clamp(v*h,0,h-1),x0=Math.floor(tx),y0=Math.floor(ty),fx=tx-x0,fy=ty-y0,x1=(x0+1)%w,y1=Math.min(h-1,y0+1);
          const a=(y0*w+x0)*4,b=(y0*w+x1)*4,c=(y1*w+x0)*4,d=(y1*w+x1)*4;
          const wa=(1-fx)*(1-fy),wb=fx*(1-fy),wc=(1-fx)*fy,wd=fx*fy;
          const day=Math.max(0,nx*light[0]+ny*light[1]+nz*light[2]);
          const lit=id==='sun'?.70+.30*Math.sqrt(nz):.115+.98*day;
          for(let k=0;k<3;k++)data[i+k]=(tex[a+k]*wa+tex[b+k]*wb+tex[c+k]*wc+tex[d+k]*wd)*lit;
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
  return {Engine,setAssets};
}
class SurfaceService{
  constructor({worker=true}={}){
    this.frames=new Map();this.desired=new Map();this.pending=null;this.inflight=false;this.disposed=false;
    this.epoch=0;this.revision=0;this.worker=null;this.sync=null;this.timer=null;this.assetsSent=false;this.batch=null;
    this.stats={backend:'compatibility',submitted:0,accepted:0,discarded:0,workerMs:0,mapPixels:0,texturePixels:0};
    if(worker&&typeof Worker==='function'&&typeof OffscreenCanvas==='function'){
      let url;try{
        const boot=`const kernel=(${surfaceKernel.toString()})();const engine=new kernel.Engine();onmessage=async e=>{const {jobs,revision,epoch,assets}=e.data;if(assets)kernel.setAssets(assets);const start=performance.now();try{for(const job of jobs){const canvas=await engine.render(job);const bitmap=canvas.transferToImageBitmap();postMessage({kind:'frame',revision,epoch,job,bitmap},[bitmap]);}postMessage({kind:'done',revision,epoch,ms:performance.now()-start,stats:engine.stats,mapPixels:engine.mapPixels,texturePixels:engine.texturePixels});}catch(error){postMessage({kind:'error',revision,epoch,message:error.message});}};`;
        url=URL.createObjectURL(new Blob([boot],{type:'text/javascript'}));this.worker=new Worker(url);this.worker.onmessage=e=>this.receive(e.data);this.worker.onerror=e=>{this.stats.workerError=e.message||'Worker unavailable';this.fallback();};this.stats.backend='worker';
      }catch(error){this.stats.workerError=error.message;this.fallback();}finally{if(url)URL.revokeObjectURL(url);}
    }
    if(!this.worker&&!this.sync)this.createSync();
  }
  createSync(){this.sync?.clear();const kernel=surfaceKernel();kernel.setAssets(root.SolarAssets?.materials||{});this.sync=new kernel.Engine({gpu:!this.forceCPU});}
  fallback(){if(this.disposed)return;this.epoch++;this.revision++;this.worker?.terminate();this.worker=null;this.inflight=false;this.batch=null;this.forceCPU=true;this.createSync();this.stats.backend='compatibility';this.pump();}
  update(jobs,mono){if(this.disposed)return;const assetRevision=root.SolarAssets?.materialRevision||0;if(this.assetRevision!==assetRevision){this.assetRevision=assetRevision;this.assetsSent=false;this.invalidate(false);if(this.sync)this.createSync();}this.desired=new Map(jobs.map(j=>[j.id,j]));for(const [id,e] of this.frames)if(!this.desired.has(id)){e.image.close?.();this.frames.delete(id);}this.pending={jobs,mono};this.pump();}
  needs(job,mono){const old=this.frames.get(job.id);if(!old||old.epoch!==this.epoch||old.job.geometry!==job.geometry)return true;if(job.phase===old.job.phase&&job.seconds===old.job.seconds&&job.light.every((v,i)=>v===old.job.light[i]))return false;const turn=Math.abs(job.phase-old.job.phase);return mono-old.mono>=120||Math.min(turn,1-turn)*Math.PI*job.diam>.18;}
  pump(){
    if(this.disposed||this.inflight||!this.pending)return;const {mono}=this.pending;let jobs=this.pending.jobs.filter(j=>this.needs(j,mono));this.pending=null;if(!jobs.length)return;
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
            const current=this.desired.get(job.id);if(!current||current.geometry!==job.geometry)continue;
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
    if(!belongs||msg.epoch!==this.epoch||!requested||!current||current.geometry!==msg.job.geometry||
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
  suspend(){this.invalidate(true);this.worker?.terminate();this.worker=null;clearTimeout(this.timer);this.timer=null;this.inflight=false;this.batch=null;this.sync?.clear();}
  dispose(){this.suspend();this.disposed=true;}
}
root.SolarSurface={kernel:surfaceKernel,Service:SurfaceService};if(typeof module==='object'&&module.exports)module.exports=root.SolarSurface;
})(typeof window==='object'?window:globalThis);
