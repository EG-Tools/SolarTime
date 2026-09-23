(function(root){
  'use strict';
  const storageKey='solarTimeCookieConsentV1',valid=new Set(['granted','denied']);
  root.dataLayer=root.dataLayer||[];
  root.gtag=root.gtag||function(){root.dataLayer.push(arguments);};
  root.gtag('consent','default',{
    ad_storage:'denied',
    ad_user_data:'denied',
    ad_personalization:'denied',
    analytics_storage:'denied',
    wait_for_update:500
  });
  const read=()=>{try{const value=root.localStorage?.getItem(storageKey)||'';return valid.has(value)?value:'';}catch(_){return '';}};
  const write=value=>{try{root.localStorage?.setItem(storageKey,value);return true;}catch(_){return false;}};
  const apply=value=>{
    const state=value==='granted'?'granted':'denied';
    root.gtag('consent','update',{ad_storage:state,ad_user_data:state,ad_personalization:state,analytics_storage:state});
    root.dispatchEvent?.(new CustomEvent('solar:consentchange',{detail:{value:state}}));
    return state;
  };
  const choose=value=>{const state=value==='granted'?'granted':'denied';write(state);return apply(state);};
  const reset=()=>{try{root.localStorage?.removeItem(storageKey);}catch(_){}return apply('denied');};
  const current=read();if(current)apply(current);
  root.SolarConsent=Object.freeze({storageKey,value:read,choose,reset,apply});
})(window);
