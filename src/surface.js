/* Solar Time v0.05 — shared surface kernel and its bounded worker owner.
 * The same kernel runs in an offline Blob worker or the explicit compatibility
 * adapter. All physics is supplied by SolarAstro; there is no second time model.
 */
(function(root) {
  'use strict';
  function surfaceKernel() {
  const TAU=Math.PI*2,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function random(seed) { return function() { let t=seed+=0x6D2B79F5; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
  const mix=(a,b,t)=>a+(b-a)*t;
  const SURFACE={baseWidth:256,detailWidth:2048};
  const makeCanvas=(w,h=w)=>{const c=typeof OffscreenCanvas==='function'?new OffscreenCanvas(w,h):document.createElement('canvas');c.width=w;c.height=h;return c;};
  function noise(x,y) {
    const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
    const hash=(a,b)=>{ let h=Math.imul(a,374761393)+Math.imul(b,668265263); h=Math.imul(h^(h>>>13),1274126177); return ((h^(h>>>16))>>>0)/4294967295; };
    return mix(mix(hash(ix,iy),hash(ix+1,iy),sx),mix(hash(ix,iy+1),hash(ix+1,iy+1),sx),sy);
  }
  function fbm(x,y) { return noise(x,y)*.53+noise(x*2.03+19,y*2.03)*.27+noise(x*4.11,y*4.11+37)*.13+noise(x*8.17,y*8.17)*.07; }
  function noise3(x,y,z) {
    const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);
    const smooth=v=>v*v*(3-2*v),fx=smooth(x-ix),fy=smooth(y-iy),fz=smooth(z-iz);
    const hash=(a,b,c)=>{let n=Math.imul(a,374761393)^Math.imul(b,668265263)^Math.imul(c,2147483647);
      n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
    const layer=k=>mix(mix(hash(ix,iy,k),hash(ix+1,iy,k),fx),mix(hash(ix,iy+1,k),hash(ix+1,iy+1,k),fx),fy);
    return mix(layer(iz),layer(iz+1),fz);
  }
  const palettes={
    mercury:[[62,57,54],[129,120,108],[193,183,168]],
    venus:[[161,111,47],[218,181,111],[247,222,164]],
    mars:[[86,43,29],[176,84,48],[226,155,108]],
    jupiter:[[113,77,61],[197,160,125],[241,224,190]],
    saturn:[[143,122,87],[206,188,144],[242,226,184]],
    uranus:[[67,143,158],[127,195,204],[185,230,228]],
    neptune:[[22,50,133],[43,93,192],[104,162,228]],
    pluto:[[91,64,52],[158,125,100],[213,196,165]],
    moon:[[66,67,69],[135,135,132],[208,205,196]],
    sun:[[140,32,3],[250,133,21],[255,240,160]]
  };
  function colorAt(p,t) { t=clamp(t,0,1); const i=t<.5?0:1, f=t<.5?t*2:(t-.5)*2; return p[i].map((v,j)=>mix(v,p[i+1][j],f)); }
  // Hand-drawn, simplified geographic masks in longitude/latitude, intentionally not a GIS map.
  const continents=[
    [[-168,70],[-150,71],[-134,60],[-126,52],[-124,41],[-118,33],[-111,30],[-105,23],[-97,19],[-88,21],[-82,26],[-81,34],[-75,40],[-66,44],[-60,52],[-69,58],[-82,62],[-92,69],[-109,73],[-130,70]],
    [[-92,20],[-88,16],[-85,10],[-78,8],[-77,5],[-81,8]],
    [[-80,10],[-69,11],[-61,6],[-50,1],[-35,-6],[-40,-20],[-49,-30],[-57,-38],[-66,-55],[-73,-51],[-74,-35],[-71,-19],[-80,-4]],
    [[-53,59],[-44,61],[-22,72],[-25,82],[-44,84],[-62,78]],
    [[-17,36],[-6,36],[11,37],[25,32],[34,31],[35,22],[44,12],[51,12],[43,-11],[35,-23],[28,-34],[18,-35],[11,-20],[9,-1],[-6,5],[-16,14]],
    [[-10,36],[-9,44],[2,50],[8,55],[7,62],[20,70],[34,71],[29,61],[40,57],[47,68],[70,73],[99,77],[128,73],[153,61],[177,64],[179,52],[163,57],[151,47],[144,45],[141,37],[131,43],[127,36],[121,30],[122,23],[112,20],[109,9],[102,2],[98,8],[99,21],[89,22],[81,8],[75,12],[67,25],[57,25],[53,17],[44,13],[36,30],[26,40],[14,41],[5,43]],
    [[113,-22],[119,-18],[129,-14],[137,-12],[143,-17],[153,-25],[150,-36],[137,-39],[129,-32],[115,-35]],
    [[47,-13],[51,-17],[48,-26],[44,-23]],[[131,32],[141,42],[145,44],[141,34]],
    [[95,5],[104,-5],[114,-8],[117,-7],[109,0]],[[132,-3],[148,-6],[145,-10],[133,-8]],
    [[167,-34],[178,-39],[172,-46],[166,-46]],
    [[-180,-72],[-145,-76],[-100,-72],[-62,-63],[-54,-72],[-14,-70],[24,-68],[70,-69],[106,-66],[150,-69],[180,-72],[180,-90],[-180,-90]]
  ];
  function createTexture(id,w=SURFACE.baseWidth) {
    const h=w/2,can=makeCanvas(1); can.width=w;can.height=h;
    const c=can.getContext('2d'), image=c.createImageData(w,h),data=image.data;
    let mask=null;
    if(id==='earth') {
      const land=makeCanvas(1);land.width=w;land.height=h;
      const lc=land.getContext('2d');lc.fillStyle='white';
      for(const poly of continents) { lc.beginPath();poly.forEach(([lon,lat],i)=>{const x=(lon+180)/360*w,y=(90-lat)/180*h;i?lc.lineTo(x,y):lc.moveTo(x,y);});lc.closePath();lc.fill(); }
      mask=lc.getImageData(0,0,w,h).data;
    }
    const rocky=['moon','mercury','mars','pluto'].includes(id);
    for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
      const u=x/w,v=y/h;
      let n=fbm(u*26+3,v*18+11),detail=noise(u*170,v*90);
      if(rocky){
        // A spherical field prevents the radial UV streaks previously seen at poles.
        const lat=v*Math.PI,lon=u*TAU,sinLat=Math.sin(lat);
        const nx=Math.cos(lon)*sinLat,ny=Math.sin(lon)*sinLat,nz=Math.cos(lat);
        n=noise3(nx*6+11,ny*6+31,nz*6+7)*.50+noise3(nx*17+21,ny*17+9,nz*17+3)*.30+noise3(nx*49+2,ny*49+13,nz*49+4)*.20;
        detail=noise3(nx*165+3,ny*165+7,nz*165+9);
      }
      let col,t;
      if(id==='earth') {
        const lat=Math.abs(v-.5)*2,land=mask[(y*w+x)*4+3]>.5;
        if(land) {
          const desert=clamp((.28-Math.abs(lat-.28))*4,0,1)*clamp((n-.33)*3,0,1);
          col=[mix(52+n*35,172+n*25,desert),mix(86+n*46,146+n*22,desert),mix(49+n*27,96+n*23,desert)];
        } else col=[12+n*12,49+n*28,94+n*55];
        const ice=clamp((lat-.80-n*.13)*16,0,1);
        col=col.map(k=>mix(k,225,ice));
        const cloudField=fbm(u*17+noise(u*7,v*9)*1.8,v*24);
        let cloud=clamp((cloudField-.54)*5,0,.9);
        cloud*=.70+.3*Math.sin(v*90+u*13)**2;
        col=col.map(k=>mix(k,240,cloud));
      } else {
        if(['jupiter','saturn','venus','uranus','neptune'].includes(id)) {
          const freq=id==='jupiter'?54:id==='saturn'?90:35;
          const swirl=noise(u*8,v*15)*.045+Math.sin(u*TAU*3+v*28)*.004;
          t=.49+Math.sin((v+swirl)*freq)*.14+Math.sin(v*freq*2.1+n*3)*.09+(n-.5)*.35;
          if(id==='jupiter') {
            const dx=(u-.71)/.065,dy=(v-.63)/.034,spot=Math.exp(-dx*dx-dy*dy);
            col=colorAt(palettes[id],t); col=col.map((k,j)=>mix(k,[182,99,67][j],spot*.86));
          }
          if(id==='uranus')t=.53+(n-.5)*.2+Math.sin(v*freq)*.035;
          if(id==='neptune')t=.40+(n-.5)*.35+Math.sin(v*freq)*.1;
        } else if(id==='sun') {
          // Sample a 3D spherical field: no UV seam or pinched cells at the poles.
          const latitude=v*Math.PI,longitude=u*TAU,sinLat=Math.sin(latitude);
          const nx=Math.cos(longitude)*sinLat,ny=Math.sin(longitude)*sinLat,nz=Math.cos(latitude);
          const broad=noise3(nx*7+41,ny*7+9,nz*7+29);
          const cells=noise3(nx*62+41,ny*62+9,nz*62+29);
          const fine=noise3(nx*158+15,ny*158+3,nz*158+17);
          const faculae=noise3(nx*19,ny*19+31,nz*19+8);
          t=clamp(.17+cells*.78+(fine-.5)*.22+(broad-.5)*.2+Math.max(0,faculae-.6)*.4,0,1);
          // Two restrained active regions; the map rotates with the physical Sun.
          for(const [sx,sy,rx,ry] of [[.28,.41,.008,.012],[.72,.58,.006,.009]]) {
            const d=((u-sx)/rx)**2+((v-sy)/ry)**2;
            t-=Math.exp(-d*.4)*.24+Math.exp(-d*2)*.22;
          }
        } else {
          t=n*.82+detail*.18;
          if(id==='moon'||id==='mercury')t=clamp((n-.33)*1.5+detail*.15,.12,.9);
          if(id==='mars') {t=n*.8+detail*.15; if(Math.abs(v-.5)>.44)t=.9;}
          if(id==='pluto')t=clamp(n*.9+Math.exp(-((u-.65)**2/.006+(v-.5)**2/.045))*.32,0,1);
        }
        col=col||colorAt(palettes[id],t);
      }
      const i=(y*w+x)*4; data[i]=col[0];data[i+1]=col[1];data[i+2]=col[2];data[i+3]=255;
    }
    c.putImageData(image,0,0);
    if(['mercury','moon','pluto','mars'].includes(id)) {
      const rng=random(id.charCodeAt(0)*3941);
      for(let i=0;i<145;i++) {
        const x=rng()*w,y=rng()*h,r=(.6+rng()**3*6)*w/512;if(y<h*.025||y>h*.975)continue;
        const rx=r/Math.max(.16,Math.sin(y/h*Math.PI));
        c.beginPath();c.ellipse(x,y,rx,r*.8,0,0,TAU);c.fillStyle=`rgba(26,22,22,${.05+rng()*.14})`;c.fill();
        c.beginPath();c.ellipse(x,y+.45*w/512,rx,r*.8,0,.15,Math.PI+.1);c.strokeStyle='rgba(243,222,193,.18)';c.lineWidth=.7*w/512;c.stroke();
      }
    }
    if(w>=1024&&['mercury','moon','pluto','mars'].includes(id)) {
      const rng=random(id.charCodeAt(0)*113+83);
      // Sub-kilometre-looking detail is illustrative, not a measured elevation map.
      for(let i=0;i<1800;i++) {
        const x=rng()*w,y=rng()*h,rr=(.35+rng()**3*1.5)*w/512;if(y<h*.025||y>h*.975)continue;
        const rx=rr/Math.max(.16,Math.sin(y/h*Math.PI));
        c.beginPath();c.ellipse(x,y,rx,rr*.82,0,0,TAU);c.fillStyle='rgba(25,23,21,.09)';c.fill();
        c.beginPath();c.ellipse(x,y+.2*w/512,rx,rr*.82,0,0,Math.PI);c.strokeStyle='rgba(246,239,223,.11)';c.lineWidth=.28*w/512;c.stroke();
      }
    }
    // Blend the two longitude borders into the same samples. Procedural clouds
    // and clipped craters must not reveal a hard meridian in close observation.
    const pixels=c.getImageData(0,0,w,h).data,seam=Math.max(2,Math.round(w*.04));
    for(let y=0;y<h;y++)for(let x=0;x<seam;x++) {
      const q=1-x/seam,weight=q*q*(3-2*q),left=(y*w+x)*4,right=(y*w+w-1-x)*4;
      for(let channel=0;channel<3;channel++) {
        const a=pixels[left+channel],b=pixels[right+channel],middle=(a+b)/2;
        pixels[left+channel]=mix(a,middle,weight);pixels[right+channel]=mix(b,middle,weight);
      }
    }
    return {w,h,data:pixels};
  }

  class Engine {
    constructor(){this.textures=new Map();this.maps=new Map();this.outputs=new Map();this.mapPixels=0;this.outputPixels=0;this.stats={texturesBuilt:0,mapsBuilt:0,renders:0};}
    texture(id,width){
      let t=this.textures.get(id);
      if(!t||t.w<width){t=createTexture(id,width);this.textures.set(id,t);this.stats.texturesBuilt++;}
      // LRU holds only three close-up textures; base textures are small.
      this.textures.delete(id);this.textures.set(id,t);
      const detailed=[...this.textures].filter(([,t])=>t.w>256);
      while(detailed.length>3){const [key]=detailed.shift();this.textures.delete(key);}
      return t;
    }
    map(job) {
      const {diam,frame}=job,key=[diam,...frame.u,...frame.v,...frame.pole].join(':');
      let map=this.maps.get(key);
      if(map){this.maps.delete(key);this.maps.set(key,map);return map;}
      const n=diam*diam;
      map={key,pixels:n,count:0,index:new Uint32Array(n),u:new Float32Array(n),v:new Float32Array(n),
        nx:new Float32Array(n),ny:new Float32Array(n),nz:new Float32Array(n),alpha:new Uint8ClampedArray(n)};
      const dot=(a,x,y,z)=>a[0]*x+a[1]*y+a[2]*z;
      for(let y=0;y<diam;y++)for(let x=0;x<diam;x++){
        const nx=(x+.5)/diam*2-1,ny=(y+.5)/diam*2-1,rr=nx*nx+ny*ny;if(rr>=1)continue;
        const nz=Math.sqrt(1-rr),j=map.count++;
        map.index[j]=(y*diam+x)*4;map.nx[j]=nx;map.ny[j]=ny;map.nz[j]=nz;
        map.u[j]=(Math.atan2(dot(frame.v,nx,ny,nz),dot(frame.u,nx,ny,nz))+Math.PI)/TAU;
        map.v[j]=Math.acos(clamp(dot(frame.pole,nx,ny,nz),-1,1))/Math.PI;
        map.alpha[j]=clamp((1-Math.sqrt(rr))*diam,0,1)*255;
      }
      // Quantized raster tiers and focus-priority quality prevent per-frame LRU thrash.
      const budget=1024*1024+384*384*4;
      while(this.mapPixels+n>budget&&this.maps.size){const k=this.maps.keys().next().value;this.mapPixels-=this.maps.get(k).pixels;this.maps.delete(k);}
      this.maps.set(key,map);this.mapPixels+=n;this.stats.mapsBuilt++;return map;
    }
    render(job){
      const {id,diam,phase,light,seconds,activity}=job,tex=this.texture(id,job.textureWidth),map=this.map(job);
      let out=this.outputs.get(id);
      if(!out||out.canvas.width!==diam){
        if(out){this.outputPixels-=out.canvas.width**2;this.outputs.delete(id);}
        const budget=1024*1024+384*384*4;
        while(this.outputPixels+diam*diam>budget&&this.outputs.size){const key=this.outputs.keys().next().value;this.outputPixels-=this.outputs.get(key).canvas.width**2;this.outputs.delete(key);}
        const canvas=makeCanvas(diam),ctx=canvas.getContext('2d');out={canvas,ctx,image:ctx.createImageData(diam,diam)};this.outputs.set(id,out);this.outputPixels+=diam*diam;
      }
      this.outputs.delete(id);this.outputs.set(id,out);
      const data=out.image.data,pixels=tex.data,w=tex.w,h=tex.h,lx=light[0],ly=light[1],lz=light[2],sun=id==='sun',atmosphere=['earth','uranus','neptune'].includes(id);
      for(let j=0;j<map.count;j++){
        const nx=map.nx[j],ny=map.ny[j],nz=map.nz[j];
        let u=map.u[j]-phase,v=map.v[j];if(u<0)u+=1;if(u>=1)u-=1;
        if(sun&&activity){u+=Math.sin(v*37+seconds*.22)*.0025+Math.sin(v*83-seconds*.15)*.0012;u=(u%1+1)%1;v=clamp(v+Math.sin(u*49-seconds*.19)*.0025*Math.sin(v*Math.PI),0,.999);}
        const tx=u*w,ty=clamp(v*h,0,h-1),x0=Math.floor(tx),y0=Math.floor(ty),x1=(x0+1)%w,y1=Math.min(y0+1,h-1),fx=tx-x0,fy=ty-y0;
        const a=(y0*w+x0)*4,b=(y0*w+x1)*4,c=(y1*w+x0)*4,d=(y1*w+x1)*4;
        const wa=(1-fx)*(1-fy),wb=fx*(1-fy),wc=(1-fx)*fy,wd=fx*fy;
        let lit=sun?.56+.44*Math.pow(nz,.45):.30+.78*Math.max(0,nx*lx+ny*ly+nz*lz);
        if(sun&&activity)lit*=1+.018*Math.sin(seconds*.8+nx*20+ny*15);
        const rim=!sun&&atmosphere?(1-nz)**5*.24:0,i=map.index[j];
        // Hardware-independent bilinear sampling; no allocation/function calls per channel.
        data[i]=(pixels[a]*wa+pixels[b]*wb+pixels[c]*wc+pixels[d]*wd)*lit+rim*55;
        data[i+1]=(pixels[a+1]*wa+pixels[b+1]*wb+pixels[c+1]*wc+pixels[d+1]*wd)*lit+rim*142;
        data[i+2]=(pixels[a+2]*wa+pixels[b+2]*wb+pixels[c+2]*wc+pixels[d+2]*wd)*lit+rim*240;
        data[i+3]=map.alpha[j];
      }
      out.ctx.putImageData(out.image,0,0);this.stats.renders++;return out.canvas;
    }
    clear(){this.maps.clear();this.outputs.clear();this.textures.clear();this.mapPixels=0;this.outputPixels=0;}
  }
  return {Engine,random,noise,fbm};
  }

  // Exactly one producer and at most one in-flight batch. New frames replace the
  // pending snapshot instead of queueing obsolete surfaces behind it.
  class SurfaceService {
    constructor({worker=true}={}) {
      this.frames=new Map();this.desired=new Map();this.pending=null;this.inflight=false;this.disposed=false;
      this.epoch=0;this.revision=0;this.worker=null;this.sync=null;this.timer=null;
      this.stats={backend:'compatibility',submitted:0,accepted:0,discarded:0,workerMs:0,mapPixels:0,texturePixels:0};
      if(worker&&typeof Worker==='function'&&typeof OffscreenCanvas==='function'){
        let url;
        try{
          const boot=`const kernel=(${surfaceKernel.toString()})();const engine=new kernel.Engine();
            onmessage=async e=>{const {jobs,revision,epoch}=e.data;const start=performance.now();try{
              for(const job of jobs){const canvas=engine.render(job);const bitmap=canvas.transferToImageBitmap();
                postMessage({kind:'frame',revision,epoch,job,bitmap},[bitmap]);
                await new Promise(resolve=>setTimeout(resolve,0));
              }
              postMessage({kind:'done',revision,epoch,ms:performance.now()-start,stats:engine.stats,mapPixels:engine.mapPixels,texturePixels:[...engine.textures.values()].reduce((n,t)=>n+t.w*t.h,0)});
            }catch(error){postMessage({kind:'error',message:error.message});}};`;
          url=URL.createObjectURL(new Blob([boot],{type:'text/javascript'}));this.worker=new Worker(url);
          this.worker.onmessage=e=>this.receive(e.data);
          this.worker.onerror=()=>this.fallback();this.stats.backend='worker';
        }catch(_){this.fallback();}finally{if(url)URL.revokeObjectURL(url);}
      }
      if(!this.worker)this.sync=new (surfaceKernel().Engine)();
    }
    fallback(){if(this.disposed)return;this.epoch++;this.revision++;this.worker?.terminate();this.worker=null;this.inflight=false;
      this.sync=new (surfaceKernel().Engine)();this.stats.backend='compatibility';this.pump();}
    update(jobs,mono) {
      if(this.disposed)return;
      this.desired=new Map(jobs.map(job=>[job.id,job]));
      // Release hidden bitmaps, rather than retaining many full-screen observations.
      for(const [id,entry] of this.frames)if(!this.desired.has(id)){entry.image.close?.();this.frames.delete(id);}
      this.pending={jobs,mono};this.pump();
    }
    needs(job,mono){
      const old=this.frames.get(job.id);if(!old||old.epoch!==this.epoch||old.job.geometry!==job.geometry)return true;
      if(job.phase===old.job.phase&&job.seconds===old.job.seconds&&job.light.every((v,i)=>v===old.job.light[i]))return false;
      const turn=Math.abs(job.phase-old.job.phase),pixels=Math.min(turn,1-turn)*Math.PI*job.diam;
      // Slow real-time motion is sampled at least every 120ms, not rounded to a
      // texel/angle bin. Fast spin is sampled every completed worker batch.
      return mono-old.mono>=120||pixels>.18||(job.activity&&mono-old.mono>=33);
    }
    pump(){
      if(this.disposed||this.inflight||!this.pending)return;
      const {mono}=this.pending;let jobs=this.pending.jobs.filter(j=>this.needs(j,mono));this.pending=null;
      if(!jobs.length)return;this.inflight=true;this.stats.submitted++;const revision=++this.revision,epoch=this.epoch;
      jobs=jobs.map(job=>({...job,requestedMono:mono}));
      if(this.worker)this.worker.postMessage({jobs,revision,epoch});
      else{
        // One identical-kernel compatibility batch, bounded in size; no parallel renderer.
        this.timer=setTimeout(()=>{this.timer=null;if(this.disposed)return;
          try{for(const job of jobs){const small={...job,diam:Math.min(job.diam,192),textureWidth:Math.min(job.textureWidth,512)};
            const canvas=this.sync.render(small);let image;
            if(canvas.transferToImageBitmap)image=canvas.transferToImageBitmap();
            else{image=document.createElement('canvas');image.width=image.height=canvas.width;image.getContext('2d').drawImage(canvas,0,0);}
            this.receive({kind:'frame',revision,epoch,job,bitmap:image});}
            this.receive({kind:'done',revision,epoch,ms:0,stats:this.sync.stats,mapPixels:this.sync.mapPixels,texturePixels:0});
          }catch(error){this.inflight=false;this.stats.error=error.message;}
        },0);
      }
    }
    receive(msg){
      if(this.disposed){msg.bitmap?.close?.();return;}
      if(msg.kind==='error'){this.stats.error=msg.message;this.fallback();return;}
      if(msg.kind==='done'){
        if(msg.revision!==this.revision)return;
        this.inflight=false;this.stats.workerMs=msg.ms;this.stats.kernel=msg.stats;this.stats.mapPixels=msg.mapPixels;this.stats.texturePixels=msg.texturePixels;this.pump();return;
      }
      const current=this.desired.get(msg.job.id);
      if(msg.revision!==this.revision||msg.epoch!==this.epoch||!current||current.geometry!==msg.job.geometry){msg.bitmap?.close?.();this.stats.discarded++;return;}
      const previous=this.frames.get(msg.job.id);previous?.image.close?.();
      this.frames.set(msg.job.id,{image:msg.bitmap,job:msg.job,epoch:msg.epoch,mono:msg.job.requestedMono});this.stats.accepted++;
    }
    get(id){return this.frames.get(id)?.image;}
    invalidate(clear=false){this.epoch++;this.pending=null;if(clear){for(const e of this.frames.values())e.image.close?.();this.frames.clear();}this.desired.clear();}
    suspend(){this.invalidate(true);this.worker?.terminate();this.worker=null;clearTimeout(this.timer);this.timer=null;this.inflight=false;this.sync?.clear();}
    dispose(){this.suspend();this.disposed=true;}
  }
  // Deliberate platform boundary for standalone HTML, worker source and Node tests.
  root.SolarSurface={kernel:surfaceKernel,Service:SurfaceService};
  if(typeof module==='object'&&module.exports)module.exports=root.SolarSurface;
})(typeof window==='object'?window:globalThis);
