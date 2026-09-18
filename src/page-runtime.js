/* Solar Time page build, lifecycle update checks and opt-in layout diagnostics.
   The page build may advance without changing the renderer/coordinator bundle. */
(function (root) {
  'use strict';
  const document=root.document,element=document.documentElement;
  const version=document.querySelector('meta[name="solar-time-version"]')?.content||'';
  const revision=document.querySelector('meta[name="solar-time-revision"]')?.content||'r0';
  const build=Object.freeze({version,revision});
  root.SolarBuild=build;
  const small=root.matchMedia('(max-width:680px), (max-height:630px)');
  const coarse=root.matchMedia('(any-pointer:coarse)');
  const standalone=root.matchMedia('(display-mode:standalone)');
  const installed=()=>standalone.matches||root.navigator?.standalone===true;
  // Installed WebClips can report different visual/layout viewport bounds at
  // launch, rotation and resume. Read the visible rectangle, never screen.height
  // or a guessed status-bar offset. Keep browser tabs and pinch zoom unchanged.
  let viewportBounds=null,viewportFrame=0,resizeNotice=0;
  const finite=value=>typeof value==='number'&&Number.isFinite(value);
  const positive=value=>finite(value)&&value>0;
  const rounded=value=>Math.round(value*100)/100;
  function readViewport(){
    const visual=root.visualViewport;
    if(visual&&finite(visual.scale)&&Math.abs(visual.scale-1)>.01)return null;
    const useVisual=visual&&positive(visual.width)&&positive(visual.height);
    const width=useVisual?visual.width:root.innerWidth,height=useVisual?visual.height:root.innerHeight;
    if(!positive(width)||!positive(height))return null;
    return {left:rounded(useVisual&&finite(visual.offsetLeft)?Math.max(0,visual.offsetLeft):0),
      top:rounded(useVisual&&finite(visual.offsetTop)?Math.max(0,visual.offsetTop):0),
      width:rounded(width),height:rounded(height),source:useVisual?'visualViewport':'innerSize'};
  }
  function notifyViewportResize(){
    if(resizeNotice)return;
    resizeNotice=root.requestAnimationFrame(()=>{
      resizeNotice=0;
      // Reuse the coordinator's existing resize/paint/settle path. It reads the
      // canvas rectangle AFTER the new viewport CSS has been applied.
      root.dispatchEvent(new root.Event('resize'));
    });
  }
  function syncViewport(){
    if(!installed()){
      if(viewportBounds){
        viewportBounds=null;
        for(const key of ['left','top','width','height'])element.style.removeProperty('--solar-viewport-'+key);
        notifyViewportResize();
      }
      return;
    }
    const next=readViewport();if(!next)return;
    if(viewportBounds&&['left','top','width','height','source'].every(key=>viewportBounds[key]===next[key]))return;
    viewportBounds=Object.freeze(next);
    for(const key of ['left','top','width','height'])element.style.setProperty('--solar-viewport-'+key,next[key]+'px');
    notifyViewportResize();
  }
  function scheduleViewportSync(){
    if(!installed()||viewportFrame)return;
    viewportFrame=root.requestAnimationFrame(()=>{viewportFrame=0;syncViewport();});
  }
  const updateLayout=()=>{
    element.classList.toggle('solar-phone-layout',small.matches&&(coarse.matches||installed()));
    element.classList.toggle('solar-standalone',installed());
    syncViewport();
  };
  for(const query of [small,coarse,standalone]){
    if(query.addEventListener)query.addEventListener('change',updateLayout);
    else query.addListener?.(updateLayout);
  }
  updateLayout();
  root.addEventListener('resize',updateLayout,{passive:true});
  root.addEventListener('orientationchange',scheduleViewportSync,{passive:true});
  root.addEventListener('load',scheduleViewportSync,{passive:true});
  root.visualViewport?.addEventListener('resize',scheduleViewportSync,{passive:true});
  root.visualViewport?.addEventListener('scroll',scheduleViewportSync,{passive:true});

  const interval=5*60*1000,attemptKey='solar-time.update-attempt';
  let checkedAt=-Infinity,checking=false,reloading=false,lastAttempt=null;
  const compareVersion=(a,b)=>{
    const x=String(a).split('.').map(Number),y=String(b).split('.').map(Number);
    for(let i=0;i<Math.max(x.length,y.length);i++)if((x[i]||0)!==(y[i]||0))return (x[i]||0)>(y[i]||0)?1:-1;
    return 0;
  };
  const revisionNumber=value=>Number(/^r(\d+)$/.exec(String(value))?.[1]||0);
  async function checkForUpdate(force=false){
    if(!version||!/^https?:$/.test(root.location.protocol)||document.hidden||checking||reloading)return;
    const now=Date.now();if(!force&&now-checkedAt<interval)return;
    checkedAt=now;checking=true;
    try{
      const url=new URL('version.json',root.location.href);url.searchParams.set('check',String(now));
      const response=await root.fetch(url,{cache:'no-store',credentials:'same-origin'});
      if(!response.ok)return;
      const manifest=await response.json(),nextVersion=String(manifest.version||''),nextRevision=String(manifest.revision||'');
      if(!/^\d+(?:\.\d+)+$/.test(nextVersion)||!/^r\d+$/.test(nextRevision))return;
      const order=compareVersion(nextVersion,version);
      if(order<0||(order===0&&revisionNumber(nextRevision)<=revisionNumber(revision)))return;
      let previous=lastAttempt;
      try{previous=JSON.parse(root.sessionStorage.getItem(attemptKey)||'null')||previous;}catch(_){/* Storage can be unavailable. */}
      if(previous?.version===nextVersion&&previous?.revision===nextRevision&&now-previous.at<60000)return;
      lastAttempt={version:nextVersion,revision:nextRevision,at:now};
      try{root.sessionStorage.setItem(attemptKey,JSON.stringify(lastAttempt));}catch(_){/* Reload does not depend on storage. */}
      const next=new URL(root.location.href);
      next.searchParams.set('release',nextVersion);next.searchParams.set('revision',nextRevision);next.searchParams.set('refresh',now.toString(36));
      reloading=true;root.location.replace(next.href);
    }catch(_){/* Offline pages keep working. */}
    finally{checking=false;}
  }
  root.addEventListener('pageshow',event=>{updateLayout();checkForUpdate(!!event.persisted);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){updateLayout();checkForUpdate(true);}});
  if(version&&/^https?:$/.test(root.location.protocol)){
    checkForUpdate();root.setInterval(()=>checkForUpdate(),interval);
  }

  function layoutInfo(){
    const css=root.getComputedStyle(element),visual=root.visualViewport;
    const visibleBottom=viewportBounds?viewportBounds.top+viewportBounds.height:root.innerHeight;
    const rect=selector=>{
      const target=document.querySelector(selector);if(!target)return null;
      const r=target.getBoundingClientRect(),s=root.getComputedStyle(target);
      return {left:Math.round(r.left),top:Math.round(r.top),width:Math.round(r.width),height:Math.round(r.height),bottom:Math.round(r.bottom),gapBelow:Math.round(visibleBottom-r.bottom),paddingBottom:s.paddingBottom,display:s.display};
    };
    return {
      build:version+' '+revision,host:root.location.host,
      // Declared page setting only; iOS may retain installed WebClip metadata.
      statusBarMeta:document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.content||'not specified',
      layoutCSS:css.getPropertyValue('--solar-layout-revision').trim()||'OLD / NOT LOADED',
      mode:installed()?'standalone':'browser',phoneLayout:element.classList.contains('solar-phone-layout'),coarsePointer:coarse.matches,
      viewport:{width:root.innerWidth,height:root.innerHeight,clientHeight:element.clientHeight,
        visualWidth:visual?.width,visualHeight:visual?.height,offsetTop:visual?.offsetTop,offsetLeft:visual?.offsetLeft,scale:visual?.scale,scrollY:root.scrollY},
      viewportSync:viewportBounds,stage:rect('#solar-viewport'),loading:rect('#loading'),canvas:rect('#universe'),
      renderSize:root.SolarTime?.renderer?{width:root.SolarTime.renderer.w,height:root.SolarTime.renderer.h}:null,
      safeTop:css.getPropertyValue('--solar-safe-top').trim(),safeBottom:css.getPropertyValue('--solar-safe-bottom').trim(),
      shade:document.querySelector('.edge-shade')?root.getComputedStyle(document.querySelector('.edge-shade')).display:null,
      skyShade:root.SolarTime?.renderer?.sky?.edgeShadeStrength??null,
      footer:rect('.footer'),navigation:rect('.planet-nav'),playback:rect('.playback')
    };
  }
  let dialog=null;
  function showDiagnostics(){
    if(!dialog){
      dialog=document.createElement('dialog');dialog.className='solar-layout-diagnostics';
      const title=document.createElement('strong');title.textContent='Solar Time · Layout';
      const pre=document.createElement('pre');pre.dataset.layoutInfo='true';
      const actions=document.createElement('div');actions.className='solar-layout-actions';
      const reload=document.createElement('button');reload.type='button';reload.textContent='Reload';
      reload.addEventListener('click',()=>{const url=new URL(root.location.href);url.searchParams.set('refresh',Date.now().toString(36));root.location.replace(url.href);});
      const close=document.createElement('button');close.type='button';close.textContent='Close';close.addEventListener('click',()=>dialog.close());
      actions.append(reload,close);dialog.append(title,pre,actions);document.body.append(dialog);
    }
    dialog.querySelector('pre').textContent=JSON.stringify(layoutInfo(),null,2);
    if(!dialog.open)dialog.showModal();
  }
  function ready(){
    updateLayout();scheduleViewportSync();
    const target=document.querySelector('.support-identity');
    if(target){
      const button=document.createElement('button');button.type='button';button.className='solar-build-info';
      button.textContent='BUILD '+version+' '+revision+' · INFO';button.addEventListener('click',showDiagnostics);target.after(button);
    }
    if(new URL(root.location.href).searchParams.get('layout-debug')==='1')showDiagnostics();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
  root.SolarPageRuntime=Object.freeze({checkForUpdate,layoutInfo,showDiagnostics,getViewport:()=>viewportBounds});
})(window);
