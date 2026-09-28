/* Optional feature analytics. Page views belong only to google-analytics.js. */
(function(root){
  'use strict';
  if(root.SolarUsageAnalytics)return;
  const owner=root.SolarGoogleAnalytics,consent=root.SolarConsent;
  const bodies=['sun','mercury','venus','earth','moon','mars','jupiter','europa','saturn','uranus','neptune','pluto'];
  // Fixed, low-cardinality vocabulary; never accept URLs, filenames, time values,
  // free text, native request IDs, user IDs, or arbitrary event destinations.
  const schema={
    solar_music_play:{},solar_music_stop:{},
    solar_body_select:{body_id:bodies},solar_body_track:{body_id:bodies},solar_region_view:{},
    solar_alarm_set:{sound_type:['default','custom']},solar_alarm_cancel:{},solar_alarm_snooze:{},
    solar_shutdown_set:{},solar_shutdown_cancel:{},solar_help_open:{},
    solar_language_change:{selection_mode:['auto','manual']},solar_zen_on:{},solar_zen_off:{},
    solar_eclipse_view:{body_id:['moon','europa']},solar_alignment_view:{}
  };
  const noop=()=>false;
  let granted=false,epoch=0;
  try{granted=consent?.value()==='granted';}catch(_){/* No consent: no feature events. */}
  root.addEventListener?.('solar:consentchange',event=>{
    const next=event.detail?.value==='granted';if(next!==granted){granted=next;epoch++;}
  });
  function begin(name,values={}){
    try{
      if(!owner?.production||!granted||!Object.prototype.hasOwnProperty.call(schema,name))return noop;
      const payload={send_to:owner.measurementId};
      for(const [key,allowed] of Object.entries(schema[name])){
        const value=values?.[key];if(!allowed.includes(value))return noop;payload[key]=value;
      }
      const consentEpoch=epoch;let finished=false;
      // Capture consent at the user's request, then check again at completion.
      // A revoked/regranted choice must not replay an earlier pending action.
      return ()=>{
        if(finished)return false;finished=true;
        if(!granted||epoch!==consentEpoch)return false;
        try{if(typeof root.gtag!=='function')return false;root.gtag('event',name,payload);return true;}catch(_){return false;}
      };
    }catch(_){return noop;}
  }
  root.SolarUsageAnalytics=Object.freeze({begin,track:(name,values)=>begin(name,values)()});
})(window);
