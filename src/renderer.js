/* Solar Time v0.04 — dependency-free, depth-projected Canvas renderer.
   Textures and star field are original procedural artwork, not astronomical imagery. */
(function () {
  'use strict';
  const A=window.SolarAstro, {TAU,DEG,clamp}=A;
  function random(seed) { return function() { let t=seed+=0x6D2B79F5; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
  const mix=(a,b,t)=>a+(b-a)*t;
  const VIEW=Object.freeze({minZoom:.6,maxZoom:64,lowerBy:.05,minPanY:-.2,maxPanY:.2,minElevation:-Math.PI/2,maxElevation:Math.PI/2,fillRadius:.34});
  const SURFACE=Object.freeze({baseWidth:512,detailWidth:1024,maxRaster:768,lowRaster:384,previewRaster:192,mapBudget:768*768*2+65536});
  const LABEL=Object.freeze({response:.16,switchDelay:140,dwell:320,margin:18,padding:3});
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
    const h=w/2,can=document.createElement('canvas'); can.width=w;can.height=h;
    const c=can.getContext('2d'), image=c.createImageData(w,h),data=image.data;
    let mask=null;
    if(id==='earth') {
      const land=document.createElement('canvas');land.width=w;land.height=h;
      const lc=land.getContext('2d');lc.fillStyle='white';
      for(const poly of continents) { lc.beginPath();poly.forEach(([lon,lat],i)=>{const x=(lon+180)/360*w,y=(90-lat)/180*h;i?lc.lineTo(x,y):lc.moveTo(x,y);});lc.closePath();lc.fill(); }
      mask=lc.getImageData(0,0,w,h).data;
    }
    for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
      const u=x/w,v=y/h, n=fbm(u*26+3,v*18+11), detail=noise(u*170,v*90);
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
        const x=rng()*w,y=rng()*h,r=(.6+rng()**3*6)*w/SURFACE.baseWidth;
        c.beginPath();c.ellipse(x,y,r,r*.8,0,0,TAU);c.fillStyle=`rgba(26,22,22,${.05+rng()*.14})`;c.fill();
        c.beginPath();c.ellipse(x,y+.45*w/SURFACE.baseWidth,r,r*.8,0,.15,Math.PI+.1);c.strokeStyle='rgba(243,222,193,.18)';c.lineWidth=.7*w/SURFACE.baseWidth;c.stroke();
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
  class Renderer {
    constructor(background,canvas) {
      this.bg=background;this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:true});
      if(!this.ctx)throw new Error('Canvas 2D is unavailable.');
      this.options={orbits:true,labels:true,twinkle:true,activity:true,pluto:true,moon:true,quality:'auto'};
      this.camera={azimuth:25*DEG,elevation:45*DEG,zoom:1,focus:null,panY:0};
      this.textures={};this.sprites=new Map();this.surfaceMaps=new Map();this.mapPixels=0;this.cameraChangeAt=-Infinity;this.coronaTexture=null;this.paths=[];this.hitTargets=[];this.projected=[];
      this.labelStates=new Map();this.lastLabelMono=null;
      this.selected=null;this.hover=null;this.lastPathMs=NaN;this.dirty=true;this.frameCount=0;
      for(const b of [...A.BODIES,A.SUN,A.MOON])this.textures[b.id]=createTexture(b.id);
      this.resize();
    }
    resize() {
      const box=this.canvas.getBoundingClientRect();this.w=Math.max(1,box.width);this.h=Math.max(1,box.height);
      this.dpr=Math.min(window.devicePixelRatio||1,this.options.quality==='low'?1:2);
      // Anamorphic presentation: widen projected orbital positions, keep planet icons round.
      this.lensStretch=clamp(this.w/this.h,1,1.72);
      this.canvas.width=Math.round(this.w*this.dpr);this.canvas.height=Math.round(this.h*this.dpr);
      this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
      this.makeBackground();this.dirty=true;this.sprites.clear();this.surfaceMaps.clear();this.mapPixels=0;this.clearLabels();
    }
    makeBackground() {
      const w=this.w,h=this.h,dpr=Math.min(this.dpr,1.5),rng=random(73915);
      this.bg.width=Math.round(w*dpr);this.bg.height=Math.round(h*dpr);
      const c=this.bg.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);
      c.fillStyle='#03060b';c.fillRect(0,0,w,h);
      // Low-resolution, cached galactic dust — not recalculated every frame.
      const mw=document.createElement('canvas');mw.width=480;mw.height=300;const mc=mw.getContext('2d');
      const image=mc.createImageData(mw.width,mw.height);
      for(let y=0;y<mw.height;y++)for(let x=0;x<mw.width;x++) {
        const u=x/mw.width,v=y/mw.height,dist=(v-(.85-u*.63));
        const n=fbm(u*9+12,v*10), fine=fbm(u*48,v*50),band=Math.exp(-dist*dist/.006);
        const dust=Math.exp(-((dist+.023+Math.sin(u*19)*.012)**2)/.00036);
        const intensity=band*(.10+n*n*.64+fine*.12)*(1-dust*.72);
        const j=(y*mw.width+x)*4;image.data[j]=55+fine*20;image.data[j+1]=61+fine*22;image.data[j+2]=81+fine*28;image.data[j+3]=intensity*220;
      }
      mc.putImageData(image,0,0);c.drawImage(mw,0,0,w,h);
      const vignette=c.createRadialGradient(w*.52,h*.55,0,w*.52,h*.55,Math.max(w,h)*.7);
      vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(0,0,0,.62)');c.fillStyle=vignette;c.fillRect(0,0,w,h);
      const count=Math.round(clamp(w*h/800,450,2600));this.stars=[];
      for(let i=0;i<count;i++) {
        const x=rng()*w,y=rng()*h,r=.22+rng()**5*1.1,alpha=.15+rng()*.5,warm=rng()>.7;
        c.beginPath();c.arc(x,y,r,0,TAU);c.fillStyle=warm?`rgba(227,208,180,${alpha})`:`rgba(201,221,244,${alpha})`;c.fill();
        if(i%31===0)this.stars.push({x,y,r:r+.25,period:8+rng()*20,offset:rng()*28,duration:.7+rng()*2.2});
      }
      // Three restrained distant bright stars.
      for(const [x,y,r] of [[w*.16,h*.39,2],[w*.83,h*.27,1.7],[w*.92,h*.7,1.3]])this.starGlow(c,x,y,r,.45);
    }
    starGlow(c,x,y,r,alpha) {
      const g=c.createRadialGradient(x,y,0,x,y,r*6);
      g.addColorStop(0,`rgba(207,226,255,${alpha})`);g.addColorStop(.15,`rgba(151,195,249,${alpha*.55})`);g.addColorStop(1,'rgba(112,161,226,0)');
      c.fillStyle=g;c.fillRect(x-r*6,y-r*6,r*12,r*12);
      c.strokeStyle=`rgba(213,228,252,${alpha*.6})`;c.lineWidth=.5;c.beginPath();c.moveTo(x-r*4,y);c.lineTo(x+r*4,y);c.moveTo(x,y-r*4);c.lineTo(x,y+r*4);c.stroke();
      c.fillStyle=`rgba(247,250,255,${alpha})`;c.beginPath();c.arc(x,y,r*.6,0,TAU);c.fill();
    }
    // Orthographic direction transform. Body normals and rings MUST NOT use the
    // anamorphic orbital-distance stretch: their shared frame stays orthonormal.
    viewDirection(p) {
      const {azimuth:a,elevation:e}=this.camera,ca=Math.cos(a),sa=Math.sin(a),ce=Math.cos(e),se=Math.sin(e);
      const x=p.x*ca-p.y*sa,y=p.x*sa+p.y*ca;
      return {x,y:-(y*se+p.z*ce),z:-y*ce+p.z*se};
    }
    view(p) {const v=this.viewDirection(p);v.x*=this.lensStretch;return v;}
    bodyFrame(body) {
      const tilt=A.rotationPoleTilt(body),ct=Math.cos(tilt),st=Math.sin(tilt);
      return {u:this.viewDirection({x:1,y:0,z:0}),
        v:this.viewDirection({x:0,y:ct,z:st}),pole:this.viewDirection({x:0,y:-st,z:ct})};
    }
    setOrbitView(azimuth,elevation) {
      if(!Number.isFinite(azimuth)||!Number.isFinite(elevation))return;
      this.camera.azimuth=A.wrap(azimuth);
      this.camera.elevation=clamp(elevation,VIEW.minElevation,VIEW.maxElevation);
      this.cameraChangeAt=performance.now();this.dirty=true;
    }
    setPanY(value) {
      if(!Number.isFinite(value))return;
      // Screen-height fractions: independent of zoom, target, angle or resolution.
      this.camera.panY=clamp(value,VIEW.minPanY,VIEW.maxPanY);this.dirty=true;
    }
    baseBodyScale() {return clamp(Math.min(this.w/1330,this.h/820),.55,1.35);}
    focusRadius() {return Math.min(this.w,this.h)*VIEW.fillRadius;}
    bodyScaleAtZoom() {
      const base=this.baseBodyScale(),zoom=this.camera.zoom;
      const body=[A.SUN,...this.getBodies(),...(this.options.moon?[A.MOON]:[])].find(b=>b.id===this.camera.focus);
      if(!body||zoom<=1)return base*Math.sqrt(zoom);
      // Same endpoint in SCREEN space for every target, including Pluto and Moon.
      // Only the illustrative size scale changes, never the orbit or spin clock.
      const t=(Math.sqrt(zoom)-1)/(Math.sqrt(VIEW.maxZoom)-1);
      return mix(body.size*base,this.focusRadius(),t)/body.size;
    }
    project(p) { const v=this.view(p);return {x:this.cx+v.x*this.scale,y:this.cy+v.y*this.scale,z:v.z}; }
    getBodies() { return this.options.pluto?A.BODIES:A.BODIES.filter(b=>b.id!=='pluto'); }
    rebuild(ms) {
      this.paths=this.getBodies().map(body=>({body,points:A.orbitAt(body,ms,360)}));
      let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
      for(const p of this.paths)for(const v of p.points) {const q=this.view(v);minX=Math.min(minX,q.x);maxX=Math.max(maxX,q.x);minY=Math.min(minY,q.y);maxY=Math.max(maxY,q.y);}
      const mobile=this.w<680,compact=this.h<630;
      const left=mobile?24:58,right=this.w-(mobile?24:58),top=compact?100:mobile?192:190,bottom=this.h-(compact?105:mobile?195:190);
      this.scale=Math.max(.05,Math.min((right-left)/(maxX-minX),(bottom-top)/(maxY-minY)))*this.camera.zoom;
      this.cx=(left+right)/2-(minX+maxX)*this.scale/2;
      this.centerX=(left+right)/2;this.centerY=(top+bottom)/2+this.h*(VIEW.lowerBy+this.camera.panY);
      this.homeCx=this.cx;this.homeCy=this.centerY-(minY+maxY)*this.scale/2;
      this.cy=this.homeCy;
      this.bodyScale=this.bodyScaleAtZoom();
      this.lastPathMs=ms;this.dirty=false;
    }
    setOption(key,value) {
      this.options[key]=value;this.dirty=true;if(key==='quality')this.resize();
      if(key==='labels'&&!value)this.clearLabels();
      if((key==='moon'||key==='pluto')&&!value&&this.camera.focus===key)this.resetCamera();
    }
    setZoom(value,focusId=null) {
      if(!Number.isFinite(value))return;
      this.camera.zoom=clamp(value,VIEW.minZoom,VIEW.maxZoom);this.cameraChangeAt=performance.now();
      if(this.camera.zoom<=1)this.camera.focus=null;
      else if(!this.camera.focus) {
        const candidate=focusId||this.selected||'sun';
        this.camera.focus=[A.SUN,...this.getBodies(),...(this.options.moon?[A.MOON]:[])].some(b=>b.id===candidate)?candidate:'sun';
      }
      this.dirty=true;
    }
    focusBody(id) {
      const body=[A.SUN,...this.getBodies(),...(this.options.moon?[A.MOON]:[])].find(b=>b.id===id);
      if(!body)return;
      const baseRadius=body.size*this.baseBodyScale(),radius=Math.min(this.w,this.h)*.14;
      const t=clamp((radius-baseRadius)/(this.focusRadius()-baseRadius),0,1);
      this.camera.focus=id;
      this.setZoom(clamp((1+t*(Math.sqrt(VIEW.maxZoom)-1))**2,6,VIEW.maxZoom));
    }
    get zoomLimits() {return VIEW;}
    visible(p,r=0) {return p.x+r>=0&&p.x-r<=this.w&&p.y+r>=0&&p.y-r<=this.h;}

    resetCamera() {this.camera={azimuth:25*DEG,elevation:45*DEG,zoom:1,focus:null,panY:0};this.dirty=true;}
    orbit(c,path,highlight) {
      const rgb=path.body.id==='earth'?'110,174,212':path.body.id==='pluto'?'155,140,127':'138,151,168';
      c.lineWidth=highlight?1.25:.72;
      if(path.body.id==='pluto')c.setLineDash([2,5]);
      // Draw each hemisphere separately to keep distant arcs restrained.
      for(let pass=0;pass<2;pass++) {
        c.strokeStyle=`rgba(${rgb},${highlight?.64:pass?.32:.17})`;c.beginPath();let active=false;
        for(const p of path.points) {const q=this.project(p),front=q.z>=0;if(front===(pass===1)){active?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y);active=true;}else {if(active)c.lineTo(q.x,q.y);active=false;}}
        c.stroke();
      }
      c.setLineDash([]);
    }
    textureFor(body,diameter) {
      // Lazy detail level: do not generate eleven large maps at startup. Each body
      // owns at most one texture (a detail map replaces its base map).
      if(diameter>SURFACE.baseWidth*.75&&this.textures[body.id].w<SURFACE.detailWidth)
        this.textures[body.id]=createTexture(body.id,SURFACE.detailWidth);
      return this.textures[body.id];
    }
    surfaceMap(body,diam) {
      const key=[diam,this.camera.azimuth,this.camera.elevation,A.rotationPoleTilt(body)].join(':');
      let map=this.surfaceMaps.get(key);
      if(map){this.surfaceMaps.delete(key);this.surfaceMaps.set(key,map);return map;}
      const n=diam*diam,frame=this.bodyFrame(body);
      map={pixels:n,count:0,index:new Uint32Array(n),u:new Float32Array(n),v:new Float32Array(n),
        nx:new Float32Array(n),ny:new Float32Array(n),nz:new Float32Array(n),alpha:new Uint8ClampedArray(n)};
      const dot=(axis,x,y,z)=>axis.x*x+axis.y*y+axis.z*z;
      for(let py=0;py<diam;py++)for(let px=0;px<diam;px++) {
        const nx=(px+.5)/diam*2-1,ny=(py+.5)/diam*2-1,r2=nx*nx+ny*ny;if(r2>=1)continue;
        const nz=Math.sqrt(1-r2),j=map.count++;
        map.index[j]=(py*diam+px)*4;map.nx[j]=nx;map.ny[j]=ny;map.nz[j]=nz;
        map.u[j]=(Math.atan2(dot(frame.v,nx,ny,nz),dot(frame.u,nx,ny,nz))+Math.PI)/TAU;
        map.v[j]=Math.acos(clamp(dot(frame.pole,nx,ny,nz),-1,1))/Math.PI;
        map.alpha[j]=clamp((1-Math.sqrt(r2))*diam,0,1)*255;
      }
      // Bounded LRU: two detailed views plus ordinary scene sprites, not an
      // unbounded history of every angle visited while dragging.
      while(this.mapPixels+n>SURFACE.mapBudget&&this.surfaceMaps.size) {
        const oldest=this.surfaceMaps.keys().next().value;
        this.mapPixels-=this.surfaceMaps.get(oldest).pixels;this.surfaceMaps.delete(oldest);
      }
      this.surfaceMaps.set(key,map);this.mapPixels+=n;return map;
    }
    shade(body,p,r,ms,t,force=false) {
      const sun=body.id==='sun',qualityLimit=this.options.quality==='low'?SURFACE.lowRaster:SURFACE.maxRaster;
      const moving=performance.now()-this.cameraChangeAt<120;
      const requested=Math.max(18,Math.min(qualityLimit,Math.ceil(r*2*this.dpr*1.25)));
      const diam=moving?Math.min(SURFACE.previewRaster,requested):requested,tex=this.textureFor(body,requested);
      const spin=A.rotationAt(body,ms),light=this.viewDirection({x:-p.x,y:-p.y,z:-p.z}),len=Math.hypot(light.x,light.y,light.z)||1;
      const lx=light.x/len,ly=light.y/len,lz=light.z/len;
      // Do not round the rotation angle to a texture-width bin. That cache used
      // to freeze slow Mercury/Venus/Moon sprites for minutes even as time ran.
      const key=[diam,tex.w,spin,this.camera.azimuth,this.camera.elevation,lx,ly,lz,
        sun?Number(this.options.activity):0,sun&&this.options.activity?t:0].join(':');
      let cached=this.sprites.get(body.id);
      if(cached&&cached.key===key&&!force)return cached.canvas;
      if(!cached||cached.canvas.width!==diam) {
        const canvas=document.createElement('canvas');canvas.width=canvas.height=diam;
        const ctx=canvas.getContext('2d');cached={canvas,ctx,image:ctx.createImageData(diam,diam)};
      }
      const map=this.surfaceMap(body,diam),out=cached.image.data,phase=spin/TAU,atmosphere=['earth','uranus','neptune'].includes(body.id);
      for(let j=0;j<map.count;j++) {
        const nx=map.nx[j],ny=map.ny[j],nz=map.nz[j];
        let u=map.u[j]-phase,v=map.v[j];if(u<0)u+=1;if(u>=1)u-=1;
        if(sun&&this.options.activity) {
          u=A.wrap(u+Math.sin(v*37+t*.22)*.0025+Math.sin(v*83-t*.15)*.0012,1);
          v=clamp(v+Math.sin(u*49-t*.19)*.0025*Math.sin(v*Math.PI),0,.999);
        }
        const tx=u*tex.w,ty=clamp(v*tex.h,0,tex.h-1),x0=Math.floor(tx),y0=Math.floor(ty);
        const x1=(x0+1)%tex.w,y1=Math.min(y0+1,tex.h-1),fx=tx-x0,fy=ty-y0;
        const j00=(y0*tex.w+x0)*4,j10=(y0*tex.w+x1)*4,j01=(y1*tex.w+x0)*4,j11=(y1*tex.w+x1)*4;
        let lit=sun?.56+.44*Math.pow(nz,.45):.30+.78*Math.max(0,nx*lx+ny*ly+nz*lz);
        if(sun&&this.options.activity)lit*=1+.018*Math.sin(t*.8+nx*20+ny*15);
        const rim=!sun&&atmosphere?(1-nz)**5*.24:0,i=map.index[j];
        for(let k=0;k<3;k++)out[i+k]=mix(mix(tex.data[j00+k],tex.data[j10+k],fx),mix(tex.data[j01+k],tex.data[j11+k],fx),fy)*lit+rim*(k===0?55:k===1?142:240);
        out[i+3]=map.alpha[j];
      }
      cached.ctx.putImageData(cached.image,0,0);cached.key=key;cached.spin=spin;
      this.sprites.set(body.id,cached);return cached.canvas;
    }
    makeCoronaTexture(size=384) {
      // One bounded, reusable corona asset. No per-frame pixel noise, downloads or timers.
      const extent=3.3,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
      const ctx=canvas.getContext('2d'),image=ctx.createImageData(size,size),out=image.data;
      for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
        const px=((x+.5)/size*2-1)*extent,py=((y+.5)/size*2-1)*extent,d=Math.hypot(px,py);
        if(d<.98||d>extent)continue;
        const a=Math.atan2(py,px),ca=Math.cos(a),sa=Math.sin(a);
        // Circular noise has no longitude seam. Streamers taper instead of ending abruptly.
        const field=fbm(ca*5+21,sa*5+37),fine=noise(ca*43+px*.7,sa*43+py*.7);
        const filament=Math.pow(clamp(field*.7+fine*.3,0,1),3);
        const reach=.20+Math.pow(field,2)*1.55,falloff=Math.exp(-(d-1)/reach);
        const edge=clamp((extent-d)/.45,0,1),alpha=(.07+filament*.75)*falloff*edge;
        const i=(y*size+x)*4;
        out[i]=255;out[i+1]=168+field*46;out[i+2]=67+field*51;out[i+3]=Math.round(alpha*255);
      }
      ctx.putImageData(image,0,0);return canvas;
    }
    corona(c,x,y,r,seconds) {
      // Decorative shine only: physics and solar surface rotation keep their own time.
      const t=this.options.activity?seconds*3:0;
      const detail=r*this.dpr>128&&this.options.quality!=='low'?768:384;
      if(!this.coronaTexture||this.coronaTexture.width<detail)this.coronaTexture=this.makeCoronaTexture(detail);
      c.save();c.translate(x,y);c.globalCompositeOperation='screen';
      const halo=c.createRadialGradient(0,0,r*.92,0,0,r*5.1);
      halo.addColorStop(0,'rgba(255,167,64,.25)');halo.addColorStop(.17,'rgba(216,102,25,.095)');
      halo.addColorStop(.5,'rgba(156,64,13,.026)');halo.addColorStop(1,'rgba(110,40,5,0)');
      c.fillStyle=halo;c.fillRect(-r*5.1,-r*5.1,r*10.2,r*10.2);
      for(let layer=0;layer<2;layer++) {
        c.save();c.rotate(layer*1.73+(layer?-1:1)*t*.003);
        c.globalAlpha=(layer?.37:.8)*(1+Math.sin(t*.19+layer)*.035);
        const extent=r*3.3*(layer?1.08:1);c.drawImage(this.coronaTexture,-extent,-extent,extent*2,extent*2);c.restore();
      }
      // Braided magnetic arches retain their 18–33 effect-second cycles (6–11 wall seconds).
      const loops=this.options.quality==='low'?7:12;
      for(let i=0;i<loops;i++) {
        const cycle=A.wrap(t/(18+i%6*3)+i*.618,1),life=Math.sin(cycle*Math.PI)**6;
        const a=i*2.399963+Math.sin(i*31)*.23,spread=.035+(i%4)*.012;
        const reach=r*(1.08+life*(.18+(i%5)*.065));
        for(let strand=0;strand<3;strand++) {
          const bend=(strand-1)*.015+Math.sin(t*.27+i)*.009;
          c.beginPath();c.moveTo(Math.cos(a-spread)*r*.986,Math.sin(a-spread)*r*.986);
          c.bezierCurveTo(Math.cos(a-spread*1.9+bend)*reach,Math.sin(a-spread*1.9+bend)*reach,
            Math.cos(a+spread*1.8+bend)*reach,Math.sin(a+spread*1.8+bend)*reach,
            Math.cos(a+spread)*r*.986,Math.sin(a+spread)*r*.986);
          c.strokeStyle=`rgba(255,103,20,${life*.12})`;c.lineWidth=Math.max(1,r*.065);c.stroke();
          c.strokeStyle=`rgba(255,${strand===1?214:164},${strand===1?104:43},${life*(strand===1?.42:.17)})`;
          c.lineWidth=Math.max(.35,r*.015);c.stroke();
        }
      }
      // Fine chromosphere, with irregular short spicules rather than a neon outline.
      c.beginPath();
      for(let i=0;i<=240;i++) {
        const a=i/240*TAU,ruffle=Math.sin(a*41+t*.32)*Math.sin(a*67-t*.21);
        const rr=r*(1.014+ruffle*.009);i?c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):c.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);
      }
      c.closePath();c.strokeStyle='rgba(255,183,71,.42)';c.lineWidth=Math.max(.7,r*.025);c.stroke();
      c.restore();
    }
    rings(c,b,p,r,front) {
      // Equatorial ring plane uses the SAME local-to-view frame as the surface.
      // Split by actual view-space depth, not screen top/bottom or a fixed ellipse.
      const sat=b.id==='saturn',{u,v}=this.bodyFrame(b),nearStart=Math.atan2(v.z,u.z)-Math.PI/2;
      const start=nearStart+(front?0:Math.PI);
      c.save();c.transform(u.x,u.y,v.x,v.y,p.x,p.y);
      const inner=sat?1.28:1.58,outer=sat?2.26:1.94,steps=sat?116:18;
      for(let i=0;i<steps;i++) {
        const f=i/(steps-1),rr=mix(inner,outer,f)*r;
        if(sat&&f>.56&&f<.62)continue;
        const alpha=sat?(.19+.48*Math.sin(f*75)**2)*(f>.85?.6:1):.22;
        c.strokeStyle=sat?`rgba(${205+Math.round(f*25)},${180+Math.round(f*22)},${133+Math.round(f*38)},${alpha})`:`rgba(150,194,193,${alpha})`;
        c.lineWidth=(outer-inner)*r/steps*1.18;c.beginPath();c.arc(0,0,rr,start,start+Math.PI);c.stroke();
      }
      c.restore();
    }
    drawBody(c,b,world,screen,r,ms,t) {
      if(b.id==='sun')this.corona(c,screen.x,screen.y,r,t);
      if(b.id==='saturn'||b.id==='uranus')this.rings(c,b,screen,r,false);
      if(b.id==='earth') {
        const g=c.createRadialGradient(screen.x,screen.y,r*.86,screen.x,screen.y,r*1.2);g.addColorStop(0,'rgba(63,159,225,.12)');g.addColorStop(.58,'rgba(94,188,248,.22)');g.addColorStop(1,'rgba(74,155,219,0)');c.fillStyle=g;c.fillRect(screen.x-r*1.2,screen.y-r*1.2,r*2.4,r*2.4);
      }
      const img=this.shade(b,world,r,ms,t);c.drawImage(img,screen.x-r,screen.y-r,r*2,r*2);
      if(b.id==='saturn'||b.id==='uranus')this.rings(c,b,screen,r,true);
      if(this.selected===b.id||this.hover===b.id) {
        c.strokeStyle=this.selected===b.id?'rgba(225,203,155,.7)':'rgba(210,226,244,.4)';c.lineWidth=.8;c.beginPath();c.arc(screen.x,screen.y,r+5,0,TAU);c.stroke();
      }
    }
    clearLabels() {this.labelStates.clear();this.lastLabelMono=null;}
    labels(c,bodies,mono) {
      // Stable identity order, not depth order: crossing orbits cannot change priority.
      // Store offsets from the CURRENT body, so smoothing never trails an orbiting body.
      if(this.lastLabelMono!==null&&mono<this.lastLabelMono)this.clearLabels();
      const dt=this.lastLabelMono===null?0:clamp((mono-this.lastLabelMono)/1000,0,.05);
      this.lastLabelMono=mono;
      const alpha=1-Math.exp(-dt/LABEL.response),reserved=[],active=new Set();
      const byId=new Map(bodies.map(p=>[p.body.id,p]));
      const ordered=[A.SUN,...A.BODIES,A.MOON].map(b=>byId.get(b.id)).filter(Boolean);
      const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*
        Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
      c.textAlign='center';c.textBaseline='top';
      for(const item of ordered) {
        const {body:b,screen:s,r}=item,moon=b.id==='moon';active.add(b.id);
        const font=moon?8:this.w<680?9:10,h=font+10;
        c.font=`500 ${font}px "Segoe UI", Arial, sans-serif`;
        if('letterSpacing' in c)c.letterSpacing=moon?'1px':'1.65px';
        const w=c.measureText(b.en).width+10,gap=moon?7:b.id==='saturn'?13:9;
        const offsets=[[0,r+gap],[0,-r-h-gap],[r+w/2+gap,-h/2],[-r-w/2-gap,-h/2],[0,r+gap+h+4]];
        const candidates=offsets.map(([dx,dy],slot)=>({slot,
          x:clamp(s.x+dx-w/2,8,Math.max(8,this.w-w-8)),
          y:clamp(s.y+dy,8,Math.max(8,this.h-h-8)),w,h}));
        const obstacles=bodies.filter(p=>p!==item).map(p=>({
          x:p.screen.x-p.r-LABEL.padding,y:p.screen.y-p.r-LABEL.padding,
          w:p.r*2+LABEL.padding*2,h:p.r*2+LABEL.padding*2}));
        for(const q of candidates) {
          q.score=q.slot*7;
          for(const obstacle of [...reserved,...obstacles]) {
            q.score+=overlap(q,obstacle)/Math.max(1,Math.min(w*h,obstacle.w*obstacle.h))*1000;
          }
        }
        const best=candidates.reduce((a,b)=>a.score<=b.score?a:b);
        let state=this.labelStates.get(b.id);
        if(!state) {
          state={slot:best.slot,dx:best.x+w/2-s.x,dy:best.y-s.y,
            switchedAt:mono-LABEL.dwell,pending:null,pendingSince:mono};
          this.labelStates.set(b.id,state);
        } else {
          const current=candidates[state.slot];
          // A small or one-frame overlap must not flip a label to the other side.
          if(best.slot!==state.slot&&current.score-best.score>LABEL.margin) {
            if(state.pending!==best.slot){state.pending=best.slot;state.pendingSince=mono;}
            if(mono-state.pendingSince>=LABEL.switchDelay&&mono-state.switchedAt>=LABEL.dwell) {
              state.slot=best.slot;state.switchedAt=mono;state.pending=null;
            }
          } else state.pending=null;
        }
        const target=candidates[state.slot];
        // Frame-rate-independent easing is shared by Sun, Moon and EVERY planet.
        state.dx+=(target.x+w/2-s.x-state.dx)*alpha;
        state.dy+=(target.y-s.y-state.dy)*alpha;
        if(Math.abs(target.x+w/2-s.x-state.dx)<.02)state.dx=target.x+w/2-s.x;
        if(Math.abs(target.y-s.y-state.dy)<.02)state.dy=target.y-s.y;
        reserved.push(target);
        const x=s.x+state.dx,y=s.y+state.dy,box={id:b.id,x:x-w/2,y,w,h,label:true};
        // Connector and hit area follow the displayed position, never the destination.
        const ex=clamp(s.x,box.x,box.x+w),ey=clamp(s.y,box.y,box.y+h);
        const dx=ex-s.x,dy=ey-s.y,distance=Math.hypot(dx,dy);
        if(distance>r+6) {
          c.strokeStyle='rgba(161,179,201,.22)';c.lineWidth=.6;c.beginPath();
          c.moveTo(s.x+dx/distance*(r+3),s.y+dy/distance*(r+3));c.lineTo(ex,ey);c.stroke();
        }
        c.shadowColor='rgba(0,0,0,.95)';c.shadowBlur=6;
        c.fillStyle=this.selected===b.id?'#eedbb8':b.id==='sun'?'#f1c889':moon?'#7d8d9f':'#b9c4d2';
        c.fillText(b.en,x,y);c.shadowBlur=0;this.hitTargets.push(box);
      }
      for(const id of this.labelStates.keys())if(!active.has(id))this.labelStates.delete(id);
      if('letterSpacing' in c)c.letterSpacing='0px';
    }
    draw(ms,seconds,mono=performance.now()) {
      const c=this.ctx;this.frameCount++;c.clearRect(0,0,this.w,this.h);
      if(this.dirty||Math.abs(ms-this.lastPathMs)>A.DAY*30)this.rebuild(ms);
      if(this.options.twinkle)for(const s of this.stars) {
        const phase=A.wrap(seconds+s.offset,s.period);
        if(phase<s.duration) {const alpha=Math.sin(phase/s.duration*Math.PI)**2*.85;this.starGlow(c,s.x,s.y,s.r,alpha);}
      }
      const bodies=this.getBodies().map(body=>{const world=A.positionAt(body,ms,true);return {body,world,r:body.size*this.bodyScale};});
      bodies.push({body:A.SUN,world:{x:0,y:0,z:0},r:A.SUN.size*this.bodyScale});
      const earth=bodies.find(p=>p.body.id==='earth');
      if(this.options.moon) {
        // Keep the lunar display spacing independent of Earth's enlarged icon.
        const radius=A.MOON.displayOrbit*this.bodyScale/this.scale,local=A.moonAt(ms,radius);
        const world={x:earth.world.x+local.x,y:earth.world.y+local.y,z:earth.world.z+local.z};
        bodies.push({body:A.MOON,world,r:A.MOON.size*this.bodyScale});
      }
      // One snapshot owns positions and tracking: the target cannot drift out of frame.
      const target=bodies.find(p=>p.body.id===this.camera.focus);
      if(target) {
        const v=this.view(target.world);this.cx=this.centerX-v.x*this.scale;this.cy=this.centerY-v.y*this.scale;
      } else {this.cx=this.homeCx;this.cy=this.homeCy;}
      for(const body of bodies)body.screen=this.project(body.world);
      if(this.options.orbits) {
        for(const path of this.paths)this.orbit(c,path,this.selected===path.body.id);
        if(this.options.moon) {
          const radius=A.MOON.displayOrbit*this.bodyScale/this.scale,el=A.moonElements(ms);
          c.strokeStyle='rgba(115,155,189,.26)';c.lineWidth=.65;c.beginPath();
          for(let i=0;i<=90;i++) {
            const p=A.pointOnOrbit(el,i/90*TAU,radius),s=this.project({x:earth.world.x+p.x,y:earth.world.y+p.y,z:earth.world.z+p.z});
            i?c.lineTo(s.x,s.y):c.moveTo(s.x,s.y);
          }
          c.stroke();
        }
      }
      bodies.sort((a,b)=>a.screen.z-b.screen.z);
      this.hitTargets=[];
      for(const p of bodies) {
        const extent=p.body.id==='sun'?5.1:p.body.id==='saturn'?2.3:p.body.id==='uranus'?2:1.3;
        if(!this.visible(p.screen,p.r*extent+16))continue;
        this.drawBody(c,p.body,p.world,p.screen,p.r,ms,seconds);
        this.hitTargets.push({id:p.body.id,x:p.screen.x,y:p.screen.y,r:Math.max(p.r+6,11),z:p.screen.z});
      }
      if(this.options.labels)this.labels(c,bodies.filter(p=>this.visible(p.screen,p.r+20)),mono);
      else this.clearLabels();
      this.projected=bodies;
    }
    hit(x,y) {
      for(let i=this.hitTargets.length-1;i>=0;i--) {
        const t=this.hitTargets[i];if(t.label?(x>=t.x&&x<=t.x+t.w&&y>=t.y&&y<=t.y+t.h):Math.hypot(x-t.x,y-t.y)<t.r)return t.id;
      }
      return null;
    }
  }
  window.SolarRenderer=Renderer;
})();
