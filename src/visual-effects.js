/* Solar Time v0.43 r2 — even star distribution plus fine Sun/Jupiter surface motion. */
(function(root){
  'use strict';

  const BASE_STAR_COUNT=4400,MAX_STAR_MULTIPLIER=4,MAX_STAR_COUNT=BASE_STAR_COUNT*MAX_STAR_MULTIPLIER;
  const TAU=Math.PI*2,GOLDEN=.6180339887498949;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const fract=value=>value-Math.floor(value);
  const randomGenerator=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  function radicalInverse(index){let value=0,scale=.5;for(let n=index>>>0;n;n>>>=1,scale*=.5)value+=(n&1)*scale;return value;}

  // Low-discrepancy sphere: every prefix is spread over the full sphere instead
  // of filling one latitude band first. Tiny deterministic jitter keeps it organic
  // without recreating obvious clusters or empty patches.
  function uniformStarPool(source,total=MAX_STAR_COUNT){
    const looks=(Array.isArray(source)?source:[]).filter(star=>Array.isArray(star)&&star.length>=6);
    const random=randomGenerator(204031),field=[];
    for(let i=0;i<total;i++){
      const u=clamp(radicalInverse(i+1)+(random()-.5)*.0012,.00005,.99995);
      const v=fract((i+1)*GOLDEN+.137+(random()-.5)*.0035);
      const z=u*2-1,angle=v*TAU,radius=Math.sqrt(Math.max(0,1-z*z));
      const template=looks.length?looks[(i*4051)%looks.length]:null,rare=random();
      const size=template?clamp(Number(template[3])||.34,.22,1.25):.28+Math.pow(rare,7)*.92;
      const brightness=template?clamp(Number(template[4])||.24,.10,.72):.16+random()*.32+(rare>.985?.18:0);
      const phase=template?fract((Number(template[5])||0)/12+random()*.07)*12:random()*12;
      field.push([Math.cos(angle)*radius,Math.sin(angle)*radius,z,size,brightness,phase]);
    }
    return field;
  }

  // Build the maximum pool once. Density changes only the GPU draw count.
  if(root.SolarAssets&&Array.isArray(root.SolarAssets.stars))root.SolarAssets.stars=uniformStarPool(root.SolarAssets.stars);

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

  // Surface programs compile after this module loads. Sun motion keeps the old
  // temporal coefficients but uses much finer spatial frequencies and smaller
  // displacement. Jupiter gets a separate banded differential-flow warp.
  const SUN_REPLACEMENTS=Object.freeze([
    ['uv.y*49.','uv.y*130.'],['uv.x*PI*10.','uv.x*PI*48.'],
    ['uv.x*PI*16.','uv.x*PI*64.'],['uv.y*31.','uv.y*150.'],
    ['*.0015','*.00085'],['*.0011','*.00065'],
    ['uv.x*PI*6.','uv.x*PI*48.'],['uv.y*11.','uv.y*126.'],
    ['uv.x*PI*14.','uv.x*PI*64.'],['uv.y*19.','uv.y*176.'],
    ['-.018+.118*brightCycle','-.012+.075*brightCycle'],['-.032+.057*darkCycle','-.020+.035*darkCycle']
  ]);
  const JUPITER_WARP=`\n    if(kind==5.){\n      float jet=sin(uv.y*PI*14.)*.52+sin(uv.y*PI*30.)*.23;\n      float drift=effectTime*(.000018+jet*.000012);\n      float eddy=sin(uv.x*PI*18.+uv.y*45.-effectTime*.16)*.00022;\n      float cross=sin(uv.x*PI*8.-uv.y*28.+effectTime*.09)*.00014;\n      uv=vec2(fract(uv.x+drift+eddy),clamp(uv.y+cross,.001,.999));\n    }`;
  const JUPITER_COLOR=`\n    if(kind==5.){\n      float gas=.5+.5*sin(uv.x*PI*20.+uv.y*58.-effectTime*.12);\n      base*=.992+.016*gas;\n    }`;
  function transformSurfaceShader(source){
    if(typeof source!=='string'||!source.includes('sunActivity')||!source.includes('kind==2.'))return source;
    let next=source;
    for(const [from,to] of SUN_REPLACEMENTS)next=next.split(from).join(to);
    if(!next.includes('if(kind==5.){'))next=next.replace(/\n\s*vec3 base=texture2D\(colorMap,uv\)\.rgb/,match=>JUPITER_WARP+match);
    if(!next.includes('float gas=.5+.5*sin'))next=next.replace(/\n\s*if\(kind==4\.\)\{/,match=>JUPITER_COLOR+match);
    return next;
  }
  function installShaderPatch(ctor){
    const proto=ctor?.prototype,original=proto?.shaderSource;if(!proto||typeof original!=='function'||original.__solarSurfaceFlowPatch)return;
    function patchedShaderSource(shader,source){return original.call(this,shader,transformSurfaceShader(source));}
    Object.defineProperty(patchedShaderSource,'__solarSurfaceFlowPatch',{value:true});proto.shaderSource=patchedShaderSource;
  }
  installShaderPatch(root.WebGLRenderingContext);installShaderPatch(root.WebGL2RenderingContext);

  // Give Jupiter its own shader kind on the direct-GPU path without touching
  // textures, orbit/ring transforms or any other body's material behavior.
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

  root.SolarVisualEffects=Object.freeze({BASE_STAR_COUNT,MAX_STAR_MULTIPLIER,MAX_STAR_COUNT,uniformStarPool,transformSurfaceShader});
})(window);
