/* Solar Time v0.43 r3 — natural stars plus visible fine Sun/Jupiter atmosphere motion. */
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
        'float z=dot(position,forward),seed=appearance.z;float period=mix(2.4,18.0,fract(seed*.754877666));float phase=fract(seed*.56984029)*period;');
      next=next.replace('float pulse=pow(max(0.,sin((seconds+phase)/(6.+phase)*6.28318530718)),16.);',
        'float wave=.5+.5*sin((seconds+phase)/period*6.28318530718);float sharp=mix(4.,20.,fract(seed*.438289));float pulse=pow(wave,sharp);');
      next=next.replace('intensity=appearance.y*(.55+pulse*.65);',
        'intensity=appearance.y*(.30+pulse*1.32);starTone=fract(seed*.173205+appearance.x*.37);flarePulse=step(.9975,fract(seed*.91337+appearance.y*.71))*pulse*smoothstep(.42,.80,appearance.y);');
      next=next.replace('gl_PointSize=clamp(appearance.x*10.*pointScale,1.,30.);',
        'gl_PointSize=clamp((appearance.x*10.+flarePulse*17.)*pointScale,1.,36.);');
      return next;
    }
    if(source.includes('gl_PointCoord-.5')){
      next=next.replace('varying float intensity;','varying float intensity,starTone,flarePulse;');
      next=next.replace('float alpha=(halo*.24+core*.94+cross*.14)*intensity;if(alpha<.002)discard;',
        'float alpha=(halo*.22+core*.96)*intensity+cross*.62*flarePulse;if(alpha<.002)discard;');
      next=next.replace('vec3 color=mix(vec3(.45,.66,.94),vec3(1.,.99,.96),core);',
        'vec3 color=vec3(.985,.99,1.);if(starTone<.08)color=vec3(1.,.79,.72);else if(starTone<.22)color=vec3(1.,.92,.76);else if(starTone>.84)color=vec3(.76,.87,1.);color=mix(color,vec3(1.),core*.16);');
      return next;
    }
    return source;
  }

  // Surface programs compile after this module loads. Sun motion retains its
  // temporal coefficients while spatial frequency and amplitude are tuned so the
  // surface visibly seethes in many smaller cells rather than broad sheets.
  const SUN_REPLACEMENTS=Object.freeze([
    ['uv.y*49.','uv.y*150.'],['uv.x*PI*10.','uv.x*PI*56.'],
    ['uv.x*PI*16.','uv.x*PI*48.'],['uv.y*31.','uv.y*138.'],
    ['*.0015','*.00255'],['*.0011','*.00190'],
    ['uv.x*PI*6.','uv.x*PI*52.'],['uv.y*11.','uv.y*150.'],
    ['uv.x*PI*14.','uv.x*PI*64.'],['uv.y*19.','uv.y*176.'],
    ['-.018+.118*brightCycle','-.018+.155*brightCycle'],['-.032+.057*darkCycle','-.030+.078*darkCycle']
  ]);

  // Jupiter: differential east/west jets, small turbulent eddies, and a local
  // slow vortex around the texture coordinate used by the existing Great Red
  // Spot feature view (longitude ~70°, latitude ~-22°). The vortex attenuates
  // the broad jet locally so the spot rotates instead of simply sliding away.
  const JUPITER_WARP=`\n    if(kind==5.){\n      const float GRS_U=.6944444444;\n      const float GRS_V=.6222222222;\n      float grsDx=fract(uv.x-GRS_U+.5)-.5;\n      float grsDy=uv.y-GRS_V;\n      vec2 grsN=vec2(grsDx/.066,grsDy/.042);\n      float grsR=length(grsN);\n      float grsMask=1.-smoothstep(.72,1.38,grsR);\n      float grsAngle=-effectTime*.022*grsMask;\n      float grsC=cos(grsAngle),grsS=sin(grsAngle);\n      vec2 grsRot=vec2(grsN.x*grsC-grsN.y*grsS,grsN.x*grsS+grsN.y*grsC);\n      vec2 grsSample=mix(grsN,grsRot,grsMask);\n      uv=vec2(fract(GRS_U+grsSample.x*.066),clamp(GRS_V+grsSample.y*.042,.001,.999));\n      float jetA=sin(uv.y*PI*14.);\n      float jetB=sin(uv.y*PI*32.+.7);\n      float jetSpeed=.00042+jetA*.00031+jetB*.00016;\n      float drift=effectTime*jetSpeed*(1.-grsMask*.78);\n      float eddy=sin(uv.x*PI*18.+uv.y*52.-effectTime*.42)*.00145;\n      float eddy2=sin(uv.x*PI*8.-uv.y*34.+effectTime*.24)*.00082;\n      float latitudeMask=.34+.66*abs(sin(uv.y*PI*9.));\n      uv=vec2(fract(uv.x+drift+eddy*(1.-grsMask*.58)),clamp(uv.y+eddy2*latitudeMask*(1.-grsMask*.62),.001,.999));\n    }`;
  const JUPITER_COLOR=`\n    if(kind==5.){\n      float gasA=.5+.5*sin(uv.x*PI*20.+uv.y*62.-effectTime*.28);\n      float gasB=.5+.5*sin(uv.x*PI*9.-uv.y*38.+effectTime*.17);\n      base*=.964+.060*(gasA*.65+gasB*.35);\n    }`;

  function transformSurfaceShader(source){
    if(typeof source!=='string'||!source.includes('sunActivity')||!source.includes('kind==2.'))return source;
    let next=source;
    for(const [from,to] of SUN_REPLACEMENTS)next=next.split(from).join(to);
    if(!next.includes('const float GRS_U=.6944444444'))next=next.replace(/\n\s*vec3 base=texture2D\(colorMap,uv\)\.rgb/,match=>JUPITER_WARP+match);
    if(!next.includes('float gasA=.5+.5*sin'))next=next.replace(/\n\s*if\(kind==4\.\)\{/,match=>JUPITER_COLOR+match);
    return next;
  }

  function installShaderPatch(ctor){
    const proto=ctor?.prototype,original=proto?.shaderSource;if(!proto||typeof original!=='function'||original.__solarVisualPatch)return;
    function patchedShaderSource(shader,source){return original.call(this,shader,transformStarShader(transformSurfaceShader(source)));}
    Object.defineProperty(patchedShaderSource,'__solarVisualPatch',{value:true});proto.shaderSource=patchedShaderSource;
  }
  installShaderPatch(root.WebGLRenderingContext);installShaderPatch(root.WebGL2RenderingContext);

  // Give Jupiter its own material kind on the direct-GPU path without changing
  // its source map, body rotation, rings or orbital hierarchy.
  const Direct=root.SolarSurface?.DirectRenderer;
  if(Direct?.prototype&&!Direct.prototype.__solarJupiterFlowInstalled){
    Direct.prototype.planet=function(job,body,screen,radius,time,activity){
      this.desired.set(job.id,job);const color=this.texture(job.id,job.textureWidth);if(!color)return false;
      const bump=root.SolarAssets?.materials?.[job.id+'-relief']?this.texture(job.id+'-relief',job.textureWidth):null;
      const clouds=job.id==='earth'?this.texture('clouds',Math.min(2048,job.textureWidth)):null;
      const frame=job.frame;if(body.id==='saturn'||body.id==='uranus')this.rings(body,frame,screen,radius,false);
      const g=this.gl,p=this.planetProgram;this.bind(p);this.viewport(p);g.uniform2f(p.u.center,screen.x,screen.y);g.uniform1f(p.u.radius,radius);g.uniform3fv(p.u.axisU,frame.u);g.uniform3fv(p.u.axisV,frame.v);g.uniform3fv(p.u.pole,frame.pole);g.uniform3fv(p.u.light,job.light);
      const kind=job.id==='earth'?1:job.id==='sun'?2:job.id==='jupiter'?5:job.id==='uranus'?4:['saturn','venus','neptune'].includes(job.id)?3:0;
      g.uniform1f(p.u.phase,job.phase);g.uniform1f(p.u.kind,kind);g.uniform1f(p.u.hasBump,bump?1:0);g.uniform1f(p.u.diameter,radius*2*this.dpr);g.uniform1f(p.u.texel,1/color.width);g.uniform1f(p.u.effectTime,time);g.uniform1f(p.u.sunActivity,activity?1:0);
      for(const [unit,texture,uniform] of [[0,color.texture,p.u.colorMap],[1,bump?.texture||color.texture,p.u.bumpMap],[2,clouds?.texture||this.black,p.u.cloudsMap]]){g.activeTexture(g.TEXTURE0+unit);g.bindTexture(g.TEXTURE_2D,texture);g.uniform1i(uniform,unit);}
      g.drawArrays(g.TRIANGLES,0,6);this.stats.drawCalls++;
      if(body.id==='saturn'||body.id==='uranus')this.rings(body,frame,screen,radius,true);
      this.frames.set(job.id,{job,image:{width:Math.round(radius*2*this.dpr),height:Math.round(radius*2*this.dpr),gpu:true}});return true;
    };
    Object.defineProperty(Direct.prototype,'__solarJupiterFlowInstalled',{value:true});
  }

  root.SolarVisualEffects=Object.freeze({BASE_STAR_COUNT,MAX_STAR_MULTIPLIER,MAX_STAR_COUNT,buildNaturalStarPool,transformStarShader,transformSurfaceShader});
})(window);
