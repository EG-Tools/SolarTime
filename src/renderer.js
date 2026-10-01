/* Solar Time v0.56 — renderer implementation owner. */
(function () {
  'use strict';
  const A=window.SolarAstro, {TAU,DEG,clamp}=A,SATELLITES=A.SATELLITES||Object.freeze([A.MOON].filter(Boolean));
  const OVERVIEW_ORBIT=A.OVERVIEW_ORBIT||Object.freeze({gap:90,minGap:50,maxGap:400});
  const ACTUAL_ORBIT_SPACING=Object.freeze({normalBlendEnd:.1,minimumMix:.01});
  const OVERVIEW_GAP_MULTIPLIER=1.5;
  function random(seed) { return function() { let t=seed+=0x6D2B79F5; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
  const mix=(a,b,t)=>a+(b-a)*t;
  // The ordinary endpoint is a parent-centered circle. Only Pluto retains
  // inclination there; the physical endpoint always keeps its full 3D vector.
  function blendOrbitPoint(point,normal,actual,depthNormal,depthActual,inclined,out){
    const planar=Math.hypot(point.x,point.y),flatten=inclined?1:Math.hypot(point.x,point.y,point.z)/Math.max(1e-12,planar);
    out.x=point.x*(normal*flatten+actual);out.y=point.y*(normal*flatten+actual);out.z=point.z*((inclined?normal:0)+actual);
    out.depthX=point.x*(depthNormal*flatten+depthActual);out.depthY=point.y*(depthNormal*flatten+depthActual);out.depthZ=point.z*((inclined?depthNormal:0)+depthActual);
    return out;
  }
  const ease=t=>{t=clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);};
  // One timing source: camera/particles share duration; annotations are always
  // relative to arrival, never a separately maintained absolute timestamp.
  const OPENING_TIMING=Object.freeze({duration:5000,closeupExtra:2000,orbitBeforeEnd:2000,annotationFade:1500,departureDolly:.001,accel:.4,cruise:0,decel:.6});
  const OPENING_ANNOTATION_FADE=OPENING_TIMING.annotationFade;
  const openingEase=t=>{
    t=clamp(t,0,1);const {accel:a,cruise:c,decel:d}=OPENING_TIMING,maxVelocity=1/(a/2+c+d/2);
    if(t<=a)return maxVelocity/2*(t-a/Math.PI*Math.sin(Math.PI*t/a));
    const accelerated=maxVelocity*a/2;
    if(t<=a+c)return accelerated+maxVelocity*(t-a);
    const u=t-a-c;return accelerated+maxVelocity*c+maxVelocity/2*(u+d/Math.PI*Math.sin(Math.PI*u/d));
  };
  function openingDustMotion(progress,out){
    const p=clamp(progress,0,1),accel=OPENING_TIMING.accel;
    // Exact camera easing and its derivative: no residual outward drift once
    // the camera stops, and no special last-second push toward the edges.
    out.travel=openingEase(p);
    out.velocity=p<=accel?1-Math.cos(Math.PI*p/accel):1+Math.cos(Math.PI*(p-accel)/(1-accel));
    return out;
  }
  // Lens zoom keeps the established 0.1× floor. Physical camera travel has a
  // deeper 0.002× floor so the default wheel control and opening can reduce the
  // whole system to a distant point.
  const VIEW=Object.freeze({minZoom:.1,minDolly:.002,maxZoom:2048,maxDolly:1e8,lowerBy:.05,minPanY:-.8,maxPanY:.8,minPanX:-.8,maxPanX:.8,minElevation:-Math.PI,maxElevation:Math.PI});
  const DOLLY=Object.freeze({baseDistance:5000,nearRatio:.002});
  const SURFACE=Object.freeze({detailWidth:4096,maxRaster:1024,lowRaster:384});
  const TEXTURE_TIERS=Object.freeze([128,256,512,1024,2048,4096]);
  // User-approved normal-view baseline. Horizontal pan is intentionally zero;
  // the vertical composition, lens and orbit angle come from the approved view.
  // User-framed overview captured on 2026-10-02. Startup, reset and Home/0
  // all use this one pose; returning users may still restore their last view.
  const DEFAULT_CAMERA=Object.freeze({azimuth:6.24870825667827,elevation:.25293208858658467,zoom:1.1853048513203654,dolly:1.4049475905635938,focus:null,panY:.033915866075961185,panX:0});
  const REGION_INSPECTION_ZOOM=250; // UI lens scale is ×, not percent; wheel limits are independent.
  const RANDOM_ROTATION=2;
  const AUTO_ROTATE_SPEED=1.8*DEG; // radians per real second; independent of orbital time
  const ORBIT_REVEAL=Object.freeze({duration:1400});
  const ORBIT_SCAN=Object.freeze({duration:1000,stagger:1000});
  const PRECISION_ORBIT=Object.freeze({bucketYears:5,cacheEntries:6});
  const LABEL=Object.freeze({response:.16,switchDelay:140,dwell:320,margin:18,padding:3});
  const DISPLAY_SAFETY=Object.freeze({satelliteShell:.60,localGap:.8});
  const SATELLITE_ORBIT_PARENTS=new Set(SATELLITES.map(body=>body.parent));
  const ORBIT_HIERARCHY_PARENTS=new Set(['sun',...SATELLITE_ORBIT_PARENTS]);
  const normalizeElevation=value=>A.wrap(value+Math.PI)-Math.PI;
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
      this.options={actualScale:false,overviewOrbitGap:100,actualOrbitSpacing:1,orbitBrightness:.5,dollyZoom:true,labels:true,avoidLabels:false,twinkle:true,activity:true,alignmentGuideVisible:true,earthNightLights:true,earthCloudAmount:1,earthCloudSeed:0,venusCloudAmount:.8,pluto:true,moon:true,skyMotion:true,comets:true,quality:'auto'};
      this.bodyScales=Object.create(null);this.satelliteOrbitScales=Object.create(null);
      this.camera={...DEFAULT_CAMERA};
      this.site={label:'KOREA',latitude:37.5665,longitude:126.978};
      this.cameraTween=null;this.autoRotation=null;this.pendingAutoRotation=null;this.rotationGeneration=0;this.actualScaleMix=0;this.actualScaleTween=null;this.orbitSpacingTween=null;this.projectionAnchor=null;this.trackingAnchor=null;
      this.surface=this.gpu||new window.SolarSurface.Service();this.cameraChangeAt=-Infinity;this.coronaTexture=null;this.paths=[];this.hitTargets=[];this.projected=[];
      this.labelStates=new Map();this.lastLabelMono=null;this.labelWidths=new Map();this.labelBodyMap=new Map();this.labelOrdered=[];this.labelReserved=[];this.labelActive=new Set();this.labelObstacleMap=new Map();this.labelCandidateMap=new Map();
      this.orbitCache=new WeakMap();this.orbitModelCache=new WeakMap();this.satelliteOrbitCache=new Map();this.precisionOrbitPathCache=new Map();this.frameCache=new Map();this.starSprites=new Map();
      this.frameBodies=[];this.surfaceBodies=[];this.directBodies=[];this.labelBodies=[];this.satelliteLayouts=[];this.compatSurfaceJobs=[];
      this.frameItems=new Map();this.frameSerial=0;
      this.physicsMs=NaN;this.physicsBodies=new Map();this.physicsSatellites=new Map();
      this.stats={orbitProjections:0,orbitBufferBuilds:0,orbitPaths:0,starSprites:0};this.boundStarGlow=this.starGlow.bind(this);
      this.selected=null;this.hover=null;this.alignmentGuide=null;this.lastPathMs=NaN;this.dirty=true;this.presentationDirty=true;this.presentationUntil=0;this.presentedResources='';this.frameCount=0;
      this.orbitRevealStart=performance.now();this.openingAnnotationStart=NaN;this.openingOrbitStart=NaN;
      this.openingParticles=null;this.openingParticleSprite=null;
      this.lastSurfaceSubmit=-Infinity;this.lastSurfaceSimMs=NaN;this.lastSurfaceMono=NaN;
      this.sky=new window.SolarSky(background);
      this.resize();
    }
    resize() {
      const box=this.canvas.getBoundingClientRect(),w=Math.max(1,box.width),h=Math.max(1,box.height);
      const dpr=window.SolarPerformance?.pixelRatio(w,h,this.options.quality)??Math.min(window.devicePixelRatio||1,this.options.quality==='low'?1:2);
      if(w===this.w&&h===this.h&&Math.abs(dpr-this.dpr)<.001)return;
      this.w=w;this.h=h;this.dpr=dpr;this.starSprites?.clear();this.labelWidths?.clear();
      this.canvas.width=Math.round(this.w*this.dpr);this.canvas.height=Math.round(this.h*this.dpr);
      this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
      this.stats.adaptiveDpr=this.dpr;this.gpu?.resize(this.w,this.h,this.dpr);
      this.sky.resize(this.w,this.h,this.dpr);this.dirty=true;this.lastSurfaceSubmit=-Infinity;this.surface?.invalidate(false);this.clearLabels();
    }
    startOrbitReveal(mono=performance.now()) {
      this.orbitRevealStart=Number.isFinite(mono)?mono:performance.now();
      this.invalidatePresentation(ORBIT_REVEAL.duration);
    }
    orbitRevealAlpha(mono=performance.now()) {
      if(!Number.isFinite(this.orbitRevealStart)||(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches))return 1;
      const p=clamp((mono-this.orbitRevealStart)/ORBIT_REVEAL.duration,0,1);
      return p*p*(3-2*p);
    }
    cloudRevealProgress(mono=performance.now()) {
      if(!(this.options.earthCloudAmount>0))return 0;
      if(this.cloudRevealSeed!==this.options.earthCloudSeed){
        this.cloudRevealSeed=this.options.earthCloudSeed;this.cloudRevealStart=mono;
        this.invalidatePresentation(3600,mono);
      }
      return clamp((mono-this.cloudRevealStart)/3600,0,1);
    }
    resourceSignature(){
      const surface=this.gpu||this.surface,sky=this.sky;
      return [surface?.stats?.accepted||0,surface?.stats?.discarded||0,surface?.stats?.recoveries||0,
        surface?.cloudWeather?.builds||0,this.coronaTexture?.width||0,
        sky?.ready?1:0,sky?.stats?.textureStage||0,sky?.stats?.backend||''].join(':');
    }
    memoryUsage(){
      const surface=this.gpu?.memoryUsage?.(),sky=this.sky?.memoryUsage?.();
      const knownBytes=(surface?.knownBytes||0)+(sky?.knownBytes||0),framebufferEstimate=(surface?.framebufferEstimate||0)+(sky?.framebufferEstimate||0);
      return {estimated:true,scope:'WebGL textures, geometry and estimated color buffers; excludes browser/driver overhead',surface,sky,knownBytes,framebufferEstimate,totalEstimate:knownBytes+framebufferEstimate};
    }
    invalidatePresentation(duration=0,mono=performance.now()){
      this.presentationDirty=true;
      if(duration>0&&Number.isFinite(mono))this.presentationUntil=Math.max(this.presentationUntil,mono+duration);
    }
    needsDraw(mono=performance.now()){
      return this.dirty||this.presentationDirty||this.resourceSignature()!==this.presentedResources||
        !!this.cameraTween||!!this.openingParticles||!!this.autoRotation||!!this.actualScaleTween||!!this.orbitSpacingTween||this.orbitRevealAlpha(mono)<.9999||
        mono<this.presentationUntil||mono<(this.gpu?.cloudBlendUntil||0)||mono<(this.gpu?.cloudWeather?.readyAt||-Infinity)+300||mono-(this.cameraChangeAt??-Infinity)<400;
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
    // Both viewing modes use the same undistorted camera projection.
    view(p) {return this.viewDirection(p);}
    viewDepth(p,anchor={x:0,y:0,z:0}) {
      const {sa,ca,ce,se}=this.cameraBasis();
      const x=(p.depthX??p.x)-(anchor.depthX??anchor.x),y=(p.depthY??p.y)-(anchor.depthY??anchor.y),z=(p.depthZ??p.z)-(anchor.depthZ??anchor.z);
      return -(x*sa+y*ca)*ce+z*se;
    }
    projectView(p) {
      const dolly=this.camera.dolly??1,travel=dolly-1;
      if(Math.abs(travel)<1e-8)return this.view(p);
      const anchor=this.projectionAnchor||{x:0,y:0,z:0};
      const v=this.view({x:p.x-anchor.x,y:p.y-anchor.y,z:p.z-anchor.z});
      v.z=this.viewDepth(p,anchor);
      // Switching modes changes no lens or projection state. Perspective appears
      // only after real forward/backward travel, and is exactly 1 at dolly=1.
      const distance=DOLLY.baseDistance,denominator=distance-v.z*travel;
      const near=Math.max(.02,distance*DOLLY.nearRatio);
      if(denominator<=near)return {x:NaN,y:NaN,z:v.z,perspective:0,behind:true};
      // A minimum magnification made distant bodies grow during true-scale
      // close-ups. The near plane already bounds the positive perspective gain.
      const perspective=distance/denominator;
      return {x:v.x*perspective,y:v.y*perspective,z:v.z,perspective,behind:false};
    }
    bodyFrame(body) {
      this.cameraBasis();
      // Pole tilt is part of the key; a changed body model cannot reuse an old frame.
      const tilt=A.rotationPoleTilt(body);let cached=this.frameCache?.get(body.id);
      if(cached&&cached.body===body&&cached.tilt===tilt)return cached.frame;
      const axes=A.bodyAxes(body),frame={u:this.viewDirection(axes.u),v:this.viewDirection(axes.v),pole:this.viewDirection(axes.pole)};
      (this.frameCache||(this.frameCache=new Map())).set(body.id,{body,tilt,frame});return frame;
    }
    setOrbitView(azimuth,elevation,mono=performance.now()) {
      if(!Number.isFinite(azimuth)||!Number.isFinite(elevation)||!Number.isFinite(mono))return;
      this.cancelCameraMotion(mono);
      this.camera.azimuth=A.wrap(azimuth);
      // Wrap through both poles instead of stopping at a top/bottom limit. The
      // equivalent end orientations meet continuously at -180/180 degrees.
      this.camera.elevation=normalizeElevation(elevation);
      this.cameraChangeAt=mono;this.dirty=true;
    }
    rotateViewBy(azimuthDelta,elevationDelta,mono=performance.now()) {
      if(![azimuthDelta,elevationDelta,mono].every(Number.isFinite))return false;
      // Settle animation at this timestamp before reading the angles. Pointer
      // deltas extend the CURRENT view, not a stale pointerdown snapshot. All
      // rotation modes keep their intent/path; +/-180 wrapping is not a clamp.
      this.cancelCameraMotion(mono);
      this.setOrbitView(this.camera.azimuth+azimuthDelta,this.camera.elevation+elevationDelta,mono);
      return true;
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
    allBodies() {return [A.SUN,...A.BODIES,...SATELLITES];}
    sceneBodies() {return [A.SUN,...this.getBodies(),...(this.options.moon?SATELLITES:[])];}
    bodySizeScale(bodyOrId) {
      const id=typeof bodyOrId==='string'?bodyOrId:bodyOrId?.id;
      return Number.isFinite(this.bodyScales?.[id])?this.bodyScales[id]:1;
    }
    bodyScaleLimits(bodyOrId) {
      const body=typeof bodyOrId==='string'?this.allBodies().find(value=>value.id===bodyOrId):bodyOrId;
      if(!body)return {min:1,max:1};
      if(body.id==='sun')return {min:1,max:3};
      // The minimum is the Moon/Pluto baseline, never the user's enlarged Moon.
      // Planets can reach the current Sun; moons can reach their current parent.
      const parent=body.parent?A.BODIES.find(value=>value.id===body.parent):A.SUN;
      const min=A.MOON.size/body.size,max=parent.size*this.bodySizeScale(parent)/body.size;
      return {min,max:Math.max(min,max)};
    }
    effectiveBodySizeScale(body) {const p=Number.isFinite(this.actualScaleMix)?this.actualScaleMix:0;return body.id==='sun'?Math.max(1,this.bodySizeScale(body)):mix(this.bodySizeScale(body),1,p);}
    setBodyScale(id,value) {
      const body=this.allBodies().find(value=>value.id===id);
      if((this.options.actualScale&&id!=='sun')||!body||!Number.isFinite(value))return false;
      this.setBodyScales({[id]:value});return true;
    }
    setBodyScales(values) {
      if(!values||typeof values!=='object')return;
      this.bodyScales||(this.bodyScales=Object.create(null));
      // One parent-first transaction for live sliders, loading and reset. A
      // smaller Sun/planet also clamps existing children; JSON key order cannot
      // change the result. Keep 0.1% precision so the 12.5% giant floor is exact.
      for(const body of this.allBodies()){
        const id=body.id,value=Number.isFinite(values[id])?values[id]:this.bodySizeScale(body);
        const limits=this.bodyScaleLimits(body),next=clamp(Math.round(value*1000)/1000,limits.min,limits.max);
        if(Math.abs(next-1)<1e-6)delete this.bodyScales[id];else this.bodyScales[id]=next;
      }
      this.dirty=true;this.lastSurfaceSubmit=-Infinity;this.clearLabels();
    }
    resetBodyScale(id) {return this.setBodyScale(id,1);}
    getBodyScales() {return Object.fromEntries(this.allBodies().map(body=>[body.id,this.bodySizeScale(body)]));}
    satelliteOrbitScale(parentOrId) {
      const id=typeof parentOrId==='string'?parentOrId:parentOrId?.id;
      return Number.isFinite(this.satelliteOrbitScales?.[id])?this.satelliteOrbitScales[id]:1;
    }
    satelliteOrbitScaleLimits(parentOrId) {
      const id=typeof parentOrId==='string'?parentOrId:parentOrId?.id;
      return ORBIT_HIERARCHY_PARENTS.has(id)?{min:.01,max:1}:{min:1,max:1};
    }
    setSatelliteOrbitScale(id,value) {
      if(this.options.actualScale||!ORBIT_HIERARCHY_PARENTS.has(id)||!Number.isFinite(value))return false;
      this.setSatelliteOrbitScales({[id]:value});return true;
    }
    setSatelliteOrbitScales(values) {
      if(!values||typeof values!=='object')return;
      this.satelliteOrbitScales||(this.satelliteOrbitScales=Object.create(null));
      for(const id of ORBIT_HIERARCHY_PARENTS){const value=values[id];if(!Number.isFinite(value))continue;
        const limits=this.satelliteOrbitScaleLimits(id),next=clamp(Math.round(value*100)/100,limits.min,limits.max);
        if(Math.abs(next-1)<1e-6)delete this.satelliteOrbitScales[id];else this.satelliteOrbitScales[id]=next;
      }
      this.dirty=true;this.clearLabels();
    }
    resetSatelliteOrbitScale(id) {return this.setSatelliteOrbitScale(id,1);}
    getSatelliteOrbitScales() {return Object.fromEntries([...ORBIT_HIERARCHY_PARENTS].map(id=>[id,this.satelliteOrbitScale(id)]));}
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
    trueSizeRadiusForState(body,state) {
      // Keep the Sun identical to ordinary view at every lens/travel level;
      // use its physical radius as the ruler for every other body and orbit.
      const sun=A.SUN.size*Math.max(1,this.bodySizeScale(A.SUN))*this.bodyScaleForZoom(state.zoom)*(state.dolly??1);
      return sun*(A.BODY_RADIUS_KM[body.id]||A.BODY_RADIUS_KM.earth)/A.BODY_RADIUS_KM.sun;
    }
    actualScaleFit() {
      const sunWorldRadius=A.BODY_RADIUS_KM.sun/A.AU_KM*A.TRUE_SCALE_UNITS_PER_AU;
      return A.SUN.size*Math.max(1,this.bodySizeScale(A.SUN))*this.baseBodyScale()/(sunWorldRadius*Math.sqrt(this.camera.zoom));
    }
    bodyScaleForZoom(zoom) {
      return this.baseBodyScale()*Math.sqrt(zoom);
    }
    bodyScaleAtZoom() {
      // Lens zoom and camera travel are separate multipliers. Toggling which one
      // the wheel controls therefore leaves the current view untouched.
      return this.bodyScaleForZoom(this.camera.zoom)*(this.camera.dolly??1);
    }
    bodyRadiusForState(body,state,displayScale=this.effectiveBodySizeScale(body)) {
      const zoom=state.zoom,dolly=state.dolly??1;
      const designed=body.size*displayScale,physical=this.trueSizeRadiusForState(body,state);
      if(this.actualScaleMix===1)return physical;
      // Focus selects the camera anchor, never a different body-size formula.
      // Preserve each size slider, apply the same travel multiplier to every
      // body, then let projectView supply its own depth-dependent perspective.
      // All ordinary bodies share one camera multiplier, so their 100% ratios
      // cannot change when zooming, travelling or entering tracking mode.
      const illustrative=designed*this.bodyScaleForZoom(zoom)*dolly;
      return this.actualScaleMix>0?mix(illustrative,physical,this.actualScaleMix):illustrative;
    }
    bodyRadiusAtZoom(body,displayScale=this.effectiveBodySizeScale(body)) {
      // Camera motion already owns the interpolated state. A second radius
      // tween would disagree with the projection scale during a lens change.
      return this.bodyRadiusForState(body,this.camera,displayScale);
    }

    ordinaryOrbitClearance(parent,child,parentScale=this.bodySizeScale(parent),childScale=this.bodySizeScale(child)) {
      const parentRadius=parent.size*parentScale,childRadius=child.size*childScale;
      return (parentRadius+childRadius+Math.max(DISPLAY_SAFETY.localGap,parentRadius*.08))*this.bodyScaleAtZoom();
    }
    satelliteOrbitRadius(satellite,parent,layout=null) {
      // Calculate both endpoints independently, in screen units. Using the
      // in-between fit/body sizes here makes the ordinary clearance jump as
      // soon as a true-scale transition begins (especially Moon and Europa).
      const p=this.actualScaleMix||0,actualPx=this.trueSizeRadiusForState(parent,this.camera)*A.SATELLITE_MEAN_AU[satellite.id]*A.AU_KM/A.BODY_RADIUS_KM[parent.id];
      if(p===1){
        if(layout){
          const actualScale=(this.actualFitScale||this.actualScaleFit())*this.camera.zoom*(this.camera.dolly??1);
          layout.orbitDepthRadius=actualPx/actualScale;const shape=layout.orbitShape||(layout.orbitShape=[]);
          shape[0]=shape[2]=0;shape[1]=actualPx/this.scale;shape[3]=layout.orbitDepthRadius;
        }
        return actualPx/this.scale;
      }
      const parentCustom=this.bodySizeScale(parent),bodyScale=this.bodyScaleAtZoom();
      const normalScale=p>0?(this.overviewFitScale||this.fitScale)*this.camera.zoom*(this.camera.dolly??1):this.scale;
      const fullDesiredPx=satellite.displayOrbit*bodyScale;
      const index=A.BODIES.indexOf(parent),inner=index>0?parent.orbit-A.BODIES[index-1].orbit:Infinity;
      const outer=index>=0&&index<A.BODIES.length-1?A.BODIES[index+1].orbit-parent.orbit:Infinity;
      const neighborGapPx=Math.min(inner,outer)*normalScale,overviewLimit=neighborGapPx*DISPLAY_SAFETY.satelliteShell;
      // The requested orbit starts from the 100% baseline; the same clearance
      // rule below then protects the current (possibly enlarged) bodies.
      const clearancePx=this.ordinaryOrbitClearance(parent,satellite,1,1);
      // Keep the expanded 100% orbit, but the current sizes of BOTH bodies set
      // the minimum separation. Growing either body cannot bury its orbit.
      const baseOrbitPx=Math.max(clearancePx,Math.min(fullDesiredPx,overviewLimit));
      const hierarchyScale=mix(1,parentCustom*2,this.satelliteOrbitScale(parent));
      const linkedOrbitPx=Math.max(baseOrbitPx*hierarchyScale,this.ordinaryOrbitClearance(parent,satellite));
      if(layout){
        const actualScale=(this.actualFitScale||this.actualScaleFit())*this.camera.zoom*(this.camera.dolly??1);
        layout.orbitDepthRadius=mix(linkedOrbitPx/normalScale,actualPx/actualScale,p);
        const shape=layout.orbitShape||(layout.orbitShape=[]);
        shape[0]=(1-p)*linkedOrbitPx/this.scale;shape[1]=p*actualPx/this.scale;
        shape[2]=(1-p)*linkedOrbitPx/normalScale;shape[3]=p*actualPx/actualScale;
      }
      return mix(linkedOrbitPx,actualPx,p)/this.scale;
    }
    solarOrbitHierarchyScale() {
      // The Sun treats Mercury as the first child of one solar-orbit hierarchy.
      // Scaling this radius moves every outer orbit with it, preserving their
      // relative layout instead of moving Mercury alone.
      return mix(1,this.bodySizeScale(A.SUN),this.satelliteOrbitScale('sun'));
    }
    solarOrbitClearanceScale() {
      const mercury=A.BODIES[0],fit=this.overviewFitScale||this.fitScale;
      if(!(fit>0))return 1;
      const orbit=this.overviewSolarRadius(mercury.base[0],mercury)*fit*this.camera.zoom*(this.camera.dolly??1);
      return Math.max(1,this.ordinaryOrbitClearance(A.SUN,mercury)/Math.max(1e-12,orbit));
    }
    overviewSolarRadius(distance,body=null) {
      // 100% now has the previous 150% interval. Keep the camera's reference
      // fit unchanged; otherwise auto-fitting would cancel the extra spacing.
      return A.displayDistance(body?.base?.[0]??distance,0,this.options.overviewOrbitGap??OVERVIEW_ORBIT.gap,OVERVIEW_GAP_MULTIPLIER)*this.solarOrbitHierarchyScale();
    }
    actualOrbitSpacing() {
      const value=this.options.actualOrbitSpacing;return clamp(Number.isFinite(value)?value:1,0,1);
    }
    displayedOrbitSpacing() {return this.orbitSpacingTween?.value??this.actualOrbitSpacing();}
    orbitScaleMix() {
      // 10–100% covers the former 1–100% spacing. The lower 0–10% blends
      // from the saved ordinary layout; body size and lens stay independent.
      const value=this.displayedOrbitSpacing(),{normalBlendEnd,minimumMix}=ACTUAL_ORBIT_SPACING;
      const spacing=value<=normalBlendEnd?minimumMix*value/normalBlendEnd:mix(minimumMix,1,(value-normalBlendEnd)/(1-normalBlendEnd));
      return (this.actualScaleMix||0)*spacing;
    }
    displaySolarPoint(point,body=null) {
      const radius=Math.hypot(point.x,point.y,point.z);if(!(radius>1e-9))return point;
      const scale=(point.physicalDistance??radius)/radius;
      return this.displayPhysicalPoint({x:point.x*scale,y:point.y*scale,z:point.z*scale},{},body);
    }
    project(p,out=null) {
      const v=this.projectView(p),result=out||{};
      result.x=this.cx+v.x*this.scale;result.y=this.cy+v.y*this.scale;result.z=v.z;result.perspective=v.perspective??1;result.behind=!!v.behind;
      return result;
    }
    getBodies() { return this.options.pluto?A.BODIES:(this.bodiesWithoutPluto||(this.bodiesWithoutPluto=A.BODIES.filter(b=>b.id!=='pluto'))); }
    preparePhysics(ms){
      if(this.physicsMs===ms)return;
      // Interpolate only small presentation-time steps. Fast time travel,
      // seeks and initial/restored frames retain the exact ephemeris path.
      this.physicsInterpolate=Number.isFinite(this.physicsMs)&&Math.abs(ms-this.physicsMs)<=250;
      this.physicsMs=ms;this.physicsBodies.clear();this.physicsSatellites.clear();
    }
    samplePhysics(body,ms,satellite=false){
      const solve=t=>satellite?A.satelliteAt(body,t,1):A.positionAt(body,t);
      const start=Math.floor(ms/1000)*1000,end=start+1000;
      if(!this.physicsInterpolate||A.ephemerisTier(start)!==A.ephemerisTier(end))return solve(ms);
      const cache=this.physicsSamples||(this.physicsSamples=new Map()),key=(satellite?'s:':'p:')+body.id;
      let sample=cache.get(key);
      if(!sample||sample.start!==start){
        const a=sample?.end===start?sample.b:solve(start),b=sample?.start===end?sample.a:solve(end);
        sample={start,end,a,b};cache.set(key,sample);
      }
      const t=(ms-start)/1000;
      return {...sample.a,x:mix(sample.a.x,sample.b.x,t),y:mix(sample.a.y,sample.b.y,t),z:mix(sample.a.z,sample.b.z,t)};
    }
    physicalAt(body,ms){
      this.preparePhysics(ms);let point=this.physicsBodies.get(body.id);
      if(!point){point=this.samplePhysics(body,ms);this.physicsBodies.set(body.id,point);}
      return point;
    }
    satelliteUnitAt(body,ms){
      this.preparePhysics(ms);let point=this.physicsSatellites.get(body.id);
      if(!point){point=this.samplePhysics(body,ms,true);this.physicsSatellites.set(body.id,point);}
      return point;
    }
    frameItem(body) {
      let item=this.frameItems.get(body.id);
      if(!item){
        item={body,physical:{x:0,y:0,z:0},world:{x:0,y:0,z:0},screen:{x:0,y:0,z:0,perspective:1,behind:false},r:0,parent:null,orbitRadius:0,directJob:{light:[0,0,0]},directReady:false,frameSerial:0};
        this.frameItems.set(body.id,item);
      }
      item.body=body;item.parent=null;item.orbitRadius=0;item.directReady=false;item.frameSerial=this.frameSerial;
      return item;
    }
    currentFrameItem(id) {const item=this.frameItems.get(id);return item?.frameSerial===this.frameSerial?item:null;}
    setAlignmentGuide(event) {
      this.alignmentGuide=event&&Number.isFinite(event.ms)&&Array.isArray(event.planets)?event:null;
      this.dirty=true;
    }
    drawAlignmentGuide(c,ms) {
      // Visibility is independent of date navigation: selecting another event
      // must not silently switch the user's hidden guide back on.
      if(this.options.alignmentGuideVisible===false)return;
      const guide=this.alignmentGuide;if(!guide)return;
      // The guide belongs to one catalog instant. Fade it in only near that
      // instant so later manual time travel cannot leave a misleading axis on
      // an unrelated configuration.
      const age=Math.abs(ms-guide.ms),alpha=clamp(1-age/(A.DAY*30),0,1);if(!(alpha>0))return;
      const anchor=this.currentFrameItem(guide.kind==='space'?'sun':'earth');if(!anchor||anchor.screen.behind)return;
      const points=[];
      for(const id of guide.planets){const item=this.currentFrameItem(id);if(item&&!item.screen.behind&&Number.isFinite(item.screen.x)&&Number.isFinite(item.screen.y))points.push(item);}
      if(points.length<2)return;
      const ax=anchor.screen.x,ay=anchor.screen.y;
      // Principal axis constrained to the relevant observer: Earth for apparent
      // sky parades, Sun for heliocentric space alignments.
      let xx=0,xy=0,yy=0;
      for(const item of points){const x=item.screen.x-ax,y=item.screen.y-ay;xx+=x*x;xy+=x*y;yy+=y*y;}
      const angle=.5*Math.atan2(2*xy,xx-yy),dx=Math.cos(angle),dy=Math.sin(angle);
      let min=0,max=0;
      for(const item of points){const projection=(item.screen.x-ax)*dx+(item.screen.y-ay)*dy;min=Math.min(min,projection);max=Math.max(max,projection);}
      const extension=18,start={x:ax+dx*(min-extension),y:ay+dy*(min-extension)},end={x:ax+dx*(max+extension),y:ay+dy*(max+extension)};
      c.save();c.beginPath();c.rect(0,0,this.w,this.h);c.clip();c.globalCompositeOperation='screen';
      c.globalAlpha=.78*alpha;c.strokeStyle='#e9bd67';c.lineWidth=1.15;c.shadowColor='rgba(238,188,91,.72)';c.shadowBlur=7;
      c.beginPath();c.moveTo(start.x,start.y);c.lineTo(end.x,end.y);c.stroke();
      c.shadowBlur=0;c.globalAlpha=.34*alpha;c.lineWidth=.65;
      for(const item of points){
        const projection=(item.screen.x-ax)*dx+(item.screen.y-ay)*dy,fx=ax+dx*projection,fy=ay+dy*projection;
        c.beginPath();c.moveTo(fx,fy);c.lineTo(item.screen.x,item.screen.y);c.stroke();
      }
      c.globalAlpha=.9*alpha;c.lineWidth=.9;
      for(const item of points){c.beginPath();c.arc(item.screen.x,item.screen.y,Math.max(4,item.r+4),0,TAU);c.stroke();}
      c.globalAlpha=alpha;c.fillStyle='#f2cb7a';c.beginPath();c.arc(ax,ay,2.2,0,TAU);c.fill();
      c.restore();
    }
    displayPhysicalPoint(physical,out,body=null) {
      const radius=Math.hypot(physical.x,physical.y,physical.z);
      if(!(radius>1e-9)){out.depthX=out.x=physical.x;out.depthY=out.y=physical.y;out.depthZ=out.z=physical.z;return out;}
      const normal=this.overviewSolarRadius(radius,body)/radius,actual=A.TRUE_SCALE_UNITS_PER_AU,m=this.solarOrbitMorph();
      return blendOrbitPoint(physical,normal*m[0],actual*m[1],normal*m[2],actual*m[3],body?.id==='pluto',out);
    }
    displaySatellitePoint(point,layout,parent,out={}) {
      const inverse=1/Math.max(1e-12,Math.hypot(point.x,point.y,point.z)),m=layout.orbitShape;
      blendOrbitPoint(point,m[0]*inverse,m[1],m[2]*inverse,m[3],false,out);
      for(const key of ['x','y','z']){out[key]+=parent[key];const depth='depth'+key.toUpperCase();out[depth]+=parent[depth]??parent[key];}
      return out;
    }
    orbitPath(body,ms,count=360) {
      if(body.id!=='pluto')return {body,points:A.orbitAt(body,ms,count)};
      // Pluto's precision path evaluates hundreds of VSOP/gravity samples. Its
      // displayed 248-year orbit changes imperceptibly within a five-year bucket,
      // while its actual body position remains precision-evaluated every frame.
      const year=new Date(ms).getUTCFullYear(),bucket=1800+Math.floor((year-1800)/PRECISION_ORBIT.bucketYears)*PRECISION_ORBIT.bucketYears,key=`${bucket}:${count}`;
      let path=this.precisionOrbitPathCache.get(key);
      if(path){this.precisionOrbitPathCache.delete(key);this.precisionOrbitPathCache.set(key,path);return path;}
      const sampleMs=clamp(Date.UTC(bucket+Math.floor(PRECISION_ORBIT.bucketYears/2),6,1),A.MIN_TIME,A.MAX_TIME);
      path={body,points:A.orbitAt(body,sampleMs,count)};this.precisionOrbitPathCache.set(key,path);
      while(this.precisionOrbitPathCache.size>PRECISION_ORBIT.cacheEntries)this.precisionOrbitPathCache.delete(this.precisionOrbitPathCache.keys().next().value);
      return path;
    }
    rebuild(ms) {
      const pathKey=A.modelYear(ms)+':'+this.options.pluto;
      if(this.pathKey!==pathKey){this.paths=this.getBodies().map(body=>this.orbitPath(body,ms,360));this.pathKey=pathKey;}
      const mobile=this.w<680,compact=this.h<630;
      const left=mobile?24:58,right=this.w-(mobile?24:58),top=compact?100:mobile?192:190,bottom=this.h-(compact?105:mobile?195:190);
      const baseY=(top+bottom)/2+this.h*VIEW.lowerBy,fitY=Math.max(80,2*Math.min(baseY-top,bottom-baseY));
      // Keep the overview scale invariant while orbiting the camera. Previously
      // every elevation change re-fit the projected ellipse, which felt like an
      // unwanted zoom-in/zoom-out during a vertical drag or auto rotation.
      const fitKey=[pathKey,this.w,this.h].join(':');
      if(this.fitKey!==fitKey){
        const a=25*DEG,e=45*DEG,ca=Math.cos(a),sa=Math.sin(a),ce=Math.cos(e),se=Math.sin(e);
        // Cache the ordinary fit once per viewport/model. Camera rotation must
        // never refit the scene or feel like an unsolicited zoom.
        const fit=()=>{
          let maxX=0,maxY=0;
          for(const path of this.paths)for(const p of path.points){
            const inclined=path.body.id==='pluto',length=Math.hypot(p.x,p.y,inclined?p.z:0),factor=path.body.overviewOrbit/Math.max(1e-12,length);
            const x=(p.x*ca-p.y*sa)*factor,y=(p.x*sa+p.y*ca)*factor,z=inclined?p.z*factor:0;
            maxX=Math.max(maxX,Math.abs(x));maxY=Math.max(maxY,Math.abs(y*se+z*ce));
          }
          return Math.max(.05,Math.min((right-left)/(2*maxX),fitY/(2*maxY)));
        };
        this.overviewFitScale=fit();
        this.fitKey=fitKey;
      }
      this.actualFitScale=this.actualScaleFit();
      this.fitScale=mix(this.overviewFitScale,this.actualFitScale,this.orbitScaleMix());
      this.scale=this.fitScale*this.camera.zoom*(this.camera.dolly??1);
      this.centerX=(left+right)/2+this.w*(this.camera.panX||0);this.centerY=baseY+this.h*this.camera.panY;
      this.cx=this.centerX;this.homeCx=this.centerX;this.homeCy=this.centerY;this.cy=this.homeCy;
      this.bodyScale=this.bodyScaleAtZoom();this.lastPathMs=ms;this.pathYear=A.modelYear(ms);this.dirty=false;
    }
    advanceActualScale(mono=performance.now()){
      this.advanceOrbitSpacing(mono);
      const tween=this.actualScaleTween;if(!tween)return;
      const p=clamp((mono-tween.started)/tween.duration,0,1),e=p*p*(3-2*p);this.actualScaleMix=mix(tween.from,tween.to,e);
      this.dirty=true;
      if(p>=1){this.actualScaleMix=tween.to;this.actualScaleTween=null;}
    }
    advanceOrbitSpacing(mono=performance.now()){
      const tween=this.orbitSpacingTween;if(!tween)return;
      const p=clamp((mono-tween.started)/tween.duration,0,1);
      tween.value=mix(tween.from,tween.to,p*p*(3-2*p));this.dirty=true;
      if(p>=1)this.orbitSpacingTween=null;
    }
    setDollyMode(enabled,animate=true,mono=performance.now()){
      // This is an input-mode switch only. FOV, camera travel, projection,
      // tracked body and every orbit remain byte-for-byte unchanged.
      this.options.dollyZoom=!!enabled;
      this.cameraChangeAt=mono;this.lastSurfaceSubmit=-Infinity;this.dirty=true;return true;
    }
    setOption(key,value,animate=true) {
      if(key==='dollyZoom')return this.setDollyMode(value,animate);
      if(key==='overviewOrbitGap'){
        const fallback=OVERVIEW_ORBIT.gap,numeric=Number(value);
        this.options.overviewOrbitGap=clamp(Math.round(Number.isFinite(numeric)?numeric:fallback),OVERVIEW_ORBIT.minGap,OVERVIEW_ORBIT.maxGap);
        this.dirty=true;return;
      }
      if(key==='actualOrbitSpacing'){
        const numeric=Number(value),target=clamp(Number.isFinite(numeric)?numeric:1,0,1),previous=this.actualOrbitSpacing(),mono=performance.now();
        this.advanceOrbitSpacing(mono);
        if(animate&&target===previous)return;
        const from=this.displayedOrbitSpacing(),smooth=animate&&this.options.actualScale;
        const duration=Math.max(previous,target)<=ACTUAL_ORBIT_SPACING.normalBlendEnd?100:70;
        // Store the user's target immediately; rendering eases across the full
        // slider range. The 0–10% band uses longer easing; other input follows
        // promptly, continuing from the current picture on every re-drag.
        this.options.actualOrbitSpacing=target;
        this.orbitSpacingTween=smooth&&from!==target?{from,to:target,value:from,started:mono,duration}:null;
        this.dirty=true;return;
      }
      if(key==='orbitBrightness'){
        const numeric=Number(value);
        this.options.orbitBrightness=clamp(Number.isFinite(numeric)?numeric:.8,0,1);
        this.dirty=true;return;
      }
      if(key==='earthCloudAmount'){
        const numeric=Number(value);
        this.options.earthCloudAmount=clamp(Number.isFinite(numeric)?numeric:1,0,1);
        if(this.options.earthCloudAmount===0){this.cloudRevealSeed=null;this.gpu?.cloudWeather?.cancelBuild();}
        this.lastSurfaceSubmit=-Infinity;this.dirty=true;return;
      }
      if(key==='venusCloudAmount'){
        const numeric=Number(value);this.options.venusCloudAmount=clamp(Number.isFinite(numeric)?numeric:.8,0,1);
        this.lastSurfaceSubmit=-Infinity;this.dirty=true;return;
      }
      if(key==='earthCloudSeed'){
        const numeric=Number(value);
        this.options.earthCloudSeed=Number.isFinite(numeric)?((numeric%1)+1)%1:0;
        this.lastSurfaceSubmit=-Infinity;this.dirty=true;return;
      }
      if(key==='actualScale'){
        const mono=performance.now();this.advanceActualScale(mono);this.options.actualScale=!!value;
        if(animate)this.actualScaleTween={from:this.actualScaleMix,to:value?1:0,started:mono,duration:2000};
        else{this.actualScaleMix=value?1:0;this.actualScaleTween=null;}
        this.lastSurfaceSubmit=-Infinity;this.dirty=true;return;
      }
      this.options[key]=value;this.dirty=true;if(key==='quality')this.resize();
      if(key==='activity'&&!value)this.cancelCoronaBuild();
      if(key==='earthNightLights')this.lastSurfaceSubmit=-Infinity;
      if((key==='labels'&&!value)||key==='avoidLabels')this.clearLabels();
      if(key==='moon'&&!value&&SATELLITES.some(body=>body.id===this.camera.focus))this.resetCamera();
      if(key==='pluto'&&!value&&this.camera.focus==='pluto')this.resetCamera();
    }
    screenAnchoredPan(id,state=this.camera) {
      const target=this.projected?.find(item=>item.body.id===id);
      if(!target||!target.screen||![target.screen.x,target.screen.y,this.centerX,this.centerY,this.w,this.h].every(Number.isFinite)||this.w<=0||this.h<=0)return null;
      return {
        panX:clamp(state.panX+(target.screen.x-this.centerX)/this.w,VIEW.minPanX,VIEW.maxPanX),
        panY:clamp(state.panY+(target.screen.y-this.centerY)/this.h,VIEW.minPanY,VIEW.maxPanY)
      };
    }
    setZoom(value) {
      if(!Number.isFinite(value))return;
      this.cancelCameraMotion();
      this.camera.zoom=clamp(value,VIEW.minZoom,VIEW.maxZoom);this.cameraChangeAt=performance.now();
      if(this.camera.zoom<=1&&(this.camera.dolly??1)===1)this.camera.focus=null;
      this.dirty=true;
    }
    setDolly(value,focusId=null) {
      if(!Number.isFinite(value))return;
      const next=clamp(value,VIEW.minDolly,VIEW.maxDolly),validTarget=focusId&&this.sceneBodies().some(b=>b.id===focusId);
      const anchored=validTarget&&this.camera.focus!==focusId?this.screenAnchoredPan(focusId):null;
      this.cancelCameraMotion();this.camera.dolly=next;
      if(validTarget){this.camera.focus=focusId;if(anchored)Object.assign(this.camera,anchored);}
      this.cameraChangeAt=performance.now();this.dirty=true;
    }
    prepareCloseup(id) {this.gpu?.prefetchBody?.(id,window.SolarAssets?.materialInfo?.[id]?.width||SURFACE.detailWidth);}
    focusBody(id) {
      const to=this.focusState(id);if(!to)return;
      this.prepareCloseup(id);this.restoreCamera(to);
    }
    get zoomLimits() {return VIEW;}
    visible(p,r=0) {return !p.behind&&p.x+r>=0&&p.x-r<=this.w&&p.y+r>=0&&p.y-r<=this.h;}

    cameraSnapshot() {return {...this.camera,mode:this.options.dollyZoom?'move':'zoom'};}
    defaultCameraSnapshot() {return {...DEFAULT_CAMERA,mode:'move'};}
    openingCameraSnapshot(target=this.defaultCameraSnapshot(),randomSource=Math.random) {
      const destination=Renderer.validCamera(target)?target:this.defaultCameraSnapshot();
      const sample=()=>clamp(Number(randomSource?.())||0,0,1-Number.EPSILON);
      // Keep the destination lens unchanged and begin only with physical camera
      // travel, twice as far back as the manual wheel's limit. Keep ordinary
      // controls unchanged and use the same tracked-camera projection model.
      return {...destination,azimuth:sample()*TAU,elevation:mix(-.85,.85,sample()),zoom:destination.zoom,dolly:OPENING_TIMING.departureDolly,focus:null,panX:0,panY:0};
    }
    openingCameraArc(randomSource=Math.random) {
      const sample=()=>clamp(Number(randomSource?.())||0,0,1-Number.EPSILON),angle=sample()*TAU,amplitude=mix(.06,.11,sample());
      return {x:Math.cos(angle)*amplitude,y:Math.sin(angle)*amplitude*.7,amplitude};
    }
    static validCamera(state) {
      if(!state||typeof state!=='object')return false;
      for(const key of ['azimuth','elevation','zoom','panX','panY'])if(!Number.isFinite(state[key]))return false;
      const dolly=state.dolly??1;if(!Number.isFinite(dolly))return false;
      if(state.azimuth<0||state.azimuth>=TAU||state.elevation<VIEW.minElevation||state.elevation>=VIEW.maxElevation||
        state.zoom<VIEW.minZoom||state.zoom>VIEW.maxZoom||dolly<Math.min(VIEW.minDolly,OPENING_TIMING.departureDolly)||dolly>VIEW.maxDolly||state.panX<VIEW.minPanX||state.panX>VIEW.maxPanX||
        state.panY<VIEW.minPanY||state.panY>VIEW.maxPanY)return false;
      if(state.mode!==undefined&&!['zoom','move'].includes(state.mode))return false;
      const validFocus=state.focus===null||[A.SUN,...A.BODIES,...SATELLITES].some(b=>b.id===state.focus);
      return validFocus;
    }
    restoreCamera(state) {
      if(!Renderer.validCamera(state))return false;
      if((SATELLITES.some(body=>body.id===state.focus)&&!this.options.moon)||(state.focus==='pluto'&&!this.options.pluto))return false;
      const mono=performance.now(),direction=this.rotationIntent,generation=this.autoRotation?.generation||this.pendingAutoRotation?.generation||this.rotationGeneration;
      this.cameraTween=null;this.openingParticles=null;this.autoRotation=null;this.pendingAutoRotation=null;this.trackingAnchor=null;if(state.mode!==undefined)this.setDollyMode(state.mode==='move',false);
      // Commit one camera transaction. Time, selected body and display toggles are not preset data.
      this.camera={azimuth:state.azimuth,elevation:state.elevation,zoom:state.zoom,dolly:state.dolly??1,
        focus:state.focus,panX:state.panX,panY:state.panY};
      if(direction)this.beginAutoRotation(direction,mono,generation);
      this.cameraChangeAt=performance.now();this.dirty=true;this.clearLabels();this.invalidateSurfaces();return true;
    }
    // One monotonic-time transition owner, not a second requestAnimationFrame loop.
    // A retargeted focus transition retains its last rendered tracking anchor so
    // rapid planet navigation cannot restart from a different body position.
    animateCamera(state,mono=performance.now(),duration=1100,input=false,timing='smooth') {
      if(!Renderer.validCamera(state)||!Number.isFinite(mono)||!Number.isFinite(duration))return false;
      if((SATELLITES.some(body=>body.id===state.focus)&&!this.options.moon)||(state.focus==='pluto'&&!this.options.pluto))return false;
      if(duration<=0)return this.restoreCamera(state);
      const interruptedAnchor=this.cameraTween&&this.trackingAnchor?{...this.trackingAnchor}:null;
      const direction=this.rotationIntent,generation=this.autoRotation?.generation||this.pendingAutoRotation?.generation||this.rotationGeneration;
      // A camera transition may pause the physical turn, but it never changes the
      // user's rotation toggle. Keep that intent pending and resume on arrival.
      this.pendingAutoRotation=null;this.cancelCameraTween(mono);
      if(this.autoRotation){this.advanceAutoRotate(mono);this.autoRotation=null;}
      const from=this.cameraSnapshot(),to={...state,dolly:state.dolly??1,mode:state.mode||from.mode};
      this.setDollyMode(to.mode==='move',false,mono);
      // Programmatic transitions keep both the old and new tracking anchors alive
      // for the whole move. This prevents a one-frame focus hand-off that used to
      // make the tracked planet jump in size/position between saved views.
      const resolvedTiming=timing==='opening'?'opening':'smooth';
      const openingPath=resolvedTiming==='opening'?{from,to,arc:to.focus===null?this.openingCameraArc():null,points:[]}:null;
      this.cameraTween={from,to,start:mono,duration,input,timing:resolvedTiming,openingPath,progress:0,fromAnchor:interruptedAnchor};
      if(resolvedTiming==='opening')this.cameraTween.rotationBlend={seconds:0,yaw:0,pitch:0};
      if(to.focus)this.prepareCloseup(to.focus);
      if(direction)this.pendingAutoRotation={direction,generation};
      this.cameraChangeAt=mono;this.dirty=true;return true;
    }
    openingCameraDuration(state=this.camera) {
      if(!Renderer.validCamera(state))return OPENING_TIMING.duration;
      const bodies=this.sceneBodies(),focused=bodies.find(body=>body.id===state?.focus);
      const coverage=Math.max(0,...(focused?[focused]:bodies).map(body=>this.bodyRadiusForState(body,state)*2/Math.max(1,Math.min(this.w,this.h))));
      // Use arrival framing, not today's frame or the mere existence of focus.
      // Small/distant bodies keep 5s; a close-up (>=30% of the short edge) gets
      // 7s, with a smooth transition between 10% and 30% screen coverage.
      return Math.round(OPENING_TIMING.duration+OPENING_TIMING.closeupExtra*ease((coverage-.1)/.2));
    }
    animateOpeningCamera(state,mono=performance.now(),duration=this.openingCameraDuration(state)) {
      const animated=this.animateCamera(state,mono,duration,false,'opening');
      if(animated){this.scheduleOpeningAnnotations(mono,duration);if(this.cameraTween)this.startOpeningParticles(mono,duration);}
      return animated;
    }
    startOpeningParticles(mono,duration) {
      this.openingParticles=null;
      if(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;
      const rand=random(Math.floor(Math.random()*4294967296)>>>0);
      const budget=this.options.quality==='low'?216:Math.min(this.w,this.h)<600?336:540;
      const baseCount=Math.round(budget*.7),count=Math.round(budget*1.35*.7);
      const path=this.cameraTween?.openingPath||{arc:null,points:[]};
      // One pool, one perspective flight. Some grains start farther away and
      // naturally remain at arrival; none are spawned or repositioned later.
      const points=path.points=Array.from({length:count},(_,i)=>{
        // Append nearby grains only: they pass the camera before braking starts,
        // leaving the original flight and quiet arrival completely unchanged.
        const depth=i>=baseCount?.6+rand()*(4*OPENING_TIMING.accel-.64):i<Math.round(baseCount*.025)?5.4+rand()*1.6:.6+rand()*3.3;
        // Fixed-width offsets around the parent path, not a depth-scaled
        // viewport-filling cone. Keep only a few distant arrival grains.
        const angle=rand()*TAU,radius=.08+Math.sqrt(rand())*.52;
        return {x:Math.cos(angle)*radius,y:Math.sin(angle)*radius,depth,
          size:1.8+rand()*2.8,glow:.8+rand()*1.8,color:Math.min(3,Math.floor(rand()*6)),life:1000+rand()*4000};
      });
      this.openingParticles={start:mono,duration,path,points,elapsed:0,projected:{},exitAt:null,progress:0,alpha:0};
      this.invalidatePresentation(duration,mono);
    }
    openingParticleFrame(mono=performance.now()) {
      const field=this.openingParticles;if(!field)return null;
      const elapsed=Math.max(0,mono-field.start),progress=clamp(elapsed/field.duration,0,1);
      const exit=field.exitAt===null?1:1-ease((mono-field.exitAt)/220);
      if(elapsed>=field.duration+5000||exit<=0){field.points.length=0;this.openingParticles=null;return null;}
      field.progress=progress;field.elapsed=elapsed;
      openingDustMotion(progress,field);
      field.alpha=ease(progress/.065)*exit;
      if(progress>=1){
        // Compact the parent's one array in place. Offscreen or expired grains
        // are removed, not hidden for a later camera movement to uncover.
        let kept=0;
        for(const p of field.points){const q=this.projectOpeningParticle(p,field,field.projected);if(q.visible&&q.alpha>1e-4)field.points[kept++]=p;}
        field.points.length=kept;
        if(!kept){this.openingParticles=null;return null;}
      }
      return field;
    }
    projectOpeningParticle(p,field,out) {
      const age=clamp(Math.max(0,field.elapsed-field.duration)/p.life,0,1);
      // Camera progress drives the flight. Afterwards a tiny, smooth approach
      // (at most 0.18 depth units) accompanies each grain's individual fade.
      const depth=p.depth-4*field.travel-.18*(age-Math.sin(Math.PI*age)/Math.PI),z=Math.max(.04,depth);
      // Sample the same parent's parabolic bend at the grain and camera.
      // Positions stay path-local; neither a second random route nor an
      // arrival re-parent/reposition is needed.
      const arc=field.path?.arc,t=clamp(p.depth/4,0,1),curve=4*(t*(1-t)-field.travel*(1-field.travel));
      const x=p.x+(arc?.x||0)*curve,y=p.y+(arc?.y||0)*curve;
      out.x=this.w*(.5+x/z);out.y=this.h*(.5+y/z);
      out.size=clamp(p.size/z,1,12);out.glowSize=out.size*p.glow;
      out.tail=Math.min(32,out.size*4,Math.hypot(x*this.w,y*this.h)*4*field.velocity*12/(field.duration*z*z));
      out.angle=Math.atan2(y*this.h,x*this.w);
      out.alpha=field.alpha*.5*(1-ease(age));
      const margin=out.glowSize;
      out.visible=depth>.04&&age<1&&out.x>=-margin&&out.x<=this.w+margin&&out.y>=-margin&&out.y<=this.h+margin;
      return out;
    }
    drawOpeningParticles(c,mono=performance.now()) {
      const field=this.openingParticleFrame(mono);if(!field||field.alpha<1e-4)return;
      let sprite=this.openingParticleSprite;
      if(!sprite){
        sprite=document.createElement('canvas');sprite.width=128;sprite.height=64;
        const ctx=sprite.getContext('2d'),colors=['158,197,255','246,207,153','203,184,239','221,231,242'];
        for(let i=0;i<colors.length;i++){
          const x=i*32+16,rgb=colors[i],glow=ctx.createRadialGradient(x,16,0,x,16,16);
          glow.addColorStop(0,`rgba(${rgb},1)`);glow.addColorStop(.15,`rgba(${rgb},.85)`);glow.addColorStop(.4,`rgba(${rgb},.24)`);glow.addColorStop(1,`rgba(${rgb},0)`);
          ctx.fillStyle=glow;ctx.fillRect(i*32,0,32,32);
          const halo=ctx.createRadialGradient(x,48,0,x,48,16);
          halo.addColorStop(0,`rgba(${rgb},.32)`);halo.addColorStop(.28,`rgba(${rgb},.18)`);halo.addColorStop(1,`rgba(${rgb},0)`);
          ctx.fillStyle=halo;ctx.fillRect(i*32,32,32,32);
        }
        this.openingParticleSprite=sprite;
      }
      c.save();c.globalCompositeOperation='source-over';
      for(const p of field.points){
        const q=this.projectOpeningParticle(p,field,field.projected);
        if(!q.visible||q.alpha<1e-4)continue;
        c.globalAlpha=q.alpha;
        if(q.tail>2){
          c.save();c.translate(q.x,q.y);c.rotate(q.angle);
          c.drawImage(sprite,p.color*32,32,32,32,-q.glowSize/2-q.tail,-q.glowSize/2,q.glowSize+q.tail,q.glowSize);
          c.drawImage(sprite,p.color*32,0,32,32,-q.size/2-q.tail,-q.size/2,q.size+q.tail,q.size);c.restore();
        }else{
          c.drawImage(sprite,p.color*32,32,32,32,q.x-q.glowSize/2,q.y-q.glowSize/2,q.glowSize,q.glowSize);
          c.drawImage(sprite,p.color*32,0,32,32,q.x-q.size/2,q.y-q.size/2,q.size,q.size);
        }
      }
      c.restore();
    }
    scheduleOpeningAnnotations(openingStartedAt=performance.now(),duration=this.cameraTween?.duration??this.openingCameraDuration()) {
      if(!Number.isFinite(openingStartedAt)||!Number.isFinite(duration))return false;
      this.openingOrbitStart=openingStartedAt+Math.max(0,duration-OPENING_TIMING.orbitBeforeEnd);
      this.openingAnnotationStart=this.openingOrbitStart+ORBIT_SCAN.duration;
      // Draw once per opening, never per frame: each body's orbit and name
      // share a stable offset, including a paused scene and custom durations.
      this.openingOrbitDelays=new Map([...A.BODIES,...SATELLITES].map(body=>[body.id,Math.random()*ORBIT_SCAN.stagger]));
      this.openingOrbitStyles=new Map([...A.BODIES,...SATELLITES].map(body=>[body.id,{direction:Math.random()<.5?-1:1}]));
      this.invalidatePresentation(OPENING_ANNOTATION_FADE+ORBIT_SCAN.stagger,this.openingAnnotationStart);
      return true;
    }
    // All UI camera commands use animateCamera: one owner, one rAF, no timers.
    // The old immediate setters remain for startup/model setup and integrations.
    cameraInputState(mono=performance.now()) {
      if(this.cameraTween?.input)return {...this.cameraTween.to};
      this.advanceCamera(mono);this.advanceAutoRotate(mono);return this.cameraSnapshot();
    }
    smoothCamera(patch,mono=performance.now(),duration=90) {
      const to={...this.cameraInputState(mono),...patch};
      if(![to.azimuth,to.elevation,to.zoom,to.dolly,to.panX,to.panY].every(Number.isFinite))return false;
      to.azimuth=A.wrap(to.azimuth);to.elevation=normalizeElevation(to.elevation);
      to.panX=clamp(to.panX,VIEW.minPanX,VIEW.maxPanX);to.panY=clamp(to.panY,VIEW.minPanY,VIEW.maxPanY);
      to.zoom=clamp(to.zoom,VIEW.minZoom,VIEW.maxZoom);to.dolly=clamp(to.dolly,VIEW.minDolly,VIEW.maxDolly);
      if(to.zoom<=1&&to.dolly===1)to.focus=null;
      return this.animateCamera(to,mono,duration,true);
    }
    smoothZoom(value,focusId=null,mono=performance.now()) {
      if(!Number.isFinite(value))return false;
      const to=this.cameraInputState(mono);to.zoom=clamp(value,VIEW.minZoom,VIEW.maxZoom);
      if(to.zoom<=1&&to.dolly===1)to.focus=null;
      return this.smoothCamera(to,mono,150);
    }
    smoothDolly(value,focusId=null,mono=performance.now()) {
      if(!Number.isFinite(value))return false;
      const to=this.cameraInputState(mono);to.dolly=clamp(value,VIEW.minDolly,VIEW.maxDolly);
      const validTarget=focusId&&this.sceneBodies().some(b=>b.id===focusId);
      const anchored=validTarget&&to.focus!==focusId?this.screenAnchoredPan(focusId,to):null;
      if(validTarget){to.focus=focusId;if(anchored)Object.assign(to,anchored);}
      return this.smoothCamera(to,mono,150);
    }
    trackingMoveState(id,snapshot=this.cameraSnapshot(),lensZoom=snapshot?.zoom) {
      const body=this.sceneBodies().find(b=>b.id===id);
      if(!body)return null;
      const zoom=clamp(Number.isFinite(lensZoom)?lensZoom:DEFAULT_CAMERA.zoom,VIEW.minZoom,VIEW.maxZoom);
      const to={...snapshot,focus:id,panX:0,panY:0,zoom,dolly:1,mode:'move'};
      const radius=Math.min(this.w,this.h)*.25,baseRadius=this.bodyRadiusForState(body,to);
      to.dolly=clamp(radius/Math.max(baseRadius,1e-12),VIEW.minDolly,VIEW.maxDolly);
      return to;
    }
    focusState(id,mono=performance.now(),forceMove=false) {
      const body=this.sceneBodies().find(b=>b.id===id);
      if(!body)return null;
      this.advanceCamera(mono);this.advanceAutoRotate(mono);
      const snapshot=this.cameraSnapshot(),radius=Math.min(this.w,this.h)*.25;
      // Tracking is always viewport-centred. A previous middle-button pan is a
      // scene navigation offset, not part of a planet-follow camera preset. The
      // target size is derived from the body's baseline display radius rather
      // than the current/tweened zoom, so repeated focus commands are idempotent.
      if(forceMove||this.options.dollyZoom)return this.trackingMoveState(id,snapshot,snapshot.zoom);
      // Legacy lens-only focus uses the same radius model, not a target-specific
      // enlargement curve. Solve once per command, never in the frame loop.
      const to={...snapshot,focus:id,panX:0,panY:0};let low=VIEW.minZoom,high=VIEW.maxZoom;
      for(let i=0;i<24;i++){to.zoom=(low+high)/2;if(this.bodyRadiusForState(body,to)<radius)low=to.zoom;else high=to.zoom;}
      to.zoom=(low+high)/2;return to;
    }
    animateFocus(id,mono=performance.now(),duration=1100) {
      const to=this.focusState(id,mono,true);return !!to&&this.animateCamera(to,mono,duration);
    }
    animateFeature(id,latitude,longitude,ms,mono=performance.now(),duration=1100) {
      const to=this.focusState(id,mono),body=this.sceneBodies().find(b=>b.id===id);
      if(!to||!body||![latitude,longitude,ms].every(Number.isFinite))return false;
      const n=A.surfaceDirection(body,latitude,longitude,ms);
      to.azimuth=A.wrap(Math.atan2(-n.x,-n.y));to.elevation=Math.asin(clamp(n.z,-1,1));
      // A country starts at the 250× lens inspection size, never a new wheel cap.
      // Clear inherited lens/travel magnification so repeated tracking is identical.
      // Move mode keeps owning the wheel and uses the equivalent Earth disk size.
      if(id==='earth'){
        to.zoom=REGION_INSPECTION_ZOOM;to.dolly=1;
        if(to.mode==='move'){
          const radius=this.bodyRadiusForState(body,to);
          to.zoom=1;
          const base=this.bodyRadiusForState(body,to);
          to.dolly=clamp(radius/Math.max(base,1e-12),VIEW.minDolly,VIEW.maxDolly);
        }
      }
      return this.animateCamera(to,mono,duration);
    }
    animateHome(mono=performance.now(),duration=1100) {
      return this.animateCamera(this.defaultCameraSnapshot(),mono,duration);
    }
    advanceCamera(mono=performance.now()) {
      const move=this.cameraTween;if(!move)return false;
      const t=clamp((mono-move.start)/move.duration,0,1),p=move.timing==='opening'?openingEase(t):ease(t),{from,to}=move;move.progress=p;
      const delta=A.wrap(to.azimuth-from.azimuth+Math.PI)-Math.PI,elevationDelta=A.wrap(to.elevation-from.elevation+Math.PI)-Math.PI;
      const arc=move.openingPath?.arc,arcWeight=arc?4*p*(1-p):0;
      const state={azimuth:A.wrap(from.azimuth+delta*p),elevation:normalizeElevation(from.elevation+elevationDelta*p),
        panX:clamp(mix(from.panX,to.panX,p)+(arc?.x||0)*arcWeight,VIEW.minPanX,VIEW.maxPanX),panY:clamp(mix(from.panY,to.panY,p)+(arc?.y||0)*arcWeight,VIEW.minPanY,VIEW.maxPanY),
        // The visible tracking anchor itself is cross-blended in draw(). Keep the
        // destination focus here so surface detail can prepare before arrival.
        focus:to.focus,
        zoom:mix(from.zoom,to.zoom,p),dolly:mix(from.dolly??1,to.dolly??1,p)};
      if(state.zoom<=1&&state.dolly===1&&to.focus===null)state.focus=null;
      this.camera=t>=1?{azimuth:to.azimuth,elevation:to.elevation,zoom:to.zoom,dolly:to.dolly??1,focus:to.focus,panX:to.panX,panY:to.panY}:state;
      const blend=move.rotationBlend;
      if(blend){
        // Integrate a smooth velocity ramp during the last part of arrival.
        // The accumulated offset belongs to this tween, so its final frame
        // hands the same angles and full turn rate to ordinary auto-rotation.
        const duration=Math.min(1500,move.duration*.3),u=clamp((mono-move.start-move.duration+duration)/duration,0,1);
        const seconds=duration/1000*(u*u*u-.5*u*u*u*u),dt=Math.max(0,seconds-blend.seconds),pending=this.pendingAutoRotation;
        if(pending&&dt>0){
          const rates=this.rotationRates(pending.direction,pending.generation);
          blend.yaw+=rates.yawRate*dt;blend.pitch+=rates.pitchRate*dt;
        }
        blend.seconds=seconds;
        this.camera.azimuth=A.wrap(this.camera.azimuth+blend.yaw);
        this.camera.elevation=normalizeElevation(this.camera.elevation+blend.pitch);
      }
      if(t>=1){
        this.cameraTween=null;
        const pending=this.pendingAutoRotation;this.pendingAutoRotation=null;
        if(pending)this.beginAutoRotation(pending.direction,mono,pending.generation);
      }
      this.cameraChangeAt=mono;this.dirty=true;return true;
    }
    cancelCameraTween(mono=performance.now()) {
      // A user taking over the camera gets a brief soft exit, not a pop.
      if(this.openingParticles&&this.openingParticles.exitAt===null&&mono<this.openingParticles.start+this.openingParticles.duration){this.openingParticles.exitAt=mono;this.invalidatePresentation(220,mono);}
      if(this.cameraTween){
        this.advanceCamera(mono);this.cameraTween=null;
        const pending=this.pendingAutoRotation;this.pendingAutoRotation=null;
        if(pending)this.beginAutoRotation(pending.direction,mono,pending.generation);
      }
    }
    get rotationIntent() {return this.autoRotation?.direction||this.pendingAutoRotation?.direction||0;}
    get autoRotateDirection() {const value=this.rotationIntent;return value===RANDOM_ROTATION?0:value;}
    get randomRotateEnabled() {return this.rotationIntent===RANDOM_ROTATION;}
    newRandomRotation(generation) {
      // Choose ONE direction per OFF -> ON. Keep it through manual input,
      // camera tweens and suspension; only re-enabling samples another heading.
      // This RNG is independent of the star pool and never runs in the frame loop.
      const heading=random(Math.floor(Math.random()*4294967296)>>>0)()*TAU;
      return Object.freeze({generation,heading,
        yawRate:Math.cos(heading)*AUTO_ROTATE_SPEED,
        pitchRate:Math.sin(heading)*AUTO_ROTATE_SPEED});
    }
    advanceRandomRotation(seconds) {
      const path=this.randomRotation;if(!path||!Number.isFinite(seconds)||seconds<=0)return false;
      // Fixed unit heading at the SAME speed as left/right. No timer, easing,
      // segment changes or frame-by-frame random sampling. Retain the stall cap.
      const dt=Math.min(.25,seconds);
      this.camera.azimuth=A.wrap(this.camera.azimuth+path.yawRate*dt);
      this.camera.elevation=normalizeElevation(this.camera.elevation+path.pitchRate*dt);
      this.dirty=true;return true;
    }
    rotationRates(direction,generation) {
      if(direction===RANDOM_ROTATION){
        if(this.randomRotation?.generation!==generation)this.randomRotation=this.newRandomRotation(generation);
        return this.randomRotation;
      }
      return {yawRate:direction*AUTO_ROTATE_SPEED,pitchRate:0};
    }
    beginAutoRotation(direction,mono,generation=(this.rotationGeneration||0)+1) {
      this.rotationRates(direction,generation);
      this.autoRotation={direction,azimuth:this.camera.azimuth,mono,generation};
      this.rotationGeneration=generation;this.cameraChangeAt=-Infinity;this.dirty=true;return true;
    }
    setAutoRotate(direction,mono=performance.now()) {
      if(![-1,0,1].includes(direction)||!Number.isFinite(mono))return false;
      return this.setRotationIntent(direction,mono);
    }
    setRandomRotate(enabled,mono=performance.now()) {
      if(typeof enabled!=='boolean'||!Number.isFinite(mono))return false;
      if(enabled===this.randomRotateEnabled)return true;
      return this.setRotationIntent(enabled?RANDOM_ROTATION:0,mono);
    }
    setRotationIntent(direction,mono) {
      if(this.cameraTween?.timing==='opening')this.advanceCamera(mono);
      const current=this.rotationIntent;
      if(!direction||current===direction){
        // This is the sole normal OFF path: only an explicit click on the active
        // direction stops it. Do not interrupt an unrelated camera transition.
        this.pendingAutoRotation=null;this.advanceAutoRotate(mono);this.autoRotation=null;this.dirty=true;return true;
      }
      this.advanceAutoRotate(mono);this.autoRotation=null;
      const generation=(this.rotationGeneration||0)+1;
      if(this.cameraTween){this.pendingAutoRotation={direction,generation};this.rotationGeneration=generation;this.dirty=true;return true;}
      // Rotate around the CURRENT viewport centre. Pan and zoom are preserved;
      // auto-rotation must never re-centre the user's composition first.
      return this.beginAutoRotation(direction,mono,generation);
    }
    advanceAutoRotate(mono=performance.now()) {
      const motion=this.autoRotation;if(!motion||!Number.isFinite(mono))return false;
      if(motion.mono===null){motion.mono=mono;motion.azimuth=this.camera.azimuth;return false;}
      const elapsed=Math.max(0,mono-motion.mono);motion.mono=mono;
      if(!(elapsed>0)){motion.azimuth=this.camera.azimuth;return false;}
      if(motion.direction===RANDOM_ROTATION)return this.advanceRandomRotation(elapsed/1000);
      const angle=A.wrap(this.camera.azimuth+motion.direction*AUTO_ROTATE_SPEED*elapsed/1000);
      motion.azimuth=angle;
      if(angle===this.camera.azimuth)return false;
      this.camera.azimuth=angle;this.dirty=true;return true;
    }
    stopAutoRotate(mono=performance.now()) {
      this.pendingAutoRotation=null;if(this.autoRotation){this.advanceAutoRotate(mono);this.autoRotation=null;}this.randomRotation=null;
    }
    cancelCameraMotion(mono=performance.now()) {
      const direction=this.rotationIntent,generation=this.autoRotation?.generation||this.pendingAutoRotation?.generation||this.rotationGeneration;
      this.pendingAutoRotation=null;this.cancelCameraTween(mono);
      if(this.autoRotation)this.advanceAutoRotate(mono);
      else if(direction)this.beginAutoRotation(direction,mono,generation);
    }
    resetCamera() {
      const mono=performance.now(),direction=this.rotationIntent,generation=this.autoRotation?.generation||this.pendingAutoRotation?.generation||this.rotationGeneration;
      this.cameraTween=null;this.autoRotation=null;this.pendingAutoRotation=null;this.camera={...DEFAULT_CAMERA};this.trackingAnchor=null;
      if(direction)this.beginAutoRotation(direction,mono,generation);
      this.projectionAnchor=null;this.dirty=true;
    }
    projectOrbit(path) {
      const {azimuth:a,elevation:e}=this.camera;
      const dolly=this.camera.dolly??1,active=Math.abs(dolly-1)>1e-8,anchor=this.projectionAnchor||{x:0,y:0,z:0};
      const cache=this.orbitCache||(this.orbitCache=new WeakMap());let item=cache.get(path);
      const cameraKey=active?[this.camera.zoom,dolly,anchor.x,anchor.y,anchor.z,anchor.depthX??anchor.x,anchor.depthY??anchor.y,anchor.depthZ??anchor.z].map(v=>Number(v).toFixed(5)).join(':'):'flat';
      const projectionKey=cameraKey+':'+Number(this.solarOrbitHierarchyScale()).toFixed(5)+':'+this.solarOrbitClearanceScale()+':'+Number(this.actualScaleMix||0).toFixed(5)+':'+(this.options.overviewOrbitGap??OVERVIEW_ORBIT.gap)+':'+this.displayedOrbitSpacing()+':'+this.orbitScaleTransitionKey();
      if(item&&item.a===a&&item.e===e&&item.projectionKey===projectionKey&&item.source===path.points)return item;
      const xyz=new Float64Array(path.points.length*3);
      let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
      for(let i=0;i<path.points.length;i++){
        const q=this.projectView(this.displaySolarPoint(path.points[i],path.body));xyz[i*3]=q.x;xyz[i*3+1]=q.y;xyz[i*3+2]=q.behind?NaN:q.z;
        if(!q.behind){minX=Math.min(minX,q.x);maxX=Math.max(maxX,q.x);minY=Math.min(minY,q.y);maxY=Math.max(maxY,q.y);}
      }
      item={a,e,projectionKey,source:path.points,xyz,minX,maxX,minY,maxY,scale:NaN,passes:null};cache.set(path,item);
      if(this.stats)this.stats.orbitProjections+=path.points.length;return item;
    }
    orbitModel(path) {
      const hierarchy=this.solarOrbitHierarchyScale(),gap=this.options.overviewOrbitGap??OVERVIEW_ORBIT.gap;
      // Cache both collinear endpoints: normal xyz + actual/normal radius.
      // Progress, fit, zoom and reveal are draw uniforms, never buffer keys.
      const key=[hierarchy,gap].join(':');
      let item=this.orbitModelCache.get(path);
      if(item&&item.source===path.points&&item.key===key)return item.xyz;
      const xyz=new Float32Array(path.points.length*4);
      for(let i=0;i<path.points.length;i++){
        const p=path.points[i],radius=Math.hypot(p.x,p.y,p.z),physical=Number.isFinite(p.physicalDistance);
        const normal=physical?this.overviewSolarRadius(p.physicalDistance,path.body):radius*hierarchy;
        const actual=physical?p.physicalDistance*A.TRUE_SCALE_UNITS_PER_AU:normal;
        const factor=radius>1e-9?normal/radius:1;
        xyz[i*4]=p.x*factor;xyz[i*4+1]=p.y*factor;xyz[i*4+2]=p.z*factor;xyz[i*4+3]=normal>1e-9?actual/normal:1;
      }
      this.orbitModelCache.set(path,{source:path.points,key,xyz});this.stats.orbitBufferBuilds+=path.points.length;return xyz;
    }
    orbitScaleTransitionKey() {
      const p=this.orbitScaleMix();return p>0&&p<1?[this.overviewFitScale,this.actualFitScale,this.fitScale].join(':'):'';
    }
    satelliteOrbitPoints(body,ms) {
      // Cache one normalized precision orbit per body/date/model. Display size
      // is applied later, so camera zoom no longer causes 91 ephemeris samples
      // and a fresh GPU upload on every frame.
      const key=A.ephemerisTier(ms)+':'+Math.floor(ms/A.DAY),cached=this.satelliteOrbitCache.get(body.id);
      if(cached&&cached.key===key)return cached;
      const points=A.satelliteOrbit(body,ms,1,90),entry={key,points,xyz:null};
      this.satelliteOrbitCache.set(body.id,entry);return entry;
    }
    satelliteOrbitModel(body,ms) {
      const entry=this.satelliteOrbitPoints(body,ms);if(entry.xyz)return entry.xyz;
      const {points}=entry,xyz=new Float32Array(points.length*4);
      for(let i=0;i<points.length;i++){const p=points[i],radius=Math.hypot(p.x,p.y,p.z)||1;xyz[i*4]=p.x/radius;xyz[i*4+1]=p.y/radius;xyz[i*4+2]=p.z/radius;xyz[i*4+3]=radius;}
      entry.xyz=xyz;this.stats.orbitBufferBuilds+=points.length;return xyz;
    }
    solarOrbitMorph() {
      const p=this.orbitScaleMix(),solarMorph=this.solarMorph||(this.solarMorph=[]);
      // Clearance expands the complete ordinary hierarchy uniformly, preserving
      // equal gaps. It is a draw weight, not a camera-dependent buffer rebuild;
      // CPU bodies and GPU paths therefore share the same protected orbit.
      solarMorph[0]=solarMorph[2]=(1-p)*this.solarOrbitClearanceScale();solarMorph[1]=solarMorph[3]=p;
      if(p>0&&p<1){
        // Match CPU body/path positions: projected extent uses fit
        // weights while perspective depth blends unscaled world endpoints.
        solarMorph[0]*=(this.overviewFitScale||this.fitScale)/this.fitScale;
        solarMorph[1]*=(this.actualFitScale||this.actualScaleFit())/this.fitScale;
      }
      return solarMorph;
    }
    gpuOrbitCamera() {
      const {ca,sa,ce,se}=this.cameraBasis(),active=Math.abs((this.camera.dolly??1)-1)>1e-8;
      return {ca,sa,ce,se,lens:1,travel:active?(this.camera.dolly??1)-1:0,anchor:active?(this.projectionAnchor||{x:0,y:0,z:0}):{x:0,y:0,z:0},solarMorph:this.solarOrbitMorph()};
    }
    orbitInk(id,progress,origin=null) {
      if(progress>=1||(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches))return null;
      // Solar paths use heliocentric coordinates; moon paths use parent-local
      // coordinates. Resolve the pen origin from the matching body each frame.
      const phase=origin&&Number.isFinite(origin.x)&&Number.isFinite(origin.y)?((Math.atan2(origin.y,origin.x)/TAU)%1+1)%1:0;
      const style=this.openingOrbitStyles?.get(id);
      return {progress:clamp(progress,0,1),phase,direction:style?.direction??1};
    }
    orbitInkAlpha(x,y,ink) {
      if(!ink)return 1;
      const phase=(((Math.atan2(y,x)/TAU-ink.phase)*(ink.direction??1))%1+1)%1;
      const scan=clamp(ink.progress,0,1);
      const feather=(angle,edge)=>{const p=clamp((angle-edge+.06)/.06,0,1);return 1-p*p*(3-2*p);};
      const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
      const tail=1-smooth(.05,.80,Math.max(0,scan-phase));
      const mask=feather(phase,scan*1.06)*tail;
      // Complete the faded tail inside the same lap, with no post-lap stage.
      return mix(mask,1,smooth(.8,1,scan));
    }
    orbitInkOpacity(x,y,ink,userAlpha){
      return this.orbitInkAlpha(x,y,ink)*userAlpha;
    }
    orbit(c,path,highlight,reveal=1,strength=1) {
      const item=this.projectOrbit(path),xyz=item.xyz,scale=this.scale;
      const rgb=path.body.id==='earth'?'110,174,212':path.body.id==='pluto'?'155,140,127':'138,151,168';
      c.lineWidth=highlight?1.25:.72;if(path.body.id==='pluto')c.setLineDash([2,5]);
      const ink=this.orbitInk(path.body.id,reveal,this.currentFrameItem(path.body.id)?.world);
      if(ink){
        c.save();c.translate(this.cx,this.cy);const alpha=c.globalAlpha;
        for(let i=1;i<path.points.length;i++){
          const a=(i-1)*3,b=i*3,pa=path.points[i-1],pb=path.points[i];
          if(!Number.isFinite(xyz[a+2])||!Number.isFinite(xyz[b+2]))continue;
          const userAlpha=clamp((highlight?.64:xyz[b+2]>=0?.32:.17)*strength,0,1),opacity=this.orbitInkOpacity(pa.x+pb.x,pa.y+pb.y,ink,userAlpha);if(opacity<1e-4)continue;
          c.globalAlpha=Math.min(1,alpha*opacity);c.strokeStyle=`rgb(${rgb})`;
          c.beginPath();c.moveTo(xyz[a]*scale,xyz[a+1]*scale);c.lineTo(xyz[b]*scale,xyz[b+1]*scale);c.stroke();
        }
        c.restore();c.setLineDash([]);return;
      }
      // Translate cached screen-unit paths when tracking. Stroke widths stay in
      // CSS pixels; zoom never scales line width or the Pluto dash pattern.
      const cached=typeof Path2D==='function';
      if(cached&&(!item.passes||item.scale!==scale)){
        item.passes=[new Path2D(),new Path2D()];item.scale=scale;
        for(let pass=0;pass<2;pass++){
          const p=item.passes[pass];let active=false;
          for(let i=0;i<xyz.length;i+=3){
            const x=xyz[i]*scale,y=xyz[i+1]*scale,valid=Number.isFinite(x)&&Number.isFinite(y)&&Number.isFinite(xyz[i+2]),front=xyz[i+2]>=0;
            if(!valid){active=false;continue;}
            if(front===(pass===1)){active?p.lineTo(x,y):p.moveTo(x,y);active=true;}
            else{if(active)p.lineTo(x,y);active=false;}
          }
        }
        if(this.stats)this.stats.orbitPaths+=2;
      }
      c.save();c.globalAlpha*=reveal;c.translate(this.cx,this.cy);
      for(let pass=0;pass<2;pass++){
        c.strokeStyle=`rgba(${rgb},${clamp((highlight?.64:pass?.32:.17)*strength,0,1)})`;
        if(cached)c.stroke(item.passes[pass]);
        else{
          c.beginPath();let active=false;
          for(let i=0;i<xyz.length;i+=3){const x=xyz[i]*scale,y=xyz[i+1]*scale,valid=Number.isFinite(x)&&Number.isFinite(y)&&Number.isFinite(xyz[i+2]),front=xyz[i+2]>=0;
            if(!valid){active=false;continue;}
            if(front===(pass===1)){active?c.lineTo(x,y):c.moveTo(x,y);active=true;}
            else{if(active)c.lineTo(x,y);active=false;}}
          c.stroke();
        }
      }
      c.restore();c.setLineDash([]);
    }
    // All bodies submit to the same bounded surface owner; no CPU pixel loop here.
    surfaceJob(body,physical,r,ms,seconds,direct=false,target=null,mono=performance.now()) {
      const focused=body.id===this.camera.focus,selected=body.id===this.selected,priority=focused||selected;
      const screenDiameter=Math.max(32,r*2*this.dpr),apparentDiameter=Math.max(16,r*2);
      const nativeWidth=window.SolarAssets?.materialInfo?.[body.id]?.width||SURFACE.detailWidth;
      const detailFloor=focused?SURFACE.detailWidth:selected?2048:0;
      const textureDemand=Math.max(screenDiameter*4,detailFloor);
      const textureTarget=direct?(TEXTURE_TIERS.find(n=>n>=textureDemand)||SURFACE.detailWidth):(priority?SURFACE.detailWidth:1024);
      const textureWidth=Math.min(nativeWidth,textureTarget);
      // Night lights contain much finer, brighter points than the daylight map.
      // Do not keep their 4K focus detail after Earth becomes small on screen:
      // a roughly 2:1 texture-to-disc ratio prefilters sub-pixel cities and
      // prevents them from sparkling while the camera dollies away.
      const nightDemand=Math.max(128,screenDiameter*2);
      const nightTextureWidth=TEXTURE_TIERS.find(n=>n>=nightDemand)||SURFACE.detailWidth;
      // Keep a faint 256px cloud layer resident even while Earth is distant.
      // Tracking can then approach without a late cloud pop; only screen size
      // raises opacity and texture detail. The user's real 0% still skips all work.
      const cloudVisibilityRaw=clamp((apparentDiameter-16)/80,0,1);
      const cloudVisibility=.16+.84*(cloudVisibilityRaw*cloudVisibilityRaw*(3-2*cloudVisibilityRaw));
      const cloudDemand=Math.max(256,screenDiameter*4);
      const cloudTextureWidth=TEXTURE_TIERS.find(n=>n>=cloudDemand)||SURFACE.detailWidth;
      const vectors=this.bodyFrame(body),frame=vectors.gpu||(vectors.gpu=Object.fromEntries(Object.entries(vectors).filter(([k])=>k!=='gpu').map(([k,v])=>[k,new Float32Array([v.x,v.y,v.z])])));
      const lightVector=this.viewDirection({x:-physical.x,y:-physical.y,z:-physical.z}),len=Math.hypot(lightVector.x,lightVector.y,lightVector.z)||1;
      const activity=body.id==='sun'&&this.options.activity,spin=A.rotationAt(body,ms),job=direct&&target?target:{};
      job.id=body.id;job.textureWidth=textureWidth;job.frame=frame;job.phase=spin/TAU;job.activity=activity;job.seconds=activity?seconds:0;job.nightLights=body.id==='earth'&&this.options.earthNightLights!==false;job.nightTextureWidth=job.nightLights?Math.min(SURFACE.detailWidth,nightTextureWidth):0;job.cloudAmount=body.id==='earth'?clamp(Number(this.options.earthCloudAmount),0,1)*cloudVisibility:0;job.cloudTextureWidth=job.cloudAmount>0?Math.min(SURFACE.detailWidth,cloudTextureWidth):0;job.cloudSeed=body.id==='earth'?this.options.earthCloudSeed:0;job.weatherDay=body.id==='earth'?ms/86400000:0;
      job.cloudSpinDays=body.id==='earth'?body.spinSeconds/86400:1;
      const detail=clamp((apparentDiameter-48)/144,0,1);
      job.cloudDetail=body.id==='earth'?detail*detail*(3-2*detail):1;
      job.venusSurfacePreviewWidth=body.id==='venus'&&apparentDiameter>=96?256:0;
      if(body.id==='venus'){
        // Opposite of Earth: an unresolved Venus is always cloud-covered.
        // Stored user preference is unchanged; it returns on approaching.
        const near=clamp((apparentDiameter-64)/96,0,1),surfaceVisibility=near*near*(3-2*near);
        job.cloudAmount=1-(1-clamp(this.options.venusCloudAmount,0,1))*surfaceVisibility;
        job.cloudTextureWidth=job.cloudAmount>0?cloudTextureWidth:0;
        job.textureWidth=job.cloudAmount>=1?cloudTextureWidth:textureWidth;
      }
      job.priority=focused?2:selected?1:0;
      job.cloudReveal=body.id==='earth'&&job.cloudAmount>0?this.cloudRevealProgress(mono):1;
      const light=direct?(job.light||(job.light=[0,0,0])):[0,0,0];
      light[0]=lightVector.x/len;light[1]=lightVector.y/len;light[2]=lightVector.z/len;job.light=light;
      if(direct)return job;
      const maximum=priority?SURFACE.maxRaster:384,wanted=Math.min(maximum,screenDiameter);
      const diam=[32,64,128,192,256,384,512,768,1024].find(n=>n>=wanted)||1024;
      job.diam=diam;
      job.geometry=[body.id,window.SolarAssets?.materialRevision||0,diam,textureWidth,job.nightTextureWidth,job.cloudTextureWidth,'camera-3d',A.rotationPoleTilt(body),this.camera.azimuth.toFixed(5),this.camera.elevation.toFixed(5),Number(activity),Number(job.nightLights),job.cloudAmount.toFixed(2),job.cloudDetail.toFixed(2),job.cloudSeed.toFixed(6)].join(':');
      job.viewState={yaw:this.camera.azimuth,pitch:this.camera.elevation,limit:this.autoRotation?Math.PI/120:Math.PI/36,
        key:[body.id,window.SolarAssets?.materialRevision||0,diam,textureWidth,job.nightTextureWidth,job.cloudTextureWidth,A.rotationPoleTilt(body),this.autoRotation?.generation||0,Number(job.nightLights),job.cloudAmount.toFixed(2),job.cloudDetail.toFixed(2),job.cloudSeed.toFixed(6)].join(':')};
      return job;
    }
    invalidateSurfaces() {this.lastSurfaceSubmit=-Infinity;this.surface?.invalidate();}
    suspend() {
      const mono=performance.now();this.cancelCameraTween(mono);this.advanceAutoRotate(mono);
      this.cancelCoronaBuild();this.physicsSamples?.clear();this.physicsMs=NaN;
      this.openingParticles=null;
      if(this.autoRotation)this.autoRotation.mono=null; // Resume at the same view, never catch up a hidden tab.
      this.surface?.pause();this.sky?.pause?.();
    }
    resume() {if(!this.surface)this.surface=this.gpu||new window.SolarSurface.Service();this.surface.resume();this.sky?.resume?.();}
    dispose() {this.suspend();this.surface?.dispose();this.surface=null;this.autoRotation=null;this.clearLabels();this.hitTargets.length=0;this.coronaTexture=null;this.openingParticleSprite=null;this.starSprites.clear();this.frameCache.clear();this.precisionOrbitPathCache.clear();this.physicsBodies.clear();this.physicsSatellites.clear();this.labelWidths.clear();this.labelBodyMap.clear();this.labelOrdered.length=0;this.labelReserved.length=0;this.labelActive.clear();this.labelObstacleMap.clear();this.labelCandidateMap.clear();this.frameItems.clear();this.frameBodies.length=this.surfaceBodies.length=this.directBodies.length=this.labelBodies.length=this.satelliteLayouts.length=this.compatSurfaceJobs.length=0;this.orbitCache=new WeakMap();this.sky?.dispose();}
    makeCoronaTexture(size=384) {
      const work=this.coronaRows(size);let result;do{result=work.next();}while(!result.done);return result.value;
    }
    *coronaRows(size) {
      // One shared public-site filament texture. Direct rendering uploads it once
      // to WebGL; the compatibility renderer draws it directly.
      const extent=3.3,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
      const ctx=canvas.getContext('2d'),image=ctx.createImageData(size,size),out=image.data;
      for(let y=0;y<size;y++){for(let x=0;x<size;x++) {
        const px=((x+.5)/size*2-1)*extent,py=((y+.5)/size*2-1)*extent,d=Math.hypot(px,py);
        if(d<.98||d>extent)continue;
        const a=Math.atan2(py,px),ca=Math.cos(a),sa=Math.sin(a);
        const field=fbm(ca*5+21,sa*5+37),fine=noise(ca*43+px*.7,sa*43+py*.7);
        const filament=Math.pow(clamp(field*.7+fine*.3,0,1),3);
        const reach=.20+Math.pow(field,2)*1.55,falloff=Math.exp(-(d-1)/reach);
        const edge=clamp((extent-d)/.45,0,1),alpha=(.07+filament*.75)*falloff*edge;
        const i=(y*size+x)*4;
        out[i]=255;out[i+1]=168+field*46;out[i+2]=67+field*51;out[i+3]=Math.round(alpha*255);
      }if((y&1)===1)yield;}
      ctx.putImageData(image,0,0);return canvas;
    }
    cancelCoronaBuild(){if(this.coronaTask){clearTimeout(this.coronaTask.timer);this.coronaTask.work.return();this.coronaTask=null;}}
    coronaSource(r) {
      const detail=r*this.dpr>128&&this.options.quality!=='low'?768:384;
      // A tiny immediate preview avoids a blank Sun. Refine the unchanged
      // filament pattern cooperatively instead of blocking the first close-up.
      if(!this.coronaTexture)this.coronaTexture=this.makeCoronaTexture(64);
      if(this.coronaTexture.width<detail&&(!this.coronaTask||this.coronaTask.detail<detail)){
        this.cancelCoronaBuild();const task={detail,work:this.coronaRows(detail),timer:null};this.coronaTask=task;
        const step=()=>{
          if(this.coronaTask!==task)return;
          const start=performance.now();let result;
          do{result=task.work.next();}while(!result.done&&performance.now()-start<2);
          this.coronaMaxSliceMs=Math.max(this.coronaMaxSliceMs||0,performance.now()-start);
          if(result.done){this.coronaTexture=result.value;this.coronaTask=null;this.invalidatePresentation(300);}
          else task.timer=setTimeout(step,0);
        };
        task.timer=setTimeout(step,0);
      }
      return this.coronaTexture;
    }
    corona(c,x,y,r,seconds) {
      // v0.19: activity is a true visibility toggle, not merely an animation freeze.
      if(!this.options.activity)return;
      // Public SolarTime timing and layer blend values.
      const t=seconds*24;
      const texture=this.coronaSource(r);
      c.save();c.translate(x,y);
      c.globalCompositeOperation='screen';
      const halo=c.createRadialGradient(0,0,r*.92,0,0,r*5.1);
      halo.addColorStop(0,'rgba(255,167,64,.25)');halo.addColorStop(.17,'rgba(216,102,25,.095)');
      halo.addColorStop(.5,'rgba(156,64,13,.026)');halo.addColorStop(1,'rgba(110,40,5,0)');
      c.fillStyle=halo;c.fillRect(-r*5.1,-r*5.1,r*10.2,r*10.2);
      for(let layer=0;layer<2;layer++) {
        c.save();c.rotate(layer*1.73+(layer?-1:1)*t*.003);
        c.globalAlpha=(layer?.37:.8)*(1+Math.sin(t*.19+layer)*.035);
        const extent=r*3.3*(layer?1.08:1);c.drawImage(texture,-extent,-extent,extent*2,extent*2);c.restore();
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
        const projectedThickness=(outer-inner)*r*Math.max(.08,Math.min(Math.hypot(u.x,u.y),Math.hypot(v.x,v.y)));
        const steps=Math.round(clamp(projectedThickness*1.25,16,116)),bandDetail=clamp((projectedThickness/24-2)/3,0,1);
        for(let i=0;i<steps;i++) {
          const f=i/(steps-1),rr=mix(inner,outer,f)*r;if(f>.56&&f<.62)continue;
          const alpha=(.19+.48*mix(.5,Math.sin(f*75)**2,bandDetail))*(f>.85?.6:1);
          c.strokeStyle=`rgba(${205+Math.round(f*25)},${180+Math.round(f*22)},${133+Math.round(f*38)},${alpha})`;
          c.lineWidth=(outer-inner)*r/steps*1.18;c.beginPath();c.arc(0,0,rr,start,start+Math.PI);c.stroke();
        }
      }else{
        // Uranus has a family of narrow, low-albedo rings rather than one broad annulus.
        // Match the GPU ring LOD: merge unresolved subpixel lines into a faint,
        // stable annulus and reveal the individual rings only when they have room.
        const rings=[[.07,.16,.72],[.16,.20,.65],[.27,.13,.68],[.39,.22,.62],[.53,.17,.78],[.68,.25,.68],[.83,.19,.82],[.95,.46,1.05]];
        const projectedThickness=(outer-inner)*r*Math.max(.08,Math.min(Math.hypot(u.x,u.y),Math.hypot(v.x,v.y)));
        const ringDetail=clamp((projectedThickness*.09-2.5)/3,0,1);
        if(ringDetail<1){
          c.strokeStyle=`rgba(158,199,202,${.045*(1-ringDetail)})`;c.lineWidth=(outer-inner)*r*.9;
          c.beginPath();c.arc(0,0,mix(inner,outer,.52)*r,start,start+Math.PI);c.stroke();
        }
        if(ringDetail>0)for(const [f,alpha,width] of rings){
          c.strokeStyle=`rgba(158,199,202,${alpha*ringDetail})`;c.lineWidth=Math.max(.55,width*this.dpr);
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
    drawSiteMarker(c,earth,ms,mono) {
      if(this.camera.focus!=='earth'||earth.r<=65)return;
      const opacity=this.openingLabelOpacity(mono,'earth');if(opacity<=1e-4)return;
      const site=this.site,surfaceNormal=A.surfaceDirection(earth.body,site.latitude,site.longitude,ms),normal=this.viewDirection(surfaceNormal);
      if(normal.z<=.03)return;
      const x=earth.screen.x+normal.x*earth.r,y=earth.screen.y+normal.y*earth.r,ep=earth.physical;
      const day=-(ep.x*surfaceNormal.x+ep.y*surfaceNormal.y+ep.z*surfaceNormal.z)>=0;
      // The selected region, its pin and day/night indicator share Earth's
      // label timeline, including that body's randomized orbit delay.
      c.save();c.globalAlpha*=opacity;
      c.fillStyle=day?'#ffdb92':'#98c9ff';c.strokeStyle='rgba(255,255,255,.8)';c.lineWidth=1;
      c.beginPath();c.arc(x,y,3,0,TAU);c.fill();c.beginPath();c.arc(x,y,6,0,TAU);c.stroke();
      c.font='11px "Segoe UI",sans-serif';c.textAlign='left';c.shadowColor='#000';c.shadowBlur=5;
      c.fillText(site.label+' · '+(day?'DAY':'NIGHT'),x+11,y-9);c.restore();
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
    trackingAnchorForFrame() {
      const move=this.cameraTween,origin={x:0,y:0,z:0};
      if(!move)return this.currentFrameItem(this.camera.focus)?.world||origin;
      const a=move.fromAnchor||this.currentFrameItem(move.from.focus)?.world||origin,b=this.currentFrameItem(move.to.focus)?.world||origin;
      const p=clamp(move.progress??0,0,1);
      // Blend camera translation in the same projected space as camera travel.
      // Linear anchor lerp multiplied by a growing dolly sent the target AWAY
      // first: (1-p)*lerp(d0,d1,p). Inverse-scale weighting removes that detour.
      // Include depth in that weighting so perspective cannot bend the final
      // approach. CPU planets and GPU orbits consume this one resolved anchor.
      const startScale=move.from.zoom*(move.from.dolly??1),scale=this.camera.zoom*(this.camera.dolly??1),remainingScale=(1-p)*startScale;
      const depth=this.viewDepth(b,a)/DOLLY.baseDistance;
      const fromDenominator=1-depth*((move.from.dolly??1)-1);
      const denominator=scale*fromDenominator+remainingScale*depth*((this.camera.dolly??1)-1);
      let remaining=clamp(fromDenominator>DOLLY.nearRatio&&denominator>0?remainingScale/denominator:remainingScale/scale,0,1);
      if(move.from.focus&&!move.to.focus){
        // Leaving tracking is the inverse journey: keep the OUTGOING body on
        // its eased screen path. The incoming-target formula above makes a
        // panned close-up surge partway through a home or free-preset recall.
        const endScale=move.to.zoom*(move.to.dolly??1),travel=(this.camera.dolly??1)-1;
        const outgoingDepth=-depth,endDenominator=1-outgoingDepth*((move.to.dolly??1)-1);
        const outDenominator=scale*endDenominator+p*endScale*outgoingDepth*travel;
        const released=outDenominator>0&&endDenominator>DOLLY.nearRatio?p*endScale/outDenominator:p*endScale/((1-p)*startScale+p*endScale);
        remaining=1-clamp(released,0,1);
      }
      return {x:mix(b.x,a.x,remaining),y:mix(b.y,a.y,remaining),z:mix(b.z,a.z,remaining),depthX:mix(b.depthX??b.x,a.depthX??a.x,remaining),depthY:mix(b.depthY??b.y,a.depthY??a.y,remaining),depthZ:mix(b.depthZ??b.z,a.depthZ??a.z,remaining)};
    }
    openingLabelOpacity(mono=performance.now(),id=null) {
      if(!Number.isFinite(this.openingAnnotationStart))return 1;
      // Names appear after each body's sweep finishes.
      const delay=this.openingOrbitDelays?.get(id)||0;
      const p=clamp((mono-this.openingAnnotationStart-delay)/OPENING_ANNOTATION_FADE,0,1);
      // Smooth onset and finish, shared with the orbit drawing curve.
      return p*p*(3-2*p);
    }
    openingOrbitOpacity(mono=performance.now(),id=null) {
      // Draw the orbit during the final two seconds of travel. Labels then
      // inherit its completion timestamp, with no independent absolute times.
      if(Number.isFinite(this.openingOrbitStart)){
        const delay=this.openingOrbitDelays?.get(id)||0;
        const duration=Math.max(1,this.openingAnnotationStart-this.openingOrbitStart),p=clamp((mono-this.openingOrbitStart-delay)/duration,0,1);
        // One linear local clock gives the single lap its 1000ms duration.
        return id?p:p*p*(3-2*p);
      }
      return this.orbitRevealAlpha(mono);
    }
    labels(c,bodies,mono) {
      if(this.lastLabelMono!==null&&mono<this.lastLabelMono)this.clearLabels();
      const dt=this.lastLabelMono===null?0:clamp((mono-this.lastLabelMono)/1000,0,.05);
      this.lastLabelMono=mono;
      const avoid=!!this.options?.avoidLabels,alpha=avoid?1-Math.exp(-dt/LABEL.response):1;
      const byId=this.labelBodyMap||(this.labelBodyMap=new Map()),ordered=this.labelOrdered||(this.labelOrdered=[]),reserved=this.labelReserved||(this.labelReserved=[]),active=this.labelActive||(this.labelActive=new Set()),obstacleMap=this.labelObstacleMap||(this.labelObstacleMap=new Map()),candidateMap=this.labelCandidateMap||(this.labelCandidateMap=new Map());
      byId.clear();ordered.length=0;reserved.length=0;active.clear();
      for(const item of bodies){byId.set(item.body.id,item);let o=obstacleMap.get(item.body.id);if(!o){o={x:0,y:0,w:0,h:0};obstacleMap.set(item.body.id,o);}o.x=item.screen.x-item.r-LABEL.padding;o.y=item.screen.y-item.r-LABEL.padding;o.w=item.r*2+LABEL.padding*2;o.h=item.r*2+LABEL.padding*2;}
      for(const body of [A.SUN,...A.BODIES,...SATELLITES]){const item=byId.get(body.id);if(item)ordered.push(item);}
      const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
      c.textAlign='center';c.textBaseline='top';const opacityBase=c.globalAlpha??1;
      for(const item of ordered) {
        const {body:b,screen:s,r}=item,satellite=!!b.parent;active.add(b.id);
        const opacity=this.openingLabelOpacity(mono,b.id);if(opacity<=1e-4)continue;
        c.globalAlpha=opacityBase*opacity;
        const font=satellite?8:this.w<680?9:10,h=font+10;c.font=`500 ${font}px "Segoe UI", Arial, sans-serif`;
        if('letterSpacing' in c)c.letterSpacing=satellite?'1px':'1.65px';
        const widths=this.labelWidths||(this.labelWidths=new Map()),metricKey=font+':'+satellite+':'+b.en;
        let w=widths.get(metricKey);if(w===undefined){w=c.measureText(b.en).width+10;widths.set(metricKey,w);}
        const gap=satellite?7:b.id==='saturn'?13:9,count=avoid?5:1;
        let candidates=candidateMap.get(b.id);if(!candidates){candidates=[];candidateMap.set(b.id,candidates);}
        for(let slot=0;slot<count;slot++){
          let dx=0,dy=r+gap;
          if(avoid){if(slot===1)dy=-r-h-gap;else if(slot===2){dx=r+w/2+gap;dy=-h/2;}else if(slot===3){dx=-r-w/2-gap;dy=-h/2;}else if(slot===4)dy=r+gap+h+4;}
          let q=candidates[slot];if(!q){q={slot,x:0,y:0,w:0,h:0,score:0};candidates[slot]=q;}
          q.slot=slot;q.w=w;q.h=h;q.x=avoid?clamp(s.x+dx-w/2,8,Math.max(8,this.w-w-8)):s.x-w/2;q.y=avoid?clamp(s.y+dy,8,Math.max(8,this.h-h-8)):s.y+dy;q.score=slot*7;
          if(avoid){for(const obstacle of reserved)q.score+=overlap(q,obstacle)/Math.max(1,Math.min(w*h,obstacle.w*obstacle.h))*1000;for(const other of bodies)if(other!==item){const obstacle=obstacleMap.get(other.body.id);q.score+=overlap(q,obstacle)/Math.max(1,Math.min(w*h,obstacle.w*obstacle.h))*1000;}}
        }
        let best=candidates[0];if(avoid)for(let slot=1;slot<count;slot++)if(candidates[slot].score<best.score)best=candidates[slot];
        let state=this.labelStates.get(b.id);
        if(!state){state={slot:best.slot,dx:best.x+w/2-s.x,dy:best.y-s.y,switchedAt:mono-LABEL.dwell,pending:null,pendingSince:mono};this.labelStates.set(b.id,state);}
        else if(!avoid){state.slot=0;state.pending=null;}else{const current=candidates[state.slot]||candidates[0];if(best.slot!==state.slot&&current.score-best.score>LABEL.margin){if(state.pending!==best.slot){state.pending=best.slot;state.pendingSince=mono;}if(mono-state.pendingSince>=LABEL.switchDelay&&mono-state.switchedAt>=LABEL.dwell){state.slot=best.slot;state.switchedAt=mono;state.pending=null;}}else state.pending=null;}
        const target=candidates[state.slot]||candidates[0];state.dx+=(target.x+w/2-s.x-state.dx)*alpha;state.dy+=(target.y-s.y-state.dy)*alpha;
        if(Math.abs(target.x+w/2-s.x-state.dx)<.02)state.dx=target.x+w/2-s.x;if(Math.abs(target.y-s.y-state.dy)<.02)state.dy=target.y-s.y;
        reserved.push(target);
        const x=s.x+state.dx,y=s.y+state.dy,box={id:b.id,x:x-w/2,y,w,h,label:true},ex=clamp(s.x,box.x,box.x+w),ey=clamp(s.y,box.y,box.y+h),dx=ex-s.x,dy=ey-s.y,distance=Math.hypot(dx,dy);
        if(distance>r+6){c.strokeStyle='rgba(161,179,201,.22)';c.lineWidth=.6;c.beginPath();c.moveTo(s.x+dx/distance*(r+3),s.y+dy/distance*(r+3));c.lineTo(ex,ey);c.stroke();}
        c.shadowColor='rgba(0,0,0,.95)';c.shadowBlur=6;c.fillStyle=this.selected===b.id?'#eedbb8':b.id==='sun'?'#f1c889':satellite?'#8f9cac':'#b9c4d2';c.fillText(b.en,x,y);c.shadowBlur=0;this.hitTargets.push(box);
      }
      for(const id of this.labelStates.keys())if(!active.has(id))this.labelStates.delete(id);
      c.globalAlpha=opacityBase;if('letterSpacing' in c)c.letterSpacing='0px';
    }
    draw(ms,seconds,mono=performance.now()) {
      this.advanceActualScale(mono);this.advanceCamera(mono);this.advanceAutoRotate(mono);
      const c=this.ctx;this.frameCount++;c.clearRect(0,0,this.w,this.h);
      if(this.dirty||!Number.isFinite(this.lastPathMs)||A.modelYear(ms)!==this.pathYear)this.rebuild(ms);
      this.sky.draw(seconds,this.camera,this.options);
      this.sky.decorate(c,seconds,this.options,this.boundStarGlow);
      this.frameSerial++;
      const bodies=this.frameBodies;bodies.length=0;
      for(const body of this.getBodies()){
        const physical=this.physicalAt(body,ms),item=this.frameItem(body);
        item.physical.x=physical.x;item.physical.y=physical.y;item.physical.z=physical.z;
        this.displayPhysicalPoint(item.physical,item.world,body);item.r=this.bodyRadiusAtZoom(body);bodies.push(item);
      }
      const sunItem=this.frameItem(A.SUN);sunItem.physical.x=sunItem.physical.y=sunItem.physical.z=0;sunItem.world.x=sunItem.world.y=sunItem.world.z=0;sunItem.r=this.bodyRadiusAtZoom(A.SUN);bodies.push(sunItem);
      const satelliteLayouts=this.satelliteLayouts;satelliteLayouts.length=0;
      if(this.options.moon) {
        for(const satellite of SATELLITES){
          const parent=this.currentFrameItem(satellite.parent);if(!parent)continue;
          const item=this.frameItem(satellite),r=this.bodyRadiusAtZoom(satellite),orbitRadius=this.satelliteOrbitRadius(satellite,parent.body,item);
          const unit=this.satelliteUnitAt(satellite,ms),physicalRadius=A.SATELLITE_MEAN_AU[satellite.id];
          item.parent=parent;item.orbitRadius=orbitRadius;item.r=r;
          this.displaySatellitePoint(unit,item,parent.world,item.world);
          item.physical.x=parent.physical.x+unit.x*physicalRadius;item.physical.y=parent.physical.y+unit.y*physicalRadius;item.physical.z=parent.physical.z+unit.z*physicalRadius;
          bodies.push(item);satelliteLayouts.push(item);
        }
      }
      const earth=this.currentFrameItem('earth');
      const anchor=this.trackingAnchorForFrame();
      this.trackingAnchor={...anchor};
      const perspectiveActive=Math.abs((this.camera.dolly??1)-1)>1e-8;
      if(perspectiveActive){
        // Camera travel uses the tracked body as its ray target. The mode button
        // itself never reaches this branch because it changes no camera value.
        this.projectionAnchor=anchor;this.cx=this.centerX;this.cy=this.centerY;
      }else{
        this.projectionAnchor=null;const v=this.view(anchor);this.cx=this.centerX-v.x*this.scale;this.cy=this.centerY-v.y*this.scale;
      }
      for(const body of bodies){this.project(body.world,body.screen);body.r*=body.screen.perspective;}
      const direct=!!this.gpu&&this.gpu.begin();
      const orbitBrightness=clamp(Number(this.options.orbitBrightness)||0,0,1),orbitStrength=orbitBrightness*3;
      if(orbitBrightness>0) {
        const camera=direct?this.gpuOrbitCamera():null;
        if(direct){
          const origin=this.orbitOrigin||(this.orbitOrigin={x:0,y:0,z:0});
          for(const path of this.paths){const selected=this.selected===path.body.id;
            camera.orbitPlane=path.body.id==='pluto'?1:0;
            const localReveal=this.openingOrbitOpacity(mono,path.body.id),ink=this.orbitInk(path.body.id,localReveal,this.currentFrameItem(path.body.id)?.world),alpha=ink?1:localReveal;
            this.gpu.orbit('solar:'+path.body.id,this.orbitModel(path),origin,camera,this.scale,this.cx,this.cy,path.body.id==='earth'?[.43,.68,.83]:path.body.id==='pluto'?[.61,.55,.50]:[.54,.59,.66],clamp((selected?.64:.22)*alpha*orbitStrength,0,1),1,1,4,ink);}
        }else if(!this.gpu)for(const path of this.paths)this.orbit(c,path,this.selected===path.body.id,this.openingOrbitOpacity(mono,path.body.id),orbitStrength);
        for(const satellite of satelliteLayouts) {
          const points=direct?null:this.satelliteOrbitPoints(satellite.body,ms).points,parent=satellite.parent.world;
          const localReveal=this.openingOrbitOpacity(mono,satellite.body.id),ink=this.orbitInk(satellite.body.id,localReveal,{x:satellite.world.x-parent.x,y:satellite.world.y-parent.y}),opacity=ink?1:localReveal;
          if(direct){this.gpu.orbit('satellite:'+satellite.body.id,this.satelliteOrbitModel(satellite.body,ms),parent,{...camera,solarMorph:satellite.orbitShape,orbitPlane:0},this.scale,this.cx,this.cy,satellite.body.id==='moon'?[.45,.61,.74]:[.67,.62,.46],clamp(.26*opacity*orbitStrength,0,1),1,1,4,ink);}
          else if(!this.gpu){
            c.save();c.globalAlpha*=ink?1:opacity;const baseAlpha=c.globalAlpha,alpha=clamp(.26*orbitStrength,0,1),strokeAlpha=ink?1:alpha;
            c.strokeStyle=satellite.body.id==='moon'?`rgba(115,155,189,${strokeAlpha})`:`rgba(171,158,117,${strokeAlpha})`;c.lineWidth=.65;c.beginPath();let previous=null;
            for(let i=0;i<points.length;i++){
              const p=points[i],s=this.project(this.displaySatellitePoint(p,satellite,parent));
              if(ink){
                if(previous&&!previous.behind&&!s.behind){const q=points[i-1];c.globalAlpha=Math.min(1,baseAlpha*this.orbitInkOpacity(p.x+q.x,p.y+q.y,ink,alpha));c.beginPath();c.moveTo(previous.x,previous.y);c.lineTo(s.x,s.y);c.stroke();}
              }else if(!s.behind){previous&&!previous.behind?c.lineTo(s.x,s.y):c.moveTo(s.x,s.y);}
              previous=s;
            }
            if(!ink)c.stroke();c.restore();
          }
        }
      }
      bodies.sort((a,b)=>a.screen.z-b.screen.z);
      this.hitTargets.length=0;
      // Surface/sky resume is handled once on visibility/pageshow. Avoid doing
      // resume()+pump() in the 60 fps draw hot path.
      // A corona that crosses the viewport does NOT make the hidden solar disk visible.
      const surfaceBodies=this.surfaceBodies;surfaceBodies.length=0;
      for(const p of bodies)if(this.visible(p.screen,p.r+2))surfaceBodies.push(p);
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
      const directBodies=this.directBodies;directBodies.length=0;
      if(direct){
        const jobs=this.compatSurfaceJobs;jobs.length=0;
        for(const p of surfaceBodies){this.surfaceJob(p.body,p.physical,p.r,ms,seconds,true,p.directJob,mono);p.directReady=true;jobs.push(p.directJob);}
        this.gpu.externalTextureBytes=this.sky?.memoryUsage?.().textures||0;
        this.gpu.prepare(jobs);
        const sun=this.currentFrameItem('sun');
        if(sun&&this.options.activity&&this.visible(sun.screen,sun.r*5.1+16))this.gpu.corona(this.coronaSource(sun.r),sun.screen,sun.r,seconds);
        for(const p of bodies){const extent=p.body.id==='sun'?5.1:p.body.id==='saturn'?2.3:p.body.id==='uranus'?2:1.3;if(!this.visible(p.screen,p.r*extent+16))continue;
          const job=p.directReady?p.directJob:null;if(job&&this.gpu.planet(job,p.body,p.screen,p.r,seconds,this.options.activity))directBodies.push(p);
        }
        this.gpu.end();
      }else if(!this.gpu){
        const realDt=Number.isFinite(this.lastSurfaceMono)?Math.max(1,mono-this.lastSurfaceMono):16.7;
        const simDt=Number.isFinite(this.lastSurfaceSimMs)?Math.abs(ms-this.lastSurfaceSimMs):0;
        const simRate=simDt/realDt, moving=!!this.cameraTween||!!this.autoRotation;
        const surfaceInterval=moving?40:simRate>1000?34:90;
        if(mono-this.lastSurfaceSubmit>=surfaceInterval){
          this.lastSurfaceSubmit=mono;this.lastSurfaceSimMs=ms;this.lastSurfaceMono=mono;
          const jobs=this.compatSurfaceJobs;jobs.length=0;for(const p of surfaceBodies)jobs.push(this.surfaceJob(p.body,p.physical,p.r,ms,seconds,false,null,mono));
          this.surface.update(jobs,mono);
        }
      }
      if(direct)this.occludeDirectBodies(c,directBodies);
      for(const p of bodies) {
        const extent=p.body.id==='sun'?5.1:p.body.id==='saturn'?2.3:p.body.id==='uranus'?2:1.3;
        if(!this.visible(p.screen,p.r*extent+16))continue;
        if(this.gpu)this.drawBodyOverlay(c,p.body,p.screen,p.r);
        else this.drawBody(c,p.body,p.world,p.screen,p.r,ms,seconds);
        this.hitTargets.push({id:p.body.id,x:p.screen.x,y:p.screen.y,r:Math.max(p.r+6,11),z:p.screen.z});
      }
      this.drawAlignmentGuide(c,ms);
      this.drawSiteMarker(c,earth,ms,mono);
      this.drawOpeningParticles(c,mono);
      const labelOpacity=this.openingLabelOpacity(mono);
      if(this.options.labels&&labelOpacity>1e-4){const labelBodies=this.labelBodies;labelBodies.length=0;for(const p of bodies)if(this.visible(p.screen,p.r+20))labelBodies.push(p);c.save();this.labels(c,labelBodies,mono);c.restore();}
      else this.clearLabels();
      this.projected=bodies;
      this.presentationDirty=false;this.presentedResources=this.resourceSignature();
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
