(function(root){
  'use strict';
  const publisher='ca-pub-5773171100052324';
  const media=typeof matchMedia==='function'?matchMedia('(min-width:1600px) and (min-height:720px) and (pointer:fine)'):null;
  const slot=String(document.querySelector('meta[name="solar-time-ad-slot"]')?.content||'').trim();
  const localPreview=location.protocol==='file:'||location.hostname==='localhost'||location.hostname==='127.0.0.1';
  const previewRequested=localPreview&&new URLSearchParams(location.search).get('ad-preview')==='1';
  const rail=document.getElementById('desktop-ad-rail'),panel=document.getElementById('desktop-ad-panel'),unit=document.getElementById('desktop-ad-unit'),preview=document.getElementById('desktop-ad-preview'),toggle=document.getElementById('desktop-ad-toggle');
  let requested=false,open=true;
  function setOpen(next){
    open=!!next;rail?.classList.toggle('is-open',open);panel?.setAttribute('aria-hidden',String(!open));toggle?.setAttribute('aria-expanded',String(open));
    const real=/^\d+$/.test(slot);if(unit)unit.hidden=!real;if(preview)preview.hidden=!previewRequested||real;
    if(open&&real&&!requested){requested=true;requestAnimationFrame(()=>{try{(root.adsbygoogle=root.adsbygoogle||[]).push({});}catch(error){console.warn('AdSense unit could not start',error);}});}
  }
  function sync(){
    const real=/^\d+$/.test(slot),eligible=!!rail&&!!unit&&(real||previewRequested)&&!!media?.matches;
    rail.hidden=!eligible;
    if(!eligible){setOpen(false);return;}
    if(real){unit.dataset.adClient=publisher;unit.dataset.adSlot=slot;}
    setOpen(true);
  }
  toggle?.addEventListener('click',()=>setOpen(!open));
  media?.addEventListener?.('change',sync);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});else sync();
  root.SolarAdSense=Object.freeze({publisher,slot,localPreview,previewRequested,eligible:()=>!rail?.hidden,isOpen:()=>open,setOpen,sync});
})(window);
