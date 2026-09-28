/* Shared, expiring cookie choices. Dismissal is not a consent decision. */
(function(root){
  'use strict';
  if(root.SolarConsent)return;
  const storageKey='solarTimeCookieConsentV1',schema=2,valid=new Set(['granted','denied']);
  const maxDelay=2147483647;
  let record=null,expiryTimer=null;
  root.dataLayer=root.dataLayer||[];
  root.gtag=root.gtag||function(){root.dataLayer.push(arguments);};
  root.gtag('consent','default',{
    ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',
    analytics_storage:'denied',wait_for_update:500
  });
  // Six calendar months, clamping month-end dates. UTC avoids DST drift.
  function sixMonthsAfter(at){
    const date=new Date(at),day=date.getUTCDate();
    date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+6);
    const last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
    date.setUTCDate(Math.min(day,last));return date.getTime();
  }
  const fresh=value=>{const chosenAt=Date.now();return {schema,value,chosenAt,expiresAt:sixMonthsAfter(chosenAt)};};
  const current=value=>!!value&&value.schema===schema&&valid.has(value.value)&&
    Number.isSafeInteger(value.chosenAt)&&value.chosenAt>=0&&value.chosenAt<=Date.now()&&
    Number.isSafeInteger(value.expiresAt)&&value.expiresAt===sixMonthsAfter(value.chosenAt)&&Date.now()<value.expiresAt;
  const remove=()=>{try{root.localStorage?.removeItem(storageKey);}catch(_){/* In-memory revocation still applies. */}};
  const write=value=>{try{if(!root.localStorage)return false;root.localStorage.setItem(storageKey,JSON.stringify(value));return true;}catch(_){return false;}};
  function read(){
    try{
      const raw=root.localStorage?.getItem(storageKey);if(!raw)return null;
      // Old choices have no date. Preserve the decision, starting its one-time
      // migration window now; never renew that window on subsequent visits.
      if(valid.has(raw)){const migrated=fresh(raw);return write(migrated)?migrated:null;}
      const value=JSON.parse(raw);if(current(value))return value;
      remove();return null;
    }catch(_){return null;}
  }
  function publish(reason){
    const state=record?.value||'denied';
    root.gtag('consent','update',{ad_storage:state,ad_user_data:state,ad_personalization:state,analytics_storage:state});
    root.dispatchEvent?.(new CustomEvent('solar:consentchange',{detail:{value:state,choice:record?.value||'',reason}}));
    return state;
  }
  function armExpiry(){
    if(expiryTimer!==null)root.clearTimeout?.(expiryTimer);expiryTimer=null;
    if(record&&typeof root.setTimeout==='function'){
      expiryTimer=root.setTimeout(()=>{expiryTimer=null;revalidate();armExpiry();},Math.max(1,Math.min(maxDelay,record.expiresAt-Date.now())));
    }
  }
  function revalidate(){
    if(record&&!current(record)){record=null;remove();armExpiry();publish('expired');}
    return record?.value||'';
  }
  function choose(value){
    record=fresh(value==='granted'?'granted':'denied');write(record);armExpiry();return publish('choice');
  }
  function reset(){record=null;remove();armExpiry();return publish('reset');}
  // Compatibility-only non-persisting update. UI choices always use choose().
  function apply(value){record=fresh(value==='granted'?'granted':'denied');armExpiry();return publish('apply');}
  record=read();if(record)publish('restore');armExpiry();
  root.addEventListener?.('pageshow',revalidate);
  root.document?.addEventListener?.('visibilitychange',()=>{if(!root.document.hidden)revalidate();});
  // This synchronizes consent only, not alarms, timers, or application state.
  root.addEventListener?.('storage',event=>{
    if(event.key!==storageKey&&event.key!==null)return;
    record=read();armExpiry();publish('storage');
  });
  root.SolarConsent=Object.freeze({storageKey,value:revalidate,choose,reset,apply});
})(window);
