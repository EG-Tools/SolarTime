(function(root){
  'use strict';
  const publisher='ca-pub-5773171100052324';
  const media=typeof matchMedia==='function'?matchMedia('(min-width:1600px) and (min-height:720px) and (pointer:fine)'):null;
  const slot=String(document.querySelector('meta[name="solar-time-ad-slot"]')?.content||'').trim();
  const localPreview=location.protocol==='file:'||location.hostname==='localhost'||location.hostname==='127.0.0.1';
  const previewRequested=localPreview&&new URLSearchParams(location.search).get('ad-preview')==='1';
  const rail=document.getElementById('desktop-ad-rail'),panel=document.getElementById('desktop-ad-panel'),unit=document.getElementById('desktop-ad-unit'),preview=document.getElementById('desktop-ad-preview'),toggle=document.getElementById('desktop-ad-toggle');
  const source=`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisher}`;
  let requested=false,loading=null,open=true;
  function loadScript(){
    if(root.adsbygoogle)return Promise.resolve();if(loading)return loading;
    loading=new Promise((resolve,reject)=>{
      let script=document.querySelector(`script[src="${source}"]`);
      if(!script){script=document.createElement('script');script.async=true;script.crossOrigin='anonymous';script.src=source;document.head.appendChild(script);}
      script.addEventListener('load',resolve,{once:true});script.addEventListener('error',()=>reject(Error('AdSense loader failed')),{once:true});
    });
    return loading;
  }
  function requestAd(){
    if(requested)return;requested=true;
    loadScript().then(()=>{(root.adsbygoogle=root.adsbygoogle||[]).push({});}).catch(error=>{requested=false;loading=null;console.warn('AdSense unit could not start',error);});
  }
  function setOpen(next){
    open=!!next;rail?.classList.toggle('is-open',open);panel?.setAttribute('aria-hidden',String(!open));toggle?.setAttribute('aria-expanded',String(open));
    const real=/^\d+$/.test(slot);if(unit)unit.hidden=!real;if(preview)preview.hidden=!previewRequested||real;
    if(open&&real&&!requested)requestAnimationFrame(requestAd);
  }
  function sync(){
    const real=/^\d+$/.test(slot),granted=root.SolarConsent?.value()==='granted';
    const eligible=!!rail&&!!unit&&(previewRequested||(real&&granted))&&!!media?.matches;
    rail.hidden=!eligible;
    if(!eligible){setOpen(false);return;}
    if(real){unit.dataset.adClient=publisher;unit.dataset.adSlot=slot;}
    setOpen(true);
  }
  toggle?.addEventListener('click',()=>setOpen(!open));
  media?.addEventListener?.('change',sync);
  root.addEventListener?.('solar:consentchange',sync);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});else sync();
  root.SolarAdSense=Object.freeze({publisher,slot,localPreview,previewRequested,eligible:()=>!rail?.hidden,isOpen:()=>open,setOpen,sync,loadScript});
})(window);
