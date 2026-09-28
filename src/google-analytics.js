(function(root){
  'use strict';
  const measurementId='G-4MP85CMH64';
  const adsId='AW-18454135815';
  const production=/^(?:www\.)?solartime\.app$/i.test(location.hostname);
  const consent=root.SolarConsent;
  if(!consent)throw Error('consent.js must load before google-analytics.js');
  // One owner and one loader for Analytics and Ads. Never reset the shared
  // dataLayer or consent state; repeated initialization must not send duplicates.
  if(root.SolarGoogleAnalytics?.measurementId===measurementId&&root.SolarGoogleAnalytics?.adsId===adsId&&root.SolarGoogleAnalytics?.production===production)return;
  if(production){
    const source=`https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    if(!document.querySelector(`script[src="${source}"]`)&&!document.querySelector('script[src^="https://www.googletagmanager.com/gtag/js?"]')){
      const script=document.createElement('script');
      script.async=true;script.src=source;document.head.appendChild(script);
    }
    root.gtag('js',new Date());
    root.gtag('config',measurementId);
    // Base destination only. A conversion action and its label must be supplied
    // separately; do not count page loads, music or donation clicks as conversions.
    root.gtag('config',adsId);
  }
  root.SolarGoogleAnalytics=Object.freeze({measurementId,adsId,production,consent,updateConsent:granted=>consent.choose(granted?'granted':'denied')});
})(window);
