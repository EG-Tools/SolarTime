/* Solar Time v0.42 runtime performance owner.
   Keeps adaptive DPR/FPS and direct-GPU texture memory policy outside renderer.js. */
(function(root){
  'use strict';
  const coarse=(()=>{
    try{
      const ua=String(navigator.userAgent||''),uaMobile=navigator.userAgentData?.mobile===true||/Android|iPhone|iPad|iPod|Mobile/i.test(ua);
      const iPadOS=/Macintosh/i.test(ua)&&(navigator.maxTouchPoints||0)>1;
      const coarsePointer=matchMedia('(pointer:coarse)').matches,shortSide=Math.min(screen.width||innerWidth,screen.height||innerHeight);
      return !!(uaMobile||iPadOS||(coarsePointer&&shortSide<=820));
    }catch(_){return false;}
  })();
  let renderCost=coarse?9:6,slowUntil=0;
  const MiB=1024*1024;
  const textureBudget=()=>coarse?96*MiB:192*MiB;
  function pixelRatio(width,height,quality='auto'){
    const native=Math.max(1,Number(root.devicePixelRatio)||1);
    if(quality==='low')return Math.min(native,1);
    const max=coarse?1.5:2,budget=coarse?3_200_000:8_000_000;
    return Math.max(1,Math.min(native,max,Math.sqrt(budget/Math.max(1,width*height))));
  }
  function reportRenderCost(ms){
    if(!Number.isFinite(ms)||ms<0)return;
    renderCost=renderCost*.90+Math.min(ms,80)*.10;
    if(renderCost>13)slowUntil=performance.now()+4000;
  }
  function frameInterval(width,height){
    const phone=coarse&&Math.min(width,height)<900;
    return phone||renderCost>13||performance.now()<slowUntil?1000/30:1000/60;
  }
  function protectTexture(renderer,name){
    const desired=renderer.desired;
    if(desired?.has(name))return true;
    if(name==='clouds'&&desired?.has('earth'))return true;
    if(name.endsWith('-relief')&&desired?.has(name.slice(0,-7)))return true;
    return false;
  }
  function trimTextures(renderer){
    const textures=renderer.textures;if(!textures?.size||!renderer.gl)return;
    const budget=textureBudget();let bytes=Math.max(0,(renderer.stats?.texturePixels||0)*4);
    renderer.stats.textureBudgetBytes=budget;renderer.stats.textureBytes=bytes;if(bytes<=budget)return;
    const candidates=[...textures.entries()].filter(([name,record])=>record?.texture&&!record.pending&&!protectTexture(renderer,name)).sort((a,b)=>(a[1].lastUsed||0)-(b[1].lastUsed||0));
    for(const [name,record] of candidates){
      if(bytes<=budget)break;
      const pixels=(record.width||0)*(record.height||0);renderer.gl.deleteTexture(record.texture);bytes-=pixels*4;
      if(Number.isFinite(renderer.stats.texturePixels))renderer.stats.texturePixels=Math.max(0,renderer.stats.texturePixels-pixels);
      Object.assign(record,{texture:null,width:0,height:0,lastUsed:0});renderer.stats.textureEvictions=(renderer.stats.textureEvictions||0)+1;
    }
    renderer.stats.textureBytes=Math.max(0,bytes);
  }
  const Direct=root.SolarSurface?.DirectRenderer;
  if(Direct?.prototype&&!Direct.prototype.__solarBudgetInstalled){
    const texture=Direct.prototype.texture,end=Direct.prototype.end;
    Direct.prototype.texture=function(name,target){
      const result=texture.call(this,name,target),record=this.textures?.get(name);if(record)record.lastUsed=(this.__solarTextureUseSerial=(this.__solarTextureUseSerial||0)+1);return result;
    };
    Direct.prototype.end=function(){
      const value=end.call(this),budget=textureBudget(),bytes=Math.max(0,(this.stats?.texturePixels||0)*4);
      this.stats.textureBudgetBytes=budget;this.stats.textureBytes=bytes;
      if(bytes>budget){const now=performance.now();if(now-(this.__solarLastTextureTrim||0)>500){this.__solarLastTextureTrim=now;trimTextures(this);}}
      return value;
    };
    Object.defineProperty(Direct.prototype,'__solarBudgetInstalled',{value:true});
  }
  const Renderer=root.SolarRenderer;
  if(Renderer?.prototype&&!Renderer.prototype.__solarAdaptiveDprInstalled){
    Renderer.prototype.resize=function(){
      const box=this.canvas.getBoundingClientRect(),w=Math.max(1,box.width),h=Math.max(1,box.height),dpr=pixelRatio(w,h,this.options.quality);
      if(w===this.w&&h===this.h&&Math.abs(dpr-this.dpr)<.001)return;
      this.w=w;this.h=h;this.dpr=dpr;this.starSprites?.clear();this.labelWidths?.clear();
      this.lensStretch=Math.max(1,Math.min(1.72,this.w/this.h));
      this.canvas.width=Math.round(this.w*this.dpr);this.canvas.height=Math.round(this.h*this.dpr);
      this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
      this.gpu?.resize(this.w,this.h,this.dpr);
      this.sky.resize(this.w,this.h,this.dpr);this.dirty=true;this.lastSurfaceSubmit=-Infinity;this.surface?.invalidate(false);this.clearLabels();
      this.stats.adaptiveDpr=this.dpr;
    };
    Object.defineProperty(Renderer.prototype,'__solarAdaptiveDprInstalled',{value:true});
  }
  root.SolarPerformance=Object.freeze({pixelRatio,frameInterval,reportRenderCost,textureBudget,trimTextures,get renderCost(){return renderCost;},coarse});
})(window);
