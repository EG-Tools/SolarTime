(function(root){
  'use strict';
  const measurementId='G-4MP85CMH64';
  const production=/^(?:www\.)?solartime\.app$/i.test(location.hostname);
  const consent=root.SolarConsent;
  if(!consent)throw Error('consent.js must load before google-analytics.js');
  if(production){
    const source=`https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    if(!document.querySelector(`script[src="${source}"]`)){
      const script=document.createElement('script');
      script.async=true;script.src=source;document.head.appendChild(script);
    }
    root.gtag('js',new Date());
    root.gtag('config',measurementId);
  }
  root.SolarGoogleAnalytics=Object.freeze({measurementId,production,consent,updateConsent:granted=>consent.choose(granted?'granted':'denied')});
})(window);
