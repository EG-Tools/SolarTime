(function(root){
  'use strict';
  const projectId='ymnblw22up';
  const source=`https://www.clarity.ms/tag/${projectId}`;
  const production=/^(?:www\.)?solartime\.app$/i.test(location.hostname);
  const consent=root.SolarConsent;
  if(!consent)throw Error('consent.js must load before microsoft-clarity.js');

  let script=document.querySelector(`script[src="${source}"]`);
  let requested=Boolean(script);

  const ensureQueue=()=>{
    root.clarity=root.clarity||function(){(root.clarity.q=root.clarity.q||[]).push(arguments);};
    return root.clarity;
  };
  const sendConsent=value=>{
    if(typeof root.clarity!=='function')return;
    root.clarity('consentv2',{
      ad_Storage:value,
      analytics_Storage:value
    });
  };
  const load=()=>{
    if(!production||requested)return false;
    requested=true;
    ensureQueue();
    script=document.createElement('script');
    script.async=true;
    script.src=source;
    script.dataset.solarClarity=projectId;
    script.addEventListener('error',()=>{requested=false;script=null;},{once:true});
    document.head.appendChild(script);
    return true;
  };
  const sync=value=>{
    const state=value==='granted'?'granted':'denied';
    if(state==='granted'){
      load();
      if(requested){ensureQueue();sendConsent(state);}
    }else if(requested)sendConsent(state);
    return state;
  };

  root.addEventListener('solar:consentchange',event=>sync(event.detail?.value));
  sync(consent.value());
  root.SolarMicrosoftClarity=Object.freeze({projectId,source,production,load,sync,isRequested:()=>requested});
})(window);
