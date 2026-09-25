/* Solar Time shuffled music; bounded recovery never overrides a newer command. */
(function(root){
  'use strict';
  const modules=root.SolarModules||(root.SolarModules={});
  const RETRY_DELAY=1000,STALL_TIMEOUT=15000,STABLE_PLAYBACK=5;
  function create({audio,tracks,folder,translate,notify,button,previous,next,title,now}){
    let enabled=false,disposed=false,index=-1,order=[],position=-1,token=0,failures=0;
    let active=null,retryTimer=0,cancelFade=null;
    const later=(fn,ms)=>(root.setTimeout||setTimeout)(fn,ms);
    const clear=id=>{if(id)(root.clearTimeout||clearTimeout)(id);};
    audio.volume=.55;audio.muted=true;
    function assetUrl(file,fallback=false){
      const asset=root.SolarAssets?.music?.[file];
      if(asset){if(fallback||!asset.base)return asset.fallback;return new URL(asset.path,asset.base).href;}
      return new URL(folder+encodeURIComponent(file),root.location.href).href;
    }
    function fadeVolume(target,duration,activeToken){
      cancelFade?.();const from=audio.volume,start=performance.now();
      return new Promise(resolve=>{
        let frame=0,settled=false;
        const finish=value=>{if(settled)return;settled=true;if(frame)cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',onVisibilityChange);if(cancelFade===cancel)cancelFade=null;resolve(value);};
        const cancel=()=>finish(false);cancelFade=cancel;
        const onVisibilityChange=()=>{if(!document.hidden)return;if(activeToken!==token||!enabled||disposed){finish(false);return;}audio.volume=target;finish(true);};
        const tick=time=>{if(activeToken!==token||!enabled||disposed){finish(false);return;}if(document.hidden){audio.volume=target;finish(true);return;}const progress=Math.min(1,(time-start)/duration),ease=progress*progress*(3-2*progress);audio.volume=from+(target-from)*ease;if(progress<1)frame=requestAnimationFrame(tick);else finish(true);};
        document.addEventListener('visibilitychange',onVisibilityChange);
        if(document.hidden)onVisibilityChange();else frame=requestAnimationFrame(tick);
      });
    }
    function prepareOrder(){
      const shuffled=tracks.map((_,trackIndex)=>trackIndex);
      for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
      order=shuffled;position=0;
    }
    function refresh(){
      const track=tracks[index],label=translate(enabled?'musicOff':'musicOn');
      button.setAttribute('aria-pressed',String(enabled));button.setAttribute('aria-label',label);button.title=label;
      title.textContent=track?.title||'';now.hidden=!(enabled&&track);
      for(const [element,key] of [[previous,'musicPrevious'],[next,'musicNext']]){element.setAttribute('aria-label',translate(key));element.title=translate(key);}
    }
    function detach(){active?.cleanup();active=null;clear(retryTimer);retryTimer=0;cancelFade?.();}
    function unavailable(){setEnabled(false);notify(translate('musicUnavailable'));}
    async function playAt(nextPosition,{urlIndex=0,retry=0,resumeAt=0,reuse=false}={}){
      if(!enabled||disposed)return;if(!order.length)prepareOrder();if(!order.length){unavailable();return;}
      detach();const activeToken=++token;position=(nextPosition+order.length)%order.length;index=order[position];
      const track=tracks[index],urls=[...new Set([assetUrl(track.file),assetUrl(track.file,true)].filter(Boolean))];
      const chosen=urls[urlIndex];if(!chosen){unavailable();return;}refresh();
      if(!reuse&&!audio.paused&&!audio.ended&&audio.currentTime>0){if(!await fadeVolume(0,90,activeToken))return;audio.pause();}
      if(activeToken!==token||!enabled||disposed)return;
      let watchdog=0,failed=false,started=false,progressAt=resumeAt,healthySince=resumeAt;
      const current=()=>!disposed&&enabled&&active?.token===activeToken&&token===activeToken&&!failed;
      const handlers={};
      const cleanup=()=>{clear(watchdog);watchdog=0;for(const [event,fn] of Object.entries(handlers))audio.removeEventListener(event,fn);};
      const failedLoad=error=>{
        if(!current())return;failed=true;cleanup();cancelFade?.();audio.pause();
        if(error?.name==='NotAllowedError'){unavailable();return;}
        const at=Math.max(0,Number(audio.currentTime)||0),oldPosition=position;
        let target=oldPosition,options={urlIndex,retry:retry+1,resumeAt:at};
        if(retry>=1){
          if(urlIndex+1<urls.length)options={urlIndex:urlIndex+1,retry:0,resumeAt:at};
          else {if(++failures>=tracks.length){unavailable();return;}target=oldPosition+1;options={};}
        }
        retryTimer=later(()=>{retryTimer=0;if(disposed||!enabled||token!==activeToken)return;playAt(target,options);},RETRY_DELAY);
      };
      const watch=()=>{if(!current()||watchdog)return;const at=Number(audio.currentTime)||0;watchdog=later(()=>{watchdog=0;if(current()&&!audio.ended&&(!started||(Number(audio.currentTime)||0)<=at+.05))failedLoad();},STALL_TIMEOUT);};
      handlers.error=()=>{if(audio.error)failedLoad(audio.error);};
      handlers.waiting=handlers.stalled=watch;
      handlers.playing=()=>{if(current()){started=true;clear(watchdog);watchdog=0;}};
      handlers.timeupdate=()=>{
        if(!current())return;const time=Number(audio.currentTime)||0;
        if(time>progressAt+.05){clear(watchdog);watchdog=0;progressAt=time;}
        if(time-healthySince>=STABLE_PLAYBACK){failures=0;retry=0;healthySince=time;}
      };
      handlers.loadedmetadata=()=>{if(!current()||resumeAt<=0)return;try{audio.currentTime=Number.isFinite(audio.duration)?Math.min(resumeAt,Math.max(0,audio.duration-.1)):resumeAt;progressAt=healthySince=audio.currentTime;}catch(_){}};
      handlers.ended=()=>{if(current()&&audio.ended)step(1);};
      active={token:activeToken,cleanup};for(const [event,fn] of Object.entries(handlers))audio.addEventListener(event,fn);
      audio.volume=0;audio.muted=false;
      try{
        if(!reuse){audio.src=chosen;audio.load();}
        watch();await audio.play();if(!current())return;
        started=true;clear(watchdog);watchdog=0;await fadeVolume(.55,180,activeToken);
      }catch(error){failedLoad(error);}
    }
    function step(direction,resetFailures=true){if(!enabled||disposed)return;if(!order.length)prepareOrder();if(resetFailures)failures=0;playAt(position+direction);}
    function setEnabled(value){
      if(disposed)return;const nextEnabled=!!value;if(nextEnabled===enabled)return;enabled=nextEnabled;
      if(!enabled){++token;detach();audio.pause();audio.muted=true;refresh();return;}
      failures=0;
      if(index>=0&&audio.src&&!audio.ended&&!audio.error)playAt(position,{resumeAt:Number(audio.currentTime)||0,reuse:true});
      else{prepareOrder();playAt(0);}
    }
    const toggle=()=>setEnabled(!enabled),back=()=>step(-1),forward=()=>step(1);
    button.addEventListener('click',toggle);previous.addEventListener('click',back);next.addEventListener('click',forward);refresh();
    return Object.freeze({refresh,step,setEnabled,get enabled(){return enabled;},get track(){return tracks[index]?.title||null;},dispose(){if(disposed)return;setEnabled(false);disposed=true;++token;detach();audio.pause();button.removeEventListener('click',toggle);previous.removeEventListener('click',back);next.removeEventListener('click',forward);}});
  }
  modules.MusicPlayer=Object.freeze({create,RETRY_DELAY,STALL_TIMEOUT});
})(window);
