/* Solar Time v0.45 r2 — calmer stars, slightly softer Sun motion, and stock Jupiter shading. */
(function(root){
  'use strict';

  const BASE_STAR_COUNT=4400,MAX_STAR_MULTIPLIER=4,MAX_STAR_COUNT=BASE_STAR_COUNT*MAX_STAR_MULTIPLIER;
  const TAU=Math.PI*2;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const randomGenerator=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};

  function starAppearance(random,index){
    // Independent distributions prevent size, brightness, colour and timing from
    // falling into the same visual pattern. Most stars stay tiny and dim, with
    // progressively rarer medium/large bright points.
    const sizeRoll=random(),brightRoll=random(),rareSize=random(),rareBright=random();
    let size=.14+Math.pow(sizeRoll,3.15)*.88;
    if(rareSize>.994)size+=.34+random()*.45;
    let brightness=.075+Math.pow(brightRoll,2.15)*.66;
    if(rareBright>.989)brightness+=.10+random()*.18;
    size=clamp(size,.14,1.52);brightness=clamp(brightness,.07,.92);
    // This seed is consumed by independent shader hashes for colour, twinkle
    // period/phase and the rare cross flare. It is not tied to sky position.
    const seed=(index+1)*.754877666+random()*8192;
    return [size,brightness,seed];
  }

  function buildNaturalStarPool(_source,total=MAX_STAR_COUNT){
    const random=randomGenerator(204031),field=[];
    // True random points on a sphere: z is uniform in [-1,1] and longitude is
    // independent. At 4.4k+ samples this stays globally even while retaining the
    // small natural clusters and gaps that a low-discrepancy lattice removed.
    for(let i=0;i<total;i++){
      const z=random()*2-1,angle=random()*TAU,radius=Math.sqrt(Math.max(0,1-z*z));
      const [size,brightness,seed]=starAppearance(random,i);
      field.push([Math.cos(angle)*radius,Math.sin(angle)*radius,z,size,brightness,seed]);
    }
    return field;
  }

  // Build the maximum pool once. Density changes only the GPU draw count.
  if(root.SolarAssets&&Array.isArray(root.SolarAssets.stars))root.SolarAssets.stars=buildNaturalStarPool(root.SolarAssets.stars);

  const Sky=root.SolarSky;
  if(Sky?.prototype&&!Sky.prototype.__solarStarDensityInstalled){
    const originalDraw=Sky.prototype.draw,originalDecorate=Sky.prototype.decorate;
    Sky.prototype.draw=function(seconds,camera,options={}){
      const available=Math.min(MAX_STAR_COUNT,root.SolarAssets?.stars?.length||MAX_STAR_COUNT);
      const current=Number(this.starCount)||0;
      this.__solarMaxStarCount=Math.max(this.__solarMaxStarCount||0,current,available);
      const density=clamp(Number(options.starDensity??2),0,MAX_STAR_MULTIPLIER);
      const drawCount=Math.min(this.__solarMaxStarCount,Math.round(BASE_STAR_COUNT*density));
      if(this.__solarStarDrawCount!==drawCount){this.__solarStarDrawCount=drawCount;this.invalidate?.();}
      const previous=this.starCount;this.starCount=drawCount;
      try{const result=originalDraw.call(this,seconds,camera,options);if(this.stats)this.stats.visibleStarCount=drawCount;return result;}
      finally{this.starCount=this.__solarMaxStarCount||previous;}
    };
    Sky.prototype.decorate=function(ctx,seconds,options={},glow){
      const source=root.SolarAssets?.stars;if(!Array.isArray(source))return originalDecorate.call(this,ctx,seconds,options,glow);
      const density=clamp(Number(options.starDensity??2),0,MAX_STAR_MULTIPLIER),count=Math.min(source.length,Math.round(BASE_STAR_COUNT*density));
      let subset=source;
      if(count!==source.length){
        if(this.__solarStarSubsetSource!==source||this.__solarStarSubsetCount!==count){this.__solarStarSubsetSource=source;this.__solarStarSubsetCount=count;this.__solarStarSubset=source.slice(0,count);}
        subset=this.__solarStarSubset;
      }
      root.SolarAssets.stars=subset;
      try{return originalDecorate.call(this,ctx,seconds,options,glow);}finally{root.SolarAssets.stars=source;}
    };
    Object.defineProperty(Sky.prototype,'__solarStarDensityInstalled',{value:true});
  }

  function transformStarShader(source){
    if(typeof source!=='string')return source;
    let next=source;
    if(source.includes('attribute vec3 position,appearance;')){
      next=next.replace('varying float intensity;','varying float intensity,starTone,flarePulse;');
      next=next.replace('float z=dot(position,forward),phase=appearance.z;',
        'float z=dot(position,forward),seed=appearance.z;float twinklePeriod=mix(5.0,25.0,fract(seed*.754877666));float behavior=fract(seed*.2718281828+appearance.y*.53);float twinkles=step(.70,behavior);float rests=step(.972,behavior);float restVisible=mix(42.0,105.0,fract(seed*.4142135623));float restHidden=mix(5.0,10.0,fract(seed*.318309886));float restCycle=restVisible+restHidden;float restTime=mod(seconds+fract(seed*.56984029)*restCycle,restCycle);float visible=1.-rests*step(restVisible,restTime);');
      next=next.replace('float pulse=pow(max(0.,sin((seconds+phase)/(6.+phase)*6.28318530718)),16.);',
        'float phase=fract(seed*.6180339887)*6.28318530718;float primary=.5+.5*sin(seconds/twinklePeriod*6.28318530718+phase);float secondary=.5+.5*sin(seconds/(twinklePeriod*1.618+3.0)*6.28318530718+fract(seed*.141421356)*6.28318530718);float irregular=primary*.68+secondary*.32;float variation=mix(.96+.04*irregular,.58+.42*irregular,twinkles);float flareWave=pow(max(0.,primary),18.);');
      next=next.replace('intensity=appearance.y*(.55+pulse*.65);',
        'intensity=appearance.y*variation*visible;starTone=fract(seed*.173205+appearance.x*.37);flarePulse=step(.9985,fract(seed*.91337+appearance.y*.71))*flareWave*smoothstep(.50,.84,appearance.y)*visible;');
      next=next.replace('gl_PointSize=clamp(appearance.x*10.*pointScale,1.,30.);',
        'gl_PointSize=clamp((appearance.x*10.+flarePulse*16.)*pointScale,1.,35.);');
      return next;
    }
    if(source.includes('gl_PointCoord-.5')){
      next=next.replace('varying float intensity;','varying float intensity,starTone,flarePulse;');
      next=next.replace('float alpha=(halo*.24+core*.94+cross*.14)*intensity;if(alpha<.002)discard;',
        'float alpha=(halo*.22+core*.96)*intensity+cross*.58*flarePulse;if(alpha<.002)discard;');
      next=next.replace('vec3 color=mix(vec3(.45,.66,.94),vec3(1.,.99,.96),core);',
        'vec3 color=vec3(.985,.99,1.);if(starTone<.07)color=vec3(1.,.80,.74);else if(starTone<.10)color=vec3(1.,.93,.79);else if(starTone>.82)color=vec3(.77,.88,1.);color=mix(color,vec3(1.),core*.16);');
      return next;
    }
    return source;
  }

  // Surface programs compile after this module loads. The Sun keeps its fine
  // spatial structure, but v0.45 r2 softens the remaining motion another 5%.
  // Jupiter deliberately receives no override and therefore follows the stock
  // gas-giant shader from surface.js exactly as it did before the experiment.
  const SUN_REPLACEMENTS=Object.freeze([
    ['uv.y*49.','uv.y*150.'],['uv.x*PI*10.','uv.x*PI*56.'],
    ['uv.x*PI*16.','uv.x*PI*48.'],['uv.y*31.','uv.y*138.'],
    ['*.0015','*.00121125'],['*.0011','*.0009025'],
    ['uv.x*PI*6.','uv.x*PI*52.'],['uv.y*11.','uv.y*150.'],
    ['uv.x*PI*14.','uv.x*PI*64.'],['uv.y*19.','uv.y*176.'],
    ['-.018+.118*brightCycle','-.00855+.073625*brightCycle'],['-.032+.057*darkCycle','-.01425+.03705*darkCycle'],
    ['vec3(.085,.026,.002)','vec3(.08075,.0247,.0019)']
  ]);

  function transformSurfaceShader(source){
    if(typeof source!=='string'||!source.includes('sunActivity')||!source.includes('kind==2.'))return source;
    let next=source;
    for(const [from,to] of SUN_REPLACEMENTS)next=next.split(from).join(to);
    return next;
  }

  function installShaderPatch(ctor){
    const proto=ctor?.prototype,original=proto?.shaderSource;if(!proto||typeof original!=='function'||original.__solarVisualPatch)return;
    function patchedShaderSource(shader,source){return original.call(this,shader,transformStarShader(transformSurfaceShader(source)));}
    Object.defineProperty(patchedShaderSource,'__solarVisualPatch',{value:true});proto.shaderSource=patchedShaderSource;
  }
  installShaderPatch(root.WebGLRenderingContext);installShaderPatch(root.WebGL2RenderingContext);

  root.SolarVisualEffects=Object.freeze({BASE_STAR_COUNT,MAX_STAR_MULTIPLIER,MAX_STAR_COUNT,buildNaturalStarPool,transformStarShader,transformSurfaceShader});
})(window);
