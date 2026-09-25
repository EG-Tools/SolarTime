/* Shared alarm and optional Windows shutdown timer owner. */
(function(root){
  'use strict';
  const modules=root.SolarModules||(root.SolarModules={}),MAX_MINUTES=99*60+59,MAX_SOUND_BYTES=30*1024*1024,DEFAULT_ALARM_FILE='00 - Soft Morning.mp3';
  const ALARM_VOLUME=.864,PREVIEW_VOLUME=.696,FALLBACK_VOLUME=.192;
  const integer=(value,min,max,fallback=0)=>{const number=Math.trunc(Number(value));return Number.isFinite(number)?Math.max(min,Math.min(max,number)):fallback;};
  const totalMinutes=(hours,minutes)=>Math.min(MAX_MINUTES,integer(hours,0,99)*60+integer(minutes,0,59));
  const copy=code=>modules.TimerCopy.copy(code);
  function soundStore(indexedDB=root.indexedDB){
    let database;
    const open=()=>database||(database=new Promise((resolve,reject)=>{if(!indexedDB){reject(Error('IndexedDB unavailable'));return;}const request=indexedDB.open('solar-time-audio',1);request.onupgradeneeded=()=>request.result.createObjectStore('sounds');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||Error('Audio storage unavailable'));}));
    const request=(mode,value)=>open().then(db=>new Promise((resolve,reject)=>{
      const transaction=db.transaction('sounds',mode==='get'?'readonly':'readwrite'),store=transaction.objectStore('sounds'),operation=mode==='get'?store.get('alarm'):mode==='put'?store.put(value,'alarm'):store.delete('alarm');
      operation.onsuccess=()=>{if(mode==='get')resolve(operation.result);};
      transaction.oncomplete=()=>resolve(operation.result);
      transaction.onabort=transaction.onerror=operation.onerror=()=>reject(transaction.error||operation.error||Error('Audio storage failed'));
    }));
    return Object.freeze({get:()=>request('get'),put:value=>request('put',value),remove:()=>request('remove')});
  }
  function create({document=root.document,UI,Preferences,translate,notify=()=>{},shutdownBridge,onAlarmStart=()=>{},onOpen=()=>{},shouldKeepOpen=()=>false}){
    const $=id=>document.getElementById(id),storageKey='solar-time.timers.v1',now=()=>Date.now(),sounds=soundStore();
    const panel=$('timer-panel'),button=$('timer-button'),alarmDialog=$('alarm-dialog'),shutdownDialog=$('shutdown-dialog'),downloadDialog=$('shutdown-helper-download-dialog'),installDialog=$('shutdown-helper-install-dialog'),removeDialog=$('shutdown-helper-remove-dialog');
    const controls={alarm:{toggle:$('alarm-enabled'),hours:$('alarm-hours'),minutes:$('alarm-minutes'),target:$('alarm-target')},shutdown:{toggle:$('shutdown-enabled'),hours:$('shutdown-hours'),minutes:$('shutdown-minutes'),target:$('shutdown-target')}};
    let state={alarm:{enabled:false,hours:0,minutes:5,deadline:0},shutdown:{enabled:false,hours:1,minutes:0,deadline:0,status:'idle'},helperEnabled:false,helperProgress:0,helperConfirmed:false,helperRevision:'',helperInstallToken:'',helperInstallDeadline:0,soundMode:'default',soundName:''};
    let interval=0,audioContext=null,toneInterval=0,customBuffer=null,defaultBuffer=null,defaultPromise=null,customSource=null,defaultAlarmMedia=null,previewSource=null,previewMedia=null,previewKind='',previewRequest=0,ringing=false,disposed=false,nextInstallPoll=0,installPollTask=null,nativeBusy='',nativeSerial=0,helperBusy=false;
    let selectionTask=0,customResource=null,customTask=null,soundGeneration=0,soundAbort=null,soundWriteTask=Promise.resolve(),defaultGeneration=0,defaultAbort=null,toneRequest=0;
    let targetFormatter=null,formatterKey='',targetLabels=new Map();
    const metrics={wakes:0,outputWrites:0,formatters:0,installPolls:0};
    try{const saved=Preferences.read(storageKey);if(saved&&typeof saved==='object'){
      for(const name of ['alarm','shutdown']){const value=saved[name];if(value&&typeof value==='object')state[name]={enabled:!!value.enabled,hours:integer(value.hours,0,99),minutes:integer(value.minutes,0,59),deadline:Number.isFinite(value.deadline)?value.deadline:0,...(name==='shutdown'?{status:value.enabled?(value.status==='confirmed'?'confirmed':'unknown'):'idle'}:{})};}
      state.helperEnabled=!!saved.helperEnabled;state.helperProgress=[0,50,100].includes(saved.helperProgress)?saved.helperProgress:(state.helperEnabled?100:0);state.helperConfirmed=saved.helperConfirmed===true;state.helperRevision=typeof saved.helperRevision==='string'?saved.helperRevision:'';state.helperInstallToken=/^[a-f0-9]{32}$/.test(saved.helperInstallToken||'')?saved.helperInstallToken:'';state.helperInstallDeadline=Number.isFinite(saved.helperInstallDeadline)?saved.helperInstallDeadline:0;if(state.helperConfirmed&&state.helperRevision!==String(shutdownBridge?.helperSha256||'')){state.helperEnabled=false;state.helperProgress=0;state.helperConfirmed=false;state.helperRevision='';state.helperInstallToken='';state.helperInstallDeadline=0;if(state.shutdown.enabled)state.shutdown.status='unknown';}if(!state.helperConfirmed&&state.helperProgress>=100){state.helperProgress=50;state.helperEnabled=false;if(state.shutdown.enabled)state.shutdown.status='unknown';}if(state.helperConfirmed){state.helperProgress=100;state.helperInstallToken='';state.helperInstallDeadline=0;}state.soundMode=saved.soundMode==='custom'?'custom':'default';state.soundName=typeof saved.soundName==='string'?saved.soundName:'';
    }}catch(_){/* Blocked storage must not disable timers. */}
    const t=(key,values)=>translate(key,values),eligible=!!shutdownBridge?.eligible;
    function save(){Preferences.write(storageKey,state);}
    function setFields(name){const item=state[name],control=controls[name];control.toggle.checked=item.enabled;control.hours.value=String(item.hours);control.minutes.value=String(item.minutes);}
    function readFields(name){const control=controls[name];state[name].hours=integer(control.hours.value,0,99);state[name].minutes=integer(control.minutes.value,0,59);control.hours.value=String(state[name].hours);control.minutes.value=String(state[name].minutes);return totalMinutes(state[name].hours,state[name].minutes);}
    function formatTarget(deadline){
      const key=(document.documentElement.lang||'')+'|'+new Date().getTimezoneOffset();
      try{
        if(key!==formatterKey||!targetFormatter){targetFormatter=new Intl.DateTimeFormat(document.documentElement.lang||undefined,{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});formatterKey=key;targetLabels.clear();metrics.formatters++;}
        if(!targetLabels.has(deadline)){if(targetLabels.size>=4)targetLabels.clear();targetLabels.set(deadline,targetFormatter.format(new Date(deadline)));}
        return targetLabels.get(deadline);
      }catch(_){return new Date(deadline).toLocaleString();}
    }
    function formatRemaining(deadline){const seconds=Math.max(0,Math.ceil((deadline-now())/1000)),hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60),rest=seconds%60;return [hours,minutes,rest].map((value,index)=>index?String(value).padStart(2,'0'):String(value)).join(':');}
    function updateOutput(name){
      const item=state[name],target=controls[name].target,section=target.closest('.timer-section');
      if(controls[name].lastActive!==item.enabled){section?.classList.toggle('is-active',item.enabled);controls[name].lastActive=item.enabled;}
      const text=name==='shutdown'&&item.status==='pending'?t('shutdownPending'):name==='shutdown'&&item.status==='unknown'?t('shutdownUnknown'):item.enabled&&item.deadline>0?t('timerTarget',{time:formatTarget(item.deadline),remaining:formatRemaining(item.deadline)}):t('timerInactive');
      if(target.textContent!==text){target.textContent=text;metrics.outputWrites++;}
    }
    function syncSound(){
      $('alarm-sound-default').checked=state.soundMode!=='custom';$('alarm-sound-custom').checked=state.soundMode==='custom';
      $('alarm-sound-name').textContent=state.soundName||t('noSoundSelected');$('alarm-sound-choose').textContent=t(state.soundName?'changeFile':'chooseFile');
      syncPreview();
    }
    function syncAvailability(){
      const helper=$('shutdown-helper-enabled'),shutdown=controls.shutdown,available=eligible;
      if(!available){state.helperEnabled=false;state.shutdown.enabled=false;state.shutdown.deadline=0;}
      if(!state.helperConfirmed){if(state.helperProgress>=100)state.helperProgress=50;state.helperEnabled=false;}else state.helperProgress=100;
      helper.checked=available&&state.helperEnabled;helper.disabled=!available||helperBusy||!!nativeBusy;
      $('shutdown-helper-remove').disabled=!available||!state.helperConfirmed||state.helperProgress<100||helperBusy||!!nativeBusy;
      $('shutdown-helper-install-yes').disabled=helperBusy;
      const enabled=available&&state.helperEnabled;shutdown.toggle.disabled=!available||(!enabled&&!state.shutdown.enabled)||nativeBusy==='cancel'||nativeBusy==='uninstall';shutdown.hours.disabled=!enabled||!!nativeBusy;shutdown.minutes.disabled=!enabled||!!nativeBusy;
      $('shutdown-section').classList.toggle('is-unavailable',!available);$('shutdown-support-note').textContent=t(!available?'shutdownUnsupported':'shutdownHelperNote')+(available?' '+t('shutdownDataWarning'):'');
      const progress=available?state.helperProgress:0,track=$('shutdown-helper-progress').querySelector('.timer-helper-track');
      $('shutdown-helper-progress').style.setProperty('--helper-progress',progress+'%');$('shutdown-helper-percent').textContent=progress+'%';track.setAttribute('aria-valuenow',String(progress));
      $('shutdown-helper-status').textContent=t(progress>=100?(state.helperEnabled?'helperInstallComplete':'helperDisabled'):progress>=50?'helperDownloadReady':'helperNotInstalled');
    }
    function sync(){setFields('alarm');setFields('shutdown');syncAvailability();syncSound();updateOutput('alarm');updateOutput('shutdown');button.classList.toggle('timer-active',state.alarm.enabled||state.shutdown.enabled);button.setAttribute('aria-pressed',String(state.alarm.enabled||state.shutdown.enabled));scheduleWake();}
    function primeAudio(){const AudioContext=root.AudioContext||root.webkitAudioContext;if(!AudioContext)return null;try{audioContext=audioContext||new AudioContext();audioContext.resume?.().catch(()=>{});return audioContext;}catch(_){audioContext=null;return null;}}
    async function decodeSound(blob){const context=primeAudio();if(!context)throw Error('Web Audio unavailable');return context.decodeAudioData(await blob.arrayBuffer());}
    function defaultSoundUrls(){
      const local=new URL('assets/music/'+encodeURIComponent(DEFAULT_ALARM_FILE),document.baseURI).href,host=root.location?.hostname||'',asset=root.SolarAssets?.music?.[DEFAULT_ALARM_FILE],remote=asset?.fallback||(asset?.base?new URL(asset.path,asset.base).href:'');
      const localFirst=root.location?.protocol==='file:'||host==='localhost'||host==='127.0.0.1';return [...new Set((localFirst?[local,remote]:[remote,local]).filter(Boolean))];
    }
    async function loadDefaultSound(){
      if(disposed)return null;if(defaultBuffer)return defaultBuffer;if(defaultPromise)return defaultPromise;
      const generation=defaultGeneration,abort=typeof root.AbortController==='function'?new root.AbortController():null;defaultAbort=abort;
      const task=(async()=>{for(const url of defaultSoundUrls())try{
        if(disposed||generation!==defaultGeneration)return null;
        const response=await root.fetch(url,{cache:'force-cache',signal:abort?.signal});if(!response.ok)continue;
        const blob=await response.blob();if(disposed||generation!==defaultGeneration)return null;
        const buffer=await decodeSound(blob);if(disposed||generation!==defaultGeneration)return null;return defaultBuffer=buffer;
      }catch(_){}return null;})();
      defaultPromise=task;try{return await task;}finally{if(defaultPromise===task)defaultPromise=null;}
    }
    function releaseCustom(){customResource?.dispose();customResource=null;customBuffer=null;}
    function invalidateSound(){soundGeneration++;soundAbort?.abort();soundAbort=null;customTask=null;}
    function releaseIdleAudio(){
      if(ringing||state.alarm.enabled||previewSource||previewMedia)return;
      if(!selectionTask)invalidateSound();releaseCustom();defaultBuffer=null;defaultGeneration++;defaultAbort?.abort();defaultAbort=null;defaultPromise=null;audioContext?.suspend?.()?.catch?.(()=>{});
    }
    function soundPreparation(blob){soundAbort?.abort();soundAbort=typeof root.AbortController==='function'?new root.AbortController():null;return modules.AlarmSound.prepare(blob,{getContext:primeAudio,signal:soundAbort?.signal});}
    async function loadStoredSound(){
      if(disposed)return null;if(customResource)return customResource;if(customTask)return customTask;
      const generation=soundGeneration;
      const task=(async()=>{try{
        const record=await sounds.get();if(!record?.blob||disposed||generation!==soundGeneration)return null;
        const resource=await soundPreparation(record.blob);
        if(disposed||generation!==soundGeneration){resource.dispose();return null;}
        releaseCustom();customResource=resource;customBuffer=resource.buffer;
        if(!state.soundName)state.soundName=record.name||'';syncSound();return resource;
      }catch(_){return null;}})();
      customTask=task;try{return await task;}finally{if(customTask===task)customTask=null;}
    }
    function syncPreview(){
      for(const kind of ['default','custom']){const control=$('alarm-preview-'+kind),active=!!(previewSource||previewMedia)&&previewKind===kind,label=t(kind==='default'?'defaultAlarmSound':'customAlarmSound');control.disabled=kind==='custom'&&!customResource&&!state.soundName;control.setAttribute('aria-pressed',String(active));control.setAttribute('aria-label',label+' · '+t(active?'stop':'start'));control.title=control.getAttribute('aria-label');}
    }
    function stopPreview(){
      previewRequest++;const source=previewSource,media=previewMedia;previewSource=null;previewMedia=null;previewKind='';try{source?.stop();}catch(_){}try{media?.pause();if(media)media.src='';}catch(_){}try{source?.disconnect?.();}catch(_){}syncPreview();
    }
    function playPreview(kind,buffer,request){
      if(request!==previewRequest||!buffer||!audioContext)return;const source=audioContext.createBufferSource(),gain=audioContext.createGain();gain.gain.value=PREVIEW_VOLUME;source.buffer=buffer;source.connect(gain).connect(audioContext.destination);previewSource=source;previewKind=kind;source.onended=()=>{if(previewSource!==source)return;previewSource=null;previewKind='';try{source.disconnect();gain.disconnect?.();}catch(_){}syncPreview();releaseIdleAudio();};source.start();syncPreview();
    }
    function playDefaultPreview(request){
      if(typeof root.Audio!=='function')return false;const urls=defaultSoundUrls();let index=0;
      const attempt=()=>{if(request!==previewRequest||index>=urls.length)return false;const media=new root.Audio(urls[index++]);let finished=false;media.preload='auto';media.volume=PREVIEW_VOLUME;previewMedia=media;previewKind='default';const clear=()=>{if(previewMedia!==media)return;previewMedia=null;previewKind='';syncPreview();};const failed=()=>{if(finished)return;finished=true;if(previewMedia===media){previewMedia=null;previewKind='';}try{media.pause();media.src='';}catch(_){}if(!attempt())syncPreview();};media.addEventListener('ended',clear,{once:true});media.addEventListener('error',failed,{once:true});try{const result=media.play();result?.catch?.(failed);}catch(_){failed();}syncPreview();return true;};return attempt();
    }
    function playCustomMedia(resource,{preview=false,request=0}={}){
      if(!resource?.url||typeof root.Audio!=='function')return false;
      const media=new root.Audio(resource.url);media.preload='auto';media.loop=!preview;media.volume=preview?PREVIEW_VOLUME:ALARM_VOLUME;
      if(preview){previewMedia=media;previewKind='custom';}else defaultAlarmMedia=media;
      const current=()=>!disposed&&(preview?previewRequest===request&&previewMedia===media:ringing&&toneRequest===request&&defaultAlarmMedia===media);
      const stop=()=>{try{media.pause();media.removeAttribute?.('src');media.src='';media.load?.();}catch(_){};};
      const ended=()=>{if(!current())return;if(preview){previewMedia=null;previewKind='';syncPreview();releaseIdleAudio();}};
      const failed=()=>{if(!current()){stop();return;}if(preview){previewMedia=null;previewKind='';syncPreview();}else {defaultAlarmMedia=null;if(!toneInterval){pulse();toneInterval=root.setInterval(pulse,1200);}}stop();};
      media.addEventListener('ended',ended,{once:true});media.addEventListener('error',failed,{once:true});
      try{Promise.resolve(media.play()).then(()=>{if(!current()){stop();return;}if(!preview){clearInterval(toneInterval);toneInterval=0;}}).catch(failed);}catch(_){failed();}
      if(preview)syncPreview();return true;
    }
    async function togglePreview(kind){
      if((previewSource||previewMedia)&&previewKind===kind){stopPreview();releaseIdleAudio();return;}
      stopPreview();primeAudio();const request=previewRequest;
      if(kind==='custom'){const resource=await loadStoredSound();if(disposed||request!==previewRequest)return;if(!resource){$('alarm-sound-file').click();return;}if(resource.url){playCustomMedia(resource,{preview:true,request});return;}playPreview(kind,resource.buffer,request);return;}
      if(root.location?.protocol==='file:'){playDefaultPreview(request);return;}
      const buffer=await loadDefaultSound();if(disposed||request!==previewRequest)return;
      if(!buffer){playDefaultPreview(request);return;}playPreview(kind,buffer,request);
    }
    function pulse(){if(!ringing||!audioContext)return;const start=audioContext.currentTime;for(const [offset,frequency] of [[0,880],[.18,660]]){const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();oscillator.type='sine';oscillator.frequency.value=frequency;gain.gain.setValueAtTime(.0001,start+offset);gain.gain.exponentialRampToValueAtTime(FALLBACK_VOLUME,start+offset+.025);gain.gain.exponentialRampToValueAtTime(.0001,start+offset+.15);oscillator.connect(gain).connect(audioContext.destination);oscillator.start(start+offset);oscillator.stop(start+offset+.17);}}
    function playLoop(buffer){if(!buffer||!audioContext)return false;customSource=audioContext.createBufferSource();const gain=audioContext.createGain();gain.gain.value=ALARM_VOLUME;customSource.buffer=buffer;customSource.loop=true;customSource.connect(gain).connect(audioContext.destination);customSource.start();return true;}
    function playDefaultAlarmMedia(){
      if(typeof root.Audio!=='function')return false;const urls=defaultSoundUrls(),request=toneRequest;let index=0;
      const attempt=()=>{if(disposed||!ringing||request!==toneRequest||index>=urls.length)return false;const media=new root.Audio(urls[index++]);let failedOnce=false;media.preload='auto';media.loop=true;media.volume=ALARM_VOLUME;defaultAlarmMedia=media;const failed=()=>{if(failedOnce)return;failedOnce=true;if(defaultAlarmMedia===media)defaultAlarmMedia=null;try{media.pause();media.src='';}catch(_){}attempt();};media.addEventListener('error',failed,{once:true});try{const result=media.play();if(result?.then)result.then(()=>{if(defaultAlarmMedia===media&&ringing&&request===toneRequest){clearInterval(toneInterval);toneInterval=0;}else {media.pause();media.src='';}}).catch(failed);else {clearInterval(toneInterval);toneInterval=0;}}catch(_){failed();}return true;};return attempt();
    }
    function startTone(){
      stopPreview();primeAudio();const request=++toneRequest,custom=state.soundMode==='custom';
      if(custom&&customResource?.url){if(playCustomMedia(customResource,{request}))return;}
      const selected=custom?customBuffer:defaultBuffer;if(playLoop(selected))return;
      pulse();toneInterval=root.setInterval(pulse,1200);
      const ready=custom?loadStoredSound():loadDefaultSound();
      ready.then(value=>{if(disposed||!ringing||request!==toneRequest||(state.soundMode==='custom')!==custom)return;
        if(custom&&value?.url){playCustomMedia(value,{request});return;}
        const buffer=custom?value?.buffer:value;if(buffer&&playLoop(buffer)){clearInterval(toneInterval);toneInterval=0;}else if(!custom)playDefaultAlarmMedia();
      });
    }
    function stopTone(){ringing=false;++toneRequest;clearInterval(toneInterval);toneInterval=0;try{customSource?.stop();customSource?.disconnect?.();}catch(_){}customSource=null;try{defaultAlarmMedia?.pause();if(defaultAlarmMedia){defaultAlarmMedia.src='';defaultAlarmMedia.load?.();}}catch(_){}defaultAlarmMedia=null;releaseIdleAudio();}
    function closeAlarm(){stopTone();if(alarmDialog.open)UI.hide(alarmDialog,()=>alarmDialog.close());}
    function closeShutdown(){if(shutdownDialog.open)UI.hide(shutdownDialog,()=>shutdownDialog.close());}
    function ring(){state.alarm.enabled=false;state.alarm.deadline=0;save();sync();ringing=true;try{onAlarmStart();}catch(error){root.console?.warn?.('Alarm start hook failed',error);}startTone();if(!alarmDialog.open)UI.show(alarmDialog,()=>alarmDialog.showModal());}
    function failureMessage(result){return result?.reason==='not-launched'?t('shutdownNotLaunched'):result?.uncertain?t('shutdownUnknown'):t('shutdownFailed',{code:result?.code??'unknown'});}
    async function nativeResult(action,seconds){try{return await shutdownBridge?.[action]?.(seconds)||{ok:false,uncertain:true};}catch(_){return {ok:false,uncertain:true};}}
    async function cancel(name,{native=true,quiet=false}={}){
      const wasEnabled=state[name].enabled;
      if(name==='shutdown'&&native&&wasEnabled){
        if(nativeBusy==='cancel'||nativeBusy==='uninstall')return false;
        const request=++nativeSerial;nativeBusy='cancel';state.shutdown.status='pending';
        const pending=nativeResult('cancel');save();sync();
        const result=await pending;if(disposed||request!==nativeSerial)return false;nativeBusy='';
        if(result?.ok!==true){state.shutdown.status='unknown';save();sync();notify(failureMessage(result));return false;}
      }
      state[name].enabled=false;state[name].deadline=0;
      if(name==='shutdown'){state.shutdown.status='idle';closeShutdown();}
      save();sync();if(name==='alarm')releaseIdleAudio();if(!quiet&&wasEnabled)notify(t(name==='alarm'?'alarmCancelled':'shutdownCancelled'));return true;
    }
    async function schedule(name,{quiet=false}={}){
      if(name==='shutdown'&&nativeBusy){sync();return false;}
      const previous={...state[name]},minutes=readFields(name);
      if(minutes<1){notify(t('timerDurationRequired'));sync();return false;}
      if(name==='shutdown'&&(!eligible||!state.helperEnabled)){notify(t(!eligible?'shutdownUnsupported':'shutdownHelperRequired'));sync();return false;}
      if(name==='alarm'){primeAudio();if(state.soundMode==='custom')loadStoredSound();else loadDefaultSound();}
      if(name==='shutdown'){
        const request=++nativeSerial;nativeBusy='schedule';state.shutdown.enabled=true;state.shutdown.status='pending';state.shutdown.deadline=0;
        // Start the protocol request while user activation is still live.
        const pending=nativeResult('schedule',minutes*60);save();sync();
        const result=await pending;if(disposed||request!==nativeSerial)return false;nativeBusy='';
        if(result?.ok!==true){
          if(result?.reason==='not-launched'){state.shutdown=previous;}
          else if(result?.uncertain||previous.enabled){state.shutdown.enabled=true;state.shutdown.status='unknown';state.shutdown.deadline=previous.deadline;}
          else {state.shutdown.enabled=false;state.shutdown.status='idle';state.shutdown.deadline=0;}
          save();sync();notify(failureMessage(result));return false;
        }
        state.shutdown.deadline=result.deadline;state.shutdown.status='confirmed';
      }else {state.alarm.enabled=true;state.alarm.deadline=now()+minutes*60000;}
      save();sync();if(!quiet)notify(t(name==='alarm'?'alarmScheduled':'shutdownScheduled',{time:formatTarget(state[name].deadline)}));return true;
    }
    function showShutdownCountdown(seconds){$('shutdown-countdown').textContent=String(seconds);if(!shutdownDialog.open)UI.show(shutdownDialog,()=>shutdownDialog.showModal());}
    function showDownloadConfirm(){$('shutdown-helper-checksum').textContent=shutdownBridge?.helperSha256||'';if(!downloadDialog.open)UI.show(downloadDialog,()=>downloadDialog.showModal());}
    function closeDownloadConfirm(){if(downloadDialog.open)UI.hide(downloadDialog,()=>downloadDialog.close());}
    function showInstallConfirm(){if(!installDialog.open)UI.show(installDialog,()=>installDialog.showModal());}
    function closeInstallConfirm(){if(installDialog.open)UI.hide(installDialog,()=>installDialog.close());}
    function showRemoveConfirm(){if(!removeDialog.open)UI.show(removeDialog,()=>removeDialog.showModal());}
    function closeRemoveConfirm(){if(removeDialog.open)UI.hide(removeDialog,()=>removeDialog.close());}
    async function downloadHelper(){return String(await shutdownBridge?.download?.()||'');}
    function installationPending(){return state.helperProgress===50&&!state.helperConfirmed&&!!state.helperInstallToken;}
    function installPollDelay(time){const age=Math.max(0,time-(state.helperInstallDeadline-10*60000));return document.hidden?15000:age<15000?1000:age<60000?3000:10000;}
    function pollHelperInstall(time){
      if(!installationPending())return;
      if(state.helperInstallDeadline&&time>=state.helperInstallDeadline){invalidateInstall();save();return;}
      if(installPollTask||time<nextInstallPoll)return;nextInstallPoll=time+installPollDelay(time);metrics.installPolls++;
      const token=state.helperInstallToken;
      installPollTask=Promise.resolve(shutdownBridge?.installStatus?.(token)).then(installed=>{
        if(disposed||!installed||token!==state.helperInstallToken)return;
        state.helperConfirmed=true;state.helperProgress=100;state.helperEnabled=true;state.helperRevision=String(shutdownBridge?.helperSha256||'');state.helperInstallToken='';state.helperInstallDeadline=0;save();sync();closeInstallConfirm();notify(t('shutdownHelperEnabled'));
      }).catch(()=>{}).finally(()=>{installPollTask=null;scheduleWake();});
    }
    function invalidateInstall(){state.helperInstallToken='';state.helperInstallDeadline=0;nextInstallPoll=0;}
    function scheduleWake(){
      if(interval){root.clearTimeout?.(interval);interval=0;}if(disposed)return;
      const time=now(),delays=[];
      if(state.alarm.enabled)delays.push(Math.min(60000,state.alarm.deadline-time));
      if(state.shutdown.enabled&&state.shutdown.status==='confirmed'){
        const left=state.shutdown.deadline-time;delays.push(left>10000?Math.min(60000,left-10000):Math.min(1000,left));
      }
      if(installationPending()){
        if(!installPollTask)delays.push(Math.max(0,nextInstallPoll-time));
        if(state.helperInstallDeadline)delays.push(state.helperInstallDeadline-time);
      }
      if(!document.hidden&&UI.visible(panel)&&(state.alarm.enabled||(state.shutdown.enabled&&state.shutdown.status==='confirmed')))delays.push(1000-time%1000);
      if(delays.length&&typeof root.setTimeout==='function')interval=root.setTimeout(()=>{interval=0;metrics.wakes++;check();},Math.max(1,Math.min(...delays)));
    }
    function check(){
      if(disposed)return;const time=now();pollHelperInstall(time);
      if(state.alarm.enabled&&state.alarm.deadline<=time)ring();
      if(state.shutdown.enabled&&state.shutdown.status==='confirmed'){const remaining=Math.max(0,Math.ceil((state.shutdown.deadline-time)/1000));if(remaining>0&&remaining<=10)showShutdownCountdown(remaining);if(remaining<=0)cancel('shutdown',{native:false,quiet:true});}
      if(!document.hidden&&UI.visible(panel)){updateOutput('alarm');updateOutput('shutdown');}
      scheduleWake();
    }
    const scrollBinding=UI.bindScrollCues(panel,panel.querySelector('.timer-scroll'));
    function open(value){const wasVisible=UI.visible(panel),next=value===undefined?!wasVisible:!!value;if(next){onOpen();UI.show(panel);check();scrollBinding.update();root.requestAnimationFrame?.(scrollBinding.update);}else {stopPreview();UI.hide(panel);}if(!next)releaseIdleAudio();button.setAttribute('aria-expanded',String(next));scheduleWake();}
    function refreshLanguage(){targetFormatter=null;targetLabels.clear();syncAvailability();syncSound();updateOutput('alarm');updateOutput('shutdown');button.setAttribute('aria-label',t('timer'));button.title=t('timer');}
    async function chooseSound(file){
      if(!file||disposed)return;stopPreview();invalidateSound();const generation=soundGeneration;
      if(file.size>MAX_SOUND_BYTES){notify(t('alarmSoundTooLarge'));return;}
      if(!(String(file.type||'').startsWith('audio/')||/\.(?:mp3|wav|ogg|m4a|aac|flac|opus)$/i.test(file.name))){notify(t('alarmSoundInvalid'));return;}
      let resource;selectionTask=generation;primeAudio();
      try{
        resource=await soundPreparation(file);if(disposed||generation!==soundGeneration){resource.dispose();return;}
        soundWriteTask=soundWriteTask.catch(()=>{}).then(async()=>{if(disposed||generation!==soundGeneration)return false;await sounds.put({blob:file,name:file.name,type:file.type});return true;});
        const saved=await soundWriteTask;if(!saved||disposed||generation!==soundGeneration){resource.dispose();return;}
        releaseCustom();customResource=resource;customBuffer=resource.buffer;state.soundMode='custom';state.soundName=file.name;save();syncSound();notify(t('alarmSoundSaved'));
      }catch(_){resource?.dispose();if(!disposed&&generation===soundGeneration)notify(t('alarmSoundInvalid'));}
      finally{if(selectionTask===generation)selectionTask=0;if(!UI.visible(panel))releaseIdleAudio();}
    }
    button.addEventListener('click',()=>open());$('timer-close').addEventListener('click',()=>{open(false);button.focus({preventScroll:true});});UI.bindPopup(panel,()=>open(false));
    const closeOnViewport=event=>{if(downloadDialog.open||installDialog.open||removeDialog.open||alarmDialog.open||shutdownDialog.open||shouldKeepOpen(event))return;if(UI.visible(panel)&&!panel.contains(event.target)&&!button.contains(event.target))open(false);};
    document.addEventListener('pointerdown',closeOnViewport);
    for(const name of ['alarm','shutdown']){
      controls[name].toggle.addEventListener('change',()=>controls[name].toggle.checked?schedule(name):cancel(name));
      for(const input of [controls[name].hours,controls[name].minutes])input.addEventListener('change',()=>{readFields(name);if(state[name].enabled)schedule(name,{quiet:true});else {save();sync();}});
    }
    $('shutdown-helper-enabled').addEventListener('change',async event=>{
      if(!eligible){state.helperEnabled=false;sync();return;}
      if(event.target.checked&&state.helperProgress<50){event.target.checked=false;state.helperEnabled=false;save();sync();showDownloadConfirm();return;}
      if(event.target.checked&&!state.helperConfirmed){event.target.checked=false;state.helperEnabled=false;save();sync();showInstallConfirm();return;}
      const enable=!!event.target.checked;
      if(!enable&&state.shutdown.enabled){if(!await cancel('shutdown')){sync();return;}}
      state.helperEnabled=enable;save();sync();if(enable)notify(t('shutdownHelperEnabled'));
    });
    $('shutdown-helper-download-no').addEventListener('click',closeDownloadConfirm);
    $('shutdown-helper-download-yes').addEventListener('click',async()=>{const token=await downloadHelper();if(token){state.helperProgress=50;state.helperInstallToken=token;nextInstallPoll=0;state.helperInstallDeadline=now()+10*60*1000;notify(t('helperDownloadStarted'));}else {state.helperProgress=0;state.helperInstallToken='';state.helperInstallDeadline=0;notify(t('helperNotInstalled'));}state.helperEnabled=false;state.helperConfirmed=false;save();sync();closeDownloadConfirm();});
    UI.bindDialog(downloadDialog,closeDownloadConfirm);
    $('shutdown-helper-install-no').addEventListener('click',closeInstallConfirm);
    $('shutdown-helper-install-yes').addEventListener('click',async()=>{
      if(helperBusy)return;helperBusy=true;const pending=nativeResult('probe');sync();
      const result=await pending;if(disposed)return;helperBusy=false;
      if(result?.ok!==true){sync();notify(t('helperVerifyFailed'));return;}
      state.helperConfirmed=true;state.helperProgress=100;state.helperEnabled=true;state.helperRevision=String(shutdownBridge?.helperSha256||'');state.helperInstallToken='';state.helperInstallDeadline=0;save();sync();closeInstallConfirm();notify(t('shutdownHelperEnabled'));
    });
    UI.bindDialog(installDialog,closeInstallConfirm);
    $('shutdown-helper-remove').addEventListener('click',()=>{if(state.helperProgress>=100)showRemoveConfirm();});
    $('shutdown-helper-remove-no').addEventListener('click',closeRemoveConfirm);
    $('shutdown-helper-remove-yes').addEventListener('click',async()=>{
      if(nativeBusy)return;const request=++nativeSerial;nativeBusy='uninstall';const pending=nativeResult('uninstall');sync();
      const result=await pending;if(disposed||request!==nativeSerial)return;nativeBusy='';
      if(result?.ok!==true){if(state.shutdown.enabled)state.shutdown.status='unknown';save();sync();notify(failureMessage(result));return;}
      state.helperEnabled=false;state.helperProgress=0;state.helperConfirmed=false;state.helperRevision='';state.helperInstallToken='';state.helperInstallDeadline=0;state.shutdown.enabled=false;state.shutdown.deadline=0;state.shutdown.status='idle';closeShutdown();save();sync();notify(t('helperRemoveRequested'));closeRemoveConfirm();
    });
    UI.bindDialog(removeDialog,closeRemoveConfirm);
    $('alarm-sound-default').addEventListener('change',()=>{if(!$('alarm-sound-default').checked)return;stopPreview();invalidateSound();releaseCustom();state.soundMode='default';save();syncSound();if(state.alarm.enabled)loadDefaultSound();else releaseIdleAudio();});
    $('alarm-sound-custom').addEventListener('change',async()=>{if(!$('alarm-sound-custom').checked)return;stopPreview();primeAudio();const generation=soundGeneration,resource=await loadStoredSound();if(disposed||generation!==soundGeneration)return;if(resource){state.soundMode='custom';save();syncSound();}else $('alarm-sound-file').click();});
    $('alarm-sound-choose').addEventListener('click',event=>{event.preventDefault();event.stopPropagation();$('alarm-sound-file').click();});
    for(const kind of ['default','custom'])$('alarm-preview-'+kind).addEventListener('click',event=>{event.preventDefault();event.stopPropagation();togglePreview(kind);});
    $('alarm-sound-file').addEventListener('change',event=>{const file=event.target.files?.[0];event.target.value='';return chooseSound(file);});
    $('alarm-snooze').addEventListener('click',()=>{closeAlarm();state.alarm.hours=0;state.alarm.minutes=5;setFields('alarm');schedule('alarm',{quiet:true});notify(t('alarmSnoozed'));});
    $('alarm-stop').addEventListener('click',()=>{closeAlarm();cancel('alarm',{quiet:true});});UI.bindDialog(alarmDialog,()=>{closeAlarm();cancel('alarm',{quiet:true});});
    $('shutdown-cancel').addEventListener('click',()=>cancel('shutdown'));
    shutdownDialog.addEventListener('cancel',event=>{event.preventDefault();cancel('shutdown');});
    if(state.alarm.enabled&&state.alarm.deadline<=now())state.alarm.enabled=false;if(state.shutdown.enabled&&state.shutdown.status==='confirmed'&&state.shutdown.deadline<=now()){state.shutdown.enabled=false;state.shutdown.status='idle';}
    const visibilityCheck=()=>{if(!document.hidden)nextInstallPoll=0;check();};
    sync();save();if(state.alarm.enabled){if(state.soundMode==='custom')loadStoredSound();else loadDefaultSound();}
    document.addEventListener('visibilitychange',visibilityCheck);root.addEventListener?.('pageshow',visibilityCheck);root.addEventListener?.('focus',visibilityCheck);
    return Object.freeze({open,close:()=>open(false),refreshLanguage,check,getState:()=>JSON.parse(JSON.stringify(state)),getDiagnostics:()=>({...metrics,retainedDecodedBytes:modules.AlarmSound.decodedBytes(defaultBuffer)+modules.AlarmSound.decodedBytes(customBuffer),customStreaming:!!customResource?.url,wakeScheduled:!!interval}),dispose(){if(disposed)return;disposed=true;++nativeSerial;invalidateSound();releaseCustom();defaultBuffer=null;defaultGeneration++;defaultAbort?.abort();defaultAbort=null;shutdownBridge?.dispose?.();root.clearTimeout?.(interval);interval=0;root.removeEventListener?.('pageshow',visibilityCheck);root.removeEventListener?.('focus',visibilityCheck);document.removeEventListener('visibilitychange',visibilityCheck);document.removeEventListener('pointerdown',closeOnViewport);scrollBinding.dispose();stopPreview();closeAlarm();closeShutdown();closeDownloadConfirm();closeInstallConfirm();closeRemoveConfirm();audioContext?.close?.().catch(()=>{});}});
  }
  modules.TimerController=Object.freeze({create,totalMinutes,MAX_MINUTES,MAX_SOUND_BYTES,DEFAULT_ALARM_FILE,ALARM_VOLUME,PREVIEW_VOLUME,FALLBACK_VOLUME,copy});
})(window);
