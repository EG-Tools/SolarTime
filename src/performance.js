/* Solar Time v0.55 — performance implementation owner. */
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
  let renderCost=coarse?9:6,frameLag=0,slowUntil=0;
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
  function reportFrameTiming(elapsed,target){
    if(!Number.isFinite(elapsed)||!Number.isFinite(target)||elapsed<0||target<=0)return;
    const lag=Math.max(0,elapsed-target);
    frameLag=frameLag*.90+Math.min(lag,80)*.10;
    if(target<25&&frameLag>4)slowUntil=performance.now()+4000;
  }
  function frameInterval(width,height,active=true){
    const phone=coarse&&Math.min(width,height)<900;
    const constrained=phone||renderCost>13||frameLag>4||performance.now()<slowUntil;
    return constrained||!active?1000/30:1000/60;
  }
  function createFrameGate(){
    let next=NaN,previousInterval=0;
    return (mono,interval,reset=false)=>{
      if(!Number.isFinite(mono)||!Number.isFinite(interval)||interval<=0)return false;
      if(reset||!Number.isFinite(next)||interval!==previousInterval||mono>next+250){next=mono+interval;previousInterval=interval;return true;}
      if(mono<next-.5)return false;
      next+=(Math.max(0,Math.floor((mono-next+.5)/interval))+1)*interval;
      return true;
    };
  }
  function protectTexture(renderer,name){
    const desired=renderer.desired;
    if(desired?.has(name))return true;
    if(name==='clouds'&&desired?.has('earth'))return true;
    if(name==='earth-night'&&desired?.get('earth')?.nightLights)return true;
    if(name.endsWith('-relief')&&desired?.has(name.slice(0,-7)))return true;
    return false;
  }
  // Allocate before uploading. Reserve room for the sky and a texture swap;
  // lower-priority visible bodies yield detail before the tracked body does.
  function planTextures(jobs,assets,maxWidth=4096){
    const entries=[];
    const add=(name,width,priority)=>{if(assets?.[name])entries.push({name,width:Math.max(128,Math.min(maxWidth,width)),priority});};
    for(const job of jobs){
      add(job.id,job.textureWidth,job.priority||0);
      if(job.id==='earth')add('clouds',Math.min(2048,job.textureWidth),job.priority||0);
      if(job.id==='earth'&&job.nightLights)add('earth-night',Math.min(4096,job.nightTextureWidth||job.textureWidth),job.priority||0);
      add(job.id+'-relief',job.textureWidth,job.priority||0);
    }
    const budget=textureBudget()*.8;let bytes=entries.reduce((sum,e)=>sum+e.width*e.width*2,0),constrained=bytes>budget;
    while(bytes>budget){
      const candidate=entries.filter(e=>e.width>128).sort((a,b)=>a.priority-b.priority||b.width-a.width)[0];
      if(!candidate)break;
      bytes-=candidate.width*candidate.width*1.5;candidate.width/=2;
    }
    return {targets:new Map(entries.map(e=>[e.name,e.width])),bytes,constrained};
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
  function touchTexture(renderer,name){const record=renderer.textures?.get(name);if(record)record.lastUsed=(renderer.__solarTextureUseSerial=(renderer.__solarTextureUseSerial||0)+1);}
  function enforceTextureBudget(renderer){const budget=textureBudget(),bytes=Math.max(0,(renderer.stats?.texturePixels||0)*4);renderer.stats.textureBudgetBytes=budget;renderer.stats.textureBytes=bytes;if(bytes>budget){const now=performance.now();if(now-(renderer.__solarLastTextureTrim||0)>500){renderer.__solarLastTextureTrim=now;trimTextures(renderer);}}}
  root.SolarPerformance=Object.freeze({pixelRatio,frameInterval,createFrameGate,reportRenderCost,reportFrameTiming,textureBudget,planTextures,protectTexture,trimTextures,touchTexture,enforceTextureBudget,get renderCost(){return renderCost;},get frameLag(){return frameLag;},coarse});
})(window);
