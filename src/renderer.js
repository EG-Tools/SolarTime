/* Solar Time v0.3 — dependency-free, depth-projected Canvas renderer.
   Credited photographic maps are embedded for Earth, Pluto, Uranus and Europa. */
(function () {
  'use strict';
  const A=window.SolarAstro, {TAU,DEG,clamp}=A,SATELLITES=A.SATELLITES||Object.freeze([A.MOON].filter(Boolean));
  function random(seed) { return function() { let t=seed+=0x6D2B79F5; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
  const mix=(a,b,t)=>a+(b-a)*t;
  const ease=t=>{t=clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);};
  const VIEW=Object.freeze({minZoom:.6,maxZoom:2048,detailZoom:64,lowerBy:.05,minPanY:-.4,maxPanY:.4,minPanX:-.4,maxPanX:.4,minElevation:-Math.PI/2,maxElevation:Math.PI/2,fillRadius:1.10,detailFillRadius:.34});
  const SURFACE=Object.freeze({detailWidth:4096,maxRaster:1024,lowRaster:384});
  const AUTO_ROTATE_SPEED=2*DEG; // radians per real second; independent of orbital time
  const LABEL=Object.freeze({response:.16,switchDelay:140,dwell:320,margin:18,padding:3});
  const TRUE_RADIUS_KM=Object.freeze({sun:696340,mercury:2439.7,venus:6051.8,earth:6371,mars:3389.5,jupiter:69911,saturn:58232,uranus:25362,neptune:24622,pluto:1188.3,moon:1737.4,europa:1560.8});
  const TRUE_SCALE_SUN_SIZE=67.2;
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
      this.gpu=null;this.gpuError=null;
      const gpuCanvas=typeof document==='object'&&typeof document.getElementById==='function'?document.getElementById('planet-layer'):null;
      if(gpuCanvas&&window.SolarSurface?.DirectRenderer){try{this.gpu=new window.SolarSurface.DirectRenderer(gpuCanvas);}catch(error){this.gpuError=error.message;}}
      this.options={actualScale:false,orbits:true,labels:true,avoidLabels:false,twinkle:true,activity:true,pluto:true,moon:true,skyMotion:true,comets:true,quality:'auto'};
      this.camera={azimuth:25*DEG,elevation:45*DEG,zoom:1,focus:null,panY:0,panX:0};
      this.site={label:'KOREA',latitude:37.5665,longitude:126.978};
      this.cameraTween=null;this.autoRotation=null;this.rotationGeneration=0;this.actualScaleMix=0;this.actualScaleTween=null;
      this.surface=this.gpu||new window.SolarSurface.Service();this.cameraChangeAt=-Infinity;this.coronaTexture=null;this.paths=[];this.hitTargets=[];this.projected=[];
      this.labelStates=new Map();this.lastLabelMono=null;this.labelWidths=new Map();
      this.orbitCache=new WeakMap();this.frameCache=new Map();this.starSprites=new Map();
      this.stats={orbitProjections:0,orbitPaths:0,starSprites:0};this.boundStarGlow=this.starGlow.bind(this);
      this.selected=null;this.hover=null;this.lastPathMs=NaN;this.dirty=true;this.frameCount=0;
      this.lastSurfaceSubmit=-Infinity;this.lastSurfaceSimMs=NaN;this.lastSurfaceMono=NaN;
      this.sky=new window.SolarSky(background);
      this.resize();
    }
    resize() {
      const box=this.canvas.getBoundingClientRect(),w=Math.max(1,box.width),h=Math.max(1,box.height);
      const dpr=Math.min(window.devicePixelRatio||1,this.options.quality==='low'?1:2);
      if(w===this.w&&h===this.h&&dpr===this.dpr)return;
      this.w=w;this.h=h;this.dpr=dpr;this.starSprites?.clear();this.labelWidths?.clear();
      // Anamorphic presentation: widen projected orbital positions, keep planet icons round.
      this.lensStretch=clamp(this.w/this.h,1,1.72);
      this.canvas.width=Math.round(this.w*this.dpr);this.canvas.height=Math.round(this.h*this.dpr);
      this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
      this.gpu?.resize(this.w,this.h,this.dpr);
      this.sky.resize(this.w,this.h,this.dpr);this.dirty=true;this.lastSurfaceSubmit=-Infinity;this.surface?.invalidate(false);this.clearLabels();
    }
    starGlow(c,x,y,r,alpha) {
      if(!(r>0)||!(alpha>0))return;
      // One normalized sprite per DPR, not a new gradient/path for each star.
      const ratio=this.dpr||1,key=ratio;
      let sprite=this.starSprites.get(key);
      if(!sprite){
        const n=Math.ceil(64*ratio),canvas=document.createElement('canvas');canvas.width=canvas.height=n;
        const g=canvas.getContext('2d'),radius=n/12,center=n/2;
        const halo=g.createRadialGradient(center,center,0,center,center,n/2);
        halo.addColorStop(0,'rgba(207,226,255,1)');halo.addColorStop(.15,'rgba(151,195,249,.55)');halo.addColorStop(1,'rgba(112,161,226,0)');
        g.fillStyle=halo;g.fillRect(0,0,n,n);g.strokeStyle='rgba(213,228,252,.6)';
        g.lineWidth=radius*.5;g.beginPath();g.moveTo(center-radius*4,center);g.lineTo(center+radius*4,center);
        g.moveTo(center,center-radius*4);g.lineTo(center,center+radius*4);g.stroke();
        g.fillStyle='rgba(247,250,255,1)';g.beginPath();g.arc(center,center,radius*.6,0,TAU);g.fill();
        sprite=canvas;this.starSprites.set(key,sprite);this.stats.starSprites++;
      }
      const previous=c.globalAlpha;c.globalAlpha=previous*clamp(alpha,0,1);
      c.drawImage(sprite,x-r*6,y-r*6,r*12,r*12);c.globalAlpha=previous;
    }
    cameraBasis() {
      const {azimuth:a,elevation:e}=this.camera;
      if(!this.basis||this.basis.a!==a||this.basis.e!==e){
        this.basis={a,e,ca:Math.cos(a),sa:Math.sin(a),ce:Math.cos(e),se:Math.sin(e)};
        this.frameCache?.clear();
      }
      return this.basis;
    }
    // Orthographic direction transform shared by orbit geometry, planet
    // materials, rings and markers. This keeps every sphere in the same 3D
    // camera space instead of making its material behave like a billboard.
    viewDirection(p) {
      const {ca,sa,ce,se}=this.cameraBasis();
      const x=p.x*ca-p.y*sa,y=p.x*sa+p.y*ca;
      return {x,y:-(y*se+p.z*ce),z:-y*ce+p.z*se};
    }
    view(p) {const v=this.viewDirection(p);v.x*=this.lensStretch;return v;}
    bodyFrame(body) {
      this.cameraBasis();
      // Pole tilt is part of the key; a changed body model cannot reuse an old frame.
      const tilt=A.rotationPoleTilt(body);let cached=this.frameCache?.get(body.id);
      if(cached&&cached.body===body&&cached.tilt===tilt)return cached.frame;
      const axes=A.bodyAxes(body),frame={u:this.viewDirection(axes.u),v:this.viewDirection(axes.v),pole:this.viewDirection(axes.pole)};
      (this.frameCache||(this.frameCache=new Map())).set(body.id,{body,tilt,frame});return frame;
    }
    setOrbitView(azimuth,elevation) {
      if(!Number.isFinite(azimuth)||!Number.isFinite(elevation))return;
      this.cancelCameraMotion();
      this.camera.azimuth=A.wrap(azimuth);
      this.camera.elevation=clamp(elevation,VIEW.minElevation,VIEW.maxElevation);
      this.cameraChangeAt=performance.now();this.dirty=true;
    }
    setPanY(value) {
      if(!Number.isFinite(value))return;
      this.cancelCameraMotion();
      // Screen-height fractions: independent of zoom, target, angle or resolution.
      this.camera.panY=clamp(value,VIEW.minPanY,VIEW.maxPanY);this.dirty=true;
    }
    setPan(x,y=this.camera.panY) {
      if(!Number.isFinite(x)||!Number.isFinite(y))return;
      this.cancelCameraMotion();this.camera.panX=clamp(x,VIEW.minPanX,VIEW.maxPanX);this.setPanY(y);
    }
    sceneBodies() {return [A.SUN,...this.getBodies(),...(this.options.moon?SATELLITES:[])];}
    setSite(site){
      if(!site||typeof site.label!=='string'||!Number.isFinite(site.latitude)||!Number.isFinite(site.longitude))return false;
      this.site={label:site.label,latitude:site.latitude,longitude:site.longitude};this.dirty=true;return true;
    }
    faceFeature(id,latitude,longitude,ms) {
      const body=this.sceneBodies().find(b=>b.id===id);if(!body)return;
      const n=A.surfaceDirection(body,latitude,longitude,ms);
      this.focusBody(id);this.setOrbitView(Math.atan2(-n.x,-n.y),Math.asin(clamp(n.z,-1,1)));
    }
    baseBodyScale() {return clamp(Math.min(this.w/1330,this.h/820),.55,1.35);}
    focusRadius() {return Math.min(this.w,this.h)*4.5;}
    bodyScaleForZoom(zoom) {
      return this.baseBodyScale()*Math.sqrt(Math.min(zoom,VIEW.detailZoom));
    }
    bodyScaleAtZoom() {
      // Scene magnification depends ONLY on viewport and zoom. A small tracking
      // target must never divide the scale used by every other planet or the Sun.
      return this.bodyScaleForZoom(this.camera.zoom);
    }
    bodyDisplaySize(body){
      const designed=body.size*(body.id==='sun'?1.2:1),radius=TRUE_RADIUS_KM[body.id]||TRUE_RADIUS_KM.earth;
      const physical=TRUE_SCALE_SUN_SIZE*radius/TRUE_RADIUS_KM.sun;
      return mix(designed,physical,this.actualScaleMix);
    }
    bodyRadiusForState(body,state) {
      const zoom=state.zoom,displaySize=this.bodyDisplaySize(body);
      // The Sun is the untracked scene's fixed origin. Its ordinary body scale
      // intentionally tops out at detailZoom, but the old early return also made
      // wheel/+ zoom appear broken once the solar disk filled about 80% of the
      // viewport. Continue the central Sun into the close-up curve without
      // silently attaching a camera focus or changing any planet's behaviour.
      const centralSun=body.id==='sun'&&state.focus===null&&zoom>VIEW.detailZoom;
      if((body.id!==state.focus&&!centralSun)||zoom<=1)return displaySize*this.bodyScaleForZoom(zoom);
      const oldMax=centralSun?displaySize*this.bodyScaleForZoom(VIEW.detailZoom):Math.min(this.w,this.h)*VIEW.detailFillRadius;
      if(zoom<=VIEW.detailZoom){
        const t=(Math.sqrt(zoom)-1)/(Math.sqrt(VIEW.detailZoom)-1);
        return mix(displaySize*this.baseBodyScale(),oldMax,t);
      }
      const t=(Math.sqrt(zoom)-Math.sqrt(VIEW.detailZoom))/(Math.sqrt(VIEW.maxZoom)-Math.sqrt(VIEW.detailZoom));
      return mix(oldMax,this.focusRadius(),t);
    }
    bodyRadiusAtZoom(body) {
      // Preset/focus transitions must not switch the special tracked-body size
      // on the first frame. Blend the visible radius continuously from the exact
      // source camera state to the exact destination camera state.
      const move=this.cameraTween&&!this.cameraTween.input?this.cameraTween:null;
      if(move)return mix(this.bodyRadiusForState(body,move.from),this.bodyRadiusForState(body,move.to),move.progress||0);
      return this.bodyRadiusForState(body,this.camera);
    }

    satelliteOrbitRadius(parentRadius,satelliteRadius,satellite,parent) {
      // A close-up may enlarge a parent or satellite independently. Keep only their local
      // illustrative clearance, using the existing orbit/body ratio, not a second
      // global magnifier. The orbit line and satellite position share this ONE radius.
      const clearance=satellite.displayOrbit/(parent.size+satellite.size);
      return Math.max(satellite.displayOrbit*this.bodyScale,
        (parentRadius+satelliteRadius)*clearance)/this.scale;
    }
    moonOrbitRadius(earthRadius,moonRadius) {
      const earth=A.BODIES.find(body=>body.id==='earth');
      return this.satelliteOrbitRadius(earthRadius,moonRadius,A.MOON,earth);
    }
    project(p) { const v=this.view(p);return {x:this.cx+v.x*this.scale,y:this.cy+v.y*this.scale,z:v.z}; }
    getBodies() { return this.options.pluto?A.BODIES:(this.bodiesWithoutPluto||(this.bodiesWithoutPluto=A.BODIES.filter(b=>b.id!=='pluto'))); }
    rebuild(ms) {
      const pathKey=A.modelYear(ms)+':'+this.options.pluto;
      if(this.pathKey!==pathKey){this.paths=this.getBodies().map(body=>({body,points:A.orbitAt(body,ms,360)}));this.pathKey=pathKey;}
      const mobile=this.w<680,compact=this.h<630;
      const left=mobile?24:58,right=this.w-(mobile?24:58),top=compact?100:mobile?192:190,bottom=this.h-(compact?105:mobile?195:190);
      const baseY=(top+bottom)/2+this.h*VIEW.lowerBy,fitY=Math.max(80,2*Math.min(baseY-top,bottom-baseY));
      // Keep the overview scale invariant while orbiting the camera. Previously
      // every elevation change re-fit the projected ellipse, which felt like an
      // unwanted zoom-in/zoom-out during a vertical drag or auto rotation.
      const fitKey=[pathKey,this.w,this.h,this.lensStretch].join(':');
      if(this.fitKey!==fitKey){
        const a=25*DEG,e=45*DEG,ca=Math.cos(a),sa=Math.sin(a),ce=Math.cos(e),se=Math.sin(e);
        let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
        for(const path of this.paths)for(const p of path.points){
          const x=(p.x*ca-p.y*sa)*this.lensStretch,y=p.x*sa+p.y*ca;
          const vy=-(y*se+p.z*ce);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,vy);maxY=Math.max(maxY,vy);
        }
        this.fitScale=Math.max(.05,Math.min((right-left)/(2*Math.max(Math.abs(minX),Math.abs(maxX))),fitY/(2*Math.max(Math.abs(minY),Math.abs(maxY)))));
        this.fitKey=fitKey;
      }
      this.scale=this.fitScale*this.camera.zoom;
      this.centerX=(left+right)/2+this.w*(this.camera.panX||0);this.centerY=baseY+this.h*this.camera.panY;
      this.cx=this.centerX;this.homeCx=this.centerX;this.homeCy=this.centerY;this.cy=this.homeCy;
      this.bodyScale=this.bodyScaleAtZoom();this.lastPathMs=ms;this.pathYear=A.modelYear(ms);this.dirty=false;
    }
    advanceActualScale(mono=performance.now()){
      const tween=this.actualScaleTween;if(!tween)return;
      const p=clamp((mono-tween.started)/tween.duration,0,1),e=p*p*(3-2*p);this.actualScaleMix=mix(tween.from,tween.to,e);
      if(p>=1){this.actualScaleMix=tween.to;this.actualScaleTween=null;}
    }
    setOption(key,value,animate=true) {
      if(key==='actualScale'){
        const mono=performance.now();this.advanceActualScale(mono);this.options.actualScale=!!value;
        if(animate)this.actualScaleTween={from:this.actualScaleMix,to:value?1:0,started:mono,duration:2000};
        else{this.actualScaleMix=value?1:0;this.actualScaleTween=null;}
        this.lastSurfaceSubmit=-Infinity;return;
      }
      this.options[key]=value;this.dirty=true;if(key==='quality')this.resize();
      if((key==='labels'&&!value)||key==='avoidLabels')this.clearLabels();
      if(key==='moon'&&!value&&SATELLITES.some(body=>body.id===this.camera.focus))this.resetCamera();
      if(key==='pluto'&&!value&&this.camera.focus==='pluto')this.resetCamera();
    }
    setZoom(value,focusId=null) {
      if(!Number.isFinite(value))return;
      this.cancelCameraMotion();
      this.camera.zoom=clamp(value,VIEW.minZoom,VIEW.maxZoom);this.cameraChangeAt=performance.now();
      if(this.camera.zoom<=1)this.camera.focus=null;
      else if(!this.camera.focus) {
        const candidate=focusId||this.selected||'sun';
        this.camera.focus=this.sceneBodies().some(b=>b.id===candidate)?candidate:'sun';
      }
      this.dirty=true;
    }
    focusBody(id) {
      const body=this.sceneBodies().find(b=>b.id===id);
      if(!body)return;
      const baseRadius=this.bodyDisplaySize(body)*this.baseBodyScale(),radius=Math.min(this.w,this.h)*.25;
      const t=clamp((radius-baseRadius)/(Math.min(this.w,this.h)*VIEW.detailFillRadius-baseRadius),0,1);
      this.cancelCameraMotion();this.camera.focus=id;
      this.setZoom(clamp((1+t*(Math.sqrt(VIEW.detailZoom)-1))**2,6,VIEW.detailZoom));
    }
    get zoomLimits() {return VIEW;}
    visible(p,r=0) {return p.x+r>=0&&p.x-r<=this.w&&p.y+r>=0&&p.y-r<=this.h;}

    cameraSnapshot() {return {...this.camera};}
    static validCamera(state) {
      if(!state||typeof state!=='object')return false;
      for(const key of ['azimuth','elevation','zoom','panX','panY'])if(!Number.isFinite(state[key]))return false;
      if(state.azimuth<0||state.azimuth>=TAU||state.elevation<VIEW.minElevation||state.elevation>VIEW.maxElevation||
        state.zoom<VIEW.minZoom||state.zoom>VIEW.maxZoom||state.panX<VIEW.minPanX||state.panX>VIEW.maxPanX||
        state.panY<VIEW.minPanY||state.panY>VIEW.maxPanY)return false;
      const validFocus=state.focus===null||[A.SUN,...A.BODIES,...SATELLITES].some(b=>b.id===state.focus);
      return validFocus&&(state.zoom>1||state.focus===null);
    }
    restoreCamera(state) {
      if(!Renderer.validCamera(state))return false;
      if((SATELLITES.some(body=>body.id===state.focus)&&!this.options.moon)||(state.focus==='pluto'&&!this.options.pluto))return false;
      this.cameraTween=null;this.autoRotation=null;
      // Commit one camera transaction. Time, selected body and display toggles are not preset data.
      this.camera={azimuth:state.azimuth,elevation:state.elevation,zoom:state.zoom,
        focus:state.focus,panX:state.panX,panY:state.panY};
      this.cameraChangeAt=performance.now();this.dirty=true;this.clearLabels();this.invalidateSurfaces();return true;
    }
    // One monotonic-time transition owner, not a second requestAnimationFrame loop.
    // Different tracked bodies travel through overview zoom: focus switches only
    // at zoom=1 where both its position weight and its extra size are exactly zero.
    animateCamera(state,mono=performance.now(),duration=1100,input=false) {
      if(!Renderer.validCamera(state)||!Number.isFinite(mono)||!Number.isFinite(duration))return false;
      if((SATELLITES.some(body=>body.id===state.focus)&&!this.options.moon)||(state.focus==='pluto'&&!this.options.pluto))return false;
      if(duration<=0)return this.restoreCamera(state);
      this.stopAutoRotate(mono);this.advanceCamera(mono);this.pendingAutoRotation=null;
      const from=this.cameraSnapshot(),to={...state};
      // Programmatic transitions keep both the old and new tracking anchors alive
      // for the whole move. This prevents a one-frame focus hand-off that used to
      // make the tracked planet jump in size/position between saved views.
      this.cameraTween={from,to,start:mono,duration,input,progress:0};
      this.cameraChangeAt=mono;this.dirty=true;return true;
    }
    // All UI camera commands use animateCamera: one owner, one rAF, no timers.
    // The old immediate setters remain for startup/model setup and integrations.
    cameraInputState(mono=performance.now()) {
      if(this.cameraTween?.input)return {...this.cameraTween.to};
      this.advanceCamera(mono);this.advanceAutoRotate(mono);return this.cameraSnapshot();
    }
    smoothCamera(patch,mono=performance.now(),duration=90) {
      const to={...this.cameraInputState(mono),...patch};
      if(![to.azimuth,to.elevation,to.zoom,to.panX,to.panY].every(Number.isFinite))return false;
      to.azimuth=A.wrap(to.azimuth);to.elevation=clamp(to.elevation,VIEW.minElevation,VIEW.maxElevation);
      to.panX=clamp(to.panX,VIEW.minPanX,VIEW.maxPanX);to.panY=clamp(to.panY,VIEW.minPanY,VIEW.maxPanY);
      to.zoom=clamp(to.zoom,VIEW.minZoom,VIEW.maxZoom);if(to.zoom<=1)to.focus=null;
      return this.animateCamera(to,mono,duration,true);
    }
    smoothZoom(value,focusId=null,mono=performance.now()) {
      if(!Number.isFinite(value))return false;
      const to=this.cameraInputState(mono);to.zoom=clamp(value,VIEW.minZoom,VIEW.maxZoom);
      if(to.zoom<=1)to.focus=null;
      // Wheel / +/- zoom must not silently create a tracking target. A target is
      // attached only by an explicit focus command; otherwise overview zoom keeps
      // the scene's true centre and cannot inherit a hidden pivot.
      if(!to.focus)to.focus=null;
      return this.smoothCamera(to,mono,150);
    }
    focusState(id,mono=performance.now()) {
      const body=this.sceneBodies().find(b=>b.id===id);
      if(!body)return null;
      this.advanceCamera(mono);this.advanceAutoRotate(mono);
      const baseRadius=this.bodyDisplaySize(body)*this.baseBodyScale(),radius=Math.min(this.w,this.h)*.25;
      const t=clamp((radius-baseRadius)/(Math.min(this.w,this.h)*VIEW.detailFillRadius-baseRadius),0,1);
      // Tracking is always viewport-centred. A previous middle-button pan is a
      // scene navigation offset, not part of a planet-follow camera preset.
      return {...this.cameraSnapshot(),focus:id,panX:0,panY:0,
        zoom:clamp((1+t*(Math.sqrt(VIEW.detailZoom)-1))**2,6,VIEW.detailZoom)};
    }
    animateFocus(id,mono=performance.now(),duration=1100) {
      const to=this.focusState(id,mono);return !!to&&this.animateCamera(to,mono,duration);
    }
    animateFeature(id,latitude,longitude,ms,mono=performance.now(),duration=1100) {
      const to=this.focusState(id,mono),body=this.sceneBodies().find(b=>b.id===id);
      if(!to||!body||![latitude,longitude,ms].every(Number.isFinite))return false;
      const n=A.surfaceDirection(body,latitude,longitude,ms);
      to.azimuth=A.wrap(Math.atan2(-n.x,-n.y));to.elevation=Math.asin(clamp(n.z,-1,1));
      // Feature views are inspection shots rather than whole-planet portraits.
      // Earth reaches roughly 200% of the viewport height, making Korea readable
      // while keeping one final wheel step available up to the 256x hard limit.
      if(id==='earth')to.zoom=Math.max(to.zoom,1800);
      return this.animateCamera(to,mono,duration);
    }
    animateHome(mono=performance.now(),duration=1100) {
      return this.animateCamera({azimuth:25*DEG,elevation:45*DEG,zoom:1,focus:null,panY:0,panX:0},mono,duration);
    }
    advanceCamera(mono=performance.now()) {
      const move=this.cameraTween;if(!move)return false;
      const t=clamp((mono-move.start)/move.duration,0,1),p=ease(t),{from,to}=move;move.progress=p;
      const delta=A.wrap(to.azimuth-from.azimuth+Math.PI)-Math.PI;
      const state={azimuth:A.wrap(from.azimuth+delta*p),elevation:mix(from.elevation,to.elevation,p),
        panX:mix(from.panX,to.panX,p),panY:mix(from.panY,to.panY,p),
        // The visible tracking anchor itself is cross-blended in draw(). Keep the
        // destination focus here so surface detail can prepare before arrival.
        focus:to.focus,
        zoom:mix(from.zoom,to.zoom,p)};
      if(state.zoom<=1&&to.focus===null)state.focus=null;
      this.camera=t>=1?{...to}:state;
      if(t>=1){
        this.cameraTween=null;
        const pending=this.pendingAutoRotation;this.pendingAutoRotation=null;
        if(pending)this.beginAutoRotation(pending.direction,mono,pending.generation);
      }
      this.cameraChangeAt=mono;this.dirty=true;return true;
    }
    cancelCameraTween(mono=performance.now()) {
      if(this.cameraTween){this.advanceCamera(mono);this.cameraTween=null;}
    }
    get autoRotateDirection() {return this.autoRotation?.direction||this.pendingAutoRotation?.direction||0;}
    beginAutoRotation(direction,mono,generation=(this.rotationGeneration||0)+1) {
      this.autoRotation={direction,azimuth:this.camera.azimuth,mono,generation};
      this.rotationGeneration=generation;this.cameraChangeAt=-Infinity;this.dirty=true;return true;
    }
    setAutoRotate(direction,mono=performance.now()) {
      if(![-1,0,1].includes(direction)||!Number.isFinite(mono))return false;
      const current=this.autoRotateDirection;
      if(!direction||current===direction){
        this.pendingAutoRotation=null;this.cancelCameraTween(mono);this.advanceAutoRotate(mono);this.autoRotation=null;this.dirty=true;return true;
      }
      this.cancelCameraTween(mono);this.advanceAutoRotate(mono);this.autoRotation=null;
      const generation=(this.rotationGeneration||0)+1;
      // Rotate around the CURRENT viewport centre. Pan and zoom are preserved;
      // auto-rotation must never re-centre the user's composition first.
      return this.beginAutoRotation(direction,mono,generation);
    }
    advanceAutoRotate(mono=performance.now()) {
      const motion=this.autoRotation;if(!motion||!Number.isFinite(mono))return false;
      if(motion.mono===null){motion.mono=mono;motion.azimuth=this.camera.azimuth;return false;}
      const angle=A.wrap(motion.azimuth+motion.direction*AUTO_ROTATE_SPEED*Math.max(0,mono-motion.mono)/1000);
      if(angle===this.camera.azimuth)return false;
      this.camera.azimuth=angle;this.dirty=true;return true;
    }
    stopAutoRotate(mono=performance.now()) {
      this.pendingAutoRotation=null;if(this.autoRotation){this.advanceAutoRotate(mono);this.autoRotation=null;}
    }
    cancelCameraMotion(mono=performance.now()) {this.pendingAutoRotation=null;this.cancelCameraTween(mono);this.stopAutoRotate(mono);}
    resetCamera() {this.cameraTween=null;this.autoRotation=null;this.camera={azimuth:25*DEG,elevation:45*DEG,zoom:1,focus:null,panY:0,panX:0};this.dirty=true;}
    projectOrbit(path) {
      const {azimuth:a,elevation:e}=this.camera,lens=this.lensStretch;
      const cache=this.orbitCache||(this.orbitCache=new WeakMap());let item=cache.get(path);
      if(item&&item.a===a&&item.e===e&&item.lens===lens&&item.source===path.points)return item;
      const xyz=new Float64Array(path.points.length*3);
      let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
      for(let i=0;i<path.points.length;i++){
        const q=this.view(path.points[i]);xyz[i*3]=q.x;xyz[i*3+1]=q.y;xyz[i*3+2]=q.z;
        minX=Math.min(minX,q.x);maxX=Math.max(maxX,q.x);minY=Math.min(minY,q.y);maxY=Math.max(maxY,q.y);
      }
      item={a,e,lens,source:path.points,xyz,minX,maxX,minY,maxY,scale:NaN,passes:null};cache.set(path,item);
      if(this.stats)this.stats.orbitProjections+=path.points.length;return item;
    }
    orbit(c,path,highlight) {
      const item=this.projectOrbit(path),xyz=item.xyz,scale=this.scale;
      const rgb=path.body.id==='earth'?'110,174,212':path.body.id==='pluto'?'155,140,127':'138,151,168';
      c.lineWidth=highlight?1.25:.72;if(path.body.id==='pluto')c.setLineDash([2,5]);
      // Translate cached screen-unit paths when tracking. Stroke widths stay in
      // CSS pixels; zoom never scales line width or the Pluto dash pattern.
      const cached=typeof Path2D==='function';
      if(cached&&(!item.passes||item.scale!==scale)){
        item.passes=[new Path2D(),new Path2D()];item.scale=scale;
        for(let pass=0;pass<2;pass++){
          const p=item.passes[pass];let active=false;
          for(let i=0;i<xyz.length;i+=3){
            const x=xyz[i]*scale,y=xyz[i+1]*scale,front=xyz[i+2]>=0;
            if(front===(pass===1)){active?p.lineTo(x,y):p.moveTo(x,y);active=true;}
            else{if(active)p.lineTo(x,y);active=false;}
          }
        }
        if(this.stats)this.stats.orbitPaths+=2;
      }
      c.save();c.translate(this.cx,this.cy);
      for(let pass=0;pass<2;pass++){
        c.strokeStyle=`rgba(${rgb},${highlight?.64:pass?.32:.17})`;
        if(cached)c.stroke(item.passes[pass]);
        else{
          c.beginPath();let active=false;
          for(let i=0;i<xyz.length;i+=3){const x=xyz[i]*scale,y=xyz[i+1]*scale,front=xyz[i+2]>=0;
            if(front===(pass===1)){active?c.lineTo(x,y):c.moveTo(x,y);active=true;}
            else{if(active)c.lineTo(x,y);active=false;}}
          c.stroke();
        }
      }
      c.restore();c.setLineDash([]);
    }
    // All bodies submit to the same bounded surface owner; no CPU pixel loop here.
    surfaceJob(body,world,r,ms,seconds,mono) {
      const focused=body.id===this.camera.focus;
      const maximum=focused?SURFACE.maxRaster:256;
      const wanted=Math.min(maximum,Math.max(32,r*2*this.dpr));
      const diam=[32,64,128,192,256,384,512,768,1024].find(n=>n>=wanted)||1024;
      // Stable detail while dragging and on tab return. No flat->256->4096
      // ladder: decode the chosen image once and reuse it across camera angles.
      const nativeWidth=window.SolarAssets?.materialInfo?.[body.id]?.width||SURFACE.detailWidth;
      const textureTarget=this.gpu?([128,256,512,1024,2048,4096].find(n=>n>=diam*4)||4096):(focused?SURFACE.detailWidth:1024);
      const textureWidth=Math.min(nativeWidth,focused?textureTarget:Math.min(1024,textureTarget));
      // One parent body frame owns every visual child (surface, rings, markers).
      // There is intentionally no independently rotatable ring transform.
      const vectors=this.bodyFrame(body),frame=vectors.gpu||(vectors.gpu=Object.fromEntries(Object.entries(vectors).filter(([k])=>k!=='gpu').map(([k,v])=>[k,new Float32Array([v.x,v.y,v.z])])));
      // Satellites inherit their parent's heliocentric position for lighting.
      let physical;
      if(body.id==='sun')physical={x:0,y:0,z:0};
      else if(body.parent){
        const parent=A.BODIES.find(candidate=>candidate.id===body.parent),parentPhysical=A.positionAt(parent,ms);
        const physicalRadius=body.id==='moon'?.0025696:.004484;
        const local=A.satelliteAt(body,ms,physicalRadius);
        physical={x:parentPhysical.x+local.x,y:parentPhysical.y+local.y,z:parentPhysical.z+local.z};
      }else physical=A.positionAt(body,ms);
      const lightVector=this.viewDirection({x:-physical.x,y:-physical.y,z:-physical.z});
      const len=Math.hypot(lightVector.x,lightVector.y,lightVector.z)||1;
      // Solar activity changes emissive brightness only; geometry and rotation remain physical.
      const activity=body.id==='sun'&&this.options.activity;
      const spin=A.rotationAt(body,ms);
      const geometry=[body.id,window.SolarAssets?.materialRevision||0,diam,textureWidth,'camera-3d',A.rotationPoleTilt(body),this.camera.azimuth.toFixed(5),this.camera.elevation.toFixed(5),Number(activity)].join(':');
      const viewState={yaw:this.camera.azimuth,pitch:this.camera.elevation,limit:this.autoRotation?Math.PI/120:Math.PI/36,
        key:[body.id,window.SolarAssets?.materialRevision||0,diam,textureWidth,A.rotationPoleTilt(body),this.autoRotation?.generation||0].join(':')};
      return {id:body.id,diam,textureWidth,frame,geometry,viewState,phase:spin/TAU,
        light:[lightVector.x/len,lightVector.y/len,lightVector.z/len],activity,seconds:activity?seconds:0};
    }
    invalidateSurfaces() {this.lastSurfaceSubmit=-Infinity;this.surface?.invalidate();}
    suspend() {
      const mono=performance.now();this.cancelCameraTween(mono);this.advanceAutoRotate(mono);
      if(this.autoRotation)this.autoRotation.mono=null; // Resume at the same view, never catch up a hidden tab.
      this.surface?.pause();this.sky?.pause?.();
    }
    resume() {if(!this.surface)this.surface=this.gpu||new window.SolarSurface.Service();this.surface.resume();this.sky?.resume?.();}
    dispose() {this.suspend();this.surface?.dispose();this.surface=null;this.autoRotation=null;this.clearLabels();this.hitTargets=[];this.coronaTexture=null;this.starSprites.clear();this.frameCache.clear();this.labelWidths.clear();this.orbitCache=new WeakMap();this.sky?.dispose();}
    makeCoronaTexture(size=384) {
      // Exact public-site corona texture for the non-WebGL compatibility path.
      const extent=3.3,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
      const ctx=canvas.getContext('2d'),image=ctx.createImageData(size,size),out=image.data;
      for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
        const px=((x+.5)/size*2-1)*extent,py=((y+.5)/size*2-1)*extent,d=Math.hypot(px,py);
        if(d<.98||d>extent)continue;
        const a=Math.atan2(py,px),ca=Math.cos(a),sa=Math.sin(a);
        const field=fbm(ca*5+21,sa*5+37),fine=noise(ca*43+px*.7,sa*43+py*.7);
        const filament=Math.pow(clamp(field*.7+fine*.3,0,1),3);
        const reach=.20+Math.pow(field,2)*1.55,falloff=Math.exp(-(d-1)/reach);
        const edge=clamp((extent-d)/.45,0,1),alpha=(.07+filament*.75)*falloff*edge;
        const i=(y*size+x)*4;
        out[i]=255;out[i+1]=168+field*46;out[i+2]=67+field*51;out[i+3]=Math.round(alpha*255);
      }
      ctx.putImageData(image,0,0);return canvas;
    }
    corona(c,x,y,r,seconds,maskDisk=false) {
      // v0.19: activity is a true visibility toggle, not merely an animation freeze.
      if(!this.options.activity)return;
      // Public SolarTime timing and layer blend values.
      const t=seconds*24;
      const detail=r*this.dpr>128&&this.options.quality!=='low'?768:384;
      if(!this.coronaTexture||this.coronaTexture.width<detail)this.coronaTexture=this.makeCoronaTexture(detail);
      c.save();c.translate(x,y);
      // The direct-GPU Sun is on the layer below this Canvas. Keep the public
      // effect around its limb without painting the halo over the solar disk.
      if(maskDisk){c.beginPath();c.rect(-r*5.1,-r*5.1,r*10.2,r*10.2);c.arc(0,0,r*.99,0,TAU,true);c.clip('evenodd');}
      c.globalCompositeOperation='screen';
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
    rings(c,b,p,r,front,frame=this.bodyFrame(b)) {
      // Rings are a visual child of the planet and consume its parent frame.
      // Split by actual view-space depth, not screen top/bottom or a fixed ellipse.
      const sat=b.id==='saturn',{u,v}=frame,nearStart=Math.atan2(v.z,u.z)-Math.PI/2;
      const start=nearStart+(front?0:Math.PI);
      c.save();c.transform(u.x,u.y,v.x,v.y,p.x,p.y);
      const inner=sat?1.28:1.58,outer=sat?2.26:1.94;
      if(sat){
        const steps=116;
        for(let i=0;i<steps;i++) {
          const f=i/(steps-1),rr=mix(inner,outer,f)*r;if(f>.56&&f<.62)continue;
          const alpha=(.19+.48*Math.sin(f*75)**2)*(f>.85?.6:1);
          c.strokeStyle=`rgba(${205+Math.round(f*25)},${180+Math.round(f*22)},${133+Math.round(f*38)},${alpha})`;
          c.lineWidth=(outer-inner)*r/steps*1.18;c.beginPath();c.arc(0,0,rr,start,start+Math.PI);c.stroke();
        }
      }else{
        // Uranus has a family of narrow, low-albedo rings rather than one broad annulus.
        const rings=[[.07,.16,.72],[.16,.20,.65],[.27,.13,.68],[.39,.22,.62],[.53,.17,.78],[.68,.25,.68],[.83,.19,.82],[.95,.46,1.05]];
        for(const [f,alpha,width] of rings){
          c.strokeStyle=`rgba(158,199,202,${alpha})`;c.lineWidth=Math.max(.55,width*this.dpr);
          c.beginPath();c.arc(0,0,mix(inner,outer,f)*r,start,start+Math.PI);c.stroke();
        }
      }
      c.restore();
    }
    drawBody(c,b,world,screen,r,ms,t) {
      const frame=this.bodyFrame(b);
      if(b.id==='sun')this.corona(c,screen.x,screen.y,r,t);
      if(b.id==='saturn'||b.id==='uranus')this.rings(c,b,screen,r,false,frame);
      if(b.id==='earth') {
        const g=c.createRadialGradient(screen.x,screen.y,r*.99,screen.x,screen.y,r*1.035);g.addColorStop(0,'rgba(73,145,218,.12)');g.addColorStop(1,'rgba(74,155,219,0)');c.fillStyle=g;c.beginPath();c.arc(screen.x,screen.y,r*1.035,0,TAU);c.fill();
      }
      if(this.visible(screen,r+2)) {
        const img=this.surface.get(b.id);
        if(img)c.drawImage(img,screen.x-r,screen.y-r,r*2,r*2);
        // First-ever material load has no fake flat-colour planet. During
        // camera changes/visibility pauses the last complete image is retained.
      }
      if(b.id==='saturn'||b.id==='uranus')this.rings(c,b,screen,r,true,frame);
      if(this.selected===b.id||this.hover===b.id) {
        c.strokeStyle=this.selected===b.id?'rgba(225,203,155,.7)':'rgba(210,226,244,.4)';c.lineWidth=.8;c.beginPath();c.arc(screen.x,screen.y,r+5,0,TAU);c.stroke();
      }
    }
    drawBodyOverlay(c,b,screen,r) {
      if(this.selected===b.id||this.hover===b.id) {
        c.strokeStyle=this.selected===b.id?'rgba(225,203,155,.7)':'rgba(210,226,244,.4)';c.lineWidth=.8;c.beginPath();c.arc(screen.x,screen.y,r+5,0,TAU);c.stroke();
      }
    }
    occludeDirectBodies(c,bodies) {
      if(!bodies.length)return;
      // Stars, twinkles and comets live on the transparent 2D canvas above the
      // direct WebGL planet canvas. Remove only those background pixels where an
      // opaque GPU sphere was actually drawn, then paint labels/markers on top.
      // Match the shader's half-device-pixel antialiased limb so no clear halo is
      // introduced around a planet.
      const inset=.5/(this.dpr||1);
      c.save();c.globalCompositeOperation='destination-out';c.fillStyle='#000';
      for(const {screen,r} of bodies){const radius=Math.max(0,r-inset);if(!radius)continue;c.beginPath();c.arc(screen.x,screen.y,radius,0,TAU);c.fill();}
      c.restore();
    }
    clearLabels() {this.labelStates.clear();this.lastLabelMono=null;}
    labels(c,bodies,mono) {
      // Stable identity order, not depth order: crossing orbits cannot change priority.
      // Store offsets from the CURRENT body, so smoothing never trails an orbiting body.
      if(this.lastLabelMono!==null&&mono<this.lastLabelMono)this.clearLabels();
      const dt=this.lastLabelMono===null?0:clamp((mono-this.lastLabelMono)/1000,0,.05);
      this.lastLabelMono=mono;
      const avoid=!!this.options?.avoidLabels;
      const alpha=avoid?1-Math.exp(-dt/LABEL.response):1,reserved=[],active=new Set();
      const byId=new Map(bodies.map(p=>[p.body.id,p]));
      const ordered=[A.SUN,...A.BODIES,...SATELLITES].map(b=>byId.get(b.id)).filter(Boolean);
      const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*
        Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
      c.textAlign='center';c.textBaseline='top';
      for(const item of ordered) {
        const {body:b,screen:s,r}=item,satellite=!!b.parent;active.add(b.id);
        const font=satellite?8:this.w<680?9:10,h=font+10;
        c.font=`500 ${font}px "Segoe UI", Arial, sans-serif`;
        if('letterSpacing' in c)c.letterSpacing=satellite?'1px':'1.65px';
        const widths=this.labelWidths||(this.labelWidths=new Map()),metricKey=font+':'+satellite+':'+b.en;
        let w=widths.get(metricKey);if(w===undefined){w=c.measureText(b.en).width+10;widths.set(metricKey,w);}
        const gap=satellite?7:b.id==='saturn'?13:9;
        const offsets=avoid?[[0,r+gap],[0,-r-h-gap],[r+w/2+gap,-h/2],[-r-w/2-gap,-h/2],[0,r+gap+h+4]]:[[0,r+gap]];
        const candidates=offsets.map(([dx,dy],slot)=>({slot,
          x:clamp(s.x+dx-w/2,8,Math.max(8,this.w-w-8)),
          y:clamp(s.y+dy,8,Math.max(8,this.h-h-8)),w,h}));
        const obstacles=(avoid?bodies:[]).filter(p=>p!==item).map(p=>({
          x:p.screen.x-p.r-LABEL.padding,y:p.screen.y-p.r-LABEL.padding,
          w:p.r*2+LABEL.padding*2,h:p.r*2+LABEL.padding*2}));
        if(!avoid){candidates[0].x=s.x-w/2;candidates[0].y=s.y+r+gap;}
        for(const q of (avoid?candidates:[])) {
          q.score=q.slot*7;
          for(const obstacle of [...reserved,...obstacles]) {
            q.score+=overlap(q,obstacle)/Math.max(1,Math.min(w*h,obstacle.w*obstacle.h))*1000;
          }
        }
        const best=avoid?candidates.reduce((a,b)=>a.score<=b.score?a:b):candidates[0];
        let state=this.labelStates.get(b.id);
        if(!state) {
          state={slot:best.slot,dx:best.x+w/2-s.x,dy:best.y-s.y,
            switchedAt:mono-LABEL.dwell,pending:null,pendingSince:mono};
          this.labelStates.set(b.id,state);
        } else if(!avoid) {state.slot=0;state.pending=null;} else {
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
        c.fillStyle=this.selected===b.id?'#eedbb8':b.id==='sun'?'#f1c889':satellite?'#8f9cac':'#b9c4d2';
        c.fillText(b.en,x,y);c.shadowBlur=0;this.hitTargets.push(box);
      }
      for(const id of this.labelStates.keys())if(!active.has(id))this.labelStates.delete(id);
      if('letterSpacing' in c)c.letterSpacing='0px';
    }
    draw(ms,seconds,mono=performance.now()) {
      this.advanceActualScale(mono);this.advanceCamera(mono);this.advanceAutoRotate(mono);
      const c=this.ctx;this.frameCount++;c.clearRect(0,0,this.w,this.h);
      if(this.dirty||!Number.isFinite(this.lastPathMs)||A.modelYear(ms)!==this.pathYear)this.rebuild(ms);
      this.sky.draw(seconds,this.camera,this.options);
      this.sky.decorate(c,seconds,this.options,this.boundStarGlow);
      const bodies=this.getBodies().map(body=>{const world=A.positionAt(body,ms,true);return {body,world,r:this.bodyRadiusAtZoom(body)};});
      bodies.push({body:A.SUN,world:{x:0,y:0,z:0},r:this.bodyRadiusAtZoom(A.SUN)});
      const satelliteLayouts=[];
      if(this.options.moon) {
        for(const satellite of SATELLITES){
          const parent=bodies.find(item=>item.body.id===satellite.parent);if(!parent)continue;
          const r=this.bodyRadiusAtZoom(satellite),orbitRadius=this.satelliteOrbitRadius(parent.r,r,satellite,parent.body);
          const local=A.satelliteAt(satellite,ms,orbitRadius);
          const world={x:parent.world.x+local.x,y:parent.world.y+local.y,z:parent.world.z+local.z};
          const item={body:satellite,world,r,parent,orbitRadius};bodies.push(item);satelliteLayouts.push(item);
        }
      }
      const earth=bodies.find(p=>p.body.id==='earth');
      // Saved-view/focus transitions interpolate ONE tracking anchor between the
      // source and destination states. Null focus is the scene origin. Because the
      // anchor itself is blended, there is no focus hand-off frame and no camera
      // knock when moving 1→2→3 with a tracked planet in the middle preset.
      const move=this.cameraTween&&!this.cameraTween.input?this.cameraTween:null;
      if(move){
        const from=move.from.focus?bodies.find(p=>p.body.id===move.from.focus):null;
        const to=move.to.focus?bodies.find(p=>p.body.id===move.to.focus):null;
        const a=from?.world||{x:0,y:0,z:0},b=to?.world||{x:0,y:0,z:0},p=move.progress||0;
        const anchor={x:mix(a.x,b.x,p),y:mix(a.y,b.y,p),z:mix(a.z,b.z,p)},v=this.view(anchor);
        this.cx=this.centerX-v.x*this.scale;this.cy=this.centerY-v.y*this.scale;
      }else{
        const target=bodies.find(p=>p.body.id===this.camera.focus);
        if(target){const v=this.view(target.world);this.cx=this.centerX-v.x*this.scale;this.cy=this.centerY-v.y*this.scale;}
        else{this.cx=this.homeCx;this.cy=this.homeCy;}
      }
      for(const body of bodies)body.screen=this.project(body.world);
      const direct=!!this.gpu&&this.gpu.begin();
      if(this.options.orbits) {
        if(direct){
          for(const path of this.paths){const item=this.projectOrbit(path),selected=this.selected===path.body.id;
            this.gpu.orbit(item.xyz,this.scale,this.cx,this.cy,path.body.id==='earth'?[.43,.68,.83]:path.body.id==='pluto'?[.61,.55,.50]:[.54,.59,.66],selected?.64:.22);}
        }else if(!this.gpu)for(const path of this.paths)this.orbit(c,path,this.selected===path.body.id);
        for(const satellite of satelliteLayouts) {
          const points=A.satelliteOrbit(satellite.body,ms,satellite.orbitRadius,90),parent=satellite.parent.world;
          if(direct){const xyz=new Float32Array(points.length*3);for(let i=0;i<points.length;i++){const p=points[i],v=this.view({x:parent.x+p.x,y:parent.y+p.y,z:parent.z+p.z});xyz[i*3]=v.x;xyz[i*3+1]=v.y;xyz[i*3+2]=v.z;}this.gpu.orbit(xyz,this.scale,this.cx,this.cy,satellite.body.id==='moon'?[.45,.61,.74]:[.67,.62,.46],.26);}
          else if(!this.gpu){c.strokeStyle=satellite.body.id==='moon'?'rgba(115,155,189,.26)':'rgba(171,158,117,.26)';c.lineWidth=.65;c.beginPath();for(let i=0;i<points.length;i++){const p=points[i],s=this.project({x:parent.x+p.x,y:parent.y+p.y,z:parent.z+p.z});i?c.lineTo(s.x,s.y):c.moveTo(s.x,s.y);}c.stroke();}
        }
      }
      bodies.sort((a,b)=>a.screen.z-b.screen.z);
      this.hitTargets=[];
      // Surface/sky resume is handled once on visibility/pageshow. Avoid doing
      // resume()+pump() in the 60 fps draw hot path.
      // A corona that crosses the viewport does NOT make the hidden solar disk visible.
      const surfaceBodies=bodies.filter(p=>this.visible(p.screen,p.r+2));
      surfaceBodies.sort((a,b)=>{
        const focus=Number(b.body.id===this.camera.focus)-Number(a.body.id===this.camera.focus);
        return focus||b.r-a.r;
      });
      // Surface bitmaps are produced asynchronously. Submitting a new full batch
      // every display frame made fast simulation accumulate work unevenly: the
      // visible phase advanced continuously, then caught up in bursts when a
      // worker batch completed. Use a stable producer cadence instead. Large/focus
      // bodies still refresh at ~30 fps in accelerated time while real-time motion
      // uses a lighter cadence. Camera motion gets an immediate-enough 40 ms path.
      let directJobs=null,directBodies=[];
      if(direct){
        directJobs=new Map(surfaceBodies.map(p=>[p.body.id,this.surfaceJob(p.body,p.world,p.r,ms,seconds,mono)]));
        for(const p of bodies){const extent=p.body.id==='sun'?5.1:p.body.id==='saturn'?2.3:p.body.id==='uranus'?2:1.3;if(!this.visible(p.screen,p.r*extent+16))continue;
          const job=directJobs.get(p.body.id);if(job&&this.gpu.planet(job,p.body,p.screen,p.r,seconds,this.options.activity))directBodies.push(p);
        }
        this.gpu.end();
      }else if(!this.gpu){
        const realDt=Number.isFinite(this.lastSurfaceMono)?Math.max(1,mono-this.lastSurfaceMono):16.7;
        const simDt=Number.isFinite(this.lastSurfaceSimMs)?Math.abs(ms-this.lastSurfaceSimMs):0;
        const simRate=simDt/realDt, moving=!!this.cameraTween||!!this.autoRotation;
        const surfaceInterval=moving?40:simRate>1000?34:90;
        if(mono-this.lastSurfaceSubmit>=surfaceInterval){
          this.lastSurfaceSubmit=mono;this.lastSurfaceSimMs=ms;this.lastSurfaceMono=mono;
          this.surface.update(surfaceBodies.map(p=>this.surfaceJob(p.body,p.world,p.r,ms,seconds,mono)),mono);
        }
      }
      if(direct)this.occludeDirectBodies(c,directBodies);
      for(const p of bodies) {
        const extent=p.body.id==='sun'?5.1:p.body.id==='saturn'?2.3:p.body.id==='uranus'?2:1.3;
        if(!this.visible(p.screen,p.r*extent+16))continue;
        if(this.gpu){
          if(p.body.id==='sun'&&this.options.activity)this.corona(c,p.screen.x,p.screen.y,p.r,seconds,true);
          this.drawBodyOverlay(c,p.body,p.screen,p.r);
        }else this.drawBody(c,p.body,p.world,p.screen,p.r,ms,seconds);
        this.hitTargets.push({id:p.body.id,x:p.screen.x,y:p.screen.y,r:Math.max(p.r+6,11),z:p.screen.z});
      }
      if(this.camera.focus==='earth'&&earth.r>65){
        const site=this.site,normal=this.viewDirection(A.surfaceDirection(earth.body,site.latitude,site.longitude,ms));
        if(normal.z>.03){
          const x=earth.screen.x+normal.x*earth.r,y=earth.screen.y+normal.y*earth.r,day=A.siteSun(ms,site.latitude,site.longitude).altitude>=0;
          c.fillStyle=day?'#ffdb92':'#98c9ff';c.strokeStyle='rgba(255,255,255,.8)';c.lineWidth=1;
          c.beginPath();c.arc(x,y,3,0,TAU);c.fill();c.beginPath();c.arc(x,y,6,0,TAU);c.stroke();
          c.font='11px "Segoe UI",sans-serif';c.textAlign='left';c.shadowColor='#000';c.shadowBlur=5;c.fillText(site.label+' · '+(day?'DAY':'NIGHT'),x+11,y-9);c.shadowBlur=0;
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
