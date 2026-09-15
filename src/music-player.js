/* Solar Time shuffled background-music controller. */
(function(root){
  'use strict';
  const modules=root.SolarModules||(root.SolarModules={});
  function create({audio,tracks,folder,translate,notify,button,previous,next,title,now}){
    let enabled=false,index=-1,order=[],position=-1,token=0,failures=0,lastFailure=-1;
    audio.volume=.55;audio.muted=true;
    function assetUrl(file,fallback=false){
      const asset=root.SolarAssets?.music?.[file];
      if(asset){if(fallback||!asset.base)return asset.fallback;return new URL(asset.path,asset.base).href;}
      return new URL(folder+encodeURIComponent(file),root.location.href).href;
    }
    function fadeVolume(target,duration,activeToken){
      const from=audio.volume,start=performance.now();
      return new Promise(resolve=>{
        let frame=0,settled=false;
        const finish=value=>{if(settled)return;settled=true;if(frame)cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',onVisibilityChange);resolve(value);};
        const onVisibilityChange=()=>{if(!document.hidden)return;if(activeToken!==token){finish(false);return;}audio.volume=target;finish(true);};
        const tick=time=>{if(activeToken!==token){finish(false);return;}if(document.hidden){audio.volume=target;finish(true);return;}const progress=Math.min(1,(time-start)/duration),ease=progress*progress*(3-2*progress);audio.volume=from+(target-from)*ease;if(progress<1)frame=requestAnimationFrame(tick);else finish(true);};
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
    function failure(activeToken){
      if(!enabled||activeToken!==token||lastFailure===activeToken)return;
      lastFailure=activeToken;if(++failures<tracks.length){step(1,false);return;}setEnabled(false);notify(translate('musicUnavailable'));
    }
    async function playAt(nextPosition,useFallback=false){
      if(!enabled)return;if(!order.length)prepareOrder();position=(nextPosition+order.length)%order.length;index=order[position];
      const track=tracks[index],activeToken=++token;refresh();
      if(!audio.paused&&!audio.ended&&audio.currentTime>0){if(!await fadeVolume(0,90,activeToken))return;audio.pause();}
      if(activeToken!==token||!enabled)return;
      audio.src=assetUrl(track.file,useFallback);audio.volume=0;audio.muted=false;audio.load();
      try{await audio.play();if(activeToken===token){failures=0;await fadeVolume(.55,180,activeToken);}}
      catch(_){const primary=assetUrl(track.file),fallback=assetUrl(track.file,true);if(!useFallback&&primary!==fallback){playAt(nextPosition,true);return;}failure(activeToken);}
    }
    function step(direction,resetFailures=true){if(!enabled)return;if(!order.length)prepareOrder();if(resetFailures)failures=0;playAt(position+direction);}
    function setEnabled(value){
      const nextEnabled=!!value;if(nextEnabled===enabled)return;enabled=nextEnabled;
      if(!enabled){++token;audio.pause();audio.muted=true;refresh();return;}
      audio.muted=false;failures=0;lastFailure=-1;
      if(index>=0&&audio.src&&!audio.ended&&!audio.error){const activeToken=++token;refresh();audio.volume=0;audio.play().then(()=>fadeVolume(.55,180,activeToken)).catch(()=>failure(activeToken));}
      else{prepareOrder();playAt(0);}
    }
    const ended=()=>step(1),toggle=()=>setEnabled(!enabled),back=()=>step(-1),forward=()=>step(1);
    audio.addEventListener('ended',ended);button.addEventListener('click',toggle);previous.addEventListener('click',back);next.addEventListener('click',forward);refresh();
    return Object.freeze({refresh,step,setEnabled,get enabled(){return enabled;},get track(){return tracks[index]?.title||null;},dispose(){++token;audio.pause();audio.removeEventListener('ended',ended);button.removeEventListener('click',toggle);previous.removeEventListener('click',back);next.removeEventListener('click',forward);}});
  }
  modules.MusicPlayer=Object.freeze({create});
})(window);
