/* Shared card lifecycle, dismissal, scrolling and lazy-script ownership. */
(function(root){
  'use strict';
  const modules=root.SolarModules||(root.SolarModules={});
  const timers=new Map(),bindings=new Map(),dialogOrder=[],cleanups=new Set(),scripts=new Map(),fadeMs=1000;
  let disposed=false;const animationFrames=new Set();
  const later=callback=>{const id=root.requestAnimationFrame(()=>{animationFrames.delete(id);if(!disposed)callback();});animationFrames.add(id);return id;};
  const duration=()=>root.matchMedia?.('(prefers-reduced-motion: reduce)').matches?0:fadeMs;
  const shown=element=>element.tagName==='DIALOG'?element.open:!element.hidden;
  const visible=element=>shown(element)&&!element.classList.contains('ui-fade-closing');
  const forget=element=>{const i=dialogOrder.indexOf(element);if(i>=0)dialogOrder.splice(i,1);};
  const track=element=>{if(element.tagName==='DIALOG'){forget(element);dialogOrder.push(element);}};
  function own(dispose){cleanups.add(dispose);return ()=>{if(cleanups.delete(dispose))dispose();};}
  function show(element,open){
    if(disposed)return;
    const timer=timers.get(element);if(timer)root.clearTimeout(timer);timers.delete(element);
    element.classList.add('ui-fade');element.classList.remove('ui-fade-closing');
    const alreadyShown=shown(element);if(!alreadyShown){if(open)open();else element.hidden=false;}
    track(element);
    if(alreadyShown||!duration()){element.classList.add('ui-fade-visible');return;}
    element.classList.remove('ui-fade-visible');void element.offsetWidth;
    later(()=>later(()=>{if(shown(element)&&!element.classList.contains('ui-fade-closing'))element.classList.add('ui-fade-visible');}));
  }
  function hide(element,close){
    const timer=timers.get(element);if(timer)root.clearTimeout(timer);timers.delete(element);
    if(!shown(element))return;
    element.classList.add('ui-fade','ui-fade-closing');element.classList.remove('ui-fade-visible');
    const finish=()=>{timers.delete(element);if(!element.classList.contains('ui-fade-closing'))return;if(close)close();else element.hidden=true;forget(element);element.classList.remove('ui-fade','ui-fade-closing','ui-fade-visible');};
    const wait=duration();if(!wait)finish();else timers.set(element,root.setTimeout(finish,wait));
  }
  function topDialog(){
    for(let i=dialogOrder.length-1;i>=0;i--){const d=dialogOrder[i];if(shown(d)&&bindings.has(d))return d;dialogOrder.splice(i,1);}
    return null;
  }
  function dismissTopDialog(){
    const dialog=topDialog();if(!dialog)return false;
    if(!dialog.classList.contains('ui-fade-closing'))bindings.get(dialog)();
    return true;
  }
  function dismissAll(){
    for(const [element,requestClose] of [...bindings].reverse()){
      if(visible(element))requestClose({restoreFocus:false});
    }
  }
  function bindPopup(element,requestClose){
    if(bindings.has(element))throw Error('Popup already registered: '+element.id);
    bindings.set(element,requestClose);
    return own(()=>{bindings.delete(element);forget(element);});
  }
  function outside(dialog,event){
    const b=dialog.getBoundingClientRect();
    return event.target===dialog&&(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom);
  }
  function bindDialog(dialog,requestClose,{backdrop=true}={}){
    const unbind=bindPopup(dialog,requestClose);if(shown(dialog))track(dialog);
    let pressedOutside=null;
    const down=event=>{pressedOutside=outside(dialog,event);};
    const click=event=>{if(backdrop&&outside(dialog,event)&&pressedOutside!==false)requestClose();pressedOutside=null;};
    const cancel=event=>{event.preventDefault();event.stopPropagation();if(topDialog()===dialog)dismissTopDialog();};
    const closed=()=>forget(dialog);
    dialog.addEventListener('pointerdown',down);dialog.addEventListener('click',click);dialog.addEventListener('cancel',cancel);dialog.addEventListener('close',closed);
    return own(()=>{unbind();dialog.removeEventListener('pointerdown',down);dialog.removeEventListener('click',click);dialog.removeEventListener('cancel',cancel);dialog.removeEventListener('close',closed);});
  }
  function bindScrollCues(container,scroller){
    let frame=0,stopped=false;
    const update=()=>{if(stopped)return;const remaining=scroller.scrollHeight-scroller.clientHeight-scroller.scrollTop;container.classList.toggle('can-scroll-up',scroller.scrollTop>3);container.classList.toggle('can-scroll-down',remaining>3);};
    const schedule=()=>{if(!frame&&!stopped)frame=root.requestAnimationFrame(()=>{frame=0;update();});};
    scroller.addEventListener('scroll',update,{passive:true});
    const observer=typeof root.ResizeObserver==='function'?new root.ResizeObserver(schedule):null;
    if(observer)observer.observe(scroller);
    const dispose=own(()=>{stopped=true;scroller.removeEventListener('scroll',update);observer?.disconnect();if(frame)root.cancelAnimationFrame(frame);});
    return {update,dispose};
  }
  function loadScript(url,globalName,{timeout=15000}={}){
    if(disposed)return Promise.reject(Error('UI has been disposed'));
    if(root[globalName])return Promise.resolve(root[globalName]);
    if(scripts.has(url))return scripts.get(url);
    const task=new Promise((resolve,reject)=>{
      const script=root.document.createElement('script');let timer,settled=false;
      const cancel=()=>finish(Error('Page disposed while loading '+url));cleanups.add(cancel);
      const finish=error=>{if(settled)return;settled=true;cleanups.delete(cancel);root.clearTimeout(timer);script.removeEventListener('load',loaded);script.removeEventListener('error',failed);if(error){script.remove();reject(error);}else resolve(root[globalName]);};
      const loaded=()=>finish(root[globalName]?null:Error(globalName+' did not initialize'));
      const failed=()=>finish(Error('Could not load '+url));
      script.src=url;script.async=true;script.dataset.solarModule=globalName;
      script.addEventListener('load',loaded);script.addEventListener('error',failed);
      timer=root.setTimeout(()=>finish(Error('Timed out loading '+url)),timeout);
      root.document.head.append(script);
    });
    scripts.set(url,task);task.then(()=>scripts.delete(url),()=>scripts.delete(url));return task;
  }
  function bindFullscreenEscape(document=root.document,keyboard=root.navigator?.keyboard){
    // preventDefault alone cannot intercept the browser's fullscreen Escape.
    // Capture ONLY Escape; native long-press exit and every other key stay free.
    let stopped=false,revision=0,state='native';
    function release(){
      revision++;const owned=state==='pending'||state==='locked';state='native';
      if(owned)try{keyboard.unlock();}catch(_){}
    }
    async function sync(){
      if(stopped||disposed||!document.fullscreenElement){release();return;}
      if(state!=='native')return;
      if(!keyboard?.lock||!keyboard?.unlock){state='unavailable';return;}
      const request=++revision;state='pending';
      try{await keyboard.lock(['Escape']);if(request===revision)state='locked';}
      catch(_){if(request===revision)state='unavailable';}
    }
    document.addEventListener('fullscreenchange',sync);
    root.addEventListener?.('pagehide',release);root.addEventListener?.('pageshow',sync);
    const dispose=own(()=>{
      stopped=true;release();document.removeEventListener('fullscreenchange',sync);
      root.removeEventListener?.('pagehide',release);root.removeEventListener?.('pageshow',sync);
    });
    sync();return {get state(){return state;},dispose};
  }
  function installDocumentGuards(document){
    if(document.documentElement.dataset.solarInputGuards==='true')return;
    document.documentElement.dataset.solarInputGuards='true';
    // Browsers promote pointer-retained focus to :focus-visible on ANY key.
    // Only deliberate Tab navigation should reveal the keyboard focus outline.
    const html=document.documentElement,keyboardTarget=root.addEventListener?root:document;
    html.dataset.focusInput='pointer';
    const pointer=()=>{html.dataset.focusInput='pointer';};
    const keyboard=event=>{if(event.key==='Tab'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.isComposing)html.dataset.focusInput='keyboard';};
    document.addEventListener('pointerdown',pointer,true);
    keyboardTarget.addEventListener('keydown',keyboard,true);
    own(()=>{document.removeEventListener('pointerdown',pointer,true);keyboardTarget.removeEventListener('keydown',keyboard,true);delete html.dataset.focusInput;});
    const selectable=event=>event.target.closest?.('input,textarea,[contenteditable]:not([contenteditable="false"]),[data-allow-selection]');
    const guard=event=>{if(!selectable(event))event.preventDefault();};
    document.addEventListener('contextmenu',guard);document.addEventListener('selectstart',guard);
    own(()=>{document.removeEventListener('contextmenu',guard);document.removeEventListener('selectstart',guard);delete document.documentElement.dataset.solarInputGuards;});
  }
  function dispose(){if(disposed)return;disposed=true;for(const d of [...dialogOrder])if(shown(d))d.close();for(const frame of animationFrames)root.cancelAnimationFrame(frame);animationFrames.clear();for(const stop of [...cleanups]){cleanups.delete(stop);stop();}for(const timer of timers.values())root.clearTimeout(timer);timers.clear();dialogOrder.length=0;}
  modules.UI=Object.freeze({fadeMs,shown,visible,show,hide,bindScrollCues,bindPopup,bindDialog,topDialog,dismissTopDialog,dismissAll,outside,loadScript,bindFullscreenEscape,installDocumentGuards,own,dispose});
})(window);
