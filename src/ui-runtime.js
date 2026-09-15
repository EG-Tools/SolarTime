/* Solar Time shared transient UI behavior. */
(function(root){
  'use strict';
  const modules=root.SolarModules||(root.SolarModules={});
  const timers=new WeakMap(),fadeMs=1000;
  const duration=()=>typeof root.matchMedia==='function'&&root.matchMedia('(prefers-reduced-motion: reduce)').matches?0:fadeMs;
  const shown=element=>element.tagName==='DIALOG'?element.open:!element.hidden;
  const visible=element=>shown(element)&&!element.classList.contains('ui-fade-closing');
  function show(element,open){
    const timer=timers.get(element);if(timer)root.clearTimeout(timer);timers.delete(element);
    element.classList.add('ui-fade');element.classList.remove('ui-fade-closing');
    const alreadyShown=shown(element);if(!alreadyShown){if(open)open();else element.hidden=false;}
    if(alreadyShown||!duration()){element.classList.add('ui-fade-visible');return;}
    element.classList.remove('ui-fade-visible');void element.offsetWidth;
    root.requestAnimationFrame(()=>root.requestAnimationFrame(()=>{if(shown(element)&&!element.classList.contains('ui-fade-closing'))element.classList.add('ui-fade-visible');}));
  }
  function hide(element,close){
    const timer=timers.get(element);if(timer)root.clearTimeout(timer);timers.delete(element);
    if(!shown(element))return;
    element.classList.add('ui-fade','ui-fade-closing');element.classList.remove('ui-fade-visible');
    const finish=()=>{timers.delete(element);if(!element.classList.contains('ui-fade-closing'))return;if(close)close();else element.hidden=true;element.classList.remove('ui-fade','ui-fade-closing','ui-fade-visible');};
    const wait=duration();if(!wait)finish();else timers.set(element,root.setTimeout(finish,wait));
  }
  function bindScrollCues(container,scroller){
    const update=()=>{const remaining=scroller.scrollHeight-scroller.clientHeight-scroller.scrollTop;container.classList.toggle('can-scroll-up',scroller.scrollTop>3);container.classList.toggle('can-scroll-down',remaining>3);};
    scroller.addEventListener('scroll',update,{passive:true});
    const observer=typeof root.ResizeObserver==='function'?new root.ResizeObserver(()=>root.requestAnimationFrame(update)):null;
    if(observer)observer.observe(scroller);
    return {update,dispose(){scroller.removeEventListener('scroll',update);observer?.disconnect();}};
  }
  function installDocumentGuards(document){
    if(document.documentElement.dataset.solarInputGuards==='true')return;
    document.documentElement.dataset.solarInputGuards='true';
    document.addEventListener('contextmenu',event=>event.preventDefault());
    document.addEventListener('selectstart',event=>event.preventDefault());
  }
  modules.UI=Object.freeze({fadeMs,shown,visible,show,hide,bindScrollCues,installDocumentGuards});
})(window);
