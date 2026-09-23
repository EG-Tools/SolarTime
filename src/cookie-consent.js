(function(root){
  'use strict';
  const banner=document.getElementById('cookie-consent');
  const accept=document.getElementById('cookie-accept');
  const reject=document.getElementById('cookie-reject');
  const UI=root.SolarModules?.UI;
  const consent=root.SolarConsent;
  if(!consent)throw Error('consent.js must load before cookie-consent.js');
  function show(){
    if(!banner)return;
    if(UI)UI.show(banner);else banner.hidden=false;
  }
  function hide(){
    if(!banner)return;
    if(UI)UI.hide(banner);else banner.hidden=true;
  }
  function choose(value){consent.choose(value);hide();}
  accept?.addEventListener('click',()=>choose('granted'));
  reject?.addEventListener('click',()=>choose('denied'));
  const current=consent.value();
  if(current!=='granted'&&current!=='denied')show();
  root.SolarCookieConsent=Object.freeze({value:consent.value,show,reset(){consent.reset();show();}});
})(window);
