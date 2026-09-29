/* Solar Time v0.56 — surface implementation owner. */
(function(root){
'use strict';
const STYLE=root.SolarSurfaceStyle;
if(!STYLE)throw Error('surface-style.js must load before surface.js');
const EARTH_NIGHT_GLSL=`
  vec3 stableNight(vec2 uv,float facing){
    vec3 center=texture2D(nightMap,uv).rgb;
    float outer=1.-smoothstep(.20,.55,facing);
    if(outer<=.001)return center;
    // Longitude and latitude become increasingly compressed toward the limb.
    // Filter only that annulus so central city detail stays pixel-sharp while
    // sub-pixel lights at the edge no longer jump between samples each frame.
    float footprint=min(nightTexel*16.,max(nightTexel,1./(PI*max(diameter,1.)*max(facing,.06))));
    vec2 dx=vec2(footprint,0.),dy=vec2(0.,footprint*2.);
    vec3 filtered=(center*4.+texture2D(nightMap,uv+dx).rgb+texture2D(nightMap,uv-dx).rgb+
      texture2D(nightMap,uv+dy).rgb+texture2D(nightMap,uv-dy).rgb)/8.;
    return mix(center,filtered,outer);
  }
  vec3 cloudVeiledNight(vec2 uv,float facing,float cloud){
    vec3 clear=stableNight(uv,facing);
    if(cloud<=.01)return clear;
    float spread=nightTexel*(2.+cloud*4.);
    vec2 dx=vec2(spread,0.),dy=vec2(0.,spread*2.);
    vec3 softened=(clear*2.+texture2D(nightMap,uv+dx).rgb+texture2D(nightMap,uv-dx).rgb+
      texture2D(nightMap,uv+dy).rgb+texture2D(nightMap,uv-dy).rgb)/6.;
    return mix(clear,softened,cloud*.48)*(1.-cloud*.42);
  }`;
const ATMOSPHERIC_CLOUD_GLSL=`
  float cloudHash(float n){return fract(sin(n)*43758.5453123);}
  vec2 atmosphericShellUv(vec3 viewNormal,float shellRadius){
    float shellSq=shellRadius*shellRadius;
    vec3 shellNormal=vec3(viewNormal.xy/shellRadius,sqrt(max(0.,1.-dot(viewNormal.xy,viewNormal.xy)/shellSq)));
    vec3 shellLocal=vec3(dot(shellNormal,axisU),dot(shellNormal,axisV),dot(shellNormal,pole));
    float shellAngle=atan(shellLocal.y,shellLocal.x);
    float shellLatitude=asin(clamp(shellLocal.z,-1.,1.));
    return vec2(fract((shellAngle+PI)/(2.*PI)-phase),.5-shellLatitude/PI);
  }
  float atmosphericCloudRegion(vec2 delta,float radius){
    float boundedRadius=min(radius,.46);
    return 1.-smoothstep(boundedRadius*.04,boundedRadius,length(delta));
  }
  float atmosphericCloudTexture(vec2 localUv,float seed,vec2 direction){
    vec2 rotated=vec2(localUv.x*direction.x-localUv.y*direction.y,localUv.x*direction.y+localUv.y*direction.x);
    float patchScale=.18+.20*cloudHash(seed+37.8);
    float sampleY=rotated.y*patchScale+cloudHash(seed+41.6);
    vec2 sampleUv=vec2(fract(rotated.x*patchScale+cloudHash(seed+34.9)),1.-abs(fract(sampleY*.5)*2.-1.));
    float detailY=(rotated.y*2.73-rotated.x*.37)*patchScale+cloudHash(seed+71.2);
    vec2 detailUv=vec2(fract((rotated.x*2.73+rotated.y*.31)*patchScale+cloudHash(seed+67.4)),1.-abs(fract(detailY*.5)*2.-1.));
    float sourceCloud=pow(texture2D(cloudsMap,sampleUv).r,1.18);
    float fineCloud=texture2D(cloudsMap,detailUv).r;
    return sourceCloud*(.78+.32*fineCloud)*.72;
  }
  float atmosphericCloudCoverage(vec2 uv,float amount,float day,float userSeed){
    vec2 weatherUv=vec2(fract(uv.x),clamp(uv.y,0.,1.));
    float target=clamp(amount,0.,1.)*16.;
    float cycle=floor(day/1.25),cover=0.;
    // Four deterministic weather generations overlap. The previous 100% level
    // now sits at 50%; 100% adds two more independently seeded systems to every
    // generation, doubling the available regional cloud cover.
    for(int i=0;i<16;i++){
      float fi=float(i),slot=floor(fi*.25),variant=mod(fi,4.);
      float rank=variant*4.+slot;
      float amountWeight=clamp(target-rank,0.,1.);
      if(amountWeight<=0.)continue;
      float birthIndex=cycle-slot,birth=birthIndex*1.25,age=day-birth;
      float seed=birthIndex*19.17+variant*83.41+userSeed*917.53;
      float lifetime=.5+4.5*cloudHash(seed+1.3);
      float birthDuration=min(1.5,lifetime*.40);
      float deathDuration=min(1.15,lifetime*.40);
      float birthFade=smoothstep(0.,birthDuration,age);
      float deathFade=smoothstep(lifetime-deathDuration,lifetime,age);
      float life=birthFade*(1.-deathFade);
      if(life<=0.)continue;
      float angle=cloudHash(seed+4.7)*6.28318530718;
      float speed=.007+.012*cloudHash(seed+7.1);
      vec2 direction=vec2(cos(angle),sin(angle));
      vec2 origin=vec2(cloudHash(seed+11.9),.12+.76*cloudHash(seed+15.2));
      // Clouds share the surface rotation rate. Only the short-lived local
      // weather drift remains, avoiding latitude-band work and visible shear.
      vec2 drift=direction*speed;
      vec2 center=origin+drift*age;
      center.x=fract(center.x);center.y=clamp(center.y,.04,.96);
      float dx=mod(weatherUv.x-center.x+.5,1.)-.5;
      float dy=(weatherUv.y-center.y)*1.55;
      vec2 delta=vec2(dx,dy);
      float radius=.30+.14*cloudHash(seed+21.6);
      float deathMode=cloudHash(seed+43.2),region=0.,shapeRadius=radius;
      if(deathMode<.333){
        float growScale=1.12+.58*cloudHash(seed+47.9);
        float birthScale=mix(growScale,1.,birthFade),deathScale=mix(1.,growScale,deathFade);
        shapeRadius=radius*birthScale*deathScale;
        region=atmosphericCloudRegion(delta,shapeRadius);
      }else if(deathMode<.666){
        float shrinkScale=.20+.50*cloudHash(seed+51.7);
        float birthScale=mix(shrinkScale,1.,birthFade),deathScale=mix(1.,shrinkScale,deathFade);
        shapeRadius=radius*birthScale*deathScale;
        region=atmosphericCloudRegion(delta,shapeRadius);
      }else{
        float scatter=max(1.-birthFade,deathFade);
        float branchCount=3.+floor(cloudHash(seed+55.1)*10.);
        float spread=radius*(.35+.55*cloudHash(seed+58.4))*scatter;
        float lobeScale=.25+.24*cloudHash(seed+61.8);
        float lobeRadius=radius*mix(1.,lobeScale,scatter);
        float branchWave=.5+.5*cos(atan(delta.y,delta.x)*branchCount+angle);
        shapeRadius=lobeRadius+spread*pow(branchWave,3.);
        region=atmosphericCloudRegion(delta,shapeRadius);
        vec2 sprayUv=delta/max(min(shapeRadius,.46),.02);
        float sprayNoise=.5+.5*sin((sprayUv.x*113.+sprayUv.y*179.+seed)*6.28318530718)*sin((sprayUv.x*197.-sprayUv.y*137.+seed*.73)*6.28318530718);
        float particleKeep=smoothstep(scatter*.65,.96,sprayNoise);
        region*=mix(1.,particleKeep,scatter*.82);
      }
      if(region<=0.)continue;
      vec2 localUv=delta/max(min(shapeRadius,.46),.02);
      float patch=atmosphericCloudTexture(localUv,seed,direction)*region*life*amountWeight;
      cover+=patch*(1.-cover);
    }
    // The user-facing 100% level is intentionally denser than the raw weather
    // blend while retaining headroom for terrain and night-light readability.
    return min(.92,cover*2.25);
  }`;
function surfaceKernel(style){
  const sun=style.sun;
  let assets={};
  const TAU=Math.PI*2,clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),smooth=(a,b,n)=>{const t=clamp((n-a)/(b-a),0,1);return t*t*(3-2*t);};
  const atmosphericRegion=(dx,dy,radius)=>{const boundedRadius=Math.min(radius,.46);return 1-smooth(boundedRadius*.04,boundedRadius,Math.hypot(dx,dy));};
  const atmosphericTexture=(texture,su,sv)=>{const w=texture.width,h=texture.height,x=su*w-.5,y=clamp(sv*h-.5,0,h-1),ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,x0=(ix+w)%w,x1=(x0+1)%w,y1=Math.min(h-1,iy+1),a=(iy*w+x0)*4,b=(iy*w+x1)*4,c=(y1*w+x0)*4,d=(y1*w+x1)*4;return (texture.data[a]*(1-fx)*(1-fy)+texture.data[b]*fx*(1-fy)+texture.data[c]*(1-fx)*fy+texture.data[d]*fx*fy)/255;};
  const setAssets=value=>{if(value)assets=value;};
  function dataBlob(url){const [meta,data]=url.split(','),raw=atob(data),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return new Blob([bytes],{type:meta.split(':')[1].split(';')[0]});}
  function sourceFor(asset,width){
    if(typeof asset==='string')return {url:asset,fallback:'',key:asset};
    const tiers=asset?.tiers||[],tier=tiers.find(row=>row.width>=width)||tiers[tiers.length-1];if(!tier)return null;
    const remote=asset.base?new URL(tier.path,asset.base).href:'',url=remote||asset.fallback;
    return {url,fallback:remote&&asset.fallback!==remote?asset.fallback:'',key:url+'|'+(remote?asset.fallback:''),seamBaked:!!asset.seamBaked};
  }
  async function bitmapFor(source,width=null,height=null,{signal,timeoutMs=15000}={}){
    const resize=width&&height?{resizeWidth:width,resizeHeight:height,resizeQuality:'high'}:{};
    let lastError;
    for(const url of [...new Set([source.url,source.fallback].filter(Boolean))]){
      signal?.throwIfAborted();
      const controller=new AbortController(),abort=()=>controller.abort(signal.reason);
      signal?.addEventListener('abort',abort,{once:true});
      const timer=setTimeout(()=>controller.abort(new DOMException('Material download timed out','TimeoutError')),timeoutMs);
      try{
        let bitmap;
        if(url.startsWith('data:'))bitmap=await createImageBitmap(dataBlob(url),resize);
        else if(!url.startsWith('file:')){const response=await fetch(url,{mode:'cors',credentials:'omit',cache:'force-cache',signal:controller.signal});if(!response.ok)throw Error('HTTP '+response.status);bitmap=await createImageBitmap(await response.blob(),resize);}
        else if(typeof document==='object'){const image=new Image();image.decoding='async';image.src=url;await image.decode();bitmap=await createImageBitmap(image,resize);}
        if(controller.signal.aborted){bitmap?.close();controller.signal.throwIfAborted();}
        if(bitmap)return bitmap;
      }catch(error){if(signal?.aborted)throw signal.reason;lastError=error;}
      finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
    }
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
    varying vec2 p; uniform sampler2D colorMap; uniform sampler2D bumpMap; uniform sampler2D cloudsMap; uniform sampler2D nightMap;
    uniform vec3 axisU,axisV,pole,light; uniform float phase,kind,hasBump,diameter,texel,nightTexel,effectTime,sunActivity,nightLights,cloudAmount,cloudSeed,weatherDay;
    const float PI=3.141592653589793;
    vec3 world(vec3 q){return axisU*q.x+axisV*q.y+pole*q.z;}
    ${EARTH_NIGHT_GLSL}
    ${ATMOSPHERIC_CLOUD_GLSL}
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
        float cloud=0.;
        vec2 cloudUv=atmosphericShellUv(n,1.007);
        if(cloudAmount>0.)cloud=atmosphericCloudCoverage(cloudUv,cloudAmount,weatherDay,cloudSeed);
        col=mix(col,vec3(.94,.965,1.)*(.14+day*.93),cloud);
        // A broad twilight band fades city lights in through early evening
        // and out again at dawn instead of switching at the terminator.
        float nightSide=(1.-smoothstep(-.34,.30,mu))*nightLights;
        float nightLimb=smoothstep(.035,.18,n.z);
        col+=cloudVeiledNight(uv,n.z,cloud)*nightSide*1.05*nightLimb;
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
        this.uniforms=Object.fromEntries(['colorMap','bumpMap','cloudsMap','nightMap','axisU','axisV','pole','light','phase','kind','hasBump','diameter','texel','nightTexel','effectTime','sunActivity','nightLights','cloudAmount','cloudSeed','weatherDay'].map(k=>[k,g.getUniformLocation(program,k)]));this.stats.backend='gpu';
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
      const {id,frame,phase,light,seconds=0,activity=false,nightLights=false,nightTextureWidth=0,cloudAmount=.5,cloudTextureWidth=0,cloudSeed=0,weatherDay=0}=job;const n=this.gl?Math.min(1024,job.diam):Math.min(768,job.diam);
      const width=this.gl?job.textureWidth:Math.min(4096,job.textureWidth);
      const color=await this.texture(id,width),bump=assets[id+'-relief']?await this.texture(id+'-relief',width):color;
      const clouds=id==='earth'&&cloudAmount>0?await this.texture('clouds',Math.min(4096,cloudTextureWidth||width)):color;
      const night=id==='earth'&&nightLights?await this.texture('earth-night',Math.min(2048,nightTextureWidth||width)):color;
      if(this.canvas.width!==n){this.canvas.width=this.canvas.height=n;}
      if(this.gl?.isContextLost())throw Error('WebGL context lost');
      if(this.gl){
        const g=this.gl,u=this.uniforms;g.viewport(0,0,n,n);g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT);g.useProgram(this.program);g.bindBuffer(g.ARRAY_BUFFER,this.buffer);
        const a=this.attribute;g.enableVertexAttribArray(a);g.vertexAttribPointer(a,2,g.FLOAT,false,0,0);
        for(const [i,t,name] of [[0,color,'colorMap'],[1,bump,'bumpMap'],[2,clouds,'cloudsMap'],[3,night,'nightMap']]){g.activeTexture(g.TEXTURE0+i);g.bindTexture(g.TEXTURE_2D,t.handle);g.uniform1i(u[name],i);}
        g.uniform3fv(u.axisU,frame.u);g.uniform3fv(u.axisV,frame.v);g.uniform3fv(u.pole,frame.pole);g.uniform3fv(u.light,light);
        g.uniform1f(u.phase,phase);g.uniform1f(u.kind,id==='earth'?1:id==='sun'?2:id==='uranus'?4:['jupiter','saturn','venus','neptune'].includes(id)?3:0);
        g.uniform1f(u.hasBump,bump!==color?1:0);g.uniform1f(u.diameter,n);g.uniform1f(u.texel,1/width);g.uniform1f(u.nightTexel,1/night.width);g.uniform1f(u.effectTime,seconds);g.uniform1f(u.sunActivity,activity?1:0);g.uniform1f(u.nightLights,night!==color?1:0);g.uniform1f(u.cloudAmount,cloudAmount);g.uniform1f(u.cloudSeed,cloudSeed);g.uniform1f(u.weatherDay,weatherDay);g.drawArrays(g.TRIANGLES,0,6);
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
          const mu=nx*light[0]+ny*light[1]+nz*light[2],day=Math.max(0,mu);
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
            let cover=0;
            if(cloudAmount>0){
              const shellRadius=1.007,shellX=nx/shellRadius,shellY=ny/shellRadius,shellZ=Math.sqrt(Math.max(0,1-(nx*nx+ny*ny)/(shellRadius*shellRadius))),shellDot=a=>a[0]*shellX+a[1]*shellY+a[2]*shellZ;
              const cloudU=(Math.atan2(shellDot(frame.v),shellDot(frame.u))/TAU+.5-phase+2)%1,cloudV=Math.acos(clamp(shellDot(frame.pole),-1,1))/Math.PI;
              const hash=n=>((Math.sin(n)*43758.5453123)%1+1)%1,target=clamp(cloudAmount,0,1)*16,cycle=Math.floor(weatherDay/1.25);
              for(let system=0;system<16;system++){
                const slot=Math.floor(system*.25),variant=system%4,rank=variant*4+slot,amountWeight=clamp(target-rank,0,1);
                if(amountWeight<=0)continue;
                const birthIndex=cycle-slot,birth=birthIndex*1.25,age=weatherDay-birth,seed=birthIndex*19.17+variant*83.41+cloudSeed*917.53,lifetime=.5+4.5*hash(seed+1.3),birthDuration=Math.min(1.5,lifetime*.40),deathDuration=Math.min(1.15,lifetime*.40);
                const birthFade=smooth(0,birthDuration,age),deathFade=smooth(lifetime-deathDuration,lifetime,age),life=birthFade*(1-deathFade);if(life<=0)continue;
                const angle=hash(seed+4.7)*TAU,speed=.007+.012*hash(seed+7.1),dirX=Math.cos(angle),dirY=Math.sin(angle),originY=.12+.76*hash(seed+15.2);
                const driftX=dirX*speed,driftY=dirY*speed;
                const centerX=(hash(seed+11.9)+driftX*age+1)%1,centerY=clamp(originY+driftY*age,.04,.96);
                const weatherU=((cloudU%1)+1)%1,weatherV=cloudV;let dx=weatherU-centerX;if(dx>.5)dx-=1;else if(dx<-.5)dx+=1;
                const dy=(weatherV-centerY)*1.55,deltaRadius=.30+.14*hash(seed+21.6),deathMode=hash(seed+43.2),regionAt=(ox,oy,radius)=>atmosphericRegion(dx-ox,dy-oy,radius);let region,shapeRadius=deltaRadius;
                if(deathMode<.333){const growScale=1.12+.58*hash(seed+47.9);shapeRadius=deltaRadius*(growScale+(1-growScale)*birthFade)*(1+(growScale-1)*deathFade);region=regionAt(0,0,shapeRadius);}
                else if(deathMode<.666){const shrinkScale=.20+.50*hash(seed+51.7);shapeRadius=deltaRadius*(shrinkScale+(1-shrinkScale)*birthFade)*(1+(shrinkScale-1)*deathFade);region=regionAt(0,0,shapeRadius);}
                else{
                  const scatter=Math.max(1-birthFade,deathFade),branchCount=3+Math.floor(hash(seed+55.1)*10),spread=deltaRadius*(.35+.55*hash(seed+58.4))*scatter,lobeScale=.25+.24*hash(seed+61.8),lobeRadius=deltaRadius*(1+(lobeScale-1)*scatter),branchWave=.5+.5*Math.cos(Math.atan2(dy,dx)*branchCount+angle),branchRadius=lobeRadius+spread*branchWave**3;
                  shapeRadius=branchRadius;region=regionAt(0,0,shapeRadius);
                  const boundedRadius=Math.max(.02,Math.min(shapeRadius,.46)),sprayU=dx/boundedRadius,sprayV=dy/boundedRadius,sprayNoise=.5+.5*Math.sin((sprayU*113+sprayV*179+seed)*TAU)*Math.sin((sprayU*197-sprayV*137+seed*.73)*TAU),particleKeep=smooth(scatter*.65,.96,sprayNoise);
                  region*=1-scatter*.82+particleKeep*scatter*.82;
                }
                if(region<=0)continue;
                const boundedRadius=Math.max(.02,Math.min(shapeRadius,.46)),localU=dx/boundedRadius,localV=dy/boundedRadius,rotatedU=localU*dirX-localV*dirY,rotatedV=localU*dirY+localV*dirX,patchScale=.18+.20*hash(seed+37.8),sampleU=((rotatedU*patchScale+hash(seed+34.9))%1+1)%1,sampleY=rotatedV*patchScale+hash(seed+41.6),sampleV=1-Math.abs(((((sampleY*.5)%1)+1)%1)*2-1);
                const detailU=(((rotatedU*2.73+rotatedV*.31)*patchScale+hash(seed+67.4))%1+1)%1,detailY=(rotatedV*2.73-rotatedU*.37)*patchScale+hash(seed+71.2),detailV=1-Math.abs(((((detailY*.5)%1)+1)%1)*2-1),sourceCloud=atmosphericTexture(clouds,sampleU,sampleV)**1.18,fineCloud=atmosphericTexture(clouds,detailU,detailV);
                const patch=sourceCloud*(.78+.32*fineCloud)*.72*region*life*amountWeight;cover+=patch*(1-cover);
              }
              cover=Math.min(.92,cover*2.25);
            }
            const rim=(1-nz)**4*(.05+.8*day);
            data[i]=data[i]*(1-cover)+240*(.14+.93*day)*cover+19*rim;
            data[i+1]=data[i+1]*(1-cover)+246*(.14+.93*day)*cover+92*rim;
            data[i+2]=data[i+2]*(1-cover)+255*(.14+.93*day)*cover+184*rim;
            if(night!==color){
              const nightY=Math.min(night.height-1,Math.floor(v*night.height)),nightX=Math.floor(u*night.width),ni=(nightY*night.width+nightX)*4,nightLimb=smooth(.035,.24,nz),nightSide=(1-smooth(-.34,.30,mu))*1.05*nightLimb;
              let red=night.data[ni],green=night.data[ni+1],blue=night.data[ni+2];
              if(cover>.01){
                const spread=Math.max(1,Math.round(2+cover*4)),left=(nightY*night.width+(nightX-spread+night.width)%night.width)*4,right=(nightY*night.width+(nightX+spread)%night.width)*4,up=(Math.max(0,nightY-spread*2)*night.width+nightX)*4,down=(Math.min(night.height-1,nightY+spread*2)*night.width+nightX)*4,mixAmount=cover*.48,shade=1-cover*.42;
                red=(red*(1-mixAmount)+(red*2+night.data[left]+night.data[right]+night.data[up]+night.data[down])/6*mixAmount)*shade;
                green=(green*(1-mixAmount)+(green*2+night.data[left+1]+night.data[right+1]+night.data[up+1]+night.data[down+1])/6*mixAmount)*shade;
                blue=(blue*(1-mixAmount)+(blue*2+night.data[left+2]+night.data[right+2]+night.data[up+2]+night.data[down+2])/6*mixAmount)*shade;
              }
              data[i]+=red*nightSide;data[i+1]+=green*nightSide;data[i+2]+=blue*nightSide;
            }
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
const BASELINE_TEXTURE_WIDTH=256;
const PREVIEW_TEXTURE_WIDTH=1024;
class SurfaceService{
  constructor({worker=true}={}){
    this.frames=new Map();this.desired=new Map();this.pending=null;this.inflight=false;this.disposed=false;
    this.epoch=0;this.revision=0;this.worker=null;this.sync=null;this.timer=null;this.assetsSent=false;this.batch=null;this.paused=false;
    this.stats={backend:'compatibility',submitted:0,accepted:0,discarded:0,workerMs:0,mapPixels:0,texturePixels:0};
    if(worker&&typeof Worker==='function'&&typeof OffscreenCanvas==='function'){
      let url;try{
        const boot=`const EARTH_NIGHT_GLSL=${JSON.stringify(EARTH_NIGHT_GLSL)};const ATMOSPHERIC_CLOUD_GLSL=${JSON.stringify(ATMOSPHERIC_CLOUD_GLSL)};const kernel=(${surfaceKernel.toString()})(${JSON.stringify(STYLE)});const engine=new kernel.Engine();onmessage=async e=>{const {jobs,revision,epoch,assets}=e.data;if(assets)kernel.setAssets(assets);const start=performance.now();try{for(const job of jobs){const canvas=await engine.render(job);const bitmap=canvas.transferToImageBitmap();postMessage({kind:'frame',revision,epoch,job,bitmap},[bitmap]);}postMessage({kind:'done',revision,epoch,ms:performance.now()-start,stats:engine.stats,mapPixels:engine.mapPixels,texturePixels:engine.texturePixels});}catch(error){postMessage({kind:'error',revision,epoch,message:error.message});}};`;
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

  needs(job,mono){const old=this.frames.get(job.id);if(!old||old.epoch!==this.epoch||old.job.geometry!==job.geometry||old.job.textureWidth<job.textureWidth)return true;if(job.phase===old.job.phase&&job.seconds===old.job.seconds&&job.weatherDay===old.job.weatherDay&&job.light.every((v,i)=>v===old.job.light[i]))return false;const turn=Math.abs(job.phase-old.job.phase);return mono-old.mono>=120||Math.min(turn,1-turn)*Math.PI*job.diam>.18;}
  pump(){
    if(this.disposed||this.paused||this.inflight||!this.pending)return;const {mono}=this.pending;let jobs=this.pending.jobs.filter(j=>this.needs(j,mono));this.pending=null;if(!jobs.length)return;
    this.inflight=true;this.stats.submitted++;const revision=++this.revision,epoch=this.epoch;jobs=jobs.map(job=>({...job,textureWidth:job.textureWidth>PREVIEW_TEXTURE_WIDTH&&(this.frames.get(job.id)?.job.textureWidth||0)<PREVIEW_TEXTURE_WIDTH?PREVIEW_TEXTURE_WIDTH:job.textureWidth,requestedMono:mono}));
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
  varying vec2 p;uniform sampler2D colorMap,bumpMap,cloudsMap,nightMap;
  uniform vec3 axisU,axisV,pole,light;uniform float phase,kind,hasBump,diameter,texel,nightTexel,effectTime,sunActivity,nightLights,cloudAmount,cloudSeed,weatherDay;
  const float PI=3.141592653589793;
  vec3 world(vec3 q){return axisU*q.x+axisV*q.y+pole*q.z;}
  ${EARTH_NIGHT_GLSL}
  ${ATMOSPHERIC_CLOUD_GLSL}
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
      float cloud=0.;
      vec2 cloudUv=atmosphericShellUv(n,1.007);
      if(cloudAmount>0.)cloud=atmosphericCloudCoverage(cloudUv,cloudAmount,weatherDay,cloudSeed);
      col=mix(col,vec3(.94,.965,1.)*(.14+day*.93),cloud);
      float nightSide=(1.-smoothstep(-.34,.30,mu))*nightLights;
      float nightLimb=smoothstep(.035,.18,n.z);
      col+=cloudVeiledNight(uv,n.z,cloud)*nightSide*1.05*nightLimb;
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
  uniform vec4 camera;uniform float lens,travel,scale,localScale;
  void main(){
    vec3 p=a*localScale+worldOffset-anchor;
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
    this.textures=new Map();this.recentTextures=new Map();this.textureIntent=null;this.frames=new Map();this.desired=new Map();this.orbitBuffers=new Map();this.textureSources=new Map();this.coronaTexture=null;this.pendingCount=0;this.loadQueue=[];this.activeLoads=0;
    this.boundProgram=null;this.boundBuffer=null;this.boundAttrib=-1;this.boundAttribSize=0;this.boundAttribBuffer=null;this.activeTextureUnit=-1;this.boundTextures=[null,null,null,null];this.canvasViewportW=0;this.canvasViewportH=0;this.orbitState={valid:false};
    this.stats={backend:'gpu-direct',accepted:0,discarded:0,drawCalls:0,frames:0,texturesLoaded:0,texturePixels:0,orbitUploads:0,kernel:{backend:'gpu-direct'}};
    this.contextLost=false;this.onLost=event=>{event.preventDefault();this.contextLost=true;this.invalidate();this.orbitBuffers.clear();this.resetBindings();this.stats.contextLost=true;};
    this.onRestored=()=>{this.contextLost=false;this.recentTextures.clear();this.textures.clear();this.frames.clear();this.desired.clear();this.orbitBuffers.clear();this.coronaTexture=null;this.stats.texturePixels=0;this.stats.contextLost=false;this.stats.recoveries=(this.stats.recoveries||0)+1;this.resetBindings();this.setup();};
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
    this.planetProgram=directProgram(g,DIRECT_QUAD_VERTEX,DIRECT_PLANET_FRAGMENT,['center','viewport','radius','colorMap','bumpMap','cloudsMap','nightMap','axisU','axisV','pole','light','phase','kind','hasBump','diameter','texel','nightTexel','effectTime','sunActivity','nightLights','cloudAmount','cloudSeed','weatherDay']);
    this.coronaProgram=directProgram(g,DIRECT_QUAD_VERTEX,DIRECT_CORONA_FRAGMENT,['center','viewport','radius','coronaMap','effectTime']);
    this.line=directProgram(g,DIRECT_LINE_VERTEX,DIRECT_COLOR_FRAGMENT,['center','viewport','worldOffset','anchor','camera','lens','travel','scale','localScale','color']);
    this.ring=directProgram(g,DIRECT_RING_VERTEX,DIRECT_RING_FRAGMENT,['center','viewport','axisU','axisV','radius','outer','depthAxis','inner','front','saturn','pixel','ringColor']);
    this.quad=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,this.quad);g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),g.STATIC_DRAW);
    this.black=g.createTexture();g.bindTexture(g.TEXTURE_2D,this.black);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,1,1,0,g.RGBA,g.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));
    g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);
    g.useProgram(this.planetProgram.program);g.uniform1i(this.planetProgram.u.colorMap,0);g.uniform1i(this.planetProgram.u.bumpMap,1);g.uniform1i(this.planetProgram.u.cloudsMap,2);
    g.uniform1i(this.planetProgram.u.nightMap,3);
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
  visibleTexturesReady(){
    if(!this.desired.size)return false;
    for(const id of this.desired.keys())if(!this.textures.get(id)?.texture)return false;
    return true;
  }
  begin(){
    if(this.disposed||this.paused||this.contextLost)return false;
    const g=this.gl;this.applyCanvasViewport();g.clear(g.COLOR_BUFFER_BIT);
    this.stats.frames++;this.stats.drawCalls=0;this.desired.clear();return true;
  }
  prepare(jobs){
    for(const job of jobs)this.desired.set(job.id,job);
    this.pruneTextureQueue();
    const assets=root.SolarAssets?.materials,key=jobs.map(job=>job.id+':'+job.textureWidth+':'+(job.nightTextureWidth||0)+':'+(job.cloudTextureWidth||0)+':'+job.priority+':'+Number(job.nightLights)+':'+(Number.isFinite(job.cloudAmount)?job.cloudAmount:job.id==='earth'?.5:0)).join('|');
    if(key!==this.planKey||assets!==this.planAssets){
      this.planKey=key;this.planAssets=assets;this.texturePlan=root.SolarPerformance?.planTextures(jobs,assets,this.maxTextureSize);
      this.stats.plannedTextureBytes=this.texturePlan?.bytes||0;
    }
    // Jobs arrive focus-first, before depth sorting for painting. Start the
    // important color maps first rather than letting a distant body take a slot.
    for(const job of jobs){this.texture(job.id,job.textureWidth);if(job.id==='earth'&&job.nightLights)this.texture('earth-night',Math.min(4096,job.nightTextureWidth||job.textureWidth));}
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
  textureIsWanted(name){
    if(this.desired.has(name)||root.SolarPerformance?.protectTexture(this,name))return true;
    const intent=this.textureIntent;
    return !!intent&&intent.id===name&&performance.now()<intent.until;
  }
  texturePriority(task){
    const name=task.name,body=name==='clouds'||name==='earth-night'?'earth':name.replace(/-relief$/,''),job=this.desired.get(body);
    const intent=this.textureIntent,preview=task.target<=PREVIEW_TEXTURE_WIDTH,color=body===name;
    const focused=job?.priority===2||(intent?.id===body&&performance.now()<intent.until);
    if(focused&&color)return preview?600:500;
    if(!this.textures.get(name)?.texture&&this.textureIsWanted(name))return 450;
    if(focused)return preview?430:400;
    if(job?.priority===1&&color)return preview?380:350;
    return this.textureIsWanted(name)?(preview?150:100):0;
  }
  // This is an early request through the SAME progressive owner, not a second
  // download/cache. Start only the preview; a resident final tier is a fast path.
  prefetchBody(name,target=4096){
    if(this.disposed||this.paused||this.contextLost)return;
    const asset=root.SolarAssets?.materials?.[name];if(!asset)return;
    this.textureIntent={id:name,until:performance.now()+2500};
    target=directPower(Math.min(target,this.maxTextureSize,asset.tiers?.at(-1)?.width||target));
    const current=this.textures.get(name);
    if(current?.asset===asset&&current.texture&&current.width>=PREVIEW_TEXTURE_WIDTH)return;
    if(this.restoreRecent(name,asset,target))return;
    this.textureFor(name,Math.min(PREVIEW_TEXTURE_WIDTH,target),true);
    this.pumpTextureQueue();
  }
  cancelTexture(name){
    const record=this.textures.get(name);record?.controller?.abort();
    this.loadQueue=this.loadQueue.filter(task=>{if(task.name!==name)return true;if(task.generation===this.generation)this.pendingCount=Math.max(0,this.pendingCount-1);return false;});
    if(record)record.pending=false;
  }
  pruneTextureQueue(){
    for(const [name,record] of this.textures)if(record.pending&&!this.textureIsWanted(name))this.cancelTexture(name);
  }
  queueTexture(task){this.loadQueue.push(task);this.pendingCount++;this.pumpTextureQueue();}
  pumpTextureQueue(){
    if(this.disposed||this.paused||this.contextLost)return;
    // Re-evaluate queued work against the latest focus. Never start all tiers
    // or prefetch every planet, and keep the existing two-slot bound.
    this.loadQueue.sort((a,b)=>this.texturePriority(b)-this.texturePriority(a)||a.token-b.token);
    while(this.activeLoads<2&&this.loadQueue.length){
      const task=this.loadQueue.shift(),record=this.textures.get(task.name);
      if(task.generation!==this.generation||!record||record.token!==task.token||record.source.key!==task.source.key){if(task.generation===this.generation)this.pendingCount=Math.max(0,this.pendingCount-1);continue;}
      const controller=new AbortController();record.controller=controller;
      this.activeLoads++;this.loadTexture(task.name,task.source,task.target,task.token,task.generation,controller.signal).finally(()=>{this.activeLoads=Math.max(0,this.activeLoads-1);if(record.controller===controller)record.controller=null;this.pumpTextureQueue();});
    }
  }
  recentKey(name,source,width){return name+':'+width+'|'+source.key;}
  discardRecent(key){
    const old=this.recentTextures?.get(key);if(!old)return;
    if(!this.contextLost)this.gl.deleteTexture(old.texture);
    this.stats.texturePixels-=old.width*old.height;this.recentTextures.delete(key);
    this.stats.recentEvictions=(this.stats.recentEvictions||0)+1;this.resetTextureBindings();
  }
  trimRecent(reserveBytes=0){
    const recent=this.recentTextures;if(!recent?.size)return;
    const budget=root.SolarPerformance?.textureBudget()||192*1024*1024,limit=Math.min(64*1024*1024,budget/3);
    let bytes=0;for(const row of recent.values())bytes+=row.width*row.height*4;
    for(const [key,row] of recent){
      if(bytes<=limit&&this.stats.texturePixels*4+reserveBytes<=budget)break;
      bytes-=row.width*row.height*4;this.discardRecent(key);
    }
    this.stats.recentTextureBytes=bytes;
  }
  parkTexture(name,record){
    if(!record?.texture)return;
    // Store the actually uploaded source, not an unfinished replacement URL.
    const source=record.residentSource||record.source;
    if(!this.contextLost&&record.width>=PREVIEW_TEXTURE_WIDTH&&source){
      this.recentTextures ||= new Map();
      const key=this.recentKey(name,source,record.width);this.discardRecent(key);
      this.recentTextures.set(key,{asset:record.residentAsset||record.asset,source,texture:record.texture,width:record.width,height:record.height});
    }else{
      if(!this.contextLost)this.gl.deleteTexture(record.texture);
      this.stats.texturePixels-=record.width*record.height;
    }
  }
  restoreRecent(name,asset,target){
    const source=this.textureSource(name,asset,target),key=source&&this.recentKey(name,source,target),saved=this.recentTextures?.get(key);
    if(!saved)return null;
    if(saved.asset!==asset){this.discardRecent(key);return null;}
    this.recentTextures.delete(key);const current=this.textures.get(name);
    this.cancelTexture(name);this.parkTexture(name,current);
    const record={...saved,residentSource:saved.source,pending:false,token:++this.textureToken,retryAt:0};
    this.textures.set(name,record);this.resetTextureBindings();this.trimRecent();
    this.stats.recentHits=(this.stats.recentHits||0)+1;this.stats.accepted=(this.stats.accepted||0)+1;
    return record;
  }
  async loadTexture(name,source,target,token,generation,signal){
    let bitmap,canvas,texture;
    try{
      const requested=this.textures.get(name);if(!requested||requested.token!==token||requested.source.key!==source.key||generation!==this.generation)return;
      bitmap=await materialSource.bitmapFor(source,null,null,{signal});
      if(this.disposed||signal?.aborted||generation!==this.generation||this.textures.get(name)?.token!==token)return;
      const natural=2**Math.floor(Math.log2(Math.max(2,bitmap.width))),width=Math.max(2,Math.min(target,natural)),height=width/2;
      let upload=bitmap;
      if(!source.seamBaked||bitmap.width!==width||bitmap.height!==height){
        canvas=materialSource.materialCanvas(bitmap,width,height,false,source.seamBaked).canvas;upload=canvas;
      }
      if(this.disposed||generation!==this.generation)return;
      const prior=this.textures.get(name);
      if(prior?.texture&&target>prior.width&&width<prior.width&&prior.asset===root.SolarAssets?.materials?.[name]){
        Object.assign(prior,{pending:false,retryAt:Date.now()+30000});return;
      }
      this.trimRecent(width*height*4);
      root.SolarPerformance?.trimTextures(this,width*height*4);
      const g=this.gl;texture=g.createTexture();g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,texture);this.resetTextureBindings();g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,false);
      g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,upload);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.REPEAT);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);
      // Explicit screen-size texture tiers provide LOD without the longitude
      // derivative seam that implicit mip selection creates on a sphere.
      g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);
      const record=this.textures.get(name);if(!record||record.token!==token||record.source.key!==source.key){g.deleteTexture(texture);texture=null;this.stats.discarded++;return;}
      this.parkTexture(name,record);
      Object.assign(record,{texture,width,height,residentSource:source,residentAsset:record.asset,pending:false,error:null,retryAt:width<target?Date.now()+30000:0});texture=null;this.stats.accepted++;this.stats.texturesLoaded++;this.stats.texturePixels+=width*height;
      this.trimRecent();
    }catch(error){const record=this.textures.get(name);if(!signal?.aborted&&generation===this.generation&&record&&record.token===token){record.pending=false;record.error=error.message;record.retryAt=Date.now()+30000;this.stats.error=error.message;}}
    finally{bitmap?.close?.();if(texture&&!this.contextLost)this.gl.deleteTexture(texture);if(generation===this.generation)this.pendingCount=Math.max(0,this.pendingCount-1);}
  }
  texture(name,target){const result=this.textureFor(name,target);root.SolarPerformance?.touchTexture(this,name);return result;}
  textureFor(name,target,previewIntent=false){
    const asset=root.SolarAssets?.materials?.[name];if(!asset)return null;
    target=directPower(Math.min(target,this.maxTextureSize,previewIntent?Infinity:this.texturePlan?.targets.get(name)??Infinity,asset.tiers?.at(-1)?.width||target));
    let record=this.textures.get(name);
    const assetChanged=!record||record.asset!==asset,now=performance.now();
    const current=record?.pending?Math.max(record.width,record.pendingTarget):record?.width||0;
    if(!assetChanged&&current>target&&!this.texturePlan?.constrained){
      if(record.lowerTarget!==target){record.lowerTarget=target;record.lowerSince=now;}
      if(now-record.lowerSince<650)return record.texture?record:null;
    }else if(record){record.lowerTarget=0;record.lowerSince=0;}
    // A ready exact tier is the only bypass of progressive loading. Browsers'
    // HTTP cache cannot be assumed synchronous; uncached detail always has a
    // 1024 preview first, without walking through 512 and 2048 downloads.
    if(!(record?.asset===asset&&record.texture&&record.width===target)){
      const ready=this.restoreRecent(name,asset,target);if(ready)return ready;
    }
    if(!record?.texture)target=Math.min(target,record?.pending&&record.pendingTarget<=PREVIEW_TEXTURE_WIDTH?record.pendingTarget:previewIntent?PREVIEW_TEXTURE_WIDTH:BASELINE_TEXTURE_WIDTH);
    else if(record.width<PREVIEW_TEXTURE_WIDTH&&target>PREVIEW_TEXTURE_WIDTH)target=PREVIEW_TEXTURE_WIDTH;
    const source=this.textureSource(name,asset,target);if(!source)return null;
    const changed=assetChanged||record.source.key!==source.key,resize=!record?.texture||record.width!==target,retryReady=changed||!record?.retryAt||Date.now()>=record.retryAt;
    if(retryReady&&(changed||resize)&&(!record?.pending||record.pendingTarget!==target||changed)){
      this.cancelTexture(name);
      const old=record?.texture||null,token=++this.textureToken,generation=this.generation;
      record={asset,source,residentAsset:record?.residentAsset||record?.asset,residentSource:record?.residentSource||record?.source,texture:old,width:record?.width||0,height:record?.height||0,pending:true,pendingTarget:target,token};
      this.textures.set(name,record);this.queueTexture({name,source,target,token,generation});
    }
    return record?.texture?record:null;
  }
  orbit(key,xyz,worldOffset,camera,scale,centerX,centerY,color,alpha,localScale=1){
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
    g.uniform3f(p.u.worldOffset,offset.x,offset.y,offset.z);g.uniform1f(p.u.localScale,localScale);g.uniform4f(p.u.color,color[0],color[1],color[2],alpha);
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
    const cloudAmount=job.id==='earth'?(Number.isFinite(job.cloudAmount)?Math.max(0,Math.min(1,job.cloudAmount)):.5):0;
    const clouds=cloudAmount>0?this.texture('clouds',Math.min(4096,job.cloudTextureWidth||job.textureWidth)):null;
    const night=job.id==='earth'&&job.nightLights?this.texture('earth-night',Math.min(4096,job.nightTextureWidth||job.textureWidth)):null;
    // Rings are children of this body: the surface and both ring halves share
    // exactly one parent transform and cannot drift into separate orientations.
    const frame=job.frame;
    if(body.id==='saturn'||body.id==='uranus')this.rings(body,frame,screen,radius,false);
    const g=this.gl,p=this.planetProgram;this.bind(p);this.viewport(p);g.uniform2f(p.u.center,screen.x,screen.y);g.uniform1f(p.u.radius,radius);g.uniform3fv(p.u.axisU,frame.u);g.uniform3fv(p.u.axisV,frame.v);g.uniform3fv(p.u.pole,frame.pole);g.uniform3fv(p.u.light,job.light);
    g.uniform1f(p.u.phase,job.phase);g.uniform1f(p.u.kind,job.id==='earth'?1:job.id==='sun'?2:job.id==='uranus'?4:['jupiter','saturn','venus','neptune'].includes(job.id)?3:0);g.uniform1f(p.u.hasBump,bump?1:0);g.uniform1f(p.u.diameter,radius*2*this.dpr);g.uniform1f(p.u.texel,1/color.width);g.uniform1f(p.u.nightTexel,1/(night?.width||color.width));g.uniform1f(p.u.effectTime,time);g.uniform1f(p.u.sunActivity,activity?1:0);g.uniform1f(p.u.nightLights,night?1:0);g.uniform1f(p.u.cloudAmount,cloudAmount);g.uniform1f(p.u.cloudSeed,Number.isFinite(job.cloudSeed)?job.cloudSeed:0);g.uniform1f(p.u.weatherDay,Number.isFinite(job.weatherDay)?job.weatherDay:0);
    this.bindTextureUnit(0,color.texture);this.bindTextureUnit(1,bump?.texture||color.texture);this.bindTextureUnit(2,clouds?.texture||this.black);this.bindTextureUnit(3,night?.texture||this.black);
    g.drawArrays(g.TRIANGLES,0,6);this.stats.drawCalls++;
    if(body.id==='saturn'||body.id==='uranus')this.rings(body,frame,screen,radius,true);
    let frameRecord=this.frames.get(job.id);if(!frameRecord){frameRecord={job:null,image:{width:0,height:0,gpu:true}};this.frames.set(job.id,frameRecord);}
    frameRecord.job=job;frameRecord.image.width=Math.round(radius*2*this.dpr);frameRecord.image.height=Math.round(radius*2*this.dpr);return true;
  }
  end(){
    for(const id of this.frames.keys())if(!this.desired.has(id))this.frames.delete(id);
    this.pruneTextureQueue();this.trimRecent();
    root.SolarPerformance?.enforceTextureBudget(this);
  }
  flush(){if(!this.disposed&&!this.contextLost)this.gl.flush();}
  get(id){return this.frames.get(id)?.image;}
  invalidate(){this.textureIntent=null;for(const record of this.textures.values()){record.controller?.abort();record.pending=false;}this.generation++;this.loadQueue=[];this.pendingCount=0;}
  pause(){this.paused=true;this.invalidate();}
  resume(){this.paused=false;this.pumpTextureQueue();}
  suspend(){this.pause();}
  dispose(){
    if(this.disposed)return;this.disposed=true;this.invalidate();const g=this.gl;
    for(const key of this.recentTextures?.keys()||[])this.discardRecent(key);
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
