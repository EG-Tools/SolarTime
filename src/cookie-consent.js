(function(root){
  'use strict';
  const storageKey='solarTimeCookieConsentV1';
  const banner=document.getElementById('cookie-consent');
  const accept=document.getElementById('cookie-accept');
  const reject=document.getElementById('cookie-reject');
  const UI=root.SolarModules?.UI;
  const read=()=>{try{return localStorage.getItem(storageKey)||'';}catch(_){return '';}};
  const write=value=>{try{localStorage.setItem(storageKey,value);}catch(_){}}
  function apply(value){
    root.SolarGoogleAnalytics?.updateConsent(value==='granted');
    root.dispatchEvent(new CustomEvent('solar:consentchange',{detail:{value}}));
  }
  function show(){
    if(!banner)return;
    if(UI)UI.show(banner);else banner.hidden=false;
  }
  function hide(){
    if(!banner)return;
    if(UI)UI.hide(banner);else banner.hidden=true;
  }
  function choose(value){write(value);apply(value);hide();}
  accept?.addEventListener('click',()=>choose('granted'));
  reject?.addEventListener('click',()=>choose('denied'));
  const current=read();
  if(current==='granted'||current==='denied')apply(current);else show();
  root.SolarCookieConsent=Object.freeze({value:read,show,reset(){try{localStorage.removeItem(storageKey);}catch(_){}apply('denied');show();}});
})(window);
