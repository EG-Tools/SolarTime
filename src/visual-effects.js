/* Solar Time v0.43 — adjustable particle-star density and finer Sun surface motion. */
(function(root){
  'use strict';

  const BASE_STAR_COUNT=4400,MAX_STAR_MULTIPLIER=4,MAX_STAR_COUNT=BASE_STAR_COUNT*MAX_STAR_MULTIPLIER;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const randomGenerator=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};

  function expandStarPool(source,total=MAX_STAR_COUNT){
    const field=(Array.isArray(source)?source:[]).filter(star=>Array.isArray(star)&&star.length>=6).map(star=>star.slice(0,6));
    const random=randomGenerator(204031),target=Math.max(total,field.length);
    while(field.length<target){
      const z=random()*2-1,angle=random()*Math.PI*2,radius=Math.sqrt(Math.max(0,1-z*z)),rare=random();
      field.push([Math.cos(angle)*radius,Math.sin(angle)*radius,z,.28+Math.pow(rare,7)*.92,.16+random()*.32+(rare>.985?.18:0),random()*12]);
    }
    return field;
  }

  // Build the maximum deterministic pool once. The first 4,400 entries are
  // byte-for-byte the same sequence the previous sky generator exposed at 100%.
  if(root.SolarAssets&&Array.isArray(root.SolarAssets.stars)){
    root.SolarAssets.stars=expandStarPool(root.SolarAssets.stars);
  }

  const Sky=root.SolarSky;
  if(Sky?.prototype&&!Sky.prototype.__solarStarDensityInstalled){
    const originalDraw=Sky.prototype.draw,originalDecorate=Sky.prototype.decorate;

    Sky.prototype.draw=function(seconds,camera,options={}){
      const available=Math.min(MAX_STAR_COUNT,root.SolarAssets?.stars?.length||MAX_STAR_COUNT);
      const current=Number(this.starCount)||0;
      this.__solarMaxStarCount=Math.max(this.__solarMaxStarCount||0,current,available);
      const density=clamp(Number(options.starDensity??1),0,MAX_STAR_MULTIPLIER);
      const drawCount=Math.min(this.__solarMaxStarCount,Math.round(BASE_STAR_COUNT*density));
      if(this.__solarStarDrawCount!==drawCount){
        this.__solarStarDrawCount=drawCount;
        this.invalidate?.();
      }
      const previous=this.starCount;
      this.starCount=drawCount;
      try{
        const result=originalDraw.call(this,seconds,camera,options);
        if(this.stats)this.stats.visibleStarCount=drawCount;
        return result;
      }finally{
        this.starCount=this.__solarMaxStarCount||previous;
      }
    };

    Sky.prototype.decorate=function(ctx,seconds,options={},glow){
      const source=root.SolarAssets?.stars;
      if(!Array.isArray(source))return originalDecorate.call(this,ctx,seconds,options,glow);
      const density=clamp(Number(options.starDensity??1),0,MAX_STAR_MULTIPLIER);
      const count=Math.min(source.length,Math.round(BASE_STAR_COUNT*density));
      let subset=source;
      if(count!==source.length){
        if(this.__solarStarSubsetSource!==source||this.__solarStarSubsetCount!==count){
          this.__solarStarSubsetSource=source;
          this.__solarStarSubsetCount=count;
          this.__solarStarSubset=source.slice(0,count);
        }
        subset=this.__solarStarSubset;
      }
      root.SolarAssets.stars=subset;
      try{return originalDecorate.call(this,ctx,seconds,options,glow);}
      finally{root.SolarAssets.stars=source;}
    };

    Object.defineProperty(Sky.prototype,'__solarStarDensityInstalled',{value:true});
  }

  // Surface shaders are compiled after this module loads. Replace only the
  // Sun-specific spatial frequencies; all time coefficients and amplitudes stay
  // unchanged, so the motion speed is identical but the pattern is ~2x finer.
  const SUN_SHADER_REPLACEMENTS=Object.freeze([
    ['uv.y*49.','uv.y*98.'],
    ['uv.x*PI*10.','uv.x*PI*20.'],
    ['uv.x*PI*16.','uv.x*PI*32.'],
    ['uv.y*31.','uv.y*62.'],
    ['uv.x*PI*6.','uv.x*PI*12.'],
    ['uv.y*11.','uv.y*22.'],
    ['uv.x*PI*14.','uv.x*PI*28.'],
    ['uv.y*19.','uv.y*38.']
  ]);
  function densifySunShader(source){
    if(typeof source!=='string'||!source.includes('sunActivity')||!source.includes('kind==2.'))return source;
    let next=source;
    for(const [from,to] of SUN_SHADER_REPLACEMENTS)next=next.split(from).join(to);
    return next;
  }
  function installShaderPatch(ctor){
    const proto=ctor?.prototype,original=proto?.shaderSource;
    if(!proto||typeof original!=='function'||original.__solarSunDensityPatch)return;
    function patchedShaderSource(shader,source){return original.call(this,shader,densifySunShader(source));}
    Object.defineProperty(patchedShaderSource,'__solarSunDensityPatch',{value:true});
    Object.defineProperty(patchedShaderSource,'__solarOriginal',{value:original});
    proto.shaderSource=patchedShaderSource;
  }
  installShaderPatch(root.WebGLRenderingContext);
  installShaderPatch(root.WebGL2RenderingContext);

  root.SolarVisualEffects=Object.freeze({
    BASE_STAR_COUNT,MAX_STAR_MULTIPLIER,MAX_STAR_COUNT,
    expandStarPool,densifySunShader
  });
})(window);
