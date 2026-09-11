/* Solar Time v0.07 — dependency-free, depth-projected Canvas renderer.
   Earth uses a NASA Blue Marble material; other worlds and sky are artistic materials. */
(function () {
  'use strict';
  const A=window.SolarAstro, {TAU,DEG,clamp}=A;
  function random(seed) { return function() { let t=seed+=0x6D2B79F5; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
  const mix=(a,b,t)=>a+(b-a)*t;
  const VIEW=Object.freeze({minZoom:.6,maxZoom:64,lowerBy:.05,minPanY:-.2,maxPanY:.2,minPanX:-.2,maxPanX:.2,minElevation:-Math.PI/2,maxElevation:Math.PI/2,fillRadius:.34});
  const SURFACE=Object.freeze({baseWidth:256,detailWidth:4096,maxRaster:1024,lowRaster:384,previewRaster:192});
  const LABEL=Object.freeze({response:.16,switchDelay:140,dwell:320,margin:18,padding:3});
  function noise(x,y) {
    const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
    const hash=(a,b)=>{ let h=Math.imul(a,374761393)+Math.imul(b,668265263); h=Math.imul(h^(h>>>13),1274126177); return ((h^(h>>>16))>>>0)/4294967295; };
    return mix(mix(hash(ix,iy),hash(ix+1,iy),sx),mix(hash(ix,iy+1),hash(ix+1,iy+1),sx),sy);
  }
  function fbm(x,y) { return noise(x,y)*.53+noise(x*2.03+19,y*2.03)*.27+noise(x*4.11,y*4.11+37)*.13+noise(x*8.17,y*8.17)*.07; }
  class Renderer {
    constructor(background,canvas) {
      this.bg=background;this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:true});
      if(!this.ctx)throw new Error('Canvas 2D is unavailable.');
      this.options={orbits:true,labels:true,twinkle:true,activity:true,pluto:true,moon:true,skyMotion:true,comets:true,quality:'auto'};
      this.camera={azimuth:25*DEG,elevation:45*DEG,zoom:1,focus:null,panY:0,panX:0};
      this.surface=new window.SolarSurface.Service();this.cameraChangeAt=-Infinity;this.coronaTexture=null;this.paths=[];this.hitTargets=[];this.projected=[];
      this.labelStates=new Map();this.lastLabelMono=null;
      this.selected=null;this.hover=null;this.lastPathMs=NaN;this.dirty=true;this.frameCount=0;
      this.sky=new window.SolarSky(background);
      this.resize();
    }
    resize() {
      const box=this.canvas.getBoundingClientRect();this.w=Math.max(1,box.width);this.h=Math.max(1,box.height);
      this.dpr=Math.min(window.devicePixelRatio||1,this.options.quality==='low'?1:2);
      // Anamorphic presentation: widen projected orbital positions, keep planet icons round.
      this.lensStretch=clamp(this.w/this.h,1,1.72);
      this.canvas.width=Math.round(this.w*this.dpr);this.canvas.height=Math.round(this.h*this.dpr);
      this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
      this.sky.resize(this.w,this.h,this.dpr);this.dirty=true;this.surface?.invalidate(true);this.clearLabels();
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
      const frame=A.bodyAxes(body);
      return Object.fromEntries(Object.entries(frame).map(([key,n])=>[key,this.viewDirection(n)]));
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
    setPan(x,y=this.camera.panY) {
      if(!Number.isFinite(x)||!Number.isFinite(y))return;
      this.camera.panX=clamp(x,VIEW.minPanX,VIEW.maxPanX);this.setPanY(y);
    }
    faceFeature(id,latitude,longitude,ms) {
      const body=[A.SUN,...this.getBodies(),A.MOON].find(b=>b.id===id);if(!body)return;
      const n=A.surfaceDirection(body,latitude,longitude,ms);
      this.focusBody(id);this.setOrbitView(Math.atan2(-n.x,-n.y),Math.asin(clamp(n.z,-1,1)));
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
      const pathKey=A.modelYear(ms)+':'+this.options.pluto;
      if(this.pathKey!==pathKey){this.paths=this.getBodies().map(body=>({body,points:A.orbitAt(body,ms,360)}));this.pathKey=pathKey;}
      let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
      for(const p of this.paths)for(const v of p.points) {const q=this.view(v);minX=Math.min(minX,q.x);maxX=Math.max(maxX,q.x);minY=Math.min(minY,q.y);maxY=Math.max(maxY,q.y);}
      const mobile=this.w<680,compact=this.h<630;
      const left=mobile?24:58,right=this.w-(mobile?24:58),top=compact?100:mobile?192:190,bottom=this.h-(compact?105:mobile?195:190);
      const baseY=(top+bottom)/2+this.h*VIEW.lowerBy;
      const fitY=Math.max(80,2*Math.min(baseY-top,bottom-baseY));
      this.scale=Math.max(.05,Math.min((right-left)/(2*Math.max(Math.abs(minX),Math.abs(maxX))),fitY/(2*Math.max(Math.abs(minY),Math.abs(maxY)))))*this.camera.zoom;
      this.centerX=(left+right)/2+this.w*(this.camera.panX||0);this.centerY=baseY+this.h*this.camera.panY;
      // Sun-centred both at home and during zoom: eccentric Pluto cannot offset startup.
      this.cx=this.centerX;this.homeCx=this.centerX;this.homeCy=this.centerY;
      this.cy=this.homeCy;
      this.bodyScale=this.bodyScaleAtZoom();
      this.lastPathMs=ms;this.pathYear=A.modelYear(ms);this.dirty=false;
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

    resetCamera() {this.camera={azimuth:25*DEG,elevation:45*DEG,zoom:1,focus:null,panY:0,panX:0};this.dirty=true;}
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
    // All bodies submit to the same bounded surface owner; no CPU pixel loop here.
    surfaceJob(body,world,r,ms,seconds,mono) {
      const focused=body.id===this.camera.focus,moving=mono-this.cameraChangeAt<120;
      const maximum=this.options.quality==='low'?SURFACE.lowRaster:focused?SURFACE.maxRaster:SURFACE.previewRaster;
      const wanted=Math.min(maximum,Math.max(32,r*2*this.dpr));
      const tier=[32,64,128,192,256,384,512,768,1024].find(n=>n>=wanted)||1024;
      const diam=moving?Math.min(tier,SURFACE.previewRaster):tier;
      // A quick first sample makes the body visible before the detailed map is built.
      const textureWidth=focused&&!moving&&this.surface.get(body.id)?Math.min(SURFACE.detailWidth,window.SolarAssets?.materialInfo?.[body.id]?.width||SURFACE.detailWidth):SURFACE.baseWidth;
      const vectors=this.bodyFrame(body),frame=Object.fromEntries(Object.entries(vectors).map(([k,v])=>[k,[v.x,v.y,v.z]]));
      const earth=A.positionAt(A.BODIES.find(b=>b.id==='earth'),ms);
      const physical=body.id==='moon'?(()=>{const m=A.moonAt(ms,.0025696);return {x:earth.x+m.x,y:earth.y+m.y,z:earth.z+m.z};})():body.id==='sun'?{x:0,y:0,z:0}:A.positionAt(body,ms);
      const lightVector=this.viewDirection({x:-physical.x,y:-physical.y,z:-physical.z});
      const len=Math.hypot(lightVector.x,lightVector.y,lightVector.z)||1;
      const activity=false; // No surface distortion or erupting loops: physical spin + shine only.
      const spin=A.rotationAt(body,ms);
      const geometry=[window.SolarAssets?.materialRevision||0,diam,textureWidth,this.camera.azimuth,this.camera.elevation,A.rotationPoleTilt(body),Number(activity)].join(':');
      return {id:body.id,diam,textureWidth,frame,geometry,phase:spin/TAU,
        light:[lightVector.x/len,lightVector.y/len,lightVector.z/len],activity,seconds:activity?seconds:0};
    }
    invalidateSurfaces() {this.surface?.invalidate();}
    suspend() {this.surface?.dispose();this.surface=null;}
    resume() {if(!this.surface)this.surface=new window.SolarSurface.Service();}
    dispose() {this.suspend();this.clearLabels();this.hitTargets=[];this.coronaTexture=null;this.sky?.dispose();}
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
      const t=this.options.activity?seconds*24:0;
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
        const g=c.createRadialGradient(screen.x,screen.y,r*.99,screen.x,screen.y,r*1.035);g.addColorStop(0,'rgba(73,145,218,.12)');g.addColorStop(1,'rgba(74,155,219,0)');c.fillStyle=g;c.beginPath();c.arc(screen.x,screen.y,r*1.035,0,TAU);c.fill();
      }
      if(this.visible(screen,r+2)) {
        const img=this.surface.get(b.id);
        if(img)c.drawImage(img,screen.x-r,screen.y-r,r*2,r*2);
        else {c.fillStyle=b.color||'#9b917f';c.beginPath();c.arc(screen.x,screen.y,r,0,TAU);c.fill();}
      }
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
      if(this.dirty||!Number.isFinite(this.lastPathMs)||A.modelYear(ms)!==this.pathYear)this.rebuild(ms);
      this.sky.draw(seconds,this.camera,this.options);
      this.sky.decorate(c,seconds,this.options,this.starGlow.bind(this));
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
      this.resume();
      // A corona that crosses the viewport does NOT make the hidden solar disk visible.
      const surfaceBodies=bodies.filter(p=>this.visible(p.screen,p.r+2));
      surfaceBodies.sort((a,b)=>Number(b.body.id===this.camera.focus)-Number(a.body.id===this.camera.focus));
      this.surface.update(surfaceBodies.map(p=>this.surfaceJob(p.body,p.world,p.r,ms,seconds,mono)),mono);
      for(const p of bodies) {
        const extent=p.body.id==='sun'?5.1:p.body.id==='saturn'?2.3:p.body.id==='uranus'?2:1.3;
        if(!this.visible(p.screen,p.r*extent+16))continue;
        this.drawBody(c,p.body,p.world,p.screen,p.r,ms,seconds);
        this.hitTargets.push({id:p.body.id,x:p.screen.x,y:p.screen.y,r:Math.max(p.r+6,11),z:p.screen.z});
      }
      if(this.camera.focus==='earth'&&earth.r>65){
        const normal=this.viewDirection(A.surfaceDirection(earth.body,37.5665,126.978,ms));
        if(normal.z>.03){
          const x=earth.screen.x+normal.x*earth.r,y=earth.screen.y+normal.y*earth.r,day=A.siteSun(ms).altitude>=0;
          c.fillStyle=day?'#ffdb92':'#98c9ff';c.strokeStyle='rgba(255,255,255,.8)';c.lineWidth=1;
          c.beginPath();c.arc(x,y,3,0,TAU);c.fill();c.beginPath();c.arc(x,y,6,0,TAU);c.stroke();
          c.font='11px "Segoe UI",sans-serif';c.textAlign='left';c.shadowColor='#000';c.shadowBlur=5;c.fillText('KOREA · '+(day?'DAY':'NIGHT'),x+11,y-9);c.shadowBlur=0;
        }
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
