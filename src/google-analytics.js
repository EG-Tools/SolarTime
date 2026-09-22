(function(root){
  'use strict';
  const measurementId='G-4MP85CMH64';
  const production=/^(?:www\.)?solartime\.app$/i.test(location.hostname);
  root.dataLayer=root.dataLayer||[];
  root.gtag=root.gtag||function(){root.dataLayer.push(arguments);};
  root.gtag('consent','default',{
    ad_storage:'denied',
    ad_user_data:'denied',
    ad_personalization:'denied',
    analytics_storage:'denied',
    wait_for_update:500
  });
  function updateConsent(granted){
    const state=granted?'granted':'denied';
    root.gtag('consent','update',{ad_storage:state,ad_user_data:state,ad_personalization:state,analytics_storage:state});
  }
  if(production){
    const script=document.createElement('script');
    script.async=true;script.src=`https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);
    root.gtag('js',new Date());
    root.gtag('config',measurementId);
  }
  root.SolarGoogleAnalytics=Object.freeze({measurementId,production,updateConsent});
})(window);
