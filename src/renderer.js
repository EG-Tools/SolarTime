/* Solar Time v0.56 — renderer implementation owner. */
(function () {
  'use strict';
  const A=window.SolarAstro, {TAU,DEG,clamp}=A,SATELLITES=A.SATELLITES||Object.freeze([A.MOON].filter(Boolean));
  const OVERVIEW_ORBIT=A.OVERVIEW_ORBIT||Object.freeze({gap:90,minGap:50,maxGap:400});
  const ACTUAL_ORBIT_SPACING=Object.freeze({normalBlendEnd:.1,minimumMix:.01});
  const OVERVIEW_GAP_MULTIPLIER=1.5;
  // The radial map includes transparent inner padding: visible ink starts
  // near 1.35 Saturn radii, not the texture quad's 1.28 boundary.
  const SATURN_RING_SELECTION=Object.freeze({inner:1.35,outer:2.26,hitOuter:2.24});
  function random(seed) { return function() { let t=seed+=0x6D2B79F5; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
  const mix=(a,b,t)=>a+(b-a)*t;
  const REPLAY_TRANSITION=Object.freeze({departure:4300,maxDeparture:15000,warp:4700,particleLead:0,clearHold:250,fadeOut:8000,openingLead:2000,skyFov:60.8,particleDepth:5,particleRate:.8});
  const FLIGHT_GLOW_COLORS=Object.freeze(['#76bfff','#f3d6aa','#b8a1ff','#bfecff']);
  const WARP_PARTICLES=Object.freeze({peakAt:7000,entryDelay:1000,entrySpread:1200,entryFade:450,exitLead:300,openingAppear:1200,openingTail:.175,appear:700,speed:1.44,arrivalSpeed:.3,arrivalDrift:.06,tail:.8,edgeTail:.5,arrivalTail:.25,alpha:.64,speedAlpha:.7,arrivalAlpha:1.2,arrivalHold:.25,afterglow:2000,loopSpread:1200,loopFade:800,blend:450});
  const SATURN_APPEAR=Object.freeze({delay:300,duration:1000,linger:500,glowScale:.7,alpha:.9,extraCohorts:2});
  const PARTICLE_TRANSITION=Object.freeze({finalFade:1200,boardingHold:250});
  // Absolute presentation timestamps only. Particle ages, simulation dates and
  // wall-clock time never belong to this registry. Aliases are shifted once.
  const ANIMATION_TIMESTAMPS=[
    ['', ['orbitRevealStart','openingAnnotationStart','openingOrbitStart','cameraChangeAt','presentationUntil']],
    ['cameraTween',['start']],['cameraTween.replay',['clearSince']],
    ['openingPointReveal',['start']],['lookRelease',['start']],['bankRelease',['start']],
    ['ringTour.replayBridge',['start']],['ringTour',['lastMono']],['autoRotation',['mono']],['openingFlight',['mono']],
    ['sky.skySample',['time']],['sky.skyPrevious',['time']],['cameraTween.replay.skyFrom',['time']],
    ['sky.starRemap',['start']],['actualScaleTween',['started']],['orbitSpacingTween',['started']]
  ].map(([path,keys])=>({path:path?path.split('.'):[],keys}));
  function cameraFrame(state,bank=0){
    const a=state.azimuth,e=state.elevation,ca=Math.cos(a),sa=Math.sin(a),ce=Math.cos(e),se=Math.sin(e),cr=Math.cos(bank),sr=Math.sin(bank);
    return {ca,sa,ce,se,cr,sr,right:[ca*cr-sa*se*sr,-sa*cr-ca*se*sr,-ce*sr],
      up:[ca*sr+sa*se*cr,-sa*sr+ca*se*cr,ce*cr],forward:[sa*ce,ca*ce,-se]};
  }
  class CameraTransitionManager {
    constructor(){this.camera=null;this.tour=null;this.handoff=null;this.revision=0;}
    set(slot,value){
      const next=value||null;if(this[slot]===next)return next;
      this[slot]=next;this.revision++;return next;
    }
    get mode(){
      if(this.camera?.replay)return 'warp';
      if(this.tour)return 'ring';
      if(this.camera?.timing==='opening')return 'opening';
      return this.camera?'camera':'idle';
    }
  }
  class FlightParticleLifecycle {
    constructor(){this.active=null;this.retiring=[];}
    activate(field){this.active=field||null;return this.active;}
    retire(field){
      if(!field)return false;
      if(this.active===field)this.active=null;
      if(!this.retiring.includes(field))this.retiring.push(field);
      return true;
    }
    remove(field){
      if(!field)return false;
      if(this.active===field)this.active=null;
      const index=this.retiring.indexOf(field);if(index>=0)this.retiring.splice(index,1);
      return true;
    }
    fields(){return this.active?[...this.retiring.filter(field=>field!==this.active),this.active]:[...this.retiring];}
    clear(dispose){
      const fields=this.fields();this.active=null;this.retiring.length=0;
      if(dispose)for(const field of fields)dispose(field);
      return fields.length;
    }
    get size(){return this.retiring.length+(this.active?1:0);}
  }
  // The ordinary endpoint is a parent-centered circle. Only Pluto retains
  // inclination there; the physical endpoint always keeps its full 3D vector.
  function blendOrbitPoint(point,normal,actual,depthNormal,depthActual,inclined,out){
    const planar=Math.hypot(point.x,point.y),flatten=inclined?1:Math.hypot(point.x,point.y,point.z)/Math.max(1e-12,planar);
    out.x=point.x*(normal*flatten+actual);out.y=point.y*(normal*flatten+actual);out.z=point.z*((inclined?normal:0)+actual);
    out.depthX=point.x*(depthNormal*flatten+depthActual);out.depthY=point.y*(depthNormal*flatten+depthActual);out.depthZ=point.z*((inclined?depthNormal:0)+depthActual);
    return out;
  }
  const ease=t=>{t=clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);};
  const flightUnit=v=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n);};
  const flightDot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
  const frameValue=(value,index,key)=>value?.[key]??value?.[index]??0;
  function frameVectorToLocal(axes,value,out=[0,0,0]){
    const x=frameValue(value,0,'x'),y=frameValue(value,1,'y'),z=frameValue(value,2,'z');
    out[0]=axes.u.x*x+axes.u.y*y+axes.u.z*z;
    out[1]=axes.pole.x*x+axes.pole.y*y+axes.pole.z*z;
    out[2]=axes.v.x*x+axes.v.y*y+axes.v.z*z;return out;
  }
  function frameVectorToWorld(axes,value,out=[0,0,0]){
    const x=frameValue(value,0,'x'),y=frameValue(value,1,'y'),z=frameValue(value,2,'z');
    out[0]=axes.u.x*x+axes.pole.x*y+axes.v.x*z;
    out[1]=axes.u.y*x+axes.pole.y*y+axes.v.y*z;
    out[2]=axes.u.z*x+axes.pole.z*y+axes.v.z*z;return out;
  }
  function framePointToLocal(axes,origin,units,value,out=[0,0,0]){
    const x=(frameValue(value,0,'x')-origin.x)/units,y=(frameValue(value,1,'y')-origin.y)/units,z=(frameValue(value,2,'z')-origin.z)/units;
    out[0]=axes.u.x*x+axes.u.y*y+axes.u.z*z;
    out[1]=axes.pole.x*x+axes.pole.y*y+axes.pole.z*z;
    out[2]=axes.v.x*x+axes.v.y*y+axes.v.z*z;return out;
  }
  function framePointToWorld(axes,origin,units,value,out=[0,0,0]){
    frameVectorToWorld(axes,value,out);out[0]=origin.x+out[0]*units;out[1]=origin.y+out[1]*units;out[2]=origin.z+out[2]*units;return out;
  }
  const easeIntegral=u=>u**4*(2.5-3*u+u*u);
  // Reparameterize any existing path: keep velocity at brake entry, then
  // stop both translation and rotation over the sky transition, without a new path.
  const replayFlightTime=(seconds,brake=Infinity)=>{
    if(seconds<=brake)return seconds;
    const duration=REPLAY_TRANSITION.fadeOut/1000,u=clamp((seconds-brake)/duration,0,1);return brake+duration*(u-easeIntegral(u));
  };
  const flightEye=s=>{const d=1/Math.max(.00001,s.dolly??1),c=Math.cos(s.elevation);return [-Math.sin(s.azimuth)*c*d,-Math.cos(s.azimuth)*c*d,Math.sin(s.elevation)*d];};
  // One timing source: camera/particles share duration; annotations are always
  // relative to arrival, never a separately maintained absolute timestamp.
  const OPENING_TIMING=Object.freeze({duration:6500,closeupExtra:2000,orbitBeforeEnd:2000,annotationFade:1500,departureDolly:.001,accel:.4,cruise:0,decel:.6});
  const OPENING_ANNOTATION_FADE=OPENING_TIMING.annotationFade;
  const openingFlyThrough=t=>{
    t=clamp(t,0,1);const a=OPENING_TIMING.accel,v=1/(1-a/2);
    return t<=a?v/2*(t-a/Math.PI*Math.sin(Math.PI*t/a)):v*(t-a/2);
  };
  const openingEase=t=>{
    t=clamp(t,0,1);const {accel:a,cruise:c,decel:d}=OPENING_TIMING,maxVelocity=1/(a/2+c+d/2);
    if(t<=a)return maxVelocity/2*(t-a/Math.PI*Math.sin(Math.PI*t/a));
    const accelerated=maxVelocity*a/2;
    if(t<=a+c)return accelerated+maxVelocity*(t-a);
    const u=t-a-c;return accelerated+maxVelocity*c+maxVelocity/2*(u+d/Math.PI*Math.sin(Math.PI*u/d));
  };
  // Limit the widest lens to 0.8×. The shared 0.001× travel floor lets both
  // desktop and portrait viewports frame Neptune
  // in true scale. Home and wheel travel must use the same distance limit.
  const VIEW=Object.freeze({minZoom:.8,minDolly:.001,maxZoom:2048,maxDolly:1e8,lowerBy:.05,minPanY:-.8,maxPanY:.8,minPanX:-.8,maxPanX:.8,minElevation:-Math.PI,maxElevation:Math.PI});
  const DOLLY=Object.freeze({baseDistance:5000,nearRatio:.002});
  const SURFACE=Object.freeze({detailWidth:4096,maxRaster:1024,lowRaster:384});
  const TEXTURE_TIERS=Object.freeze([128,256,512,1024,2048,4096]);
  // Retain the approved viewing angle and lens. defaultCameraSnapshot derives
  // distance and pan from the live orbit layout instead of a captured viewport.
  const DEFAULT_CAMERA=Object.freeze({azimuth:6.24870825667827,elevation:.25293208858658467,zoom:1.1853048513203654,dolly:1,focus:null,panY:0,panX:0});
  const DEFAULT_FRAME=Object.freeze({body:'neptune',widthRatio:.75,sunYRatio:.57,iterations:32});
  const REGION_TRACKED_WHEEL_STEPS=7;
  // Region picking deliberately uses small representative-city safe zones.
  // It does not infer national borders, islands or disputed territory.
  // Screen-space appearance only: never change physical size, lens or camera pose.
  const BODY_POINT=Object.freeze({fadeBegin:2.2,fadeEnd:5.2,growthFullAt:1.2,sizeCurve:.25});
  const OPENING_POINT_REVEAL=1500;
  const POINT_TOUR_CAMERA_HANDOFF=1.2;
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
    transitionManager(){return this._cameraTransitions||(this._cameraTransitions=new CameraTransitionManager());}
    particleLifecycle(){return this._flightParticles||(this._flightParticles=new FlightParticleLifecycle());}
    get cameraTween(){return this.transitionManager().camera;}
    set cameraTween(value){this.transitionManager().set('camera',value);}
    get ringTour(){return this.transitionManager().tour;}
    set ringTour(value){this.transitionManager().set('tour',value);}
    get openingFlight(){return this.transitionManager().handoff;}
    set openingFlight(value){this.transitionManager().set('handoff',value);}
    get openingParticles(){return this.particleLifecycle().active;}
    set openingParticles(value){this.particleLifecycle().activate(value);}
    get transitionMode(){return this.transitionManager().mode;}
    constructor(background,canvas) {
      this.bg=background;this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:true});
      if(!this.ctx)throw new Error('Canvas 2D is unavailable.');
      this.gpu=null;this.gpuError=null;
      const gpuCanvas=typeof document==='object'&&typeof document.getElementById==='function'?document.getElementById('planet-layer'):null;
      if(gpuCanvas&&window.SolarSurface?.DirectRenderer){try{this.gpu=new window.SolarSurface.DirectRenderer(gpuCanvas);}catch(error){this.gpuError=error.message;}}
      this.options={actualScale:false,overviewOrbitGap:100,actualOrbitSpacing:0,orbitBrightness:.5,dollyZoom:true,labels:true,avoidLabels:false,twinkle:true,activity:true,alignmentGuideVisible:true,earthNightLights:true,earthCloudAmount:1,earthCloudSeed:0,venusCloudAmount:.8,pluto:true,moon:true,skyMotion:true,comets:true,quality:'auto'};
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
      this.selected=null;this.hover=null;this.earthRegionHover=null;this.countryBorders=null;this.alignmentGuide=null;this.lastPathMs=NaN;this.dirty=true;this.presentationDirty=true;this.presentationUntil=0;this.presentedResources='';this.frameCount=0;
      this.orbitRevealStart=performance.now();this.openingAnnotationStart=NaN;this.openingOrbitStart=NaN;this.openingPointReveal=null;
      this._flightParticles=new FlightParticleLifecycle();this.openingParticleSprite=null;this.ringTour=null;this.pendingTravelFocus=null;
      this.lastSurfaceSubmit=-Infinity;this.lastSurfaceSimMs=NaN;this.lastSurfaceMono=NaN;
      this.sky=new window.SolarSky(background);
      this.resize();
      this.loadFlightParticleAtlas();
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
    startOpeningPointReveal(mono=performance.now(),duration=OPENING_POINT_REVEAL) {
      this.openingPointReveal={start:Number.isFinite(mono)?mono:performance.now(),duration:Math.max(1,duration)};
      this.invalidatePresentation(duration,mono);
    }
    openingPointOpacity(mono=performance.now(),sceneAlpha=1) {
      mono=this.animationMono(mono);
      const reveal=this.openingPointReveal;
      if(!reveal)return clamp(sceneAlpha,0,1);
      const alpha=ease((mono-reveal.start)/reveal.duration);
      if(alpha>=1)this.openingPointReveal=null;
      return Math.min(clamp(sceneAlpha,0,1),alpha);
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
      const ringTour=this.ringTour?.memoryUsage()||0,sprite=this.openingParticleSprite;
      const flightAtlas=(sprite?.naturalWidth||sprite?.width||0)*(sprite?.naturalHeight||sprite?.height||0)*4;
      const knownBytes=(surface?.knownBytes||0)+(sky?.knownBytes||0)+ringTour+flightAtlas,framebufferEstimate=(surface?.framebufferEstimate||0)+(sky?.framebufferEstimate||0);
      return {estimated:true,scope:'WebGL textures, geometry, flight sprite and estimated color buffers; excludes browser/driver overhead',surface,sky,ringTour,flightAtlas,knownBytes,framebufferEstimate,totalEstimate:knownBytes+framebufferEstimate};
    }
    invalidatePresentation(duration=0,mono=performance.now()){
      this.presentationDirty=true;
      if(duration>0&&Number.isFinite(mono))this.presentationUntil=Math.max(this.presentationUntil,mono+duration);
    }
    needsDraw(mono=performance.now()){
      return !!this.preparedRingTour?.needsWarmup()||
        this.dirty||this.presentationDirty||this.resourceSignature()!==this.presentedResources||
        (!this.animationPaused&&(!!this.ringTour||!!this.cameraTween||!!this.bankRelease||this.particleLifecycle().size>0||!!this.autoRotation||this.orbitRevealAlpha(mono)<.9999||mono<this.presentationUntil))||!!this.actualScaleTween||!!this.orbitSpacingTween||mono<(this.gpu?.cloudBlendUntil||0)||mono<(this.gpu?.cloudWeather?.readyAt||-Infinity)+300||mono-(this.cameraChangeAt??-Infinity)<400;
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
    bodyPointLod(body,radius) {
      if(!Number.isFinite(radius)||radius<=0)return {size:0,alpha:0};
      // Keep every body's point representation on one screen-space curve.
      // The shallow power keeps sub-pixel bodies visible without replacing
      // their projected size relationship with planet-class ranks.
      const normalized=clamp(radius/BODY_POINT.fadeBegin,0,1);
      const growth=ease(clamp(radius/BODY_POINT.growthFullAt,0,1));
      return {size:BODY_POINT.fadeBegin*Math.pow(normalized,BODY_POINT.sizeCurve),
        alpha:(1-ease(clamp((radius-BODY_POINT.fadeBegin)/(BODY_POINT.fadeEnd-BODY_POINT.fadeBegin),0,1)))*mix(.58,1,growth)};
    }
    drawBodyPoint(c,item,occluders=[],reveal=1) {
      const {screen,body,r}=item,point=this.bodyPointLod(body,r),extent=point.size*1.8;
      reveal=clamp(Number(reveal)||0,0,1);
      if(point.alpha<=0||reveal<=0||!Number.isFinite(screen?.x)||!Number.isFinite(screen?.y)||!this.visible(screen,extent))return false;
      this.starSprites ||= new Map();
      const color=/^#[0-9a-f]{6}$/i.test(body.color)?body.color:'#cfe2ff';
      const key='body:'+color;let sprite=this.starSprites.get(key);
      if(!sprite){
        const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
        const g=canvas.getContext('2d'),rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)).join(','),halo=g.createRadialGradient(32,32,0,32,32,32);
        halo.addColorStop(0,'rgba(255,255,255,.95)');halo.addColorStop(.12,'rgba(255,255,255,.9)');
        halo.addColorStop(.4,`rgba(${rgb},.85)`);halo.addColorStop(.55,`rgba(${rgb},.16)`);halo.addColorStop(1,`rgba(${rgb},0)`);
        g.fillStyle=halo;g.fillRect(0,0,64,64);sprite=canvas;this.starSprites.set(key,sprite);
      }
      c.save();
      // Intersect each outside-disc region separately. One even-odd path for
      // multiple discs would expose the point again where two blockers overlap.
      for(const other of occluders){
        if(other===item||other.screen?.behind||!(other.r>.65)||!(other.screen.z>screen.z+1e-9))continue;
        const dx=screen.x-other.screen.x,dy=screen.y-other.screen.y;
        if(dx*dx+dy*dy>=(other.r+extent)**2)continue;
        c.beginPath();c.rect(0,0,this.w,this.h);
        c.moveTo(other.screen.x+other.r,other.screen.y);c.arc(other.screen.x,other.screen.y,other.r,0,TAU);c.clip('evenodd');
      }
      const parentAlpha=c.globalAlpha;c.globalAlpha=parentAlpha*point.alpha*reveal;
      c.drawImage(sprite,screen.x-extent,screen.y-extent,extent*2,extent*2);
      // Below textured-disc resolution this is a point presentation, not a
      // translucent planet surface. Fade the whole point with the shared solar
      // reveal; the actual planet layer remains binary and fully opaque.
      if(r<BODY_POINT.fadeBegin){
        c.globalAlpha=parentAlpha*reveal;c.fillStyle=color;c.beginPath();
        c.arc(screen.x,screen.y,clamp(point.size*.3,.04,.9),0,TAU);c.fill();
      }
      c.restore();return true;
    }
    cameraBasis() {
      const {azimuth:a,elevation:e}=this.camera,r=this.flightBank||0;
      if(!this.basis||this.basis.a!==a||this.basis.e!==e||this.basis.r!==r||this.basis.look!==this.flightLook){
        this.basis={a,e,r,look:this.flightLook,...cameraFrame(this.camera,r)};
        this.frameCache?.clear();
      }
      return this.basis;
    }
    // Orthographic direction transform shared by orbit geometry, planet
    // materials, rings and markers. This keeps every sphere in the same 3D
    // camera space instead of making its material behave like a billboard.
    viewDirection(p,base=false) {
      const {right,up,forward}=this.cameraBasis();
      const v={x:p.x*right[0]+p.y*right[1]+p.z*right[2],y:-(p.x*up[0]+p.y*up[1]+p.z*up[2]),z:-(p.x*forward[0]+p.y*forward[1]+p.z*forward[2])};
      if(!base&&this.flightLook){const q=[v.x,-v.y,-v.z],look=this.flightLook;return {x:flightDot(q,look.right),y:-flightDot(q,look.up),z:-flightDot(q,look.forward)};}
      return v;
    }
    bankedSkyCamera(){
      if(!this.flightBank&&!this.flightLook)return this.camera;
      const basis=this.cameraBasis();
      if(this.bankSkyBasis!==basis){
        const columns=[{x:1,y:0,z:0},{x:0,y:1,z:0},{x:0,y:0,z:1}].map(p=>this.viewDirection(p));
        this.bankSkyBasis=basis;this.bankSkyAxes={right:columns.map(p=>p.x),down:columns.map(p=>p.y),forward:columns.map(p=>p.z)};
      }
      return {...this.camera,viewAxes:this.bankSkyAxes};
    }
    // Both viewing modes use the same undistorted camera projection.
    view(p) {return this.viewDirection(p);}
    viewDepth(p,anchor={x:0,y:0,z:0}) {
      const {sa,ca,ce,se}=this.cameraBasis();
      const x=(p.depthX??p.x)-(anchor.depthX??anchor.x),y=(p.depthY??p.y)-(anchor.depthY??anchor.y),z=(p.depthZ??p.z)-(anchor.depthZ??anchor.z);
      return -(x*sa+y*ca)*ce+z*se;
    }
    projectView(p,homogeneous=false) {
      if(this.flightLook){
        // Reorient the existing homogeneous projection about the eye. This is
        // a view change, not a second camera/planet renderer or a zoom trick.
        const anchor=this.projectionAnchor||{x:0,y:0,z:0},travel=(this.camera.dolly??1)-1;
        const v=this.viewDirection({x:p.x-anchor.x,y:p.y-anchor.y,z:p.z-anchor.z},true);
        const w=1-this.viewDepth(p,anchor)*travel/DOLLY.baseDistance,f=this.h/(2*Math.tan(36*DEG));
        const ox=(this.cx-this.w/2)/f,oy=(this.h/2-this.cy)/f;
        const ray=[v.x*this.scale/f+ox*w,-v.y*this.scale/f+oy*w,w],look=this.flightLook;
        const denominator=flightDot(ray,look.forward),x=(flightDot(ray,look.right)-ox*denominator)*f/this.scale,y=(-flightDot(ray,look.up)+oy*denominator)*f/this.scale;
        const z=this.viewDirection({x:p.x-anchor.x,y:p.y-anchor.y,z:p.z-anchor.z}).z;
        if(homogeneous)return {x,y,z,denominator};
        if(denominator<=DOLLY.nearRatio)return {x:NaN,y:NaN,z,perspective:0,behind:true};
        return {x:x/denominator,y:y/denominator,z,perspective:1/denominator,behind:false};
      }
      const dolly=this.camera.dolly??1,travel=dolly-1;
      if(Math.abs(travel)<1e-8)return this.view(p);
      const anchor=this.projectionAnchor||{x:0,y:0,z:0};
      const v=this.view({x:p.x-anchor.x,y:p.y-anchor.y,z:p.z-anchor.z});
      v.z=this.viewDepth(p,anchor);
      // Switching modes changes no lens or projection state. Perspective appears
      // only after real forward/backward travel, and is exactly 1 at dolly=1.
      const distance=DOLLY.baseDistance,denominator=distance-v.z*travel;
      const near=Math.max(.02,distance*DOLLY.nearRatio);
      // Camera transitions interpolate undivided coordinates, even behind the
      // camera. Dividing/clipping first can teleport a planet across the screen.
      if(homogeneous)return {...v,denominator:denominator/distance};
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
      this.site={label:site.label,dayLabel:site.dayLabel||'DAY',nightLabel:site.nightLabel||'NIGHT',latitude:site.latitude,longitude:site.longitude};this.dirty=true;return true;
    }
    earthRegionInteractionReady(){
      if(this.cameraTween||this.ringTour||this.flightLook||this.camera.focus!=='earth')return false;
      const earth=this.currentFrameItem('earth');
      return !!earth&&!earth.screen.behind&&earth.r>=Math.min(this.w,this.h)*.245;
    }
    earthSurfaceCoordinate(x,y,earth,ms){
      if(!earth||![x,y,ms,earth.screen.x,earth.screen.y,earth.r].every(Number.isFinite)||earth.r<=0)return null;
      const nx=(x-earth.screen.x)/earth.r,ny=(y-earth.screen.y)/earth.r,disk=nx*nx+ny*ny;
      if(disk>1)return null;
      const nz=Math.sqrt(Math.max(0,1-disk));
      const {right,up,forward}=this.cameraBasis(),normal={
        x:right[0]*nx-up[0]*ny-forward[0]*nz,
        y:right[1]*nx-up[1]*ny-forward[1]*nz,
        z:right[2]*nx-up[2]*ny-forward[2]*nz
      },axes=A.bodyAxes(earth.body),local={
        x:normal.x*axes.u.x+normal.y*axes.u.y+normal.z*axes.u.z,
        y:normal.x*axes.v.x+normal.y*axes.v.y+normal.z*axes.v.z,
        z:normal.x*axes.pole.x+normal.y*axes.pole.y+normal.z*axes.pole.z
      },latitude=Math.asin(clamp(local.z,-1,1))/DEG;
      let longitude=(Math.atan2(local.y,local.x)-A.rotationAt(earth.body,ms))/DEG;
      longitude=((longitude+540)%360)-180;return {latitude,longitude};
    }
    countryRingGeometry(ring){
      if(!Array.isArray(ring)||ring.length<4)return null;
      const cached=this.countryRingGeometryCache?.get(ring);if(cached)return cached;
      const points=[];let previous=null,minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
      for(const coordinate of ring){
        if(!Array.isArray(coordinate)||!Number.isFinite(coordinate[0])||!Number.isFinite(coordinate[1]))continue;
        let longitude=coordinate[0];if(previous!==null){while(longitude-previous>180)longitude-=360;while(longitude-previous<-180)longitude+=360;}
        const point=[longitude,coordinate[1]];points.push(point);previous=longitude;minX=Math.min(minX,longitude);maxX=Math.max(maxX,longitude);minY=Math.min(minY,coordinate[1]);maxY=Math.max(maxY,coordinate[1]);
      }
      const geometry=points.length>=4?{points,minX,maxX,minY,maxY,centerX:(minX+maxX)/2}:null;if(geometry)this.countryRingGeometryCache?.set(ring,geometry);return geometry;
    }
    countryRingContains(ring,longitude,latitude){
      const geometry=this.countryRingGeometry(ring);if(!geometry||latitude<geometry.minY||latitude>geometry.maxY)return false;
      let x=longitude;while(x-geometry.centerX>180)x-=360;while(x-geometry.centerX<-180)x+=360;
      if(x<geometry.minX||x>geometry.maxX)return false;
      const points=geometry.points;let inside=false;
      for(let i=0,j=points.length-1;i<points.length;j=i++){
        const a=points[i],b=points[j];
        if((a[1]>latitude)!==(b[1]>latitude)&&a[0]+(latitude-a[1])*(b[0]-a[0])/(b[1]-a[1])>x)inside=!inside;
      }
      return inside;
    }
    countryContains(code,longitude,latitude){
      const rings=this.countryBorders?.[code];if(!Array.isArray(rings))return false;
      // GeoJSON polygon holes have the opposite nesting level. Toggling every
      // containing ring preserves disjoint islands while excluding inland sea.
      let inside=false;for(const ring of rings)if(this.countryRingContains(ring,longitude,latitude))inside=!inside;return inside;
    }
    earthRegionHit(x,y,regions,ms){
      if(!this.earthRegionInteractionReady()||!this.countryBorders||!Array.isArray(regions)||![x,y,ms].every(Number.isFinite))return null;
      const earth=this.currentFrameItem('earth'),coordinate=this.earthSurfaceCoordinate(x,y,earth,ms);if(!coordinate)return null;
      for(const site of regions){
        if(!site||typeof site.id!=='string')continue;
        if(this.countryContains(site.code,coordinate.longitude,coordinate.latitude))return site;
      }
      return null;
    }
    setEarthRegionHover(site){
      const next=site&&typeof site.id==='string'?site:null;
      if(this.earthRegionHover?.id===(next?.id||null))return false;
      this.earthRegionHover=next;this.invalidatePresentation();return true;
    }
    setCountryBorders(data){
      if(!data||typeof data!=='object'||Array.isArray(data))return false;
      this.countryBorders=data;this.countryBorderCenters=new Map();this.countryRingGeometryCache=new WeakMap();this.invalidatePresentation();return true;
    }
    countryRingCenter(ring){
      if(!Array.isArray(ring)||ring.length<4)return null;
      const points=this.countryRingGeometry(ring)?.points||[];
      if(points.length<4)return null;let twiceArea=0,x=0,y=0;
      for(let i=0,j=points.length-1;i<points.length;j=i++){
        const a=points[j],b=points[i],cross=a[0]*b[1]-b[0]*a[1];twiceArea+=cross;x+=(a[0]+b[0])*cross;y+=(a[1]+b[1])*cross;
      }
      if(Math.abs(twiceArea)<1e-9)return null;
      return {longitude:((x/(3*twiceArea)+540)%360)-180,latitude:y/(3*twiceArea),area:Math.abs(twiceArea)};
    }
    countryRegionCenter(site){
      const code=site?.code;if(!code||!this.countryBorders)return null;
      if(this.countryBorderCenters?.has(code))return this.countryBorderCenters.get(code);
      let center=null;for(const ring of this.countryBorders[code]||[]){const candidate=this.countryRingCenter(ring);if(candidate&&(!center||candidate.area>center.area))center=candidate;}
      const result=center?{latitude:center.latitude,longitude:center.longitude}:null;this.countryBorderCenters?.set(code,result);return result;
    }
    earthRegionOutline(site,earth,ms){
      const rings=this.countryBorders?.[site?.code];if(!Array.isArray(rings)||!earth||earth.screen.behind||earth.r<=65||![ms,earth.screen.x,earth.screen.y,earth.r].every(Number.isFinite))return [];
      const lines=[],epsilon=.001,screen=normal=>({x:earth.screen.x+normal.x*earth.r,y:earth.screen.y+normal.y*earth.r}),limb=(a,b)=>{const t=clamp((epsilon-a.z)/(b.z-a.z),0,1),n={x:mix(a.x,b.x,t),y:mix(a.y,b.y,t),z:mix(a.z,b.z,t)},length=Math.hypot(n.x,n.y,n.z)||1;return screen({x:n.x/length,y:n.y/length,z:n.z/length});};
      for(const ring of rings){
        if(!Array.isArray(ring)||ring.length<2)continue;let previous=null,line=[];
        for(const coordinate of ring){
          if(!Array.isArray(coordinate)||coordinate.length<2)continue;
          const current=this.viewDirection(A.surfaceDirection(earth.body,coordinate[1],coordinate[0],ms)),visible=current.z>epsilon;
          if(previous){const priorVisible=previous.z>epsilon;if(priorVisible!==visible){line.push(limb(previous,current));if(line.length>1)lines.push(line);line=visible?[limb(previous,current)]:[];}if(visible)line.push(screen(current));}
          else if(visible)line.push(screen(current));previous=current;
        }
        if(line.length>1)lines.push(line);
      }
      return lines;
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
      const value=this.options.actualOrbitSpacing;return clamp(Number.isFinite(value)?value:0,0,1);
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
      const interval=this.ringTour?.state==='cruising'?60000:1000;
      if(this.physicsMs===ms&&this.physicsInterval===interval)return;
      this.physicsInterval=interval;
      // Interpolate only small presentation-time steps. Fast time travel,
      // seeks and initial/restored frames retain the exact ephemeris path.
      this.physicsInterpolate=Number.isFinite(this.physicsMs)&&Math.abs(ms-this.physicsMs)<=(this.ringTour?.state==='cruising'?60000:250);
      this.physicsMs=ms;this.physicsBodies.clear();this.physicsSatellites.clear();
    }
    samplePhysics(body,ms,satellite=false){
      const solve=t=>satellite?A.satelliteAt(body,t,1):A.positionAt(body,t);
      // Distant bodies in ring cruise need only coarse orbital samples. Reuse
      // this same interpolator; ESC restores the normal cadence immediately.
      const interval=this.ringTour?.state==='cruising'?60000:1000;
      const start=Math.floor(ms/interval)*interval,end=start+interval;
      if(!this.physicsInterpolate||A.ephemerisTier(start)!==A.ephemerisTier(end))return solve(ms);
      const cache=this.physicsSamples||(this.physicsSamples=new Map()),key=(satellite?'s:':'p:')+body.id;
      let sample=cache.get(key);
      if(!sample||sample.start!==start||sample.end!==end){
        const a=sample?.end===start?sample.b:solve(start),b=sample?.start===end?sample.a:solve(end);
        sample={start,end,a,b};cache.set(key,sample);
      }
      const t=(ms-start)/interval;
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
    viewportLayout() {
      const mobile=this.w<680,compact=this.h<630;
      const left=mobile?24:58,right=this.w-(mobile?24:58),top=compact?100:mobile?192:190,bottom=this.h-(compact?105:mobile?195:190);
      const baseY=(top+bottom)/2+this.h*VIEW.lowerBy,fitY=Math.max(80,2*Math.min(baseY-top,bottom-baseY));
      return {left,right,baseY,fitY};
    }
    rebuild(ms) {
      const pathKey=A.modelYear(ms)+':'+this.options.pluto;
      if(this.pathKey!==pathKey){this.paths=this.getBodies().map(body=>this.orbitPath(body,ms,360));this.pathKey=pathKey;}
      const {left,right,baseY,fitY}=this.viewportLayout();
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
      // Warp arrival starts at the particles' viewport-centred vanishing point.
      // Restore the normal layout and saved pan through the same camera progress.
      const arrival=this.cameraTween?.replay?.arrivalProgress;
      if(Number.isFinite(arrival)){
        this.centerX=mix(this.w*.5,this.centerX,arrival);
        this.centerY=mix(this.h*.5,this.centerY,arrival);
      }
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
      if(key==='actualScale')this.endRingTour();
      if(key==='dollyZoom')return this.setDollyMode(value,animate);
      if(key==='overviewOrbitGap'){
        const fallback=OVERVIEW_ORBIT.gap,numeric=Number(value);
        this.options.overviewOrbitGap=clamp(Math.round(Number.isFinite(numeric)?numeric:fallback),OVERVIEW_ORBIT.minGap,OVERVIEW_ORBIT.maxGap);
        this.dirty=true;return;
      }
      if(key==='actualOrbitSpacing'){
        const numeric=Number(value),target=clamp(Number.isFinite(numeric)?numeric:0,0,1),previous=this.actualOrbitSpacing(),mono=performance.now();
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
        else if(!animate){this.cloudRevealSeed=this.options.earthCloudSeed;this.cloudRevealStart=-Infinity;}
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
      this.cancelCameraMotion();this.shiftBackgroundForManualDolly(this.camera.dolly??1,next);this.camera.dolly=next;
      if(validTarget){this.camera.focus=focusId;if(anchored)Object.assign(this.camera,anchored);}
      this.cameraChangeAt=performance.now();this.dirty=true;
    }
    wheelTravelFactor(deltaY){return Math.exp(-clamp(deltaY,-120,120)*.0017);}
    shiftBackgroundForManualDolly(before,after) {
      // Reuse the preview's parallax only for manual travel, never cinematic motion.
      if(this.ringTour||!(before>0)||!(after>0)||!Number.isFinite(before+after)||before===after)return;
      if(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;
      const back=this.sky?.starAxes?.forward;if(!back)return;
      const field=this.manualBackgroundStars||(this.manualBackgroundStars={raw:[0,0,0],offset:[0,0,0]});
      const step=-2.2*Math.log(after/before);
      for(let i=0;i<3;i++)field.raw[i]+=back[i]*step;
      // Keep the observer inside the nearest layer even at the dolly limits.
      const length=Math.hypot(...field.raw),gain=length>1e-12?4*Math.tanh(length/4)/length:1;
      for(let i=0;i<3;i++)field.offset[i]=field.raw[i]*gain;
    }
    prepareCloseup(id) {this.gpu?.prefetchBody?.(id,window.SolarAssets?.materialInfo?.[id]?.width||SURFACE.detailWidth);}
    focusBody(id) {
      const to=this.focusState(id);if(!to)return;
      this.prepareCloseup(id);this.restoreCamera(to);
    }
    get zoomLimits() {return VIEW;}
    get saturnOpeningHandoffLead() {return PARTICLE_TRANSITION.boardingHold;}
    bodyVisibleRadius(body,r,{surface=false}={}) {
      if(surface&&body.id!=='saturn'&&body.id!=='uranus')return r+2;
      return r*(body.id==='sun'?5.1:body.id==='saturn'?2.3:body.id==='uranus'?2:1.3)+16;
    }
    visible(p,r=0) {return !p.behind&&p.x+r>=0&&p.x-r<=this.w&&p.y+r>=0&&p.y-r<=this.h;}

    cameraSnapshot() {return {...this.camera,mode:this.options.dollyZoom?'move':'zoom'};}
    defaultCameraSnapshot(ms=Number.isFinite(this.lastPathMs)?this.lastPathMs:Date.now()) {
      const state={...DEFAULT_CAMERA,mode:'move'};
      // Reuse the actual layout/projection on an isolated view. Measuring a
      // candidate must not replace the live camera, anchor or render caches.
      const view=Object.assign(Object.create(Renderer.prototype),{
        w:this.w||1280,h:this.h||800,camera:state,
        options:{pluto:true,...this.options},bodyScales:this.bodyScales||{},satelliteOrbitScales:this.satelliteOrbitScales||{},
        actualScaleMix:this.actualScaleMix||0,orbitSpacingTween:this.orbitSpacingTween,
        flightBank:this.flightBank||0,flightLook:null,projectionAnchor:null,trackingAnchor:null,cameraTween:null,
        paths:this.paths,pathKey:this.pathKey,fitKey:this.fitKey,overviewFitScale:this.overviewFitScale,
        precisionOrbitPathCache:new Map(this.precisionOrbitPathCache)
      });
      view.rebuild(ms);
      state.panY=clamp(DEFAULT_FRAME.sunYRatio-view.viewportLayout().baseY/view.h,VIEW.minPanY,VIEW.maxPanY);
      const orbit=view.paths.find(path=>path.body.id===DEFAULT_FRAME.body);
      // Orbit shape/clearance is independent of dolly: prepare it once, then
      // use the same perspective projection as drawing for each distance.
      const points=orbit.points.map(point=>view.displaySolarPoint(point,orbit.body));
      const measure=dolly=>{
        state.dolly=dolly;let min=Infinity,max=-Infinity;
        for(const point of points){
          const q=view.projectView(point);
          // A clipped orbit is not a valid fit; never silently drop its rim.
          if(q.behind||!Number.isFinite(q.x))return Infinity;
          min=Math.min(min,q.x);max=Math.max(max,q.x);
        }
        return (max-min)*view.fitScale*state.zoom*dolly/view.w;
      };
      let low=VIEW.minDolly,high=1;
      if(measure(low)>=DEFAULT_FRAME.widthRatio){state.dolly=low;return state;}
      while(high<VIEW.maxDolly&&measure(high)<DEFAULT_FRAME.widthRatio)high=Math.min(VIEW.maxDolly,high*2);
      for(let i=0;i<DEFAULT_FRAME.iterations;i++){
        const mid=Math.sqrt(low*high);
        if(measure(mid)>=DEFAULT_FRAME.widthRatio)high=mid;else low=mid;
      }
      state.dolly=low;return state;
    }
    openingCameraSnapshot(target=this.defaultCameraSnapshot(),randomSource=Math.random) {
      const destination=Renderer.validCamera(target)?target:this.defaultCameraSnapshot();
      const sample=()=>clamp(Number(randomSource?.())||0,0,1-Number.EPSILON);
      // Keep the destination lens unchanged and begin only with physical camera
      // travel from the distant opening pose, using the same tracked-camera
      // projection model as ordinary controls.
      return {...destination,azimuth:sample()*TAU,elevation:mix(-.85,.85,sample()),zoom:destination.zoom,dolly:OPENING_TIMING.departureDolly,focus:null,panX:0,panY:0};
    }
    openingCameraArc(randomSource=Math.random) {
      const sample=()=>clamp(Number(randomSource?.())||0,0,1-Number.EPSILON),angle=sample()*TAU,amplitude=mix(.06,.11,sample());
      return {x:Math.cos(angle)*amplitude,y:Math.sin(angle)*amplitude*.7,amplitude};
    }
    static savedCameraState(state) {
      if(!state||typeof state!=='object')return null;
      // Migrate the former 0.1× lens floor at the persistence boundary only.
      // Invalid camera data still fails validation; saved poses are not reset.
      const zoom=Number.isFinite(state.zoom)&&state.zoom>=.1?Math.max(VIEW.minZoom,state.zoom):state.zoom;
      const value={...state,zoom,dolly:state.dolly??1,mode:'move'};
      return Renderer.validCamera(value)?value:null;
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
      this.endRingTour();
      this.setReplaySolarOpacity(1);
      const mono=performance.now(),direction=this.rotationIntent,generation=this.autoRotation?.generation||this.pendingAutoRotation?.generation||this.rotationGeneration;
      // Bank belongs to the camera lineage, not to an individual transition.
      // The first camera after refresh establishes it (normally zero); every
      // restore/preset/opening keeps that same roll instead of re-leveling.
      this.cameraTween=null;this.flightBank=Number.isFinite(this.flightBank)?this.flightBank:0;this.flightLook=null;this.lookRelease=null;this.bankRelease=null;this.clearOpeningParticleFields();this.autoRotation=null;this.pendingAutoRotation=null;this.trackingAnchor=null;if(state.mode!==undefined)this.setDollyMode(state.mode==='move',false);
      // Commit one camera transaction. Time, selected body and display toggles are not preset data.
      this.camera={azimuth:state.azimuth,elevation:state.elevation,zoom:state.zoom,dolly:state.dolly??1,
        focus:state.focus,panX:state.panX,panY:state.panY};
      if(direction)this.beginAutoRotation(direction,mono,generation);
      this.cameraChangeAt=performance.now();this.dirty=true;this.clearLabels();this.invalidateSurfaces();return true;
    }
    // One monotonic-time transition owner, not a second requestAnimationFrame loop.
    // A retargeted focus transition retains its last rendered tracking anchor so
    // rapid planet navigation cannot restart from a different body position.
    animateCamera(state,mono=performance.now(),duration=1100,input=false,timing='smooth',tourReplay=false) {
      mono=this.animationMono(mono);
      if(!Renderer.validCamera(state)||!Number.isFinite(mono)||!Number.isFinite(duration))return false;
      if((SATELLITES.some(body=>body.id===state.focus)&&!this.options.moon)||(state.focus==='pluto'&&!this.options.pluto))return false;
      if(this.ringTour&&!tourReplay){
        // Home and saved views use this same exit; only the destination changes.
        // Do not dispose the tour or start an unrelated camera tween mid-flight.
        const tour=this.ringTour,target={...state,dolly:state.dolly??1,mode:state.mode||this.cameraSnapshot().mode};
        if(tour.replayBridge){tour.replayBridge=null;this.cancelCameraTween(mono);}
        if(!tour.returnTarget||Object.keys(target).some(key=>target[key]!==tour.returnTarget[key])){
          tour.returnTarget=target;tour.returnTargetApplied=false;
          if(target.focus)this.prepareCloseup(target.focus);
        }
        tour.stop();return true;
      }
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
      this.cameraTween={from,to,start:mono,duration,input,timing:resolvedTiming,openingPath,progress:0,fromAnchor:interruptedAnchor,bankFrom:this.flightBank||0};this.bankRelease=null;
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
      // Small/distant bodies keep 6.5s; a close-up (>=30% of the short edge) gets
      // 8.5s, with a smooth transition between 10% and 30% screen coverage.
      return Math.round(OPENING_TIMING.duration+OPENING_TIMING.closeupExtra*ease((coverage-.1)/.2));
    }
    animateOpeningCamera(state,mono=performance.now(),duration=this.openingCameraDuration(state)) {
      const animated=this.animateCamera(state,mono,duration,false,'opening');
      if(animated){this.scheduleOpeningAnnotations(mono,duration);if(this.cameraTween)this.startOpeningParticles(mono,duration);}
      return animated;
    }
    cameraTransitionPose(mono=performance.now(),anchor=this.trackingAnchor||this.currentFrameItem(this.camera.focus)?.world||{x:0,y:0,z:0}){
      const state=this.camera,eye=flightEye(state).map((v,i)=>v*DOLLY.baseDistance+anchor[['x','y','z'][i]]);
      const frame=cameraFrame(state,this.flightBank||0),view=this.bankedSkyCamera().viewAxes;
      const from={eye,
        forward:view?view.forward.map(v=>-v):frame.forward,
        right:view?view.right.map(v=>-v):frame.right.map(v=>-v),
        up:view?view.down.map(v=>-v):frame.up,
        bank:this.flightBank||0,look:this.flightLook||null};
      const rates=this.autoRotation?this.rotationRates(this.autoRotation.direction,this.autoRotation.generation):{yawRate:0,pitchRate:0};
      const ca=state.azimuth,ce=state.elevation,d=DOLLY.baseDistance/(state.dolly??1);
      let velocity=[d*(-Math.cos(ca)*Math.cos(ce)*rates.yawRate+Math.sin(ca)*Math.sin(ce)*rates.pitchRate),d*(Math.sin(ca)*Math.cos(ce)*rates.yawRate+Math.cos(ca)*Math.sin(ce)*rates.pitchRate),d*Math.cos(ce)*rates.pitchRate];
      const move=this.cameraTween;
      if(move&&mono>move.start&&mono<move.start+move.duration){
        const previous=this.cameraTweenState(move,clamp((mono-move.start-1)/move.duration,0,1)).state,now=flightEye(state),before=flightEye(previous);
        velocity=now.map((v,i)=>(v-before[i])*DOLLY.baseDistance/.001);
      }
      return {from,velocity};
    }
    warpDeparture(mono=performance.now()){
      const tour=this.ringTour,anchor=this.trackingAnchor||this.currentFrameItem(this.camera.focus)?.world||{x:0,y:0,z:0};
      if(tour?.projection){
        const {axes,saturn,units}=tour.projection;
        const {from,velocity}=tour.takeoffStart(),worldVelocity=frameVectorToWorld(axes,velocity);for(let i=0;i<3;i++)worldVelocity[i]*=units;
        return {from:{eye:framePointToWorld(axes,saturn,units,from.eye),forward:frameVectorToWorld(axes,from.forward),up:frameVectorToWorld(axes,from.up),right:frameVectorToWorld(axes,from.right),bankRate:from.bankRate,cruiseDeparture:true},velocity:worldVelocity};
      }
      return this.cameraTransitionPose(mono,anchor);
    }
    warpExitDirections(departure){
      const visible=(this.projected||[]).filter(p=>!p.screen.behind&&Number.isFinite(p.screen.x)&&Number.isFinite(p.screen.y));
      if(!visible.length)return null;
      const from=departure.from,right=this.ringTour?from.right:from.right.map(v=>-v),up=from.up;
      const sun=visible.find(p=>p.body.id==='sun');
      const center=sun?sun.screen:{x:visible.reduce((n,p)=>n+p.screen.x,0)/visible.length,y:visible.reduce((n,p)=>n+p.screen.y,0)/visible.length};
      const dx=center.x-this.w*.5,dy=center.y-this.h*.5;
      // The orbital plane's projected pole points across the narrow side of
      // the disc. Choose the side facing away from its screen position.
      let nx=right[2],ny=-up[2],length=Math.hypot(nx,ny);
      if(length<.1){nx=-dx;ny=-dy;length=Math.hypot(nx,ny);}
      if(length<1e-8){nx=0;ny=-1;length=1;}
      nx/=length;ny/=length;
      if(nx*dx+ny*dy>1e-6||(Math.abs(nx*dx+ny*dy)<=1e-6&&ny>0)){nx=-nx;ny=-ny;}
      const f=from.forward,viewRight=[up[1]*f[2]-up[2]*f[1],up[2]*f[0]-up[0]*f[2],up[0]*f[1]-up[1]*f[0]];
      return Array.from({length:8},(_,direction)=>{
        const angle=(direction%4)*Math.PI/4,side=direction<4?1:-1;
        const steering=up.map((v,i)=>side*(v*Math.cos(angle)+viewRight[i]*Math.sin(angle)));
        return {direction,score:nx*flightDot(steering,right)-ny*flightDot(steering,up)};
      }).sort((a,b)=>b.score-a.score).slice(0,3).map(p=>p.direction);
    }
    warpRingGeometry(departure=this.warpDeparture()){
      const scale=this.scale||this.fitScale*this.camera.zoom*(this.camera.dolly??1);
      const obstacles=(this.frameBodies||[]).map(p=>({center:[p.world.x,p.world.y,p.world.z],radius:this.bodyRadiusAtZoom(p.body)/scale}));
      // Our disc renderer clips by the body's centre. Before turning past a
      // nearby large limb, gently retreat so the whole disc can leave view.
      let clearance=0;
      // A ring flight already has forward momentum. A screen-size retreat
      // overwhelms that velocity near Saturn and makes takeoff accelerate back.
      // Keep its tangent; planWarp still rejects colliding swept paths.
      if(!this.ringTour)for(const p of this.frameBodies||[]){
        if(!(p.r>Math.min(this.w,this.h)*.3)||!this.visible(p.screen,p.r))continue;
        const distance=Math.hypot(...departure.from.eye.map((value,i)=>value-p.world[['x','y','z'][i]]));
        clearance=Math.max(clearance,distance*(p.r/(Math.min(this.w,this.h)*.25)-1));
      }
      const from=clearance>0?{...departure.from,retreat:departure.from.forward.map(value=>-value*clearance)}:departure.from;
      return window.SolarRingTour.planWarp(from,departure.velocity,obstacles,REPLAY_TRANSITION.departure/1000,Math.random,this.warpExitDirections(departure));
    }
    animateOpeningReplay(state,departure,mono=performance.now(),duration=this.openingCameraDuration(state)) {
      mono=this.animationMono(mono);
      if(!this.ringTour){this.advanceCamera(mono);this.advanceAutoRotate(mono);}
      const departurePose=this.warpDeparture(mono),ring=this.warpRingGeometry(departurePose),anchor=this.trackingAnchor||this.currentFrameItem(this.camera.focus)?.world||{x:0,y:0,z:0};
      if(!ring)return false;
      const tour=this.ringTour,outbound=REPLAY_TRANSITION.departure+REPLAY_TRANSITION.warp;
      const annotationIds=[null,'sun',...A.BODIES.map(body=>body.id),...SATELLITES.map(body=>body.id)];
      const departureAnnotations=tour?null:{
        labels:new Map(annotationIds.map(id=>[id,this.openingLabelOpacity(mono,id)])),
        orbits:new Map(annotationIds.map(id=>[id,this.openingOrbitOpacity(mono,id)]))};
      if(!this.animateCamera(state,mono,outbound+duration,false,'opening',!!tour))return false;
      const move=this.cameraTween,start=flightEye(move.from),turn=Math.floor(Math.random()*2);
      // Rebase only position. Orientation is the exact displayed departure
      // frame, including inherited bank; never rebuild it from Euler angles.
      const view={...departurePose.from,eye:start};
      const velocity=departurePose.velocity.map(v=>v/DOLLY.baseDistance);
      const path=window.SolarRingTour.warpPath(view,velocity,{...ring,retreat:ring.retreat?.map(value=>value/DOLLY.baseDistance),duration:REPLAY_TRANSITION.departure/1000,center:ring.center.map((v,i)=>(v-anchor[['x','y','z'][i]])/DOLLY.baseDistance),radius:ring.radius/DOLLY.baseDistance,speed:ring.speed/DOLLY.baseDistance});
      move.fromAnchor={...anchor};
      move.replay={path,ring,departureAnnotations,departure:{...departure},outbound,resetAt:Infinity,brakeAt:Infinity,particleAt:Infinity,clearSince:null,turn,inbound:duration};
      const steering=ring.viewTurnUp.map(v=>v*ring.side),screenRight=tour?departurePose.from.right:departurePose.from.right.map(v=>-v);
      move.replay.sceneSlide={direction:[-flightDot(steering,screenRight),flightDot(steering,departurePose.from.up)],
        camera:{...move.from},bank:this.flightBank,look:this.flightLook,anchor:{...anchor},distance:this.replaySceneDistance(steering,screenRight,departurePose.from.up)};
      if(tour){
        const axes=A.bodyAxes(A.BODIES.find(body=>body.id==='saturn'));
        const solarUp=[axes.u.z,axes.pole.z,axes.v.z];
        const saturn=this.currentFrameItem('saturn'),units=tour.worldUnits||this.bodyRadiusAtZoom(saturn.body)/this.scale;
        const local=v=>frameVectorToLocal(axes,v),retreat=ring.retreat?local(ring.retreat):undefined;
        if(retreat)for(let i=0;i<3;i++)retreat[i]/=units;
        const warp={...ring,retreat,duration:REPLAY_TRANSITION.departure/1000,center:framePointToLocal(axes,saturn.world,units,ring.center),normal:local(ring.normal),u:local(ring.u),entryForward:local(ring.entryForward),entryUp:local(ring.entryUp),viewUp:ring.viewUp?local(ring.viewUp):undefined,viewTurnUp:ring.viewTurnUp?local(ring.viewTurnUp):undefined,radius:ring.radius/units,speed:ring.speed/units};
        tour.startTakeoff(mono,Infinity,turn,solarUp,null,[],warp);
        tour.returnTarget=null;tour.returnTargetApplied=true;tour.annotationReveal=false;
      }
      move.replay.flightPath=tour?.replayBridge?.takeoff.path||path;
      move.replay.particleAt=REPLAY_TRANSITION.particleLead;
      this.scheduleOpeningAnnotations(mono+outbound,duration);
      this.openingOrbitStart=this.openingAnnotationStart=Infinity;
      this.startOpeningParticles(mono,move.duration);
      return true;
    }
    replayOpeningAt(path){return path.resetAt+REPLAY_TRANSITION.openingLead;}
    replaySceneDistance(steering,right,up){
      const dx=-flightDot(steering,right),dy=flightDot(steering,up);
      let distance=Math.max(this.w,this.h)*2;
      for(const item of this.projected||[]){
        const p=item.screen;if(!p||p.behind)continue;
        const radius=(item.r||0)*(item.body.id==='sun'?5.1:2.3)+24;
        const x=Math.abs(dx)<1e-8?Infinity:(dx>0?this.w+radius-p.x:p.x+radius)/Math.abs(dx);
        const y=Math.abs(dy)<1e-8?Infinity:(dy>0?this.h+radius-p.y:p.y+radius)/Math.abs(dy);
        if(Number.isFinite(Math.min(x,y)))distance=Math.max(distance,Math.min(x,y));
      }
      return distance;
    }
    replaySceneSlide(mono){
      const move=this.cameraTween,path=move?.replay,elapsed=move?this.animationMono(mono)-move.start:0;
      if(!path?.sceneSlide||elapsed>=path.resetAt)return null;
      const slide=path.sceneSlide,weight=ease(elapsed*(1.1*.75)/REPLAY_TRANSITION.departure);
      return {...slide,x:slide.direction[0]*slide.distance*weight,y:slide.direction[1]*slide.distance*weight};
    }
    replaySceneContext(slide,ms){
      if(!slide)return this;
      const scene=this.replayRenderContext||(this.replayRenderContext=Object.create(Renderer.prototype));
      const frameCache=scene.replayFrameCache||(scene.replayFrameCache=new Map());
      Object.assign(scene,this);scene.replayRenderContext=null;scene.replayFrameCache=frameCache;frameCache.clear();scene.frameCache=frameCache;
      scene.camera=slide.camera;scene.flightBank=slide.bank;scene.flightLook=slide.look;scene.trackingAnchor=slide.anchor;
      scene.basis=null;scene.bankSkyBasis=null;scene.bankSkyAxes=null;
      scene.rebuild(ms);scene.centerX+=slide.x;scene.centerY+=slide.y;scene.cx+=slide.x;scene.cy+=slide.y;
      return scene;
    }
    adoptReplayScene(scene){
      if(scene===this)return;
      for(const key of ['frameSerial','projected','presentationDirty','presentedResources','replayLayerStyle','openingPointReveal','openingParticles','lastLabelMono','lastSurfaceSubmit','lastSurfaceSimMs','lastSurfaceMono','coronaTexture','coronaBuild','coronaBuildKey'])this[key]=scene[key];
    }
    replaySkyCamera(camera,mono){
      const frame=this.replayPresentation(mono),path=this.cameraTween?.replay;
      return {...camera,transitionFov:frame.fov,replaySky:path?{...frame,from:path.skyFrom,clock:mono,carry:Math.max(0,(mono-this.cameraTween.start-path.resetAt)/1000)}:null};
    }
    openingReplayPose(move,elapsed){
      if(elapsed>=move.replay.resetAt){
        const path=move.replay,t=clamp((elapsed-this.replayOpeningAt(path))/path.inbound,0,1);
        // The sky remap already carries the outgoing orientation and momentum.
        // Keep the opening pose still during its lead, as before: steering it
        // toward a random arrival here adds a second, potentially large turn.
        return this.cameraTweenState({from:path.departure,to:move.to,timing:'opening',flyThrough:move.flyThrough,openingPath:move.openingPath},t);
      }
      const path=move.replay,seconds=replayFlightTime(elapsed/1000,Math.max(path.brakeAt/1000,path.ring.accelerationDuration||0)),pose=window.SolarRingTour.jumpPose(path.path,seconds),eye=window.SolarRingTour.warpSceneEye(path.path,seconds),distance=Math.max(.00001,Math.hypot(...eye)),p=ease(clamp(elapsed/7000,0,1));
      const state={...move.from,azimuth:A.wrap(Math.atan2(-eye[0],-eye[1])),elevation:Math.asin(clamp(eye[2]/distance,-1,1)),dolly:1/distance};
      const goalYaw=Math.atan2(pose.forward[0],pose.forward[1]),goalPitch=-Math.asin(clamp(pose.forward[2],-1,1));
      const yaw=move.from.azimuth+(A.wrap(goalYaw-move.from.azimuth+Math.PI)-Math.PI)*pose.look;
      const pitch=mix(move.from.elevation,goalPitch,pose.look);
      const look=elapsed<move.duration?this.flightLookForView(yaw,pitch,state,path.ring.virtual?pose:null):null;
      return {state,eye,look,progress:p};
    }
    replayPresentation(mono){
      mono=this.animationMono(mono);
      const move=this.cameraTween,path=move?.replay;
      const {warp,openingLead,skyFov}=REPLAY_TRANSITION,reset=warp-openingLead;
      const cache=this.replayPresentationCache||(this.replayPresentationCache={value:{solar:1,cover:0,reveal:false,fov:skyFov}});
      const brakeAt=path?.brakeAt,resetAt=path?.resetAt,inbound=path?.inbound;
      if(cache.mono===mono&&cache.move===move&&cache.path===path&&cache.start===move?.start&&cache.brakeAt===brakeAt&&cache.resetAt===resetAt&&cache.inbound===inbound&&cache.duration===move?.duration)return cache.value;
      cache.mono=mono;cache.move=move;cache.path=path;cache.start=move?.start;cache.brakeAt=brakeAt;cache.resetAt=resetAt;cache.inbound=inbound;cache.duration=move?.duration;
      const frame=cache.value;frame.cover=0;frame.reveal=false;frame.fov=skyFov;
      // Share the camera clock across CPU bodies, distant glows and GPU surfaces.
      const reveal=(elapsed,duration)=>ease(clamp(elapsed/Math.min(2000,duration),0,1));
      if(!path){frame.solar=move?.timing==='opening'?reveal(mono-move.start,move.duration):1;return frame;}
      const elapsed=mono-move.start,age=elapsed-path.brakeAt;
      if(age<0){frame.solar=1;return frame;}
      // One unchanged galaxy/star lens throughout warp and opening handoff.
      // Speed comes from the flight and particles, never background scaling.
      frame.solar=age<reset?0:reveal(elapsed-this.replayOpeningAt(path),path.inbound);frame.reveal=age>=reset;return frame;
    }
    prepareReplayFrame(mono){
      mono=this.animationMono(mono);
      const move=this.cameraTween,path=move?.replay;if(!path)return;
      // A stalled clearance test must not keep extending the journey forever.
      // Use the paused animation clock and the normal braking/arrival timeline.
      if(!Number.isFinite(path.resetAt)&&mono-move.start>=REPLAY_TRANSITION.maxDeparture)this.checkReplayClearance(mono,[]);
      // Keep only the arrival preview wanted while normal surface submissions pause.
      if(move.to?.focus&&this.replayPresentation(mono).solar<=0&&mono>=(path.arrivalPrefetchAt??-Infinity)){
        this.prepareCloseup(move.to.focus);path.arrivalPrefetchAt=mono+1000;
      }
      if(!Number.isFinite(path.resetAt))move.duration=Math.max(move.duration,mono-move.start+REPLAY_TRANSITION.warp+path.inbound);
      if(mono-move.start>=path.resetAt&&!path.skyCaptured)this.captureReplaySky(path);
      if(this.openingParticles?.replay===path)this.openingParticles.duration=move.duration;
    }
    captureReplaySky(path){
      if(path.skyCaptured||!this.sky?.canvas)return;
      path.skyFrom=this.sky.captureReplayBackground?.();
      path.skyCaptured=!!path.skyFrom;
    }
    checkReplayClearance(mono,bodies){
      mono=this.animationMono(mono);
      const move=this.cameraTween,path=move?.replay;
      if(!path||Number.isFinite(path.resetAt))return;
      const elapsed=mono-move.start;
      if(elapsed<path.particleAt){path.clearSince=null;return;}
      // Only resolvable bodies can delay hiding the scene: in true scale a
      // subpixel distant planet must not block a warp for an entire orbit.
      const visible=bodies.some(p=>!p.screen.behind&&p.r>=.5&&this.visible(p.screen,p.r*(p.body.id==='sun'?5.1:p.body.id==='saturn'?2.3:p.body.id==='uranus'?2:1.3)+24));
      const timedOut=elapsed>=REPLAY_TRANSITION.maxDeparture;
      if(!timedOut){
        if(visible){path.clearSince=null;return;}
        path.clearSince??=mono;if(mono-path.clearSince<REPLAY_TRANSITION.clearHold||elapsed<REPLAY_TRANSITION.departure)return;
      }
      path.clearanceTimedOut=timedOut;
      // The ring guides the approach; completing its docking is optional.
      path.brakeAt=elapsed;
      path.resetAt=path.brakeAt+REPLAY_TRANSITION.warp-REPLAY_TRANSITION.openingLead;path.outbound=this.replayOpeningAt(path);move.duration=path.outbound+path.inbound;
      if(this.ringTour?.replayBridge){
        this.ringTour.replayBridge.takeoff.brakeAt=path.brakeAt/1000;
        this.ringTour.returnDuration=path.resetAt/1000;
      }
      if(!move.flyThrough)this.scheduleOpeningAnnotations(move.start+this.replayOpeningAt(path),path.inbound);
      if(this.openingParticles?.replay===path)this.openingParticles.duration=move.duration;
    }
    setReplaySolarOpacity(alpha){
      const style=this.gpu?.canvas?.style;if(!style)return;
      // Planet surfaces stay fully opaque. During the particle-only part of a
      // replay, hide the layer as a binary scene state instead of fading the
      // entire WebGL canvas (which also made every planet translucent).
      if(alpha<1){
        this.replayLayerStyle||={opacity:style.opacity,transition:style.transition,visibility:style.visibility};
        style.transition='none';style.opacity='1';
        style.visibility=alpha>0?this.replayLayerStyle.visibility:'hidden';
      }else if(this.replayLayerStyle){
        const saved=this.replayLayerStyle;for(const key of ['opacity','transition','visibility']){
          if(saved[key]===undefined)delete style[key];else style[key]=saved[key];
        }
        this.replayLayerStyle=null;
      }
    }
    openingParticlePose(move,elapsed){
      const s=this.cameraTweenState(move,clamp(elapsed/move.duration,0,1)).state;
      const a=s.azimuth,e=s.elevation;
      const right=[Math.cos(a),-Math.sin(a),0],up=[Math.sin(a)*Math.sin(e),Math.cos(a)*Math.sin(e),Math.cos(e)];
      const forward=[Math.sin(a)*Math.cos(e),Math.cos(a)*Math.cos(e),-Math.sin(e)];
      const eye=flightEye(s).map((value,i)=>value+(-right[i]*s.panX+up[i]*s.panY)/Math.max(.00001,s.dolly));
      return {eye,right,up,forward};
    }
    replayDustSample(path,elapsed,field){
      if(path.saturnTour||path.saturnProfile)return this.saturnDustSample(path,elapsed,field);
      const active=Math.max(0,elapsed-path.particleAt)/1000;
      const acceleration=path.ring.accelerationDuration||REPLAY_TRANSITION.departure/1000;
      const peakAt=WARP_PARTICLES.peakAt/1000,rise=Math.min(acceleration,peakAt);
      const peak=REPLAY_TRANSITION.particleRate*1.5*WARP_PARTICLES.speed,u=clamp(active/rise,0,1);
      // The seven-second speed deadline is independent of camera clearance.
      // A delayed scene handoff must never restart or reposition the particles.
      const arrivalAt=(REPLAY_TRANSITION.departure+REPLAY_TRANSITION.warp)/1000;
      const settlingDuration=arrivalAt-peakAt,settling=clamp(active-peakAt,0,settlingDuration);
      const settled=settling/settlingDuration,brakeDuration=path.inbound/1000;
      const braking=clamp(active-arrivalAt,0,brakeDuration),v=braking/brakeDuration;
      const arrivalPeak=REPLAY_TRANSITION.particleRate*1.5*WARP_PARTICLES.arrivalSpeed;
      // Integrate the same smooth velocity curves, keeping both position and
      // speed continuous as the peak falls to arrival and a persistent drift.
      field.travel=peak*(rise*easeIntegral(u)+clamp(active-rise,0,peakAt-rise))
        +peak*settling+(arrivalPeak-peak)*settlingDuration*easeIntegral(settled)
        +arrivalPeak*braking+(WARP_PARTICLES.arrivalDrift-arrivalPeak)*brakeDuration*easeIntegral(v)
        +WARP_PARTICLES.arrivalDrift*Math.max(0,active-arrivalAt-brakeDuration);
      field.velocity=active<=peakAt?peak*ease(u):active<arrivalAt?
        mix(peak,arrivalPeak,ease(settled)):mix(arrivalPeak,WARP_PARTICLES.arrivalDrift,ease(v));
      // Appearance and acceleration begin together, with no stationary hold.
      field.formation=ease(active/(WARP_PARTICLES.appear/1000));
      // Entrance is shared; each grain contracts independently on arrival.
      const loop=ease((elapsed-path.brakeAt)/WARP_PARTICLES.blend);
      field.tailScale=WARP_PARTICLES.tail*mix(WARP_PARTICLES.edgeTail,1,loop);
      // Forward particle travel is separate from the scene's parallax path.
      // Warp rotation is applied below through the SAME displayed sky axes.
      if(path.openingMove||Number.isFinite(path.ring.viewTurnAngle)){field.headingX=field.headingY=field.flowX=field.flowY=field.bendX=field.bendY=0;return;}
      const flight=path.flightPath||path.path;
      const seconds=path.openingMove?Math.min(elapsed,this.replayOpeningAt(path)+path.inbound-20)/1000:replayFlightTime(elapsed/1000,Math.max(path.brakeAt/1000,acceleration));
      const sample=time=>path.openingMove?this.openingParticlePose(path.openingMove,time*1000-this.replayOpeningAt(path)):window.SolarRingTour.jumpPose(flight,time);
      const pose=sample(seconds);
      // Normal-view virtual warp is displayed through flightLookForView,
      // which reverses the transported right axis. Ring travel uses it as-is.
      const screenRight=!path.openingMove&&path.ring.virtual&&flight===path.path?pose.right.map(v=>-v):pose.right;
      // Measure travel in the transported camera frame, including bank.
      // A rising camera must pass the grains downward, and vice versa.
      const next=sample(seconds+.02);
      const delta=next.eye.map((value,i)=>value-pose.eye[i]);
      const direction=Math.hypot(...delta)>1e-12?flightUnit(delta):pose.forward;
      const forward=Math.max(.25,Math.abs(flightDot(direction,pose.forward)));
      field.headingX=clamp(flightDot(direction,screenRight)/forward,-2,2);
      field.headingY=clamp(-flightDot(direction,pose.up)/forward,-2,2);
      // No screen-space destination drift or look-ahead bend: neither is
      // actual camera translation, and both used to drag the entire field.
      field.flowX=field.flowY=field.bendX=field.bendY=0;
    }
    replayDustMotion(path,elapsed,field){
      this.replayDustSample(path,elapsed,field);
      if(path.saturnTour||path.saturnProfile){field.distance=field.travel;field.lateralX=field.lateralY=0;return;}
      const start=path.openingMove?this.replayOpeningAt(path):0;
      // Integrate direction against distance, never reapply the latest
      // heading to distance already travelled. Fixed samples make this
      // independent of frame rate, pauses and out-of-order preview queries.
      let motion=field.motion;
      if(!motion||motion.path!==path||motion.brake!==path.brakeAt){
        const first={time:start,x:0,y:0};this.replayDustSample(path,start,first);
        motion=field.motion={path,brake:path.brakeAt,rows:[first]};
      }
      const rows=motion.rows,integrate=(a,b)=>{
        const d=b.travel-a.travel;
        b.x=a.x+d*(a.headingX+b.headingX)*.5;
        b.y=a.y+d*(a.headingY+b.headingY)*.5;return b;
      };
      while(rows[rows.length-1].time+50<=elapsed){
        const prior=rows[rows.length-1],next={time:prior.time+50};
        this.replayDustSample(path,next.time,next);rows.push(integrate(prior,next));
      }
      const index=Math.max(0,Math.min(rows.length-1,Math.floor((elapsed-start)/50)));
      const end=integrate(rows[index],{travel:field.travel,headingX:field.headingX,headingY:field.headingY});
      field.distance=field.travel-rows[0].travel;field.lateralX=end.x;field.lateralY=end.y;
    }
    openingParticleLateral(field,distance){
      const rows=field.motion?.rows;if(!rows||distance<=0)return {x:0,y:0};
      const travel=distance+rows[0].travel;let low=0,high=rows.length-1;
      while(low<high){const mid=Math.ceil((low+high)/2);if(rows[mid].travel<=travel)low=mid;else high=mid-1;}
      const a=rows[low],b=rows[low+1]||{travel:field.travel,x:field.lateralX,y:field.lateralY};
      const u=clamp((travel-a.travel)/Math.max(1e-12,b.travel-a.travel),0,1);
      return {x:mix(a.x,b.x,u),y:mix(a.y,b.y,u)};
    }
    flightLookForView(yaw,pitch,state=this.camera,frame=null){
      // Blend in WORLD view angles. The local transform is relative to the
      // inherited banked camera, not an artificial zero-roll Euler frame.
      // Otherwise a preserved baseline bank is applied twice at handoffs.
      const base=state===this.camera?this.cameraBasis():cameraFrame(state,this.flightBank||0),target=frame||cameraFrame({azimuth:yaw,elevation:pitch},this.flightBank||0);
      const view=[frame?target.right.map(v=>-v):target.right,target.up,target.forward],local=view.map(axis=>[base.right,base.up,base.forward].map(v=>flightDot(axis,v)));
      return {yaw,pitch,world:true,right:local[0],up:local[1],forward:local[2]};
    }
    flightLookAt(yaw,pitch){
      const c=Math.cos(yaw),s=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
      return {yaw,pitch,right:[c,0,-s],up:[-s*sp,cp,-c*sp],forward:[s*cp,sp,c*cp]};
    }
    // Shared grain generator. Opening and Saturn entry select one reviewed
    // presentation profile; warp keeps its existing presentation.
    flightParticleStyle(rand) {
      const size=1.8+rand()*2.8,glow=.8+rand()*1.8,variant=rand();
      // Keep the same random-call count and particle budgets. Small grains
      // dominate; glints and tiny multi-speck sprites add variety sparingly.
      const choice=variant<.7?variant/.7*8:variant<.9?8+(variant-.7)/.2*4:12+(variant-.9)/.1*4,tile=Math.min(15,Math.floor(choice));
      return {size,glow,tile,rotation:(choice-tile)*TAU,color:Math.min(3,Math.floor(variant*6)),life:1000+rand()*4000};
    }
    loadFlightParticleAtlas(){
      if(this.flightParticleImage||typeof Image!=='function')return;
      const image=this.flightParticleImage=new Image();image.decoding='async';
      image.onload=()=>{
        if(this.flightParticleImage!==image||image.naturalWidth!==512||image.naturalHeight!==512)return;
        this.openingParticleSprite=image;this.invalidatePresentation(1000);
      };
      // The cached procedural sprite remains available on failure/offline.
      image.onerror=()=>{};image.src='assets/effects/flight-particles-atlas-v1.webp';
    }
    releaseFlightParticleAtlas(){
      if(this.flightParticleImage)this.flightParticleImage.onload=this.flightParticleImage.onerror=null;
      this.flightParticleImage=null;this.openingParticleSprite=null;this.saturnEntrySprite=null;
    }
    animationMono(mono=performance.now()){return this.animationPaused?this.animationPauseAt:mono;}
    shiftAnimationTime(delay){
      const seen=new Map();
      const shift=(object,keys)=>{
        if(!object)return;
        let shifted=seen.get(object);if(!shifted){shifted=new Set();seen.set(object,shifted);}
        for(const key of keys){
          const time=object[key];if(shifted.has(key)||!Number.isFinite(time)||Math.abs(time)>1e15)continue;
          shifted.add(key);object[key]=time+delay;
        }
      };
      for(const {path,keys} of ANIMATION_TIMESTAMPS){
        let object=this;for(const key of path)object=object?.[key];if(!object)continue;
        shift(object,keys);
      }
      for(const field of this.particleLifecycle().fields()){
        shift(field,['start','exitAt']);shift(field.replay?.openingMove,['start']);
      }
    }
    setAnimationPaused(paused,mono=performance.now()){
      if(!Number.isFinite(mono))return 0;
      paused=!!paused;if(paused===!!this.animationPaused)return 0;
      if(this.ringTour)this.ringTour.animationPaused=paused;
      if(paused){this.animationPaused=true;this.animationPauseAt=mono;this.dirty=true;return 0;}
      const delay=Math.max(0,mono-this.animationPauseAt);this.shiftAnimationTime(delay);
      this.animationPaused=false;this.animationPauseAt=null;this.dirty=true;return delay;
    }
    updateTravelParticleBudget(mono){
      const target=window.SolarPerformance?.particleBudget?.(this.options.quality)??1;
      const state=this.travelParticleBudget||(this.travelParticleBudget={value:target,mono});
      const dt=clamp((mono-state.mono)/1000,0,.1);state.mono=mono;
      const step=dt*(target<state.value?.25:.1);
      state.value+=clamp(target-state.value,-step,step);return state.value;
    }
    startOpeningParticles(mono,duration) {
      mono=this.animationMono(mono);
      const previous=this.openingParticles;
      if(previous)this.retireOpeningParticleField(previous,mono);
      const move=this.cameraTween;
      if(!move)return;
      if(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches){this.clearOpeningParticleFields();return;}
      // Boot keeps the existing opening camera timeline. Its shared particle
      // profile receives a separate local clock below.
      const offset=move.replay?0:REPLAY_TRANSITION.departure+REPLAY_TRANSITION.warp;
      const replay=move.replay||(move.timing==='opening'?{openingMove:move,
        ring:{accelerationDuration:REPLAY_TRANSITION.departure/1000},particleAt:0,
        brakeAt:REPLAY_TRANSITION.departure,resetAt:offset-REPLAY_TRANSITION.openingLead,inbound:duration}:null);
      if(!replay)return;
      this.createOpeningParticleField(mono,duration,replay,offset,!!replay.openingMove);
    }
    createOpeningParticleField(mono,duration,replay,offset=0,openingStyle=false) {
      const particleSeed=Math.floor(Math.random()*4294967296)>>>0,rand=random(particleSeed);
      const budget=this.options.quality==='low'?320:Math.min(this.w,this.h)<600?520:960;
      const capacity=window.SolarPerformance?.particleCapacity?.(this.options.quality)??1;
      const count=Math.floor(budget*capacity*(openingStyle?.9:1));
      // One fixed pool for the entire T journey. Depths are staggered so the
      // loop cannot pulse; a grain wraps only after it has left the view.
      const points=Array.from({length:count},(_,i)=>{
        const angle=rand()*TAU,radius=.07+Math.pow(rand(),.65)*2.2;
        return {...this.flightParticleStyle(rand),x:Math.cos(angle)*radius,y:Math.sin(angle)*radius,
          depth:.04+(i+rand())/count*REPLAY_TRANSITION.particleDepth,
          speed:.65+rand()*.7,stretch:.55+rand()*1.2,brightness:.45+rand()*.55,
          formationAt:rand()*.35,retirePhase:rand(),edgeKeep:i%2===0,earlyKeep:i%2===0&&(i/2*37)%(count/2)<200};
      });
      for(const p of points){
        p.sizeScale=openingStyle?(1.5+rand()*1.3)*1.1:1+rand();
        p.haloAlpha=.045+.035*clamp(((p.glow??.8)-.8)/1.8,0,1);
      }
      const field=this.openingParticles={capacity,particleSeed,start:mono-offset,duration:duration+offset,replay,points,projected:{},exitAt:null,elapsed:offset,alpha:0};
      this.invalidatePresentation(duration,mono);
      return field;
    }
    applySaturnEntryParticleProfile(field,seed=(field?.particleSeed||0)^0x444f5542) {
      if(!field||field.particleProfile==='saturn-entry')return field;
      field.particleProfile='saturn-entry';field.particleProfileOrigin=field.elapsed||0;
      field.particleProfileBrakeAt=(window.SolarRingTour?.settings?.entry||10)*1000;
      field.particlePath=field.replay.saturnTour?field.replay:{saturnProfile:true,
        ring:{accelerationDuration:field.particleProfileBrakeAt/1000},particleAt:0,
        brakeAt:field.particleProfileBrakeAt,resetAt:Infinity,inbound:5000};
      field.saturnBirths=new Map();
      // Saturn's visible entry cohort is half the base pool plus two matching
      // cohorts. The ordinary opening retains its own reviewed presentation.
      field.saturnDrawPoints=field.points.filter(p=>p.edgeKeep!==false);
      const entryRandom=random(seed>>>0),baseEntry=field.saturnDrawPoints;
      const added=baseEntry.length?Array.from({length:baseEntry.length*SATURN_APPEAR.extraCohorts},(_,i)=>{
        const p=baseEntry[i%baseEntry.length],style=this.flightParticleStyle(entryRandom);
        return {...p,...style,retirePhase:entryRandom(),haloAlpha:.045+.035*clamp((style.glow-.8)/1.8,0,1),
          saturnAddedAt:entryRandom()*600};
      }):[];
      field.points.push(...added);field.saturnDrawPoints.push(...added);
      field.saturnLoopKeep=new Set(field.saturnDrawPoints);
      field.saturnFadeRetire=new Set([...field.saturnLoopKeep].filter((_,i)=>i%10<3));
      return field;
    }
    fadeOpeningParticleField(mono=performance.now(),duration=PARTICLE_TRANSITION.finalFade,field=this.openingParticles) {
      mono=this.animationMono(mono);
      if(!field||field.exitAt!==null)return false;
      field.exitAt=mono;field.exitElapsed=field.elapsed;field.exitBaseAlpha=Math.max(0,Number(field.alpha)||0);field.fadeDuration=Math.max(1,duration);
      this.invalidatePresentation(field.fadeDuration,mono);return true;
    }
    retireOpeningParticleField(field=this.openingParticles,mono=performance.now(),duration=PARTICLE_TRANSITION.finalFade) {
      if(!field)return false;
      // An opening held for Saturn deliberately bypasses its normal arrival
      // fade. Preserve that exact envelope while the independent per-grain
      // retirement runs; re-enabling the old arrival fade here erased the
      // complete source layer on the handoff frame.
      field.holdExitEnvelope=!!field.awaitingSaturn;
      field.awaitingSaturn=false;this.fadeOpeningParticleField(mono,duration,field);
      this.particleLifecycle().retire(field);return true;
    }
    clearOpeningParticleField(field=this.openingParticles) {
      if(!field)return false;
      field.points.length=0;if(field.saturnDrawPoints&&field.saturnDrawPoints!==field.points)field.saturnDrawPoints.length=0;
      field.saturnBirths?.clear();field.saturnLoopKeep?.clear();field.saturnFadeRetire?.clear();
      if(field.cameraFrames)field.cameraFrames.length=0;
      if(field.saturnProjected)field.saturnProjected.length=0;
      field.handoff=null;field.motionCarry=null;field.particlePath=null;field.saturnLoopShape=null;field.saturnVolume=null;field.holdExitEnvelope=false;field.alpha=0;
      this.particleLifecycle().remove(field);
      return true;
    }
    clearOpeningParticleFields() {
      return this.particleLifecycle().clear(field=>this.clearOpeningParticleField(field));
    }
    keepOpeningParticlesUntilBoarding() {
      const field=this.openingParticles;
      if(!field?.replay||field.exitAt!==null)return false;
      // The incoming opening owns its normal projector until Saturn starts.
      field.awaitingSaturn=true;return true;
    }
    startSaturnParticles(tour,mono,fromOpening=false) {
      if(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches){this.clearOpeningParticleFields();return false;}
      const previous=fromOpening?this.openingParticles:null;
      const inherited=previous?.replay&&previous.exitAt===null&&previous.cameraFrames?.length&&Number.isFinite(previous.distance);
      const motionCarry=inherited?{at:0,distance:previous.distance,velocity:previous.velocity,tailScale:previous.tailScale}:null;
      const entry=window.SolarRingTour.settings.entry*1000;
      // Motion may inherit the source velocity, but a destination field always
      // owns a fresh local lifetime. Reusing the opening age made the complete
      // Saturn cohort appear in one frame because every birth was already due.
      const replay={saturnTour:tour,ring:{accelerationDuration:entry/1000},
        particleAt:0,brakeAt:entry,resetAt:Infinity,inbound:5000};
      // The source keeps its own projector and fades as an independent layer.
      // Never copy visible grains into the destination coordinate system.
      if(previous)this.retireOpeningParticleField(previous,mono);
      const field=this.createOpeningParticleField(mono,entry+SATURN_APPEAR.linger,replay);
      field.motionCarry=motionCarry;
      this.applySaturnEntryParticleProfile(field,(tour.seed||0)^0x444f5542);tour.usesWarpParticles=true;
      return true;
    }
    saturnParticleTime(field,mono) {
      // Travel age is the field lifetime. Source motion is inherited separately.
      return Math.max(0,field.replay.saturnTour.age||0)*1000;
    }
    saturnDustSample(path,elapsed,field) {
      // The Saturn entry profile owns one ten-second acceleration envelope.
      const entry=Math.max(.001,path.ring?.accelerationDuration||path.brakeAt/1000),t=Math.max(0,elapsed)/1000;
      const peak=REPLAY_TRANSITION.particleRate*1.5*WARP_PARTICLES.speed;
      const out=this.replayOpeningAt(path)/1000,active=Math.min(t,out),u=clamp(active/entry,0,1);
      const base=peak*(entry*easeIntegral(u)+Math.max(0,active-entry));
      const incoming=peak*ease(u),exit=Math.max(0,t-out),duration=path.inbound/1000,v=clamp(exit/duration,0,1);
      // The same smooth velocity integral as warp: ramp, indefinite cruise,
      // then decelerate to opening drift. Early exits inherit their actual speed.
      field.travel=base+incoming*Math.min(exit,duration)+(WARP_PARTICLES.arrivalDrift-incoming)*duration*easeIntegral(v)
        +WARP_PARTICLES.arrivalDrift*Math.max(0,exit-duration);
      field.velocity=mix(incoming,WARP_PARTICLES.arrivalDrift,ease(v));
      field.formation=ease(t/(WARP_PARTICLES.appear/1000));
      field.tailScale=WARP_PARTICLES.tail*mix(WARP_PARTICLES.edgeTail,1,ease((elapsed-path.brakeAt)/WARP_PARTICLES.blend));
      if(field.motionCarry){
        const c=field.motionCarry,seconds=Math.max(0,elapsed-c.at)/1000;
        const duration=(path.brakeAt-c.at)/1000,u=clamp(seconds/duration,0,1);
        field.travel=c.distance+c.velocity*seconds+(peak-c.velocity)*(duration*easeIntegral(u)+Math.max(0,seconds-duration));
        field.velocity=mix(c.velocity,peak,ease(u));field.formation=1;
        field.tailScale=mix(c.tailScale,field.tailScale,ease((elapsed-c.at)/WARP_PARTICLES.blend));
      }
      field.headingX=field.headingY=field.flowX=field.flowY=field.bendX=field.bendY=0;
      return field;
    }
    saturnOpeningParticleFrame(mono=performance.now(),field=this.openingParticles) {
      mono=this.animationMono(mono);
      if(!field)return null;
      const path=field.replay,tour=path.saturnTour;
      // Keep the entry field alive for a short afterglow after landing. A
      // return or replacement uses the same soft exit as every other flight.
      // Leave usesWarpParticles set so the old ring-particle fallback stays off.
      // Ordinary T warp/opening fields do not have a saturnTour and are unchanged.
      const particleTime=tour?this.saturnParticleTime(field,mono):0;
      const landed=tour?.state==='cruising'&&particleTime>=path.brakeAt+SATURN_APPEAR.linger;
      const retiring=tour&&(tour!==this.ringTour||tour.disposed||tour.state==='returning'||tour.state==='complete');
      if(retiring)this.fadeOpeningParticleField(mono,PARTICLE_TRANSITION.finalFade,field);
      const elapsed=path.saturnTour?particleTime:Math.max(0,mono-field.start);
      if(field.awaitingSaturn&&!this.cameraTween?.flyThrough)field.awaitingSaturn=false;
      // Retirement keeps the layer brightness stable. Individual grains own
      // staggered fades in particleRetirementAlpha(), so a handoff never dims
      // the complete field like a single light switch.
      const exitAge=field.exitAt===null?0:Math.max(0,mono-field.exitAt);
      field.exitAge=exitAge;
      const end=this.replayOpeningAt(path)+(path.openingMove?path.inbound+WARP_PARTICLES.afterglow:Math.max(0,path.inbound-WARP_PARTICLES.exitLead));
      if((field.exitAt===null&&(landed||(!field.awaitingSaturn&&!field.handoffOnly&&elapsed>=end)))
        ||(field.exitAt!==null&&exitAge>=field.fadeDuration)){this.clearOpeningParticleField(field);return null;}
      field.elapsed=elapsed;this.replayDustMotion(path,elapsed,field);
      if(path.saturnTour){
        // Entry particles only need the current pose for solid-body occlusion.
        const shape=field.saturnLoopShape||(field.saturnLoopShape={});shape.pose=tour.pose;
      }
      if(this.sky?.starAxes){
        const rows=field.cameraFrames||(field.cameraFrames=[]),last=rows[rows.length-1];
        if(!last||elapsed>last.time){
          const axes=this.sky.starAxes,delta=last?field.distance-last.distance:0;
          const position=last?last.position.map((x,i)=>x-delta*(last.axes.forward[i]+axes.forward[i])*.5):[0,0,0];
          rows.push({time:elapsed,distance:field.distance,axes,position});
        }
        if(path.saturnTour){
          // Cruise can last indefinitely. A complete depth cycle needs at
          // most 1/.65 distance; keep 2.5 plus a bracketing frame, not all laps.
          let first=0;while(first+2<rows.length&&rows[first+1].distance<field.distance-2.5)first++;
          if(first)rows.splice(0,first);
        }
      }
      const baseAlpha=this.replayParticleAlpha(elapsed,path,field.velocity);
      field.alpha=field.exitAt===null?baseAlpha:field.exitBaseAlpha;
      if(tour)this.prepareSaturnEntryVolume(field);
      return field;
    }
    openingParticleFrame(mono=performance.now(),field=this.openingParticles) {
      return field?.replay?.saturnTour?this.saturnOpeningParticleFrame(mono,field):this.ordinaryOpeningParticleFrame(mono,field);
    }
    ordinaryOpeningParticleFrame(mono=performance.now(),field=this.openingParticles) {
      mono=this.animationMono(mono);
      if(!field)return null;
      const elapsed=Math.max(0,mono-field.start),path=field.replay;
      if(field.awaitingSaturn&&!this.cameraTween?.flyThrough)field.awaitingSaturn=false;
      const exitAge=field.exitAt===null?0:Math.max(0,mono-field.exitAt);
      field.exitAge=exitAge;
      const end=this.replayOpeningAt(path)+(path.openingMove?path.inbound+WARP_PARTICLES.afterglow:Math.max(0,path.inbound-WARP_PARTICLES.exitLead));
      if((field.exitAt===null&&!field.awaitingSaturn&&elapsed>=end)
        ||(field.exitAt!==null&&exitAge>=field.fadeDuration)){this.clearOpeningParticleField(field);return null;}
      field.elapsed=elapsed;
      const particleElapsed=this.particleFieldElapsed(field),particlePath=this.particleFieldPath(field);
      this.replayDustMotion(particlePath,particleElapsed,field);
      if(this.sky?.starAxes){
        const rows=field.cameraFrames||(field.cameraFrames=[]),last=rows[rows.length-1];
        if(!last||particleElapsed>last.time){
          const axes=this.sky.starAxes,delta=last?field.distance-last.distance:0;
          const position=last?last.position.map((x,i)=>x-delta*(last.axes.forward[i]+axes.forward[i])*.5):[0,0,0];
          rows.push({time:particleElapsed,distance:field.distance,axes,position});
        }
      }
      const finish=field.awaitingSaturn?1:1-ease((elapsed-(end-PARTICLE_TRANSITION.finalFade))/PARTICLE_TRANSITION.finalFade);
      const baseAlpha=this.replayParticleAlpha(particleElapsed,particlePath,field.velocity)*finish;
      field.alpha=field.exitAt===null?baseAlpha:field.exitBaseAlpha;
      return field;
    }
    particleRetirementAlpha(p,field) {
      if(field.exitAt===null)return 1;
      const duration=Math.max(1,field.fadeDuration||PARTICLE_TRANSITION.finalFade);
      const progress=clamp((field.exitAge||0)/duration,0,1);
      // Fixed per-grain phases make the same particle fade consistently at
      // every frame rate. The first grains begin immediately, while the last
      // retain full brightness through 40% of the shared retirement window.
      const phase=clamp(Number.isFinite(p.retirePhase)?p.retirePhase:
        ((Number(p.rotation)||0)%TAU+TAU)%TAU/TAU,0,1);
      const delay=phase*.4;
      return 1-ease((progress-delay)/Math.max(.001,1-delay));
    }
    prepareSaturnEntryVolume(field){
      const rows=field.cameraFrames,current=rows?.[rows.length-1];if(!current)return;
      // A straight, birth-facing tunnel misses a turning camera. Use a small
      // world-space volume instead: existing points stay fixed, only fully
      // faded outer-boundary points recycle. No left/right camera offset.
      const axes=current.axes,scale=4,half=3;
      const focal=this.h/(2*(this.sky?.starTanFov||Math.tan(REPLAY_TRANSITION.skyFov*DEG/2)));
      let volume=field.saturnVolume;
      const eye=volume?.nextEye||[0,0,0];for(let i=0;i<3;i++)eye[i]=current.position[i]*scale;
      if(!volume){
        const rand=random(((field.replay.saturnTour?.seed??field.particleSeed??0)^0x454e5452)>>>0),points=new Map();
        for(const p of field.points)points.set(p,{world:eye.map(v=>v+(rand()*2-1)*half)});
        volume=field.saturnVolume={points,eye,nextEye:[0,0,0],axes,time:field.elapsed,started:field.elapsed,focal};
      }
      if(volume.time!==field.elapsed){
        volume.previousEye=volume.eye;volume.previousAxes=volume.axes;
        volume.previousFocal=volume.focal;volume.previousTime=volume.time;
        volume.eye=eye;volume.nextEye=volume.previousEye;volume.axes=axes;volume.time=field.elapsed;volume.focal=focal;
      }
      const width=half*2;
      for(const p of field.saturnDrawPoints||field.points){
        const point=volume.points.get(p);
        for(let i=0;i<3;i++){
          const d=point.world[i]-volume.eye[i];
          if(d< -half||d>half)point.world[i]=volume.eye[i]+((d+half)%width+width)%width-half;
        }
      }
    }
    projectSaturnEntryVolume(p,field,shutter,out){
      const v=field.saturnVolume,point=v.points.get(p),axes=v.axes;
      const dx=point.world[0]-v.eye[0],dy=point.world[1]-v.eye[1],dz=point.world[2]-v.eye[2];
      const x=dx*axes.right[0]+dy*axes.right[1]+dz*axes.right[2];
      const y=dx*axes.down[0]+dy*axes.down[1]+dz*axes.down[2];
      const z=-(dx*axes.forward[0]+dy*axes.forward[1]+dz*axes.forward[2]),near=Math.max(.04,z);
      out.x=this.w*.5+v.focal*x/near;out.y=this.h*.5+v.focal*y/near;out.cameraDepth=z;
      const boundary=1-ease((Math.max(Math.abs(dx),Math.abs(dy),Math.abs(dz))-2.1)/.9);
      // Initial appearance already belongs to saturnEntryAppearance(). Restarting
      // the full one-second reveal on every volume wrap made fast late-entry
      // grains recycle again before becoming visible.
      out.saturnVolumeAlpha=boundary;
      out.tail=0;out.angle=0;
      const dt=(v.time-v.previousTime)/1000;
      if(dt>0&&v.previousAxes){
        const a=v.previousAxes,px=point.world[0]-v.previousEye[0],py=point.world[1]-v.previousEye[1],pz=point.world[2]-v.previousEye[2];
        const depth=-(px*a.forward[0]+py*a.forward[1]+pz*a.forward[2]);
        if(depth>.04){
          const tx=this.w*.5+v.previousFocal*(px*a.right[0]+py*a.right[1]+pz*a.right[2])/depth;
          const ty=this.h*.5+v.previousFocal*(px*a.down[0]+py*a.down[1]+pz*a.down[2])/depth;
          const mx=out.x-tx,my=out.y-ty;
          out.tail=Math.hypot(mx,my)*Math.min(2,shutter/dt);out.angle=Math.atan2(my,mx);
        }
      }
    }
    saturnParticleOccluded(x,y,depth,pose){
      if(!(depth>.012))return true;
      const f=this.h/(2*Math.tan(pose.fov*Math.PI/360));
      const nx=(x-this.w*.5)/f-pose.offset[0],ny=(this.h*.5-y)/f-pose.offset[1];
      const perspective=pose.perspective,c=(1-perspective)*pose.orthoScale;
      // A ray starting on camera Z=0 works for both the orthographic entry and
      // perspective close-up. Saturn is the same unit sphere as the tour pass.
      let aa=0,bb=0,cc=-1;
      for(let i=0;i<3;i++){
        const lateral=pose.right[i]*nx+pose.up[i]*ny;
        const origin=pose.eye[i]+lateral*c,d=pose.forward[i]+lateral*perspective;
        aa+=d*d;bb+=origin*d;cc+=origin*origin;
      }
      const h=bb*bb-aa*cc;if(h<0)return false;
      const hit=(-bb-Math.sqrt(h))/aa;
      return hit>=0&&hit<depth-.001;
    }
    fitSaturnParticle(p,field,out){
      const shape=field.saturnLoopShape;if(!shape?.pose)return;
      const pose=shape.pose,tx=out.x-Math.cos(out.angle)*out.tail,ty=out.y-Math.sin(out.angle)*out.tail;
      out.saturnOccluded=this.saturnParticleOccluded(out.x,out.y,out.cameraDepth,pose);
      // A long streak must not shine through the planet even with a visible tip.
      if(!out.saturnOccluded&&this.saturnParticleOccluded(tx,ty,out.cameraDepth,pose))out.tail=0;
    }
    projectFlightParticleCamera(p,field,spawnDepth,born,behind,shutter,out){
      const rows=field.cameraFrames,current=rows[rows.length-1],previous=rows[rows.length-2]||current;
      let low=0,high=rows.length-1;
      while(low<high){const mid=Math.ceil((low+high)/2);if(rows[mid].distance<=born)low=mid;else high=mid-1;}
      const a=rows[low],b=rows[low+1]||a,u=clamp((born-a.distance)/Math.max(1e-12,b.distance-a.distance),0,1);
      const focal=this.h/(2*Math.tan(REPLAY_TRANSITION.skyFov*Math.PI/360)),spread=Math.min(this.w,this.h)/focal;
      const axes=current.axes,prior=previous.axes,dt=(current.time-previous.time)/1000;
      const exposure=dt>0?shutter/dt:0;
      let x=0,y=0,z=0,tx=0,ty=0,tz=0;
      for(let i=0;i<3;i++){
        const right=mix(a.axes.right[i],b.axes.right[i],u),down=mix(a.axes.down[i],b.axes.down[i],u),forward=mix(a.axes.forward[i],b.axes.forward[i],u);
        const movement=REPLAY_TRANSITION.particleDepth*p.speed*(mix(a.position[i],b.position[i],u)-current.position[i]);
        const point=movement+right*p.x*spread+down*p.y*spread-forward*spawnDepth;
        const tailPoint=point-axes.forward[i]*behind;
        x+=point*axes.right[i];y+=point*axes.down[i];z-=point*axes.forward[i];
        tx+=tailPoint*mix(axes.right[i],prior.right[i],exposure);
        ty+=tailPoint*mix(axes.down[i],prior.down[i],exposure);
        tz-=tailPoint*mix(axes.forward[i],prior.forward[i],exposure);
      }
      out.cameraDepth=z;const near=Math.max(.04,z),tailNear=Math.max(.04,tz);
      out.x=this.w*.5+focal*x/near;out.y=this.h*.5+focal*y/near;
      const dx=focal*(x/near-tx/tailNear),dy=focal*(y/near-ty/tailNear);
      out.tail=Math.hypot(dx,dy);out.angle=Math.atan2(dy,dx);
    }
    saturnOpeningParticleProjection(field){
      const frame=this.openingParticleFrameConstants||(this.openingParticleFrameConstants={}),path=this.particleFieldPath(field),elapsed=this.particleFieldElapsed(field);
      frame.budget=clamp((this.travelParticleBudget?.value??1)/(field.capacity||1),0,1);
      frame.short=Math.min(this.w,this.h);frame.arrival=elapsed-this.replayOpeningAt(path);
      frame.exposureVelocity=field.velocity/WARP_PARTICLES.speed;
      frame.shutter=.018+.048*clamp(frame.exposureVelocity/(REPLAY_TRANSITION.particleRate*1.5),0,1);
      frame.exitWindow=Math.max(1,path.inbound-WARP_PARTICLES.exitLead);
      frame.birthAt=path.particleAt+(path.openingMove||path.saturnTour||path.saturnProfile?0:WARP_PARTICLES.entryDelay-500);
      frame.early=ease((elapsed-frame.birthAt-1000)/WARP_PARTICLES.appear);return frame;
    }
    isSaturnEntryParticleField(field){return field?.particleProfile==='saturn-entry'||!!field?.replay?.saturnTour;}
    particleFieldPath(field){return this.isSaturnEntryParticleField(field)?field.particlePath||field.replay:field.replay;}
    particleFieldElapsed(field){return this.isSaturnEntryParticleField(field)?Math.max(0,field.elapsed-(field.particleProfileOrigin||0)):field.elapsed;}
    openingParticleProjection(field){
      return this.isSaturnEntryParticleField(field)?this.saturnOpeningParticleProjection(field):this.ordinaryOpeningParticleProjection(field);
    }
    ordinaryOpeningParticleProjection(field){
      const frame=this.openingParticleFrameConstants||(this.openingParticleFrameConstants={}),path=field.replay;
      frame.budget=clamp((this.travelParticleBudget?.value??1)/(field.capacity||1),0,1);
      frame.short=Math.min(this.w,this.h);frame.arrival=field.elapsed-this.replayOpeningAt(path);
      frame.exposureVelocity=field.velocity/WARP_PARTICLES.speed;
      frame.shutter=.018+.048*clamp(frame.exposureVelocity/(REPLAY_TRANSITION.particleRate*1.5),0,1);
      frame.exitWindow=Math.max(1,path.inbound-WARP_PARTICLES.exitLead);
      frame.birthAt=path.particleAt+(path.openingMove?0:WARP_PARTICLES.entryDelay);
      frame.early=ease((field.elapsed-frame.birthAt-1000)/WARP_PARTICLES.appear);return frame;
    }
    warpParticleBirth(p,field,frame){
      const path=this.particleFieldPath(field),timing=p.rotation/TAU,slide=path.sceneSlide;
      const cache=this.isSaturnEntryParticleField(field)?field.saturnBirths:null,cached=cache?.get(p);if(cached)return cached;
      if(path.openingMove||!slide||!field.cameraFrames?.length)return {at:frame.birthAt+timing*WARP_PARTICLES.entrySpread,distance:0};
      const direction=slide?.direction||[0,0],span=Math.hypot(...direction)||1;
      const facing=clamp(-(p.x*direction[0]+p.y*direction[1])/(Math.max(.04,p.depth)*span),-1,1);
      const initialAt=frame.birthAt+(.75*(1-facing)*.5+.25*timing)*WARP_PARTICLES.entrySpread;
      const loopGrain=p.edgeKeep===false;
      const at=loopGrain?Math.max(initialAt,path.brakeAt+timing*WARP_PARTICLES.loopSpread)
        :p.earlyKeep===false?Math.max(initialAt,frame.birthAt+1000):initialAt;
      // Anchor each grain to the displayed camera at its own birth, not the
      // camera before the turn. Keep that world-space trajectory thereafter.
      const rows=field.cameraFrames;let low=0,high=rows.length-1;
      while(low<high){const mid=Math.ceil((low+high)/2);if(rows[mid].time<=at)low=mid;else high=mid-1;}
      const a=rows[low],b=rows[low+1]||a,u=clamp((at-a.time)/Math.max(1e-12,b.time-a.time),0,1);
      const birth={at,distance:mix(a.distance,b.distance,u),depth:loopGrain?REPLAY_TRANSITION.particleDepth*(.85+.15*timing):p.depth};
      if(cache&&field.elapsed>=at)cache.set(p,birth);return birth;
    }
    saturnEntryParticleAlpha(p,field){
      if(!this.isSaturnEntryParticleField(field))return 1;
      // Keep the entry cohort substantial through the ten-second S curve, then
      // retire it over the half-second landing afterglow. The old 6.5-second
      // fade began around five seconds and made the extension feel unchanged.
      const elapsed=this.particleFieldElapsed(field),path=this.particleFieldPath(field);
      const timing=clamp(p.rotation/TAU,0,1),end=path.brakeAt+SATURN_APPEAR.linger,span=2500;
      const stagger=1200*timing,start=end-span+stagger,duration=span-stagger;
      const sparse=field.saturnFadeRetire?.has(p)
        ?1-ease((elapsed-(end-span+500))/2200):1;
      // The square-root tail keeps a substantial docking cohort while still
      // reaching zero with a flat slope at the staggered 10.5-second deadline.
      return Math.sqrt(clamp(1-ease((elapsed-start)/duration),0,1))*sparse;
    }
    saturnEntryAppearance(p,field,birth){
      // Each destination grain uses its own local birth time. Source particles
      // are a separate fading layer and never alter this appearance schedule.
      const at=Math.max(birth.at,p.saturnAddedAt??-Infinity)+SATURN_APPEAR.delay;
      const elapsed=this.particleFieldElapsed(field);
      return ease((elapsed-at)/SATURN_APPEAR.duration);
    }
    projectSaturnOpeningParticle(p,field,out,visibleOnly=false,frame=this.openingParticleProjection(field)) {
      out.saturnOccluded=false;out.saturnDistanceAlpha=1;out.saturnVolumeAlpha=1;
      const path=this.particleFieldPath(field),elapsed=this.particleFieldElapsed(field);
      if(visibleOnly&&!path.openingMove&&elapsed<=frame.birthAt){out.visible=false;out.alpha=0;return out;}
      // Birth-time randomness stays fixed: no frame-to-frame flicker.
      const lifetime=clamp((p.life-1000)/4000,0,1),timing=p.rotation/TAU;
      const arrival=frame.arrival;
      const contraction=ease((arrival-timing*200)/(1000+lifetime*800));
      const fadeStart=path.inbound*(WARP_PARTICLES.arrivalHold+lifetime*.3);
      const fadeEnd=path.inbound+WARP_PARTICLES.afterglow*(.025+.975*lifetime);
      // Cap the first second at 200; restore the existing departure density
      // smoothly after it. Additional loop grains have fixed random delays
      // and fade durations, so their visible count grows rather than popping.
      const entrance=ease((elapsed-path.brakeAt-timing*WARP_PARTICLES.loopSpread)
        /(WARP_PARTICLES.loopFade*(.75+lifetime*.5)));
      const birthAt=frame.birthAt,birth=this.warpParticleBirth(p,field,frame);
      const early=frame.early;
      const birthDensity=p.edgeKeep===false?entrance:p.earlyKeep===false?early:1;
      // The other half now also retires throughout arrival, doubling the
      // population reduction without reviving any previously fading grain.
      const retirement=500+lifetime*(path.inbound+WARP_PARTICLES.afterglow-500);
      const retireFade=Math.min(1000,retirement);
      const endDensity=p.edgeKeep===false?1-contraction:1-ease((arrival-retirement+retireFade)/retireFade);
      const exitWindow=frame.exitWindow;
      const warpExit=path.openingMove?1:1-ease((arrival-timing*exitWindow*.267)
        /(exitWindow*(.333+lifetime*.4)));
      const remaining=(field.awaitingSaturn||field.holdExitEnvelope)?birthDensity
        :(1-ease((arrival-fadeStart)/(fadeEnd-fadeStart)))*birthDensity*endDensity*warpExit;
      // The shared entry profile owns its local staggered fade-in. Replayed
      // warp grains keep their existing appearance instead.
      const profile=this.isSaturnEntryParticleField(field);
      const appearance=profile?this.saturnEntryAppearance(p,field,birth):path.openingMove?ease((arrival-timing*WARP_PARTICLES.openingAppear/3)
        /(WARP_PARTICLES.openingAppear*(1+lifetime)/3))
        :ease((field.elapsed-birth.at)/(WARP_PARTICLES.entryFade+lifetime*450));
      const retirementAlpha=this.particleRetirementAlpha(p,field);
      const targetOpacity=field.alpha*p.brightness*ease((field.formation-p.formationAt+.12)/.35)*appearance*remaining*retirementAlpha*this.saturnEntryParticleAlpha(p,field);
      // Apply the shared entry profile's -10% alpha once to core and glow.
      // Warp and background stars remain unchanged.
      const opacity=targetOpacity*(profile?SATURN_APPEAR.alpha:1);
      out.opacity=opacity;
      // Keep the bright core unchanged. Only Saturn's two halo layers shrink
      // from the former ~1-10 px visual range to roughly 1-7 px.
      out.glowScale=SATURN_APPEAR.glowScale;
      if(visibleOnly&&opacity<1e-4){out.visible=false;out.alpha=0;return out;}
      const length=REPLAY_TRANSITION.particleDepth,rate=length*p.speed,spawnDepth=birth.depth??p.depth;
      const distance=Math.max(0,(field.distance??field.travel)-birth.distance);
      const depth=((spawnDepth-rate*distance-.04)%length+length)%length+.04;
      const density=frame.budget>=1?1:1-ease((.85*(depth/length)**2+.15*timing-frame.budget)/.12);
      if(visibleOnly&&density*opacity<1e-4){out.visible=false;out.alpha=0;return out;}
      const short=frame.short;
      const cycle=Math.max(0,Math.ceil((rate*distance-spawnDepth+.04)/length));
      const born=birth.distance+(cycle>0?(spawnDepth-.04+(cycle-1)*length)/Math.max(1e-12,rate):0);
      // Project a second point on the same trajectory for a real perspective
      // streak. Its shutter grows with speed and contracts during arrival.
      // Tune exposure independently of travel speed so faster particles do
      // not undo the requested reduction in trail length.
      if(field.cameraFrames?.length){
        const shutter=frame.shutter*p.stretch;
        if(field.saturnVolume)this.projectSaturnEntryVolume(p,field,shutter,out);
        else this.projectFlightParticleCamera(p,field,cycle>0?length+.04:spawnDepth,born,rate*frame.exposureVelocity*shutter,shutter,out);
        out.size=clamp(p.size/(Math.max(.04,out.cameraDepth)+.5),.65,4.5);out.glowSize=out.size*p.glow;
        out.tail=Math.min(short*.24,out.tail)*field.tailScale*mix(1,WARP_PARTICLES.arrivalTail,contraction);
      }else{
      // Only the compatibility path needs the legacy lateral projection.
      // The camera-space path above supplies all final coordinates itself.
      const x=p.x*short,y=p.y*short;
      const headingX=field.headingX||0,headingY=field.headingY||0;
      const origin=this.openingParticleLateral(field,born);
      const laneX=x-short*rate*((field.lateralX??headingX*distance)-origin.x);
      const laneY=y-short*rate*((field.lateralY??headingY*distance)-origin.y);
      const cx=this.w*.5,cy=this.h*.5;
      const curve=1/(depth+.6);
      out.x=cx+laneX/depth+field.bendX*curve;out.y=cy+laneY/depth+field.bendY*curve;
      out.size=clamp(p.size/(depth+.5),.65,4.5);out.glowSize=out.size*p.glow;
      const exposureVelocity=frame.exposureVelocity;
      const shutter=frame.shutter*p.stretch;
      const behind=depth+rate*exposureVelocity*shutter;
      const behindX=laneX+short*headingX*(behind-depth),behindY=laneY+short*headingY*(behind-depth);
      const tx=cx+behindX/behind+field.bendX/(behind+.6),ty=cy+behindY/behind+field.bendY/(behind+.6);
      const dx=out.x-tx,dy=out.y-ty;
      out.tail=Math.min(short*.24,Math.hypot(dx,dy))*field.tailScale*mix(1,WARP_PARTICLES.arrivalTail,contraction);
      out.angle=Math.atan2(dy,dx);
      }
      if(path.openingMove&&!profile)out.tail*=WARP_PARTICLES.openingTail;
      if(field.replay.saturnTour)this.fitSaturnParticle(p,field,out);
      const depthFade=field.saturnVolume?out.saturnVolumeAlpha:1-ease((depth-length*.7)/(length*.3));
      out.alpha=out.saturnOccluded?0:opacity*density*depthFade*out.saturnDistanceAlpha;
      if(field.cameraFrames?.length)out.alpha*=ease((out.cameraDepth-.04)/.12);
      const margin=out.glowSize*(p.sizeScale??1)*out.glowScale+out.tail;
      out.visible=!out.saturnOccluded&&out.x>=-margin&&out.x<=this.w+margin&&out.y>=-margin&&out.y<=this.h+margin;
      return out;
    }
    projectOpeningParticle(p,field,out,visibleOnly=false,frame=this.openingParticleProjection(field)) {
      return this.isSaturnEntryParticleField(field)
        ?this.projectSaturnOpeningParticle(p,field,out,visibleOnly,frame)
        :this.projectOrdinaryOpeningParticle(p,field,out,visibleOnly,frame);
    }
    projectOrdinaryOpeningParticle(p,field,out,visibleOnly=false,frame=this.openingParticleProjection(field)) {
      if(visibleOnly&&!field.replay.openingMove&&field.elapsed<=field.replay.particleAt+WARP_PARTICLES.entryDelay){out.visible=false;out.alpha=0;return out;}
      // Birth-time randomness stays fixed: no frame-to-frame flicker.
      const lifetime=clamp((p.life-1000)/4000,0,1),timing=p.rotation/TAU;
      const arrival=frame.arrival;
      const contraction=ease((arrival-timing*200)/(1000+lifetime*800));
      const fadeStart=field.replay.inbound*(WARP_PARTICLES.arrivalHold+lifetime*.3);
      const fadeEnd=field.replay.inbound+WARP_PARTICLES.afterglow*(.025+.975*lifetime);
      // Cap the first second at 200; restore the existing departure density
      // smoothly after it. Additional loop grains have fixed random delays
      // and fade durations, so their visible count grows rather than popping.
      const entrance=ease((field.elapsed-field.replay.brakeAt-timing*WARP_PARTICLES.loopSpread)
        /(WARP_PARTICLES.loopFade*(.75+lifetime*.5)));
      const birthAt=frame.birthAt,birth=this.warpParticleBirth(p,field,frame);
      const early=frame.early;
      const birthDensity=p.edgeKeep===false?entrance:p.earlyKeep===false?early:1;
      // The other half now also retires throughout arrival, doubling the
      // population reduction without reviving any previously fading grain.
      const retirement=500+lifetime*(field.replay.inbound+WARP_PARTICLES.afterglow-500);
      const retireFade=Math.min(1000,retirement);
      const endDensity=p.edgeKeep===false?1-contraction:1-ease((arrival-retirement+retireFade)/retireFade);
      const exitWindow=frame.exitWindow;
      const warpExit=field.replay.openingMove?1:1-ease((arrival-timing*exitWindow*.267)
        /(exitWindow*(.333+lifetime*.4)));
      const remaining=(field.awaitingSaturn||field.holdExitEnvelope)?birthDensity
        :(1-ease((arrival-fadeStart)/(fadeEnd-fadeStart)))*birthDensity*endDensity*warpExit;
      // Replayed warp grains are already visible and must not appear again.
      const appearance=field.replay.openingMove?ease((arrival-timing*WARP_PARTICLES.openingAppear/3)
        /(WARP_PARTICLES.openingAppear*(1+lifetime)/3))
        :ease((field.elapsed-birth.at)/(WARP_PARTICLES.entryFade+lifetime*450));
      const retirementAlpha=this.particleRetirementAlpha(p,field);
      const opacity=field.alpha*p.brightness*ease((field.formation-p.formationAt+.12)/.35)*appearance*remaining*retirementAlpha;
      if(visibleOnly&&opacity<1e-4){out.visible=false;out.alpha=0;return out;}
      const length=REPLAY_TRANSITION.particleDepth,rate=length*p.speed,spawnDepth=birth.depth??p.depth;
      const distance=Math.max(0,(field.distance??field.travel)-birth.distance);
      const depth=((spawnDepth-rate*distance-.04)%length+length)%length+.04;
      const density=frame.budget>=1?1:1-ease((.85*(depth/length)**2+.15*timing-frame.budget)/.12);
      if(visibleOnly&&density*opacity<1e-4){out.visible=false;out.alpha=0;return out;}
      const short=frame.short,x=p.x*short,y=p.y*short;
      const headingX=field.headingX||0,headingY=field.headingY||0;
      const cycle=Math.max(0,Math.ceil((rate*distance-spawnDepth+.04)/length));
      const born=birth.distance+(cycle>0?(spawnDepth-.04+(cycle-1)*length)/Math.max(1e-12,rate):0);
      const origin=this.openingParticleLateral(field,born);
      const laneX=x-short*rate*((field.lateralX??headingX*distance)-origin.x);
      const laneY=y-short*rate*((field.lateralY??headingY*distance)-origin.y);
      const cx=this.w*.5,cy=this.h*.5;
      const curve=1/(depth+.6);
      out.x=cx+laneX/depth+field.bendX*curve;out.y=cy+laneY/depth+field.bendY*curve;
      out.size=clamp(p.size/(depth+.5),.65,4.5);out.glowSize=out.size*p.glow;
      // Project a second point on the same trajectory for a real perspective
      // streak. Its shutter grows with speed and contracts during arrival.
      // Tune exposure independently of travel speed so faster particles do
      // not undo the requested reduction in trail length.
      if(field.cameraFrames?.length){
        const shutter=frame.shutter*p.stretch;
        this.projectFlightParticleCamera(p,field,cycle>0?length+.04:spawnDepth,born,rate*frame.exposureVelocity*shutter,shutter,out);
        out.size=clamp(p.size/(Math.max(.04,out.cameraDepth)+.5),.65,4.5);out.glowSize=out.size*p.glow;
        out.tail=Math.min(short*.24,out.tail)*field.tailScale*mix(1,WARP_PARTICLES.arrivalTail,contraction);
      }else{
      const exposureVelocity=frame.exposureVelocity;
      const shutter=frame.shutter*p.stretch;
      const behind=depth+rate*exposureVelocity*shutter;
      const behindX=laneX+short*headingX*(behind-depth),behindY=laneY+short*headingY*(behind-depth);
      const tx=cx+behindX/behind+field.bendX/(behind+.6),ty=cy+behindY/behind+field.bendY/(behind+.6);
      const dx=out.x-tx,dy=out.y-ty;
      out.tail=Math.min(short*.24,Math.hypot(dx,dy))*field.tailScale*mix(1,WARP_PARTICLES.arrivalTail,contraction);
      out.angle=Math.atan2(dy,dx);
      }
      if(field.replay.openingMove)out.tail*=WARP_PARTICLES.openingTail;
      out.alpha=opacity*density*(1-ease((depth-length*.7)/(length*.3)));
      if(field.cameraFrames?.length)out.alpha*=ease((out.cameraDepth-.04)/.12);
      const margin=out.glowSize*(p.sizeScale??1)+out.tail;
      out.visible=out.x>=-margin&&out.x<=this.w+margin&&out.y>=-margin&&out.y<=this.h+margin;
      return out;
    }
    particleSphereMask(pose){
      const f=this.h/(2*Math.tan(pose.fov*DEG/2)),perspective=pose.perspective;
      const x=-flightDot(pose.eye,pose.right),y=-flightDot(pose.eye,pose.up),z=-flightDot(pose.eye,pose.forward);
      const den=(1-perspective)*pose.orthoScale+perspective*z,base=den*den-perspective*perspective;
      const mask={f,p:perspective,x,y,den,cx:this.w*.5+pose.offset[0]*f,cy:this.h*.5-pose.offset[1]*f};
      if(den+perspective<=0)return {...mask,empty:true};
      if(den>perspective&&base>0){
        mask.ellipse={x:mask.cx+f*x*den/base,y:mask.cy-f*y*den/base,
          rx:f*Math.sqrt(base+perspective*perspective*(x*x+y*y))/base+.5,ry:f/Math.sqrt(base)+.5,angle:Math.atan2(-y,x)};
      }
      return mask;
    }
    particleSphereRow(mask,screenY){
      // Exact projected-sphere conic for the uncommon near-plane crossing.
      const {f,p,x,y,den,cx,cy}=mask,v=(cy-screenY)/f,p2=p*p;
      const k=p2*(x*x+y*y-1)+den*den,t=y*v+den;
      const a=p2*x*x-k,b=2*p2*x*t,d=p2*t*t-k*(v*v+p2);
      const lo=-cx/f,hi=(this.w-cx)/f,cuts=[lo,hi],disc=b*b-4*a*d;
      if(Math.abs(a)<1e-12){if(Math.abs(b)>1e-12)cuts.push(-d/b);}
      else if(disc>=0){const h=Math.sqrt(disc);cuts.push((-b-h)/(2*a),(-b+h)/(2*a));}
      if(Math.abs(x)>1e-12)cuts.push(-t/x);
      cuts.sort((left,right)=>left-right);const spans=[];
      for(let i=1;i<cuts.length;i++){
        const left=Math.max(lo,cuts[i-1]),right=Math.min(hi,cuts[i]);if(!(right>left))continue;
        const u=(left+right)*.5;
        if((a*u+b)*u+d>=-1e-10&&(x*u+t>=0||k<=0))spans.push([Math.max(0,cx+left*f-.75),Math.min(this.w,cx+right*f+.75)]);
      }
      return spans;
    }
    clipParticleBodies(c,mono,presentation=this.replayPresentation(mono)){
      // Clip only the particle pass. The full glow and tail disappear behind
      // solid bodies while rings retain their transparent material.
      if(typeof c.clip!=='function'||typeof c.rect!=='function'||presentation.solar<=0)return;
      const pose=this.ringTour?.pose||null;
      if(pose){
        const mask=this.particleSphereMask(pose);
        if(!mask.empty){
          c.beginPath();c.rect(0,0,this.w,this.h);
          if(mask.ellipse&&typeof c.ellipse==='function'){
            const e=mask.ellipse;c.moveTo(e.x+e.rx*Math.cos(e.angle),e.y+e.rx*Math.sin(e.angle));c.ellipse(e.x,e.y,e.rx,e.ry,e.angle,0,TAU);
          }else for(let y=0;y<this.h;y++)for(const [left,right] of this.particleSphereRow(mask,y+.5))c.rect(left,y,right-left,1);
          c.clip('evenodd');
        }
      }
      for(const item of this.frameBodies||[]){
        if(pose&&item.body.id==='saturn')continue;
        const screen=item.screen,r=item.r;
        if(!screen||screen.behind||!(r>0)||!Number.isFinite(screen.x+screen.y+r)||!this.visible(screen,r+1))continue;
        // Separate clips keep overlapping planet silhouettes excluded as a union.
        c.beginPath();c.rect(0,0,this.w,this.h);c.moveTo(screen.x+r+.5,screen.y);c.arc(screen.x,screen.y,r+.5,0,TAU);c.clip('evenodd');
      }
    }
    drawParticlePass(c,mono,draw,presentation=this.replayPresentation(mono)){
      c.save();
      try{this.clipParticleBodies(c,mono,presentation);return draw();}
      finally{c.restore();}
    }
    drawOpeningParticles(c,mono=performance.now(),presentation=this.replayPresentation(mono)) {
      const replay=this.cameraTween?.replay,fields=this.particleLifecycle().fields()
        .map(field=>this.openingParticleFrame(mono,field)).filter(Boolean);
      if(!fields.length&&!(replay&&!this.sky?.gl))return;
      this.drawParticlePass(c,mono,()=>{
        if(replay&&!this.sky?.gl)this.sky?.drawStars?.(c,this.sky.lastEffect||0,this.options,this.boundStarGlow,presentation.solar>0?this.frameBodies:[]);
        for(const field of fields)if(field.alpha>1e-4){
          const frame=this.openingParticleProjection(field);
          this.drawFlightParticles(c,field,(p,f,out)=>this.projectOpeningParticle(p,f,out,true,frame));
        }
      },presentation);
    }
    replayParticleAlpha(elapsed,path,velocity){
      const openingAt=this.replayOpeningAt(path);
      const peak=REPLAY_TRANSITION.particleRate*1.5*WARP_PARTICLES.speed;
      const speedAlpha=mix(1,WARP_PARTICLES.speedAlpha,ease(velocity/peak));
      // Fade the fast streaks, then ease into the brighter, slower arrival.
      // Arrival gain replaces speed dimming so the requested +20% is exact.
      const arrival=ease((elapsed-openingAt+WARP_PARTICLES.blend)/WARP_PARTICLES.blend);
      const gain=mix(speedAlpha,WARP_PARTICLES.arrivalAlpha,arrival);
      return .92*WARP_PARTICLES.alpha*gain*ease((elapsed-path.particleAt)/WARP_PARTICLES.appear);
    }
    drawSaturnFlightParticles(c,field,project) {
      if(field.alpha<=0)return;
      if(field.replay||field.ambient){
        c.save();c.lineCap='round';
        const path=this.particleFieldPath(field),elapsed=this.particleFieldElapsed(field);
        const points=field.saturnDrawPoints||field.points,count=points.length;
        const projected=field.saturnProjected||(field.saturnProjected=[]);
        for(let i=0;i<count;i++){
          const p=points[i];
          let q=projected[i]||(projected[i]={});q.paint=false;
          if(this.isSaturnEntryParticleField(field)&&this.saturnEntryParticleAlpha(p,field)<=1e-4)continue;
          q=project(p,field,q)||q;projected[i]=q;if(!q.visible||q.alpha<1e-4)continue;
          q.paint=true;
        }
        c.globalCompositeOperation='source-over';
        for(let i=0;i<count;i++){
          const p=points[i],q=projected[i];if(!q?.paint)continue;
          const radius=clamp(q.size*.23,.38,1.05)*(p.sizeScale??1),tail=Math.max(0,q.tail||0),glowScale=q.glowScale??1;
          const halo=p.haloAlpha??(.045+.035*clamp(((p.glow??.8)-.8)/1.8,0,1));
          if((field.ambient||(path.saturnTour&&this.replayOpeningAt(path)<=elapsed))&&tail<=.65){
            c.fillStyle=FLIGHT_GLOW_COLORS[p.color??0];
            c.globalAlpha=q.alpha*halo;c.beginPath();c.arc(q.x,q.y,radius*4.5*glowScale,0,TAU);c.fill();
            c.globalAlpha=q.alpha*.3;c.beginPath();c.arc(q.x,q.y,radius*1.6*glowScale,0,TAU);c.fill();
            c.globalAlpha=q.alpha;c.fillStyle='#edf7ff';c.beginPath();c.arc(q.x,q.y,radius*.5,0,TAU);c.fill();
            continue;
          }
          c.strokeStyle=FLIGHT_GLOW_COLORS[p.color??0];c.beginPath();
          if(tail>.65){c.moveTo(q.x-Math.cos(q.angle)*tail,q.y-Math.sin(q.angle)*tail);c.lineTo(q.x,q.y);}
          else{c.moveTo(q.x-radius*.2,q.y);c.lineTo(q.x+radius*.2,q.y);}
          c.globalAlpha=q.alpha*halo;c.lineWidth=radius*9*glowScale;c.stroke();
          c.globalAlpha=q.alpha*.3;c.lineWidth=radius*3.2*glowScale;c.stroke();
          c.globalAlpha=q.alpha;c.strokeStyle='#edf7ff';c.lineWidth=radius;c.stroke();
        }
        c.restore();return;
      }
      this.loadFlightParticleAtlas();
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
      const atlas=sprite===this.flightParticleImage;
      c.save();c.globalCompositeOperation='source-over';
      const count=Math.min(field.points.length,field.drawCount??field.points.length);
      for(let i=0;i<count;i++){
        const p=field.points[i],q=project(p,field,field.projected);
        if(!q.visible||q.alpha<1e-4)continue;
        c.globalAlpha=q.alpha;
        if(atlas){
          // Alpha and compact glow are baked into the same tile: one image
          // draw per visible grain, instead of separate halo/core passes.
          const tile=p.tile??p.color??0,sx=(tile%4)*128+16,sy=Math.floor(tile/4)*128+16;
          // Skip the outer transparent gutter. Same visible size, but 44%
          // fewer quad pixels than drawing the full padded 128px cell.
          const size=1.5*Math.max(q.size,q.glowSize),tail=q.tail>2?q.tail:0;
          c.save();
          if(tail){c.translate(q.x-Math.cos(q.angle)*tail/2,q.y-Math.sin(q.angle)*tail/2);c.rotate(q.angle);c.scale(1+tail/size,1);}
          else c.translate(q.x,q.y);
          // Fixed at birth, never rerolled per frame. Stretch AFTER the local
          // rotation so the image varies but its trail follows forward motion.
          c.rotate(p.rotation||0);c.drawImage(sprite,sx,sy,96,96,-size/2,-size/2,size,size);c.restore();
          continue;
        }
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
    drawFlightParticles(c,field,project) {
      return this.isSaturnEntryParticleField(field)?this.drawSaturnFlightParticles(c,field,project):this.drawOrdinaryFlightParticles(c,field,project);
    }
    drawOrdinaryFlightParticles(c,field,project) {
      if(field.alpha<=0)return;
      if(field.replay){
        // Three compact additive strokes give a blue/violet halo and a crisp
        // ice-white core, without textures, per-grain gradients or shadow blur.
        c.save();c.globalCompositeOperation='lighter';c.lineCap='round';
        for(const p of field.points){
          const q=project(p,field,field.projected);
          if(!q.visible||q.alpha<1e-4)continue;
          const radius=clamp(q.size*.23,.38,1.05)*(p.sizeScale??1),tail=Math.max(0,q.tail||0);
          const halo=p.haloAlpha??(.045+.035*clamp(((p.glow??.8)-.8)/1.8,0,1));
          if(field.replay.openingMove&&tail<=.65){
            // Preserve the soft glow when its restored short trail is subpixel.
            c.fillStyle=FLIGHT_GLOW_COLORS[p.color??0];
            c.globalAlpha=q.alpha*halo;c.beginPath();c.arc(q.x,q.y,radius*4.5,0,TAU);c.fill();
            c.globalAlpha=q.alpha*.3;c.beginPath();c.arc(q.x,q.y,radius*1.6,0,TAU);c.fill();
            c.globalAlpha=q.alpha;c.fillStyle='#edf7ff';c.beginPath();c.arc(q.x,q.y,radius*.5,0,TAU);c.fill();
            continue;
          }
          c.strokeStyle=FLIGHT_GLOW_COLORS[p.color??0];c.beginPath();
          if(tail>.65){
            c.moveTo(q.x-Math.cos(q.angle)*tail,q.y-Math.sin(q.angle)*tail);c.lineTo(q.x,q.y);
          }else{c.moveTo(q.x-radius*.2,q.y);c.lineTo(q.x+radius*.2,q.y);}
          c.globalAlpha=q.alpha*halo;c.lineWidth=radius*9;c.stroke();
          c.globalAlpha=q.alpha*.3;c.lineWidth=radius*3.2;c.stroke();
          c.globalAlpha=q.alpha;c.strokeStyle='#edf7ff';c.lineWidth=radius;c.stroke();
        }
        c.restore();return;
      }
      this.loadFlightParticleAtlas();
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
      const atlas=sprite===this.flightParticleImage;
      c.save();c.globalCompositeOperation='source-over';
      for(const p of field.points){
        const q=project(p,field,field.projected);
        if(!q.visible||q.alpha<1e-4)continue;
        c.globalAlpha=q.alpha;
        if(atlas){
          // Alpha and compact glow are baked into the same tile: one image
          // draw per visible grain, instead of separate halo/core passes.
          const tile=p.tile??p.color??0,sx=(tile%4)*128+16,sy=Math.floor(tile/4)*128+16;
          // Skip the outer transparent gutter. Same visible size, but 44%
          // fewer quad pixels than drawing the full padded 128px cell.
          const size=1.5*Math.max(q.size,q.glowSize),tail=q.tail>2?q.tail:0;
          c.save();
          if(tail){c.translate(q.x-Math.cos(q.angle)*tail/2,q.y-Math.sin(q.angle)*tail/2);c.rotate(q.angle);c.scale(1+tail/size,1);}
          else c.translate(q.x,q.y);
          // Fixed at birth, never rerolled per frame. Stretch AFTER the local
          // rotation so the image varies but its trail follows forward motion.
          c.rotate(p.rotation||0);c.drawImage(sprite,sx,sy,96,96,-size/2,-size/2,size,size);c.restore();
          continue;
        }
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
      // Draw once per reveal, never per frame: each body's orbit and name
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
    trackingMoveState(id,snapshot=this.cameraSnapshot(),lensZoom=snapshot?.zoom,radius=Math.min(this.w,this.h)*.25) {
      const body=this.sceneBodies().find(b=>b.id===id);
      if(!body)return null;
      const zoom=clamp(Number.isFinite(lensZoom)?lensZoom:DEFAULT_CAMERA.zoom,VIEW.minZoom,VIEW.maxZoom);
      const to={...snapshot,focus:id,panX:0,panY:0,zoom,dolly:1,mode:'move'};
      const baseRadius=this.bodyRadiusForState(body,to);
      to.dolly=clamp(radius/Math.max(baseRadius,1e-12),VIEW.minDolly,VIEW.maxDolly);
      return to;
    }
    focusState(id,mono=performance.now()) {
      const body=this.sceneBodies().find(b=>b.id===id);
      if(!body)return null;
      this.advanceCamera(mono);this.advanceAutoRotate(mono);
      // Tracking is always viewport-centred. A previous middle-button pan is a
      // scene navigation offset, not part of a planet-follow camera preset. The
      // target size is derived from the body's baseline display radius rather
      // than the current/tweened zoom, so repeated focus commands are idempotent.
      return this.trackingMoveState(id);
    }
    animateFocus(id,mono=performance.now(),duration=1100) {
      const to=this.focusState(id,mono);return !!to&&this.animateCamera(to,mono,duration);
    }
    hasActivePlanetTravel(){return !!this.ringTour;}
    returnPlanetTravelHome(mono=performance.now(),speed=1){
      const travel=this.ringTour;if(!travel)return false;
      travel.setReturnSpeed?.(speed);return this.animateHome(mono,1100);
    }
    requestFocus(id,mono=performance.now(),duration=1100){
      const body=this.sceneBodies().find(value=>value.id===id);
      if(!body||(SATELLITES.some(value=>value.id===id)&&!this.options.moon)||(id==='pluto'&&!this.options.pluto))return false;
      if(!this.hasActivePlanetTravel())return this.animateFocus(id,mono,duration);
      // Travel always returns to the shared overview first. Keeping the final
      // focus request out of the exit target prevents another planet's anchor
      // from deforming the active travel projection. The latest request wins.
      this.pendingTravelFocus={id,duration};return this.returnPlanetTravelHome(mono,2);
    }
    requestFeature(id,latitude,longitude,ms,mono=performance.now(),duration=1100){
      const body=this.sceneBodies().find(value=>value.id===id);
      if(!body||![latitude,longitude,ms].every(Number.isFinite))return false;
      if(!this.hasActivePlanetTravel())return this.animateFeature(id,latitude,longitude,ms,mono,duration);
      // Reuse the one travel-return queue. A country request replaces an older
      // body request and continues directly from Home into the region view.
      this.pendingTravelFocus={id,duration,feature:{latitude,longitude,ms}};
      return this.returnPlanetTravelHome(mono,2);
    }
    resumeTravelFocus(mono=performance.now(),ms){
      if(!this.pendingTravelFocus||this.hasActivePlanetTravel()||this.cameraTween)return false;
      const request=this.pendingTravelFocus;this.pendingTravelFocus=null;
      if(request.feature){const feature=request.feature;return this.animateFeature(request.id,feature.latitude,feature.longitude,Number.isFinite(ms)?ms:feature.ms,mono,request.duration);}
      return this.animateFocus(request.id,mono,request.duration);
    }
    animateFeature(id,latitude,longitude,ms,mono=performance.now(),duration=1100) {
      this.advanceCamera(mono);this.advanceAutoRotate(mono);
      const keepEarthView=id==='earth'&&this.camera.focus==='earth';
      let to=keepEarthView?this.cameraSnapshot():this.focusState(id,mono);const body=this.sceneBodies().find(b=>b.id===id);
      if(!to||!body||![latitude,longitude,ms].every(Number.isFinite))return false;
      to.focus=id;
      const n=A.surfaceDirection(body,latitude,longitude,ms);
      to.azimuth=A.wrap(Math.atan2(-n.x,-n.y));to.elevation=Math.asin(clamp(n.z,-1,1));
      // Every Earth-country entry uses the same seven-wheel-step framing.
      // A user who is already closer keeps that distance and current pan.
      if(id==='earth'){
        const inspection=this.countryInspectionState(to);
        if(!inspection)return false;
        if(!keepEarthView)to=inspection;
        else to.dolly=clamp(Math.max(to.dolly??1,inspection.dolly),VIEW.minDolly,VIEW.maxDolly);
      }
      return this.animateCamera(to,mono,duration,keepEarthView);
    }
    countryInspectionState(snapshot=this.cameraSnapshot()){
      const state=this.trackingMoveState('earth',snapshot,snapshot?.zoom);
      if(!state)return null;
      state.dolly=clamp(state.dolly*this.wheelTravelFactor(-120)**REGION_TRACKED_WHEEL_STEPS,VIEW.minDolly,VIEW.maxDolly);
      return state;
    }
    animateHome(mono=performance.now(),duration=1100) {
      return this.animateCamera(this.defaultCameraSnapshot(),mono,duration);
    }
    cameraTweenState(move,t){
      if(move.replay)return this.openingReplayPose(move,t*move.duration);
      const p=move.timing==='opening'?(move.flyThrough?openingFlyThrough(t):openingEase(t)):ease(t),{from,to}=move;
      const delta=A.wrap(to.azimuth-from.azimuth+Math.PI)-Math.PI,elevationDelta=A.wrap(to.elevation-from.elevation+Math.PI)-Math.PI;
      const arc=move.openingPath?.arc,arcWeight=arc?4*p*(1-p):0;
      const state={azimuth:A.wrap(from.azimuth+delta*p),elevation:normalizeElevation(from.elevation+elevationDelta*p),
        panX:clamp(mix(from.panX,to.panX,p)+(arc?.x||0)*arcWeight,VIEW.minPanX,VIEW.maxPanX),panY:clamp(mix(from.panY,to.panY,p)+(arc?.y||0)*arcWeight,VIEW.minPanY,VIEW.maxPanY),
        // The visible tracking anchor itself is cross-blended in draw(). Keep the
        // destination focus here so surface detail can prepare before arrival.
        focus:to.focus,
        zoom:mix(from.zoom,to.zoom,p),dolly:mix(from.dolly??1,to.dolly??1,p)};
      if(state.zoom<=1&&state.dolly===1&&to.focus===null)state.focus=null;
      return {state,progress:p};
    }
    openingTurn(move,t){
      if(!window.SolarRingTour?.smoothBank)return 0;
      const duration=move.duration/1000;
      const sample=u=>{
        const s=this.cameraTweenState(move,clamp(u,0,1)).state,a=s.azimuth,e=s.elevation;
        const right=[Math.cos(a),-Math.sin(a),0],up=[Math.sin(a)*Math.sin(e),Math.cos(a)*Math.sin(e),Math.cos(e)];
        const eye=[-Math.sin(a)*Math.cos(e),-Math.cos(a)*Math.cos(e),Math.sin(e)];
        return {right,eye:eye.map((v,i)=>(v-right[i]*s.panX+up[i]*s.panY)/Math.max(.00001,s.dolly))};
      };
      // Curvature only selects the following S bend; it never rolls the opening.
      return window.SolarRingTour.smoothBank(seconds=>sample(seconds/duration).eye,t*duration,sample(t).right);
    }
    advanceCamera(mono=performance.now()) {
      mono=this.animationMono(mono);
      const move=this.cameraTween;
      const releaseLook=()=>{if(!this.lookRelease)return;
        const release=this.lookRelease,p=ease((mono-release.start)/1000),from=release.from;
        const yaw=from.yaw+(A.wrap(this.camera.azimuth-from.yaw+Math.PI)-Math.PI)*p,pitch=mix(from.pitch,this.camera.elevation,p);
        this.flightLook=p<1?(from.world?this.flightLookForView(yaw,pitch):this.flightLookAt(from.yaw*(1-p),from.pitch*(1-p))):null;
        if(p>=1)this.lookRelease=null;this.dirty=true;
      };
      if(!move){
        releaseLook();
        const release=this.bankRelease;if(!release)return false;
        const t=clamp((mono-release.start)/500,0,1);this.flightBank=release.from*(1-ease(t));
        if(t>=1)this.bankRelease=null;this.dirty=true;return true;
      }
      const t=clamp((mono-move.start)/move.duration,0,1),{to}=move,{state,progress,look}=this.cameraTweenState(move,t);move.progress=progress;
      if(move.replay){
        move.replay.arrivalProgress=mono-move.start>=move.replay.resetAt?progress:null;
        this.flightLook=look||null;this.lookRelease=null;
      }
      const bankLimit=window.SolarRingTour?.bankLimit??20*A.DEG;
      // Preserve the bank established by the preceding camera. Path-specific
      // flight roll is carried by the transported frame (flightLook/RingTour),
      // not by fading this shared baseline back to zero.
      this.flightBank=clamp(Number.isFinite(move.bankFrom)?move.bankFrom:(this.flightBank||0),-bankLimit,bankLimit);
      const beforeDolly=this.camera.dolly??1;
      this.camera=t>=1?{azimuth:to.azimuth,elevation:to.elevation,zoom:to.zoom,dolly:to.dolly??1,focus:to.focus,panX:to.panX,panY:to.panY}:state;
      if(move.input&&!move.replay)this.shiftBackgroundForManualDolly(beforeDolly,this.camera.dolly??1);
      if(!move.replay)releaseLook();
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
        if(move.replay&&this.flightLook&&(blend.yaw||blend.pitch))this.flightLook=this.flightLookForView(this.flightLook.yaw+blend.yaw,this.flightLook.pitch+blend.pitch);
      }
      if(t>=1){
        this.cameraTween=null;
        const pending=this.pendingAutoRotation;this.pendingAutoRotation=null;
        if(pending)this.beginAutoRotation(pending.direction,mono,pending.generation);
      }
      this.cameraChangeAt=mono;this.dirty=true;return true;
    }
    cancelCameraTween(mono=performance.now(),preserveParticles=false) {
      mono=this.animationMono(mono);
      if(this.cameraTween?.replay||this.cameraTween?.timing==='opening')this.setReplaySolarOpacity(1);
      // Every visible takeover uses the shared flight-particle fade. The old
      // 220 ms branch looked like an alpha cut beside the normal 1.2 s exit.
      if(!preserveParticles){
        const field=this.openingParticles;if(field)this.openingParticleFrame(mono,field);
        this.fadeOpeningParticleField(mono,PARTICLE_TRANSITION.finalFade,field);
      }
      if(this.cameraTween){
        this.advanceCamera(mono);this.cameraTween=null;
        if(this.flightLook){this.lookRelease={from:this.flightLook,start:mono};this.invalidatePresentation(1000,mono);}
        // Do not release bank here. The next camera inherits the same baseline.
        this.bankRelease=null;
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
      mono=this.animationMono(mono);
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
      mono=this.animationMono(mono);
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
      this.cameraTween=null;this.flightBank=Number.isFinite(this.flightBank)?this.flightBank:0;this.bankRelease=null;this.autoRotation=null;this.pendingAutoRotation=null;this.camera=this.defaultCameraSnapshot();this.trackingAnchor=null;
      if(direction)this.beginAutoRotation(direction,mono,generation);
      this.projectionAnchor=null;this.dirty=true;
    }
    projectOrbit(path) {
      const {azimuth:a,elevation:e}=this.camera;
      const dolly=this.camera.dolly??1,active=Math.abs(dolly-1)>1e-8,anchor=this.projectionAnchor||{x:0,y:0,z:0};
      const cache=this.orbitCache||(this.orbitCache=new WeakMap());let item=cache.get(path);
      const cameraKey=active?[this.camera.zoom,dolly,anchor.x,anchor.y,anchor.z,anchor.depthX??anchor.x,anchor.depthY??anchor.y,anchor.depthZ??anchor.z].map(v=>Number(v).toFixed(5)).join(':'):'flat';
      const projectionKey=cameraKey+':'+(this.flightBank||0)+':'+(this.flightLook?.yaw||0)+':'+(this.flightLook?.pitch||0)+':'+Number(this.solarOrbitHierarchyScale()).toFixed(5)+':'+this.solarOrbitClearanceScale()+':'+Number(this.actualScaleMix||0).toFixed(5)+':'+(this.options.overviewOrbitGap??OVERVIEW_ORBIT.gap)+':'+this.displayedOrbitSpacing()+':'+this.orbitScaleTransitionKey();
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
      const {ca,sa,ce,se,cr,sr}=this.cameraBasis(),active=Math.abs((this.camera.dolly??1)-1)>1e-8;
      return {ca,sa,ce,se,cr,sr,lens:1,travel:active?(this.camera.dolly??1)-1:0,anchor:active?(this.projectionAnchor||{x:0,y:0,z:0}):{x:0,y:0,z:0},solarMorph:this.solarOrbitMorph()};
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
    orbit(c,path,highlight,reveal=1,strength=1,fade=1) {
      const item=this.projectOrbit(path),xyz=item.xyz,scale=this.scale;
      const shared=!!this.gpu&&!!this.flightLook;
      const rgb=shared?(path.body.id==='earth'?'110,173,212':path.body.id==='pluto'?'156,140,128':'138,150,168')
        :path.body.id==='earth'?'110,174,212':path.body.id==='pluto'?'155,140,127':'138,151,168';
      // Switching from GPU orbits to warp's Canvas projection must not brighten
      // front-facing arcs or selected lines. Match the shared travel painter.
      c.lineWidth=shared?1/(this.gpu.dpr||this.dpr||1):highlight?1.25:.72;
      if(path.body.id==='pluto'&&!shared)c.setLineDash([2,5]);
      const ink=this.orbitInk(path.body.id,reveal,this.currentFrameItem(path.body.id)?.world);
      if(ink){
        c.save();c.translate(this.cx,this.cy);const alpha=c.globalAlpha*fade;
        for(let i=1;i<path.points.length;i++){
          const a=(i-1)*3,b=i*3,pa=path.points[i-1],pb=path.points[i];
          if(!Number.isFinite(xyz[a+2])||!Number.isFinite(xyz[b+2]))continue;
          const userAlpha=clamp((highlight?.64:shared?.22:xyz[b+2]>=0?.32:.17)*strength,0,1),opacity=this.orbitInkOpacity(pa.x+pb.x,pa.y+pb.y,ink,userAlpha);if(opacity<1e-4)continue;
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
      c.save();c.globalAlpha*=reveal*fade;c.translate(this.cx,this.cy);
      for(let pass=0;pass<2;pass++){
        c.strokeStyle=`rgba(${rgb},${clamp((highlight?.64:shared?.22:pass?.32:.17)*strength,0,1)})`;
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
      const bankKey=(this.flightBank||0).toFixed(5);
      job.geometry=[body.id,window.SolarAssets?.materialRevision||0,diam,textureWidth,job.nightTextureWidth,job.cloudTextureWidth,'camera-3d',A.rotationPoleTilt(body),this.camera.azimuth.toFixed(5),this.camera.elevation.toFixed(5),Number(activity),Number(job.nightLights),job.cloudAmount.toFixed(2),job.cloudDetail.toFixed(2),job.cloudSeed.toFixed(6)].join(':');
      job.geometry+=':'+bankKey;
      job.viewState={yaw:this.camera.azimuth,pitch:this.camera.elevation,limit:this.autoRotation?Math.PI/120:Math.PI/36,
        key:[body.id,window.SolarAssets?.materialRevision||0,diam,textureWidth,job.nightTextureWidth,job.cloudTextureWidth,A.rotationPoleTilt(body),this.autoRotation?.generation||0,Number(job.nightLights),job.cloudAmount.toFixed(2),job.cloudDetail.toFixed(2),job.cloudSeed.toFixed(6)].join(':')};
      job.viewState.key+=':'+bankKey;
      return job;
    }
    invalidateSurfaces() {this.lastSurfaceSubmit=-Infinity;this.surface?.invalidate();}
    suspend() {
      if(this.ringTour)this.ringTour.lastMono=null;
      const mono=performance.now();if(!this.animationPaused)this.cancelCameraTween(mono);this.advanceAutoRotate(mono);
      this.cancelCoronaBuild();this.physicsSamples?.clear();this.physicsMs=NaN;
      if(!this.animationPaused)this.clearOpeningParticleFields();
      if(this.autoRotation)this.autoRotation.mono=null; // Resume at the same view, never catch up a hidden tab.
      this.surface?.pause();this.sky?.pause?.();
    }
    resume() {if(!this.surface)this.surface=this.gpu||new window.SolarSurface.Service();this.surface.resume();this.sky?.resume?.();}
    dispose() {this.clearPreparedTour();this.endRingTour();this.suspend();this.clearOpeningParticleFields();this.cameraTween=null;this.surface?.dispose();this.surface=null;this.autoRotation=null;this.clearLabels();this.hitTargets.length=0;this.coronaTexture=null;this.releaseFlightParticleAtlas();this.starSprites.clear();this.frameCache.clear();this.precisionOrbitPathCache.clear();this.physicsBodies.clear();this.physicsSatellites.clear();this.labelWidths.clear();this.labelBodyMap.clear();this.labelOrdered.length=0;this.labelReserved.length=0;this.labelActive.clear();this.labelObstacleMap.clear();this.labelCandidateMap.clear();this.frameItems.clear();this.frameBodies.length=this.surfaceBodies.length=this.directBodies.length=this.labelBodies.length=this.satelliteLayouts.length=this.compatSurfaceJobs.length=0;this.orbitCache=new WeakMap();this.sky?.dispose();}
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
    bodyRingFrame(body,frame,ms) {
      const frames=this.parentRingFrames||(this.parentRingFrames=new Map());let out=frames.get(body.id);
      if(!out){out={u:{x:0,y:0,z:0},v:{x:0,y:0,z:0},pole:{x:0,y:0,z:0}};frames.set(body.id,out);}
      const a=A.rotationAt(body,ms),c=Math.cos(a),s=Math.sin(a);
      for(const key of ['x','y','z']){out.u[key]=frame.u[key]*c+frame.v[key]*s;out.v[key]=frame.v[key]*c-frame.u[key]*s;out.pole[key]=frame.pole[key];}
      return out;
    }
    drawBody(c,b,world,screen,r,ms,t) {
      const frame=this.bodyFrame(b);
      const ringFrame=b.id==='saturn'||b.id==='uranus'?this.bodyRingFrame(b,frame,ms):frame;
      if(b.id==='sun')this.corona(c,screen.x,screen.y,r,t);
      if(b.id==='saturn'||b.id==='uranus')this.rings(c,b,screen,r,false,ringFrame);
      if(b.id==='earth') {
        const g=c.createRadialGradient(screen.x,screen.y,r*.99,screen.x,screen.y,r*1.035);g.addColorStop(0,'rgba(73,145,218,.12)');g.addColorStop(1,'rgba(74,155,219,0)');c.fillStyle=g;c.beginPath();c.arc(screen.x,screen.y,r*1.035,0,TAU);c.fill();
      }
      if(this.visible(screen,r+2)) {
        const img=this.surface.get(b.id);
        if(img)c.drawImage(img,screen.x-r,screen.y-r,r*2,r*2);
        // First-ever material load has no fake flat-colour planet. During
        // camera changes/visibility pauses the last complete image is retained.
      }
      if(b.id==='saturn'||b.id==='uranus')this.rings(c,b,screen,r,true,ringFrame);
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
      c.fillText(site.label+' · '+(day?(site.dayLabel||'DAY'):(site.nightLabel||'NIGHT')),x+11,y-9);c.restore();
    }
    drawEarthRegionHover(c,earth,ms){
      if(!this.earthRegionInteractionReady()||!this.earthRegionHover)return;
      const lines=this.earthRegionOutline(this.earthRegionHover,earth,ms);if(!lines.length)return;
      c.save();c.beginPath();c.arc(earth.screen.x,earth.screen.y,earth.r,0,TAU);c.clip();
      c.beginPath();for(const line of lines){c.moveTo(line[0].x,line[0].y);for(let i=1;i<line.length;i++)c.lineTo(line[i].x,line[i].y);}
      c.strokeStyle='rgba(236,205,137,.92)';c.lineWidth=Math.max(1.25,this.dpr||1);c.lineJoin='round';c.lineCap='round';c.shadowColor='rgba(222,177,82,.55)';c.shadowBlur=4;c.stroke();c.restore();
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
      if(move.replay)return move.replay.skyCaptured?(this.currentFrameItem(move.to.focus)?.world||origin):(move.fromAnchor||origin);
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
    replayDepartureAnnotations(mono){
      const move=this.cameraTween;
      return move?.replay?.departureAnnotations&&mono-move.start<window.SolarRingTour.settings.annotationHide*1000?move.replay.departureAnnotations:null;
    }
    openingLabelOpacity(mono=performance.now(),id=null) {
      const departure=this.replayDepartureAnnotations(mono);
      if(departure)return (departure.labels.get(id)||0)*this.ringTourReturnOpacity(mono);
      if(this.openingAnnotationStart===Infinity)return 0;
      const returned=this.ringTourReturnOpacity(mono);
      if(!Number.isFinite(this.openingAnnotationStart))return returned;
      // Names appear after each body's sweep finishes.
      const delay=this.openingOrbitDelays?.get(id)||0;
      const p=clamp((mono-this.openingAnnotationStart-delay)/OPENING_ANNOTATION_FADE,0,1);
      // Smooth onset and finish, shared with the orbit drawing curve.
      return p*p*(3-2*p)*returned;
    }
    ringTourReturnOpacity(mono=performance.now()) {
      if(this.cameraTween?.replay?.departureAnnotations&&this.replayDepartureAnnotations(mono))return window.SolarRingTour.departureAnnotationOpacity((mono-this.cameraTween.start)/1000);
      return this.ringTour&&!this.ringTour.annotationReveal?this.ringTour.annotationOpacity():1;
    }
    syncRingTourAnnotations(tour,mono) {
      if(tour.replayBridge)return;
      if(tour.state!=='returning'&&tour.state!=='complete')return;
      const remaining=Math.max(0,tour.returnDuration-tour.returnAge)*1000,lead=window.SolarRingTour.settings.annotationLead*1000;
      if(!tour.annotationReveal&&remaining>lead)return;
      const start=mono+remaining-lead;
      if(!tour.annotationReveal){this.scheduleOpeningAnnotations(start,0);tour.annotationReveal=true;}
      // The flight clock pauses/throttles with rendering. Follow its actual
      // arrival, but keep the same random styles and offsets across handoff.
      this.openingOrbitStart=start;this.openingAnnotationStart=start+ORBIT_SCAN.duration;
      this.invalidatePresentation(OPENING_ANNOTATION_FADE+ORBIT_SCAN.stagger,this.openingAnnotationStart);
    }
    openingOrbitOpacity(mono=performance.now(),id=null) {
      // Keep the existing orbit geometry while shared travel opacity fades it.
      const departure=this.replayDepartureAnnotations(mono);
      if(departure)return departure.orbits.get(id)||0;
      if(this.openingOrbitStart===Infinity)return 0;
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
        const font=satellite?8:this.w<680?9:10,h=font+10,w=this.labelWidth(c,b,font);
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
    labelWidth(c,body,font=body.parent?8:this.w<680?9:10) {
      const satellite=!!body.parent;c.font=`500 ${font}px "Segoe UI", Arial, sans-serif`;
      if('letterSpacing' in c)c.letterSpacing=satellite?'1px':'1.65px';
      const widths=this.labelWidths||(this.labelWidths=new Map()),key=font+':'+satellite+':'+body.en;
      let width=widths.get(key);if(width===undefined){width=c.measureText(body.en).width+10;widths.set(key,width);}return width;
    }
    prepareRingTourReturn(tour,bodies,ms) {
      // Start as retreat begins, not after the camera is home. GPU uploads, label
      // metrics and normal-view texture requests share their existing owners.
      if(tour.state!=='returning')return false;
      if(this.options.orbitBrightness>0){
        for(const path of this.paths)this.gpu.prepareOrbit('solar:'+path.body.id,this.orbitModel(path),4);
        for(const item of this.satelliteLayouts)this.gpu.prepareOrbit('satellite:'+item.body.id,this.satelliteOrbitModel(item.body,ms),4);
      }
      this.ctx.save();for(const item of bodies)this.labelWidth(this.ctx,item.body);this.ctx.restore();
      tour.returnPrepared=true;return true;
    }
    updateProjectionAnchor() {
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
    }
    updateFrameBodies(ms) {
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
      return {bodies,satelliteLayouts};
    }
    ringTourHit(x,y) {
      if(this.ringTour||this.cameraTween||!this.gpu||!window.SolarRingTour)return false;
      const p=this.currentFrameItem('saturn');if(!p||p.r<.25||p.screen.behind)return false;
      const dx=(x-p.screen.x)/p.r,dy=(y-p.screen.y)/p.r;
      if(Math.hypot(dx,dy)<1.06)return false;
      const frame=this.bodyFrame(p.body),{u,v}=frame,det=u.x*v.y-u.y*v.x;if(Math.abs(det)<.025)return false;
      const point=[(dx*v.y-dy*v.x)/det,0,(dy*u.x-dx*u.y)/det],r=Math.hypot(point[0],point[2]);
      const axis=window.SolarRingTour.screenAxis(frame);
      return r>SATURN_RING_SELECTION.inner&&r<SATURN_RING_SELECTION.hitOuter?{point,side:dx*axis[0]+dy*axis[1]<0?-1:1}:false;
    }
    canStartRingTour(fromOpening=false) {
      if(this.ringTour||(this.cameraTween&&!(fromOpening&&this.cameraTween.timing==='opening'))||!this.gpu||!window.SolarRingTour)return false;
      const p=this.currentFrameItem('saturn'),g=this.gpu;
      return !!(p?.directJob&&p.r>0&&Number.isFinite(p.r)&&!p.screen.behind&&Number.isFinite(p.screen.x)&&Number.isFinite(p.screen.y)&&
        !g.contextLost&&!g.gl.isContextLost()&&g.textures.get('saturn')?.texture&&g.textures.get('saturn-ring')?.texture&&g.gl.getExtension('ANGLE_instanced_arrays'));
    }
    clearPreparedTour(){this.preparedRingTour?.dispose();this.preparedRingTour=null;}
    prepareOpeningTour(){
      if(this.preparedRingTour||this.ringTour||!this.gpu||!window.SolarRingTour)return;
      const p=this.currentFrameItem('saturn');if(!p||!Number.isFinite(p.r)||!Number.isFinite(p.screen.x))return;
      try{
        this.preparedRingTour=new window.SolarRingTour({frame:this.bodyFrame(p.body),radius:Math.max(1,p.r),width:this.w,height:this.h,screen:p.screen,grainStyle:rand=>this.flightParticleStyle(rand),particleCapacity:window.SolarPerformance?.particleCapacity?.(this.options.quality)??1,deferPreparation:true,pointified:p.r<BODY_POINT.fadeBegin});
      }catch(error){this.preparedRingTourError=error.message;this.clearPreparedTour();}
      finally{this.gpu.resetBindings();this.dirty=true;}
    }
    ringTourDeparturePose(item) {
      const pose=window.SolarRingTour.viewPose({frame:this.bodyFrame(item.body),radius:item.r,width:this.w,height:this.h,screen:item.screen});
      if(item.r<BODY_POINT.fadeBegin)return {...pose,perspective:1,pointified:true};
      // Express the live normal-camera lens in the ring camera's local frame.
      // The former handoff copied position and rotation but silently reset this
      // value to orthographic, so a separate screen correction had to catch up
      // after the transition had already begun.
      const axes=A.bodyAxes(item.body),units=this.bodyRadiusAtZoom(item.body)/this.scale,worldForward=frameVectorToWorld(axes,pose.forward);
      const delta={x:worldForward[0]*units,y:worldForward[1]*units,z:worldForward[2]*units};
      const base=this.projectView(item.world,true).denominator??1,probe={
        x:item.world.x+delta.x,y:item.world.y+delta.y,z:item.world.z+delta.z,
        depthX:(item.world.depthX??item.world.x)+delta.x,
        depthY:(item.world.depthY??item.world.y)+delta.y,
        depthZ:(item.world.depthZ??item.world.z)+delta.z
      },next=this.projectView(probe,true).denominator??base;
      pose.perspective=clamp(pose.orthoScale*(next-base)/Math.max(DOLLY.nearRatio,Math.abs(base)),0,1);
      return pose;
    }
    captureOpeningFlight(mono){
      mono=this.animationMono(mono);
      const p=this.currentFrameItem('saturn');if(!p||p.screen.behind||!(p.r>0))return;
      const pose=this.ringTourDeparturePose(p),previous=this.openingFlight;
      const move=this.cameraTween?.timing==='opening'?this.cameraTween:null;
      // Keep the last opening curvature as well as velocity. A slow frame may
      // finish the tween before the app performs the Saturn handoff.
      const turn=move?this.openingTurn(move,clamp((mono-move.start)/move.duration,0,1)):(previous?.turn||0);
      const dt=previous?(mono-previous.mono)/1000:0,velocity={},acceleration={};
      if(dt>0&&dt<.25){
        for(const key of ['eye','offset','right','up','forward'])velocity[key]=pose[key].map((v,i)=>(v-previous.pose[key][i])/dt);
        velocity.orthoScale=(pose.orthoScale-previous.pose.orthoScale)/dt;
        velocity.perspective=(pose.perspective-previous.pose.perspective)/dt;
        const previousDt=previous.sampleDt;
        if(previous.velocity&&previousDt>0&&previousDt<.25){
          const accelerationDt=(dt+previousDt)*.5;
          for(const key of ['eye','offset','right','up','forward'])if(previous.velocity[key])
            acceleration[key]=velocity[key].map((v,i)=>(v-previous.velocity[key][i])/accelerationDt);
          for(const key of ['orthoScale','perspective'])if(Number.isFinite(previous.velocity[key]))
            acceleration[key]=(velocity[key]-previous.velocity[key])/accelerationDt;
        }
      }
      this.transitionManager().set('handoff',{mono,pose,velocity,acceleration,sampleDt:dt,turn});
    }
    startRingTour(target,fromOpening=false,mono=performance.now(),returnAfterLap=false,returnTargetOverride=null) {
      mono=this.animationMono(mono);
      return this.startRingTourNow(target,fromOpening,mono,returnAfterLap,returnTargetOverride,false);
    }
    startRingTourNow(target,fromOpening=false,mono=performance.now(),returnAfterLap=false,returnTargetOverride=null,continueParticles=false) {
      mono=this.animationMono(mono);
      if(!this.canStartRingTour(fromOpening))return false;
      const p=this.currentFrameItem('saturn');
      const openingProjection=fromOpening?this.ringTourNormalProjection():null;
      // The return belongs to the pre-travel view, not the handoff's transient pose.
      const returnSource=Renderer.validCamera(returnTargetOverride)?returnTargetOverride:fromOpening&&this.cameraTween?this.cameraTween.to:this.cameraSnapshot();
      const returnCamera={...returnSource};
      const handoff=this.transitionManager().handoff;
      if(fromOpening){
        const axis=window.SolarRingTour.screenAxis(this.bodyFrame(p.body));
        const move=this.cameraTween,capturedTurn=handoff?.turn;
        const turn=Number.isFinite(capturedTurn)?capturedTurn:(move?this.openingTurn(move,clamp((mono-move.start)/move.duration,0,1)):0);
        target={side:(p.screen.x-this.w/2)*axis[0]+(p.screen.y-this.h/2)*axis[1]<0?-1:1,turnSign:-Math.sign(turn)};
        // Freeze the camera while its existing particle afterglow continues.
        if(this.cameraTween)this.cancelCameraTween(mono,true);
      }
      this.prepareCloseup('saturn');this.ringTourHover=false;
      const startPose=fromOpening&&handoff?.pose?handoff.pose:this.ringTourDeparturePose(p);
      this.ringTour=new window.SolarRingTour({frame:this.bodyFrame(p.body),radius:p.r,width:this.w,height:this.h,screen:p.screen,startPose,target,light:p.directJob.light,phase:p.directJob.phase||0,grainStyle:rand=>this.flightParticleStyle(rand),openingVelocity:fromOpening?(handoff?.velocity||{}):null,openingAcceleration:fromOpening?(handoff?.acceleration||{}):null,prepared:fromOpening?this.preparedRingTour:null,particleCapacity:window.SolarPerformance?.particleCapacity?.(this.options.quality)??1,lensZoom:this.camera.zoom,deferPreparation:true,pointified:p.r<BODY_POINT.fadeBegin});
      if(fromOpening)this.preparedRingTour=null;
      if(openingProjection)this.ringTour.entryNormalProjection=openingProjection;
      this.flightLook=null;this.lookRelease=null;
      if(this.flightBank)this.ringTour.returnNormalFrom=this.ringTourNormalProjection();
      this.bankRelease=null;
      if(fromOpening)this.ringTour.lastMono=mono;
      this.transitionManager().set('handoff',null);
      this.ringTour.worldUnits=this.bodyRadiusAtZoom(p.body)/this.scale;
      this.ringTour.openingResume=fromOpening;
      this.ringTour.returnTarget=returnCamera;
      if(fromOpening&&returnAfterLap)this.ringTour.homeAfterAge=window.SolarRingTour.settings.entry+this.ringTour.period;
      this.ringTour.job={...p.directJob,textureWidth:4096,priority:2};
      // Boot, T, the Saturn card and ring-click entry share the reviewed t1 particle lifecycle.
      if(!continueParticles)this.startSaturnParticles(this.ringTour,mono,fromOpening);
      this.hitTargets.length=0;this.hover=null;this.invalidatePresentation();
      return true;
    }
    drawRingTourHover(c) {
      if(!this.ringTourHover||this.ringTour)return;
      const p=this.currentFrameItem('saturn');if(!p||p.screen.behind)return;
      const {u,v}=this.bodyFrame(p.body);c.save();c.strokeStyle='rgba(210,226,244,.65)';c.lineWidth=.8;
      for(const radius of [SATURN_RING_SELECTION.inner,SATURN_RING_SELECTION.outer]){
        c.beginPath();let connected=false;
        for(let i=0;i<=128;i++){
          const a=i*TAU/128,x=(u.x*Math.cos(a)+v.x*Math.sin(a))*radius,y=(u.y*Math.cos(a)+v.y*Math.sin(a))*radius,z=(u.z*Math.cos(a)+v.z*Math.sin(a))*radius;
          if(z<0&&Math.hypot(x,y)<1.02){connected=false;continue;}
          const sx=p.screen.x+x*p.r,sy=p.screen.y+y*p.r;
          if(connected)c.lineTo(sx,sy);else c.moveTo(sx,sy);connected=true;
        }
        c.stroke();
      }
      c.restore();
    }
    endRingTour(prepareReplay=false) {
      if(!this.ringTour)return false;
      const field=this.openingParticles;
      if(field?.replay?.saturnTour===this.ringTour)this.fadeOpeningParticleField(performance.now(),PARTICLE_TRANSITION.finalFade,field);
      if(prepareReplay){this.clearPreparedTour();this.preparedRingTour=this.ringTour;}
      else this.ringTour.dispose();this.ringTour=null;
      if(this.autoRotation)this.autoRotation.mono=null;
      this.gpu?.resetBindings();this.dirty=true;this.invalidatePresentation();return true;
    }
    drawRingTour(ms,seconds,mono) {
      mono=this.animationMono(mono);
      const tour=this.ringTour,gpu=this.gpu;
      if(!tour)return false;
      if(gpu.contextLost||gpu.gl.isContextLost()){this.endRingTour();return false;}
      tour.animationPaused=!!this.animationPaused;
      tour.particleBudget=clamp((this.travelParticleBudget?.value??1)/(tour.particleCapacity||1),0,1);
      tour.advance(mono);
      if(!this.animationPaused&&tour.state==='cruising'&&Number.isFinite(tour.homeAfterAge)&&tour.age>=tour.homeAfterAge){
        tour.homeAfterAge=null;this.animateCamera(tour.returnTarget||this.cameraSnapshot(),mono);
      }
      if(this.openingParticles?.ringReturn&&tour.state==='returning'){
        this.openingParticles.start=mono-tour.returnAge*1000;this.openingParticles.duration=tour.returnDuration*1000;
      }
      if(tour.state==='returning'&&tour.returnTarget&&!tour.returnTargetApplied){
        // Once the entry lens is fully perspective, its old overview map no
        // longer contributes to the picture. Reusing that stale map on Home
        // pulled distant planets toward their pre-entry pixels and made them
        // rise vertically before snapping into the destination view.
        tour.returnNormalFrom=this.ringTourReturnNormalFrom(tour);tour.entryNormalProjection=null;
        this.camera={...tour.returnTarget};this.cameraTween=null;this.trackingAnchor=null;this.projectionAnchor=null;
        this.setDollyMode(tour.returnTarget.mode==='move',false,mono);this.rebuild(ms);this.updateFrameBodies(ms);this.updateProjectionAnchor();
        tour.setReturnView(this.ringTourReturnView(this.currentFrameItem('saturn')));
        tour.returnTargetApplied=true;
      }
      this.syncRingTourAnnotations(tour,mono);
      if(tour.state==='complete'){this.endRingTour(!!tour.replayBridge);return false;}
      this.ctx.clearRect(0,0,this.w,this.h);this.frameCount++;
      const body=A.BODIES.find(b=>b.id==='saturn'),axes=A.bodyAxes(body),physical=this.physicalAt(body,ms),length=Math.hypot(physical.x,physical.y,physical.z)||1;
      tour.phase=A.rotationAt(body,ms)/TAU;tour.job.phase=tour.phase;
      tour.light=[axes.u,axes.pole,axes.v].map(v=>-(v.x*physical.x+v.y*physical.y+v.z*physical.z)/length);
      const camera=tour.skyCamera(axes,this.camera);
      this.sky.draw(seconds,this.replaySkyCamera(camera,mono),this.options,this.manualBackgroundStars?.offset);
      const presentation=this.replayPresentation(mono),solar=presentation.solar,pointSolar=this.openingPointOpacity(mono,solar);this.setReplaySolarOpacity(solar);
      const slide=this.replaySceneSlide(mono),flightPose=tour.pose;
      if(slide&&tour.replayBridge?.takeoff)tour.pose=this.replayRingScenePose(tour,slide);
      try{
      if(gpu.begin()){
        gpu.externalTextureBytes=(this.sky?.memoryUsage?.().textures||0)+tour.memoryUsage();
        try{if(solar>0)this.drawRingTourBodies(tour,axes,slide?tour.skyCamera(axes,this.camera).viewAxes:camera.viewAxes,ms,seconds,mono);}catch(error){this.ringTourError=error.message;this.endRingTour();return false;}
        gpu.end();
      }
      if(solar>0&&!tour.usesWarpParticles&&tour.flightField.alpha>0){
        const frame=tour.grainProjection(this.w,this.h);
        this.drawParticlePass(this.ctx,mono,()=>this.drawFlightParticles(this.ctx,tour.flightField,(p,f,out)=>tour.projectGrain(p,f,out,this.w,this.h,frame)),presentation);
      }
      this.drawRingTourAnnotations(tour,ms,mono);
      if(pointSolar>0){this.ctx.save();for(const item of this.frameBodies)this.drawBodyPoint(this.ctx,item,this.frameBodies,pointSolar);this.ctx.restore();}
      }finally{tour.pose=flightPose;}
      this.drawOpeningParticles(this.ctx,mono,presentation);
      if(this.autoRotation)this.autoRotation.mono=null;
      this.presentationDirty=false;this.presentedResources=this.resourceSignature();return true;
    }
    replayRingScenePose(tour,slide) {
      const from=tour.replayBridge.takeoff.from,focal=this.h/(2*Math.tan(from.fov*Math.PI/360));
      // Keep the existing opposite screen slide, but inherit the live flight eye.
      // Freezing the entire departure pose erased cruise translation from both
      // ring geometry and nearby grains even though the flight kept advancing.
      return {...from,eye:tour.pose.eye,offset:[from.offset[0]+slide.x/focal,from.offset[1]-slide.y/focal]};
    }
    drawRingTourBodies(tour,axes,view,ms,seconds,mono) {
      // Reuse the normal ephemeris, size rules, material jobs and GPU planet renderer.
      // Only the camera transform changes; there is no second set of planetary shaders.
      if(this.dirty||!Number.isFinite(this.lastPathMs)||A.modelYear(ms)!==this.pathYear)this.rebuild(ms);
      const {bodies}=this.updateFrameBodies(ms),saturn=this.currentFrameItem('saturn');
      this.updateProjectionAnchor();
      this.updateRingTourTracking(tour,saturn);
      const returning=this.prepareRingTourReturn(tour,bodies,ms);
      const saturnRadius=this.bodyRadiusAtZoom(saturn.body),units=tour.worldUnits||saturnRadius/this.scale;
      const projection=tour.projection=this.prepareRingTourProjection({tour,axes,saturn:saturn.world,saturnRadius,units,focal:this.h/(2*Math.tan(tour.pose.fov*Math.PI/360))});
      const project=v=>[
        v.x*view.right[0]+v.y*view.right[1]+v.z*view.right[2],
        v.x*view.down[0]+v.y*view.down[1]+v.z*view.down[2],
        v.x*view.forward[0]+v.y*view.forward[1]+v.z*view.forward[2]];
      const jobs=this.compatSurfaceJobs;jobs.length=0;jobs.push(tour.job);
      const visible=this.directBodies;visible.length=0;
      for(const item of bodies){
        const normalScreen=item.tourNormalScreen||(item.tourNormalScreen={}),s=item.screen,baseRadius=item.r;
        this.projectRingTourPoint(projection,item.world,s,baseRadius,normalScreen);item.r=s.radius;
        item.tourLocal=[s.localX,s.localY,s.localZ];if(item===saturn)continue;
        const normalRadius=baseRadius*normalScreen.perspective;
        const visibleNow=this.visible(s,item.r*2.5+16),prepareReturn=returning&&this.visible(normalScreen,normalRadius*2.5+16);
        if(!visibleNow&&!prepareReturn)continue;
        const job=this.surfaceJob(item.body,item.physical,Math.max(visibleNow?item.r:0,prepareReturn?normalRadius:0),ms,seconds,true,item.directJob,mono),bodyAxes=A.bodyAxes(item.body);
        const frame=item.tourFrame||(item.tourFrame={u:new Float32Array(3),v:new Float32Array(3),pole:new Float32Array(3)});
        for(const key of ['u','v','pole'])frame[key].set(project(bodyAxes[key]));job.frame=frame;
        const magnitude=Math.hypot(item.physical.x,item.physical.y,item.physical.z)||1;
        job.light=project({x:-item.physical.x/magnitude,y:-item.physical.y/magnitude,z:-item.physical.z/magnitude});
        jobs.push(job);if(visibleNow)visible.push(item);
      }
      this.gpu.prepare(jobs);visible.sort((a,b)=>a.screen.z-b.screen.z);
      // Share the normal far-to-near body ordering. The tour pass must not
      // cover foreground planets just because it owns a separate shader.
      let tourDrawn=false;
      for(const item of visible){
        if(!tourDrawn&&item.screen.z>=saturn.screen.z){tour.draw(this.gpu,this.w,this.h);tourDrawn=true;}
        if(item.body.id==='sun'&&this.options.activity)this.gpu.corona(this.coronaSource(item.r),item.screen,item.r,seconds);
        this.gpu.planet(item.directJob,item.body,item.screen,item.r,seconds,this.options.activity);
      }
      if(!tourDrawn)tour.draw(this.gpu,this.w,this.h);
      tour.visibleBodies=visible.map(item=>item.body.id);this.projected=bodies;
      this.checkReplayClearance(mono,bodies);
    }
    updateRingTourTracking(tour,item) {
      if(tour.replayBridge)return;
      if(tour.state==='returning'){
        tour.updateReturnView(this.ringTourReturnView(item));
        tour.pose=tour.cameraPose();return;
      }
      if(tour.state!=='entering'||tour.openingResume)return;
      // Keep the departure view tied to the live ephemeris until the existing
      // approach takes over. A frozen snapshot makes only Saturn stop moving
      // at high time rates, while the shared body projection keeps orbiting.
      tour.entryView=this.ringTourReturnView(item);
      tour.entryView.perspective=tour.startPose.perspective;
      tour.pose=tour.cameraPose();
    }
    ringTourReturnNormalFrom(tour) {
      // The return advances once before this handoff is applied. Inspect the
      // captured takeoff lens, not that first in-between frame.
      const perspective=tour.returnFrom?.perspective??tour.pose.perspective;
      if(perspective>=1-1e-6)return null;
      return tour.entryNormalProjection||this.ringTourNormalProjection();
    }
    ringTourMappedView(world,map,reference) {
      const values=[world.x,world.y,world.z,world.depthX??world.x,world.depthY??world.y,world.depthZ??world.z];
      const clip=map.origin.map((v,row)=>v+map.columns.reduce((sum,col,i)=>sum+col[row]*values[i],0));
      const depth=Math.max(DOLLY.nearRatio,Math.abs(clip[2])),f=this.h/(2*Math.tan(reference.fov*Math.PI/360));
      const orthoScale=f*depth/map.radius,length=Math.hypot(...reference.eye);
      return {...reference,eye:reference.eye.map(v=>v/length*Math.max(1.08,orthoScale)),orthoScale,
        offset:[(clip[0]/depth-this.w/2)/f,(this.h/2-clip[1]/depth)/f]};
    }
    ringTourReturnView(item) {
      // Saturn can be behind the destination camera (e.g. Uranus tracking).
      // Build the reference from UNCLIPPED coordinates, never NaN screen pixels.
      // Positive normalization preserves clip-space front/back classification.
      const v=this.projectView(item.world,true),depth=Math.max(DOLLY.nearRatio,Math.abs(v.denominator??1));
      const screen={x:this.cx+v.x*this.scale/depth,y:this.cy+v.y*this.scale/depth},radius=item.r/depth;
      const pose=window.SolarRingTour.viewPose({frame:this.bodyFrame(item.body),radius,width:this.w,height:this.h,screen});
      return radius<BODY_POINT.fadeBegin?{...pose,perspective:1,pointified:true}:pose;
    }
    ringTourNormalProjection(radius=this.bodyRadiusAtZoom(A.BODIES.find(b=>b.id==='saturn'))) {
      // Capture the existing projection owner, including true-scale depth,
      // as an affine clip-space map. Retargeting home can then blend lenses
      // without changing other planets on the first return frame.
      const keys=['x','y','z','depthX','depthY','depthZ'],zero=Object.fromEntries(keys.map(k=>[k,0]));
      const sample=p=>{const v=this.projectView(p,true),w=v.denominator??1;return [this.cx*w+v.x*this.scale,this.cy*w+v.y*this.scale,w];};
      const origin=sample(zero),columns=keys.map(key=>sample({...zero,[key]:1}).map((v,i)=>v-origin[i]));
      return {origin,columns,radius};
    }
    prepareRingTourProjection(projection) {
      const {tour,axes,saturn,saturnRadius,units}=projection,unit=tour.startPose.orthoScale;
      if(tour.replayBridge?.correction){projection.correction=tour.replayBridge.correction;return projection;}
      // Compile the normal-view lens correction once per frame. Each point
      // then needs only dot products, not closures, temporary arrays or another
      // normal projection. Columns 3–5 retain the actual-scale depth mapping.
      const correction=(reference,map)=>{
        const w=reference.orthoScale/unit,depth=map.origin[2]+map.columns.reduce((sum,col,i)=>sum+col[2]*([saturn.x,saturn.y,saturn.z,saturn.depthX??saturn.x,saturn.depthY??saturn.y,saturn.depthZ??saturn.z][i]),0);
        const gain=w/Math.max(DOLLY.nearRatio,Math.abs(depth)),f=this.h/(2*Math.tan(reference.fov*Math.PI/360)),k=f/unit;
        const matrix=Array.from({length:3},(_,row)=>[map.origin[row]*gain,...map.columns.map(col=>col[row]*gain)]);
        for(const [row,axis,sign] of [[0,reference.right,-1],[1,reference.up,1]]){
          const v=['x','y','z'].map(key=>(axes.u[key]*axis[0]+axes.pole[key]*axis[1]+axes.v[key]*axis[2])*k/units);
          for(let i=0;i<3;i++)matrix[row][i+1]+=sign*v[i];
          matrix[row][0]-=sign*(v[0]*saturn.x+v[1]*saturn.y+v[2]*saturn.z+k*(axis[0]*reference.eye[0]+axis[1]*reference.eye[1]+axis[2]*reference.eye[2]));
        }
        matrix[0][0]-=(this.w/2+reference.offset[0]*f)*w;
        matrix[1][0]-=(this.h/2-reference.offset[1]*f)*w;matrix[2][0]-=w;
        const perspective=reference.perspective||0;
        if(perspective>0&&perspective<1){
          // Subtract the captured lens, not an orthographic stand-in. Otherwise
          // its depth is applied twice on the very first travel frame.
          const forward=reference.forward,coeff=['x','y','z'].map(key=>(axes.u[key]*forward[0]+axes.pole[key]*forward[1]+axes.v[key]*forward[2])/units/unit);
          const constant=-coeff[0]*saturn.x-coeff[1]*saturn.y-coeff[2]*saturn.z-flightDot(forward,reference.eye)/unit-w;
          for(const [row,gain] of [[0,this.w/2+reference.offset[0]*f],[1,this.h/2-reference.offset[1]*f],[2,1]]){
            matrix[row][0]-=gain*perspective*constant;
            for(let i=0;i<3;i++)matrix[row][i+1]-=gain*perspective*coeff[i];
            matrix[row]=matrix[row].map(value=>value/(1-perspective));
          }
        }
        return {matrix,radius:(map.radius*gain-k)/saturnRadius/(perspective>0&&perspective<1?1-perspective:1)};
      };
      let current=correction(tour.returnTo||tour.entryView||tour.startPose,tour.entryNormalProjection||this.ringTourNormalProjection(saturnRadius));
      // A banked/warped normal view is captured early for the eventual exit,
      // but it must not participate while the entry camera owns the scene.
      // Applying the return map with returnProgress(0) replaced the opening map
      // on every entering frame and created a second, hidden handoff.
      if(tour.returnNormalFrom&&(tour.state==='returning'||tour.state==='complete')){
        const reference=tour.entryView||tour.startPose;
        const from=correction(tour.liveReturn?this.ringTourMappedView(saturn,tour.returnNormalFrom,reference):reference,tour.returnNormalFrom),t=tour.returnProgress(tour.returnNormalStart||0);
        current={matrix:current.matrix.map((row,i)=>row.map((v,j)=>mix(from.matrix[i][j],v,t))),radius:mix(from.radius,current.radius,t)};
      }
      projection.correction=current;return projection;
    }
    projectRingTourPoint(projection,world,out,radius=0,normal=null) {
      const {tour,axes,saturn,saturnRadius,units,focal,correction}=projection,pose=tour.pose;
      if(normal)this.project(world,normal);
      const local=framePointToLocal(axes,saturn,units,world,projection.localPoint||(projection.localPoint=[0,0,0]));
      out.localX=local[0];out.localY=local[1];out.localZ=local[2];
      const dx=out.localX-pose.eye[0],dy=out.localY-pose.eye[1],dz=out.localZ-pose.eye[2];
      const depth=pose.forward[0]*dx+pose.forward[1]*dy+pose.forward[2]*dz,unit=tour.startPose.orthoScale;
      // One moving camera owns Saturn, every other body and every orbit point.
      // The initial correction only aligns the exact departure frame. A tiny
      // Saturn releases it over one short handoff while its perspective camera
      // remains active, so no body follows a separate depth/scale transition.
      const bodyDepth=mix(pose.orthoScale,depth,pose.perspective);
      let remainder=1-pose.perspective;
      if(tour.pointified&&tour.state==='entering')remainder=1-ease(tour.age/POINT_TOUR_CAMERA_HANDOFF);
      else if(tour.state==='returning'&&tour.returnTo?.pointified){
        if(!Number.isFinite(tour.returnCorrectionStart))tour.returnCorrectionStart=Number.isFinite(tour.projectionCorrectionWeight)?tour.projectionCorrectionWeight:tour.pointified?1-ease(tour.age/POINT_TOUR_CAMERA_HANDOFF):0;
        remainder=mix(tour.returnCorrectionStart,1,ease(tour.returnAge/Math.max(.001,tour.returnDuration)));
      }
      tour.projectionCorrectionWeight=remainder;
      const w=bodyDepth/unit,k=focal/unit;
      out.clipX=(this.w/2+pose.offset[0]*focal)*w+(pose.right[0]*dx+pose.right[1]*dy+pose.right[2]*dz)*k;
      out.clipY=(this.h/2-pose.offset[1]*focal)*w-(pose.up[0]*dx+pose.up[1]*dy+pose.up[2]*dz)*k;out.clipW=w;
      for(let i=0;i<3;i++){const row=correction.matrix[i];
        out[i===0?'clipX':i===1?'clipY':'clipW']+=remainder*(row[0]+row[1]*world.x+row[2]*world.y+row[3]*world.z+row[4]*(world.depthX??world.x)+row[5]*(world.depthY??world.y)+row[6]*(world.depthZ??world.z));
      }
      out.clipRadius=radius*(k/saturnRadius+correction.radius*remainder);
      out.behind=out.clipW<=.0001;out.z=-depth;
      const safeW=Math.max(.0001,out.clipW);
      out.x=out.clipX/safeW;out.y=out.clipY/safeW;out.radius=out.clipRadius/safeW;
      return out;
    }
    drawRingTourAnnotations(tour,ms,mono) {
      const alpha=this.ringTourReturnOpacity();if(alpha<=1e-4||!tour.projection)return;
      const c=this.ctx,brightness=clamp(Number(this.options.orbitBrightness)||0,0,1)*3;
      // Entry and return overlays reuse cached orbit geometry and the body
      // projection above. No second ephemeris solver or persistent line buffers.
      c.save();c.lineWidth=1/(this.gpu?.dpr||this.dpr||1);
      const point={},world={};
      const path=(points,transform,color,opacity,id,origin)=>{
        const reveal=tour.annotationReveal?this.openingOrbitOpacity(mono,id):1,ink=this.orbitInk(id,reveal,origin);
        const baseAlpha=clamp(opacity*brightness,0,1)*alpha*(ink?1:reveal);
        if(reveal<=0)return;
        c.strokeStyle=color;c.globalAlpha=baseAlpha;c.beginPath();let previous=false,x=0,y=0;
        for(let i=0;i<points.length;i++){const p=points[i];this.projectRingTourPoint(tour.projection,transform(p),point);
          if(point.behind||!Number.isFinite(point.x)||!Number.isFinite(point.y)){previous=false;continue;}
          if(ink){
            if(previous){const q=points[i-1];c.globalAlpha=this.orbitInkOpacity(p.x+q.x,p.y+q.y,ink,baseAlpha);
              if(c.globalAlpha>1e-4){c.beginPath();c.moveTo(x,y);c.lineTo(point.x,point.y);c.stroke();}}
          }else if(previous)c.lineTo(point.x,point.y);else c.moveTo(point.x,point.y);
          x=point.x;y=point.y;previous=true;
        }
        if(!ink)c.stroke();
      };
      if(brightness>0){
        for(const orbit of this.paths)path(orbit.points,p=>this.displaySolarPoint(p,orbit.body),orbit.body.id==='earth'?'rgb(110,173,212)':orbit.body.id==='pluto'?'rgb(156,140,128)':'rgb(138,150,168)',this.selected===orbit.body.id?.64:.22,orbit.body.id,this.currentFrameItem(orbit.body.id)?.world);
        for(const item of this.satelliteLayouts)path(this.satelliteOrbitPoints(item.body,ms).points,p=>this.displaySatellitePoint(p,item,item.parent.world,world),item.body.id==='moon'?'rgb(115,156,189)':'rgb(171,158,117)',.26,item.body.id,{x:item.world.x-item.parent.world.x,y:item.world.y-item.parent.world.y});
      }
      c.restore();
      const bodies=this.frameBodies.filter(item=>this.visible(item.screen,item.r+20));
      this.occludeDirectBodies(c,bodies);this.hitTargets.length=0;
      if(this.options.labels){c.save();this.labels(c,bodies,mono);c.restore();}
    }
    drawSolarScene(ms,seconds,mono){
      const c=this.ctx,presentation=this.replayPresentation(mono),solar=presentation.solar,pointSolar=this.openingPointOpacity(mono,solar);this.setReplaySolarOpacity(solar);c.save();c.globalAlpha=solar;
      const {bodies,satelliteLayouts}=this.updateFrameBodies(ms);
      const earth=this.currentFrameItem('earth');
      this.updateProjectionAnchor();
      for(const body of bodies){this.project(body.world,body.screen);body.r*=body.screen.perspective;}
      this.checkReplayClearance(mono,bodies);
      const direct=!!this.gpu&&this.gpu.begin();
      const orbitDirect=direct&&!this.flightLook;
      const orbitBrightness=clamp(Number(this.options.orbitBrightness)||0,0,1),orbitStrength=orbitBrightness*3,orbitFade=this.ringTourReturnOpacity(mono);
      if(orbitBrightness>0&&solar>0) {
        const camera=orbitDirect?this.gpuOrbitCamera():null;
        if(orbitDirect){
          const origin=this.orbitOrigin||(this.orbitOrigin={x:0,y:0,z:0});
          for(const path of this.paths){const selected=this.selected===path.body.id;
            camera.orbitPlane=path.body.id==='pluto'?1:0;
            const localReveal=this.openingOrbitOpacity(mono,path.body.id),ink=this.orbitInk(path.body.id,localReveal,this.currentFrameItem(path.body.id)?.world),alpha=ink?1:localReveal;
            this.gpu.orbit('solar:'+path.body.id,this.orbitModel(path),origin,camera,this.scale,this.cx,this.cy,path.body.id==='earth'?[.43,.68,.83]:path.body.id==='pluto'?[.61,.55,.50]:[.54,.59,.66],clamp((selected?.64:.22)*alpha*orbitStrength,0,1)*orbitFade,1,1,4,ink);}
        }else if(!this.gpu||this.flightLook)for(const path of this.paths)this.orbit(c,path,this.selected===path.body.id,this.openingOrbitOpacity(mono,path.body.id),orbitStrength,orbitFade);
        for(const satellite of satelliteLayouts) {
          const points=orbitDirect?null:this.satelliteOrbitPoints(satellite.body,ms).points,parent=satellite.parent.world;
          const localReveal=this.openingOrbitOpacity(mono,satellite.body.id),ink=this.orbitInk(satellite.body.id,localReveal,{x:satellite.world.x-parent.x,y:satellite.world.y-parent.y}),opacity=ink?1:localReveal;
          if(orbitDirect){this.gpu.orbit('satellite:'+satellite.body.id,this.satelliteOrbitModel(satellite.body,ms),parent,{...camera,solarMorph:satellite.orbitShape,orbitPlane:0},this.scale,this.cx,this.cy,satellite.body.id==='moon'?[.45,.61,.74]:[.67,.62,.46],clamp(.26*opacity*orbitStrength,0,1)*orbitFade,1,1,4,ink);}
          else if(!this.gpu||this.flightLook){
            c.save();c.globalAlpha*=(ink?1:opacity)*orbitFade;const baseAlpha=c.globalAlpha,alpha=clamp(.26*orbitStrength,0,1),strokeAlpha=ink?1:alpha;
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
      // Orbit guides may retain their staged reveal alpha, but planet bodies do
      // not inherit it. Once present, every solid body is painted at full alpha.
      c.globalAlpha=1;
      bodies.sort((a,b)=>a.screen.z-b.screen.z);
      this.hitTargets.length=0;
      const surfaceBodies=this.surfaceBodies;surfaceBodies.length=0;
      for(const p of bodies)if(solar>0&&this.visible(p.screen,this.bodyVisibleRadius(p.body,p.r,{surface:true})))surfaceBodies.push(p);
      surfaceBodies.sort((a,b)=>{
        const focus=Number(b.body.id===this.camera.focus)-Number(a.body.id===this.camera.focus);
        return focus||b.r-a.r;
      });
      const directBodies=this.directBodies;directBodies.length=0;
      if(direct){
        const jobs=this.compatSurfaceJobs;jobs.length=0;
        for(const p of surfaceBodies){this.surfaceJob(p.body,p.physical,p.r,ms,seconds,true,p.directJob,mono);p.directReady=true;jobs.push(p.directJob);}
        this.gpu.externalTextureBytes=this.sky?.memoryUsage?.().textures||0;
        if(solar>0)this.gpu.prepare(jobs);
        const sun=this.currentFrameItem('sun');
        if(solar>0&&sun&&this.options.activity&&this.visible(sun.screen,sun.r*5.1+16))this.gpu.corona(this.coronaSource(sun.r),sun.screen,sun.r,seconds);
        for(const p of bodies){const extent=this.bodyVisibleRadius(p.body,p.r);if(solar<=0||!this.visible(p.screen,extent))continue;
          const job=p.directReady?p.directJob:null;if(job&&this.gpu.planet(job,p.body,p.screen,p.r,seconds,this.options.activity))directBodies.push(p);
        }
        this.gpu.end();
      }else if(!this.gpu&&solar>0){
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
        const extent=this.bodyVisibleRadius(p.body,p.r);
        if(solar<=0||!this.visible(p.screen,extent))continue;
        if(this.gpu)this.drawBodyOverlay(c,p.body,p.screen,p.r);
        else this.drawBody(c,p.body,p.world,p.screen,p.r,ms,seconds);
        this.drawBodyPoint(c,p,direct?directBodies:bodies,pointSolar);
        this.hitTargets.push({id:p.body.id,x:p.screen.x,y:p.screen.y,r:Math.max(p.r+6,11),z:p.screen.z});
      }
      if(solar>0){this.drawRingTourHover(c);this.drawAlignmentGuide(c,ms);this.drawEarthRegionHover(c,earth,ms);this.drawSiteMarker(c,earth,ms,mono);}
      c.restore();
      this.drawOpeningParticles(c,mono,presentation);
      const labelOpacity=this.openingLabelOpacity(mono);
      if(this.options.labels&&labelOpacity>1e-4){const labelBodies=this.labelBodies;labelBodies.length=0;for(const p of bodies)if(this.visible(p.screen,p.r+20))labelBodies.push(p);c.save();this.labels(c,labelBodies,mono);c.restore();}
      else this.clearLabels();
      this.projected=bodies;
      this.presentationDirty=false;this.presentedResources=this.resourceSignature();
    }
    draw(ms,seconds,mono=performance.now()) {
      mono=this.animationMono(mono);
      this.updateTravelParticleBudget(mono);
      const prepared=this.preparedRingTour;
      if(prepared?.needsWarmup()){
        try{prepared.warm(this.gpu,this.w,this.h,3);}
        catch(error){this.preparedRingTourError=error.message;this.clearPreparedTour();}
        finally{this.gpu.resetBindings();}
      }
      this.prepareReplayFrame(mono);
      if(this.drawRingTour(ms,seconds,mono))return;
      this.resumeTravelFocus(mono,ms);
      this.advanceActualScale(mono);this.advanceCamera(mono);this.advanceAutoRotate(mono);
      const c=this.ctx;this.frameCount++;c.clearRect(0,0,this.w,this.h);
      if(this.dirty||!Number.isFinite(this.lastPathMs)||A.modelYear(ms)!==this.pathYear)this.rebuild(ms);
      this.sky.draw(seconds,this.replaySkyCamera(this.bankedSkyCamera(),mono),this.options,this.manualBackgroundStars?.offset);
      this.sky.decorate(c,seconds,this.options,this.boundStarGlow);
      const scene=this.replaySceneContext(this.replaySceneSlide(mono),ms);
      scene.drawSolarScene(ms,seconds,mono);this.adoptReplayScene(scene);
    }
    hit(x,y) {
      if(this.ringTour)return null;
      for(let i=this.hitTargets.length-1;i>=0;i--) {
        const t=this.hitTargets[i];if(t.label?(x>=t.x&&x<=t.x+t.w&&y>=t.y&&y<=t.y+t.h):Math.hypot(x-t.x,y-t.y)<t.r)return t.id;
      }
      return null;
    }
  }
  Renderer.replayFlightTime=replayFlightTime;
  Renderer.frameVectorToLocal=frameVectorToLocal;
  Renderer.frameVectorToWorld=frameVectorToWorld;
  Renderer.framePointToLocal=framePointToLocal;
  Renderer.framePointToWorld=framePointToWorld;
  window.SolarRenderer=Renderer;
})();
