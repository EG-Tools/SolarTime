(function(root){
  'use strict';
  if(root.SolarCookieConsent)return;
  const banner=document.getElementById('cookie-consent');
  const accept=document.getElementById('cookie-accept');
  const reject=document.getElementById('cookie-reject');
  const dismiss=document.getElementById('cookie-dismiss');
  const UI=root.SolarModules?.UI,consent=root.SolarConsent;
  let returnFocus=null;
  if(!consent)throw Error('consent.js must load before cookie-consent.js');
  function show(focus=true){
    if(!banner)return;
    if(focus&&!banner.contains(document.activeElement))returnFocus=document.activeElement;
    if(UI)UI.show(banner);else banner.hidden=false;
    if(focus)dismiss?.focus({preventScroll:true});
  }
  function hide(){
    if(!banner)return;
    const focused=banner.contains(document.activeElement);
    if(UI)UI.hide(banner);else banner.hidden=true;
    if(focused){
      const usable=returnFocus?.isConnected&&returnFocus.getClientRects().length&&!returnFocus.closest('[hidden],.ui-fade-closing');
      (usable?returnFocus:document.getElementById('help-button')||document.getElementById('universe'))?.focus({preventScroll:true});
    }
    returnFocus=null;
  }
  function choose(value){consent.choose(value);hide();}
  accept?.addEventListener('click',()=>choose('granted'));
  reject?.addEventListener('click',()=>choose('denied'));
  // X/Escape close only this banner; never store a choice or grant consent.
  dismiss?.addEventListener('click',hide);
  banner?.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();hide();}
  });
  root.addEventListener?.('solar:consentchange',event=>{
    if(event.detail?.reason==='expired')show(false);
    else if(event.detail?.reason==='storage'){if(event.detail.choice)hide();else show(false);}
  });
  const current=consent.value();
  if(current!=='granted'&&current!=='denied')show(false);
  root.SolarCookieConsent=Object.freeze({value:consent.value,show,dismiss:hide,reset(){consent.reset();show();}});
})(window);
