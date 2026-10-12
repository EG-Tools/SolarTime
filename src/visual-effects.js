/* Solar Time v0.47 — visual-effects implementation owner. */
(function(root){
  'use strict';

  const BASE_STAR_COUNT=10000,MAX_STAR_MULTIPLIER=3,MAX_STAR_COUNT=BASE_STAR_COUNT*MAX_STAR_MULTIPLIER;
  const TAU=Math.PI*2;
  // Percentage depths in the preview's 100-unit background volume.
  const STAR_DEPTH_RANGE=Object.freeze({min:8,max:99});
  const STAR_DEPTH_MOTION=Object.freeze({minPeriod:24,maxPeriod:36,minAmplitude:.018,maxAmplitude:.055});
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const fract=value=>value-Math.floor(value);
  const randomGenerator=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  function runtimeSeed(){
    let seed=((Date.now()>>>0)^Math.floor(Math.random()*4294967296))>>>0;
    try{const value=new Uint32Array(1);root.crypto?.getRandomValues?.(value);seed=(seed^value[0])>>>0;}catch(_){/* Artistic fallback. */}
    return seed||0x6d2b79f5;
  }

  function starAppearance(random,index){
    // Independent distributions prevent size, brightness, colour and timing from
    // falling into the same visual pattern. Most stars stay tiny and dim, with
    // progressively rarer medium/large bright points.
    const sizeRoll=random(),brightRoll=random(),rareSize=random(),rareBright=random();
    let size=.14+Math.pow(sizeRoll,3.15)*.88;
    if(rareSize>.994)size+=.34+random()*.45;
    let brightness=.075+Math.pow(brightRoll,2.15)*.66;
    if(rareBright>.989)brightness+=.10+random()*.18;
    size=clamp(size,.14,1.52)*.82;brightness=clamp(brightness,.07,.92);
    // This seed is consumed by independent shader hashes for colour, twinkle
    // period/phase and the rare cross flare. It is not tied to sky position.
    const seed=(index+1)*.754877666+random()*8192;
    return [size,brightness,seed];
  }

  function buildNaturalStarData(total=MAX_STAR_COUNT,seed=runtimeSeed()){
    const random=randomGenerator(seed),data=new Float32Array(total*6);
    for(let i=0;i<total;i++){
      const z=random()*2-1,angle=random()*TAU,radius=Math.sqrt(Math.max(0,1-z*z));
      const [size,brightness,starSeed]=starAppearance(random,i),o=i*6;
      data[o]=Math.cos(angle)*radius;data[o+1]=Math.sin(angle)*radius;data[o+2]=z;
      data[o+3]=size;data[o+4]=brightness;data[o+5]=starSeed;
    }
    return data;
  }
  function starArrayFromData(data){
    if(!(data instanceof Float32Array))return [];
    const stars=new Array(Math.floor(data.length/6));
    for(let i=0;i<stars.length;i++){const o=i*6;stars[i]=[data[o],data[o+1],data[o+2],data[o+3],data[o+4],data[o+5]];}
    return stars;
  }
  function buildNaturalStarPool(_source,total=MAX_STAR_COUNT,seed=runtimeSeed()){return starArrayFromData(buildNaturalStarData(total,seed));}

  const starWorldCache=new WeakMap();
  function starWorldData(source){
    const cached=starWorldCache.get(source);if(cached)return cached;
    const flat=source instanceof Float32Array;
    const count=flat?Math.floor(source.length/6):source.length,data=new Float32Array(count*6);
    for(let i=0;i<count;i++){
      const o=i*6,p=flat?source:source[i],start=flat?o:0;
      const x=p[start],y=p[start+1],z=p[start+2],seed=p[start+5];
      const depth=STAR_DEPTH_RANGE.min+(STAR_DEPTH_RANGE.max-STAR_DEPTH_RANGE.min)*(seed*.125-Math.floor(seed*.125));
      const gain=depth/(Math.hypot(x,y,z)||1);
      data[o]=x*gain;data[o+1]=y*gain;data[o+2]=z*gain;
      data[o+3]=p[start+3];data[o+4]=p[start+4];data[o+5]=seed;
    }
    starWorldCache.set(source,data);return data;
  }
  function starDepthScale(seed,seconds,amplitudeScale=1){
    const period=STAR_DEPTH_MOTION.minPeriod+(STAR_DEPTH_MOTION.maxPeriod-STAR_DEPTH_MOTION.minPeriod)*fract(seed*.4142135623);
    const amplitude=(STAR_DEPTH_MOTION.minAmplitude+(STAR_DEPTH_MOTION.maxAmplitude-STAR_DEPTH_MOTION.minAmplitude)*fract(seed*.7320508076))*amplitudeScale;
    return 1+amplitude*Math.sin(seconds/period*TAU+fract(seed*.6180339887)*TAU);
  }
  function starQuietVisible(x,y,z,seed,zones){
    const length=Math.hypot(x,y,z);if(!length||!zones)return true;
    for(const zone of zones){
      const distance=Math.hypot(x/length-zone.x,y/length-zone.y,z/length-zone.z)/zone.radius,t=clamp((distance-.35)/.9,0,1),quiet=.65*(1-t*t*(3-2*t));
      if(fract(seed*.913571)<quiet)return false;
    }
    return true;
  }
  function uploadStarPoolToSky(sky,stars){
    if(!sky)return;
    let data;if(stars instanceof Float32Array)data=stars;else{const list=Array.isArray(stars)?stars:[];data=new Float32Array(list.length*6);for(let i=0;i<list.length;i++)data.set(list[i],i*6);}
    const count=Math.floor(data.length/6);
    sky.__solarMaxStarCount=count;sky.__solarStarDrawCount=-1;sky.__solarStarSubsetSource=null;sky.__solarStarSubsetCount=-1;sky.__solarStarSubset=null;sky.starPose=null;
    if(sky.gl&&sky.starBuffer&&count){
      sky.gl.bindBuffer(sky.gl.ARRAY_BUFFER,sky.starBuffer);sky.gl.bufferData(sky.gl.ARRAY_BUFFER,starWorldData(data),sky.gl.STATIC_DRAW);
      sky.starCount=count;if(sky.stats){sky.stats.starCount=count;sky.stats.visibleStarCount=0;}
    }
    sky.invalidate?.();
  }
  function regenerateStars(sky){
    if(!root.SolarAssets)return new Float32Array(0);
    const data=buildNaturalStarData(MAX_STAR_COUNT,runtimeSeed());
    root.SolarAssets.starData=data;root.SolarAssets.stars=null;uploadStarPoolToSky(sky,data);return data;
  }

  // Every page/app launch receives a new seed. Reset rebuilds the same maximum
  // GPU pool in place so the visible star positions change immediately.
  if(root.SolarAssets)regenerateStars();

  function drawCount(sky,options={}){const available=Math.min(MAX_STAR_COUNT,sky.starCount||root.SolarAssets?.starData?.length/6||MAX_STAR_COUNT),density=clamp(Number(options.starDensity??1),0,MAX_STAR_MULTIPLIER),count=Math.min(available,Math.round(BASE_STAR_COUNT*density));if(sky.__solarStarDrawCount!==count){sky.__solarStarDrawCount=count;sky.invalidate?.();}if(sky.stats)sky.stats.visibleStarCount=count;return count;}
  function starsFor(sky,options={}){let source=root.SolarAssets?.stars;if(!Array.isArray(source)){source=starArrayFromData(root.SolarAssets?.starData);if(root.SolarAssets)root.SolarAssets.stars=source;}const density=clamp(Number(options.starDensity??1),0,MAX_STAR_MULTIPLIER),count=Math.min(source.length,Math.round(BASE_STAR_COUNT*density));if(count===source.length)return source;if(sky.__solarStarSubsetSource!==source||sky.__solarStarSubsetCount!==count){sky.__solarStarSubsetSource=source;sky.__solarStarSubsetCount=count;sky.__solarStarSubset=source.slice(0,count);}return sky.__solarStarSubset;}
  // Distribution intervals are intentional probabilities, not fixed counts.
  // Red 7% -> 4.9%; yellow 3% -> 2.1%. The freed 3% is split equally between white and blue.
  const STAR_PALETTE=Object.freeze({redEnd:.049,warmEnd:.07,blueStart:.805});
  // White 72% -> 73.5%; blue 18% -> 19.5%. Positions/density are unchanged.
  const STAR_COLORS=Object.freeze([[1,.80,.74],[1,.93,.79],[.985,.99,1],[.77,.88,1]].map(Object.freeze));
  const starColorIndex=tone=>tone<STAR_PALETTE.redEnd?0:tone<STAR_PALETTE.warmEnd?1:tone>STAR_PALETTE.blueStart?3:2;
  const starColor=tone=>STAR_COLORS[starColorIndex(tone)];
  // Integral of the former radial tiny profile over its normalized square.
  // A pixel-area integral retains that average light instead of sampling a
  // subpixel core at a single location. Telescoping CDF differences conserve it.
  const TINY_PROFILE_INTEGRAL=.03430619186;
  function tinyStarMetrics(size,ratio=1){
    const point=clamp(Math.max(size*10*ratio,3),3,29);
    return {point,pixels:Math.ceil(point),radius:Math.max(1,point*.312),energy:point*point*TINY_PROFILE_INTEGRAL};
  }
  function tinyAxisCDF(x,radius){const t=clamp((x+radius)/(2*radius),0,1);return t*t*(3-2*t);}
  function tinyStarCoverage(x,y,size,ratio=1){
    const m=tinyStarMetrics(size,ratio);
    return m.energy*(tinyAxisCDF(x+.5,m.radius)-tinyAxisCDF(x-.5,m.radius))*(tinyAxisCDF(y+.5,m.radius)-tinyAxisCDF(y-.5,m.radius));
  }
  // Paint whole output pixels in compatibility mode. Rescaling even a
  // prefiltered sprite adds a second sampling/8-bit-alpha pass and can shimmer.
  const STAR_CSS_COLORS=STAR_COLORS.map(c=>'rgb('+c.map(v=>Math.round(v*255)).join(',')+')');
  const tinyWeights=new Float64Array(32);
  function drawTinyStar(ctx,x,y,size,brightness,seed,ratio=1,color=''){
    if(!(brightness>0)||!(ratio>0))return;
    const m=tinyStarMetrics(size,ratio),cx=x*ratio,cy=y*ratio,r=m.radius;
    const tone=((seed*.173205+size*.37)%1+1)%1;
    const alpha=ctx.globalAlpha,fill=ctx.fillStyle,energy=alpha*clamp(brightness,0,1)*m.energy;
    ctx.fillStyle=color||STAR_CSS_COLORS[starColorIndex(tone)];
    const left=Math.floor(cx-r),right=Math.ceil(cx+r),bottom=Math.ceil(cy+r),pixel=1/ratio;
    for(let px=left;px<right;px++)tinyWeights[px-left]=tinyAxisCDF(px+1-cx,r)-tinyAxisCDF(px-cx,r);
    for(let py=Math.floor(cy-r);py<bottom;py++){
      const wy=tinyAxisCDF(py+1-cy,r)-tinyAxisCDF(py-cy,r);
      for(let px=left;px<right;px++){
        const wx=tinyWeights[px-left];
        ctx.globalAlpha=energy*wx*wy;ctx.fillRect(px/ratio,py/ratio,pixel,pixel);
      }
    }
    ctx.globalAlpha=alpha;ctx.fillStyle=fill;
  }
  function starShaderSources(precision,quietCount=1){return {vertex:`precision highp float;
    attribute vec3 position,appearance;uniform vec3 right,down,forward,manualEye;uniform vec2 size;uniform vec4 featureQuiet[${quietCount}];uniform float fov,pointScale,seconds;
    varying ${precision} float intensity,starTone,flarePulse,tinyStar,pointPixels,tinyRadius,tinyEnergy,shapePixels;
    void main(){
     float seed=appearance.z;float travelPeriod=mix(24.0,36.0,fract(seed*.4142135623));float travelAmplitude=mix(.018,.055,fract(seed*.7320508076));float travelScale=1.0+travelAmplitude*sin(seconds/travelPeriod*6.28318530718+fract(seed*.6180339887)*6.28318530718);float proximity=1.0/travelScale;
     vec3 relative=position*travelScale-manualEye;
     float distance2=dot(relative,relative);
     float depth=dot(relative,forward);
     if(depth>=0.||depth*depth<=.0064*distance2){gl_Position=vec4(2.,2.,1.,1.);gl_PointSize=1.;return;}
     float twinklePeriod=mix(5.0,25.0,fract(seed*.754877666))*(.7+.6*fract(seed*.381966011));float behavior=fract(seed*.2718281828+appearance.y*.53);float twinkles=step(.70,behavior);float rests=step(.972,behavior);float restVisible=mix(42.0,105.0,fract(seed*.4142135623));float restHidden=mix(5.0,10.0,fract(seed*.318309886));float restCycle=restVisible+restHidden;float restTime=mod(seconds+fract(seed*.56984029)*restCycle,restCycle);float visible=1.-rests*smoothstep(restVisible-2.,restVisible,restTime)*(1.-smoothstep(restCycle-2.,restCycle,restTime));float lively=step(.55,appearance.x);tinyStar=1.-lively;
     float phase=fract(seed*.6180339887)*6.28318530718;float primary=.5+.5*sin(seconds/twinklePeriod*6.28318530718+phase);float secondary=.5+.5*sin(seconds/(twinklePeriod*1.618+3.0)*6.28318530718+fract(seed*.141421356)*6.28318530718);float irregular=primary*.68+secondary*.32;float variation=mix(.96+.04*irregular,.58+.42*irregular,twinkles);float flareWave=pow(max(0.,primary),18.);
     intensity=appearance.y*mix(1.0,variation,lively)*mix(1.0,visible,lively)*mix(1.0,proximity,.22);starTone=fract(seed*.173205+appearance.x*.37);flarePulse=step(.9985,fract(seed*.91337+appearance.y*.71))*flareWave*smoothstep(.50,.84,appearance.y)*lively*mix(1.0,visible,lively);
     if(tinyStar>.5){intensity=appearance.y;flarePulse=0.;}
     vec2 ndc=vec2(dot(relative,right)/(-depth*fov*size.x/size.y),-dot(relative,down)/(-depth*fov));
     for(int i=0;i<${quietCount};i++){vec4 zone=featureQuiet[i];if(zone.w>0.){float quietDistance=length(normalize(position)-zone.xyz)/zone.w;float quiet=.65*(1.-smoothstep(.35,1.25,quietDistance));if(fract(seed*.913571)<quiet){gl_Position=vec4(2.,2.,1.,1.);gl_PointSize=1.;return;}}}
     gl_Position=vec4(ndc,0.,1.);float basePoint=(appearance.x*10.+flarePulse*13.12)*pointScale*mix(1.0,proximity,.35*lively);float point=clamp(max(basePoint,3.0),3.0,29.);
     shapePixels=point;pointPixels=ceil(point);tinyRadius=max(1.,point*.312);tinyEnergy=point*point*${TINY_PROFILE_INTEGRAL};gl_PointSize=pointPixels;
    }`,fragment:`precision ${precision} float;varying ${precision} float intensity,starTone,flarePulse,tinyStar,pointPixels,tinyRadius,tinyEnergy,shapePixels;
    vec3 starColor(float tone){
     if(tone<${STAR_PALETTE.redEnd})return vec3(1.,.80,.74);
     if(tone<${STAR_PALETTE.warmEnd})return vec3(1.,.93,.79);
     if(tone>${STAR_PALETTE.blueStart})return vec3(.77,.88,1.);
     return vec3(.985,.99,1.);
    }
    vec2 starProfile(vec2 q){
     float d=length(q);
     return vec2(1.-smoothstep(.08,.5,d),1.-smoothstep(.015,.21,d));
    }
    void main(){
     if(tinyStar>.5){
      vec2 delta=(gl_PointCoord-.5)*pointPixels;
      vec2 covered=smoothstep(vec2(-tinyRadius),vec2(tinyRadius),delta+.5)-smoothstep(vec2(-tinyRadius),vec2(tinyRadius),delta-.5);
      // No alpha discard or cross flare for tiny stars: both reintroduce popping.
      gl_FragColor=vec4(starColor(starTone),tinyEnergy*covered.x*covered.y*intensity);return;
     }
     vec2 q=(gl_PointCoord-.5)*pointPixels/shapePixels;float d=length(q);
     // Integrate four subpixel locations instead of sampling the sharp core once.
     vec2 tap=vec2(.25/shapePixels,0.);
     vec2 profile=(starProfile(q+tap+tap.yx)+starProfile(q+tap-tap.yx)+starProfile(q-tap+tap.yx)+starProfile(q-tap-tap.yx))*.25;
     float halo=profile.x,core=profile.y;
     float cross=(1.-smoothstep(.012,.042,min(abs(q.x),abs(q.y))))*(1.-smoothstep(.12,.5,max(abs(q.x),abs(q.y))));
     float alpha=(halo*.22+core*.96)*intensity+cross*.58*flarePulse;if(alpha<.002)discard;
     vec3 color=mix(starColor(starTone),vec3(1.),core*.16);
     gl_FragColor=vec4(color,alpha);
    }`};}
  root.SolarVisualEffects=Object.freeze({BASE_STAR_COUNT,MAX_STAR_MULTIPLIER,MAX_STAR_COUNT,runtimeSeed,buildNaturalStarData,buildNaturalStarPool,regenerateStars,drawCount,starsFor,STAR_DEPTH_RANGE,STAR_DEPTH_MOTION,starWorldData,starDepthScale,starQuietVisible,starShaderSources,STAR_PALETTE,starColor,tinyStarMetrics,tinyStarCoverage,drawTinyStar});
})(window);
