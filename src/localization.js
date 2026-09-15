/* Solar Time localization mechanics; translated content remains release data. */
(function(root){
  'use strict';
  const modules=root.SolarModules||(root.SolarModules={});
  function detect(){
    const zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'',languages=(navigator.languages?.length?navigator.languages:[navigator.language||'']).map(value=>String(value).toLowerCase());
    if(/(?:shanghai|chongqing|urumqi|hong_kong|macau)/i.test(zone))return 'chn';
    if(/tokyo/i.test(zone))return 'jpn';if(/seoul/i.test(zone))return 'kor';if(/london|belfast/i.test(zone))return 'eu';
    if(/kolkata|calcutta/i.test(zone))return 'hi';if(/madrid|canary/i.test(zone))return 'es';if(/berlin|busingen/i.test(zone))return 'de';if(/paris/i.test(zone))return 'fr';if(/^America\//i.test(zone))return 'en';
    for(const [prefix,language] of [['zh','chn'],['ja','jpn'],['ko','kor'],['en-gb','eu'],['hi','hi'],['es','es'],['de','de'],['fr','fr']])if(languages.some(value=>value===prefix||value.startsWith(prefix+'-')))return language;
    return 'en';
  }
  const interpolate=(text,values={})=>String(text).replace(/\{(\w+)\}/g,(_,key)=>values[key]??'');
  function apply(document,translate){
    for(const element of document.querySelectorAll('[data-i18n]'))element.textContent=translate(element.dataset.i18n);
    for(const element of document.querySelectorAll('[data-i18n-aria]'))element.setAttribute('aria-label',translate(element.dataset.i18nAria));
    for(const element of document.querySelectorAll('[data-i18n-title]'))element.title=translate(element.dataset.i18nTitle);
    for(const element of document.querySelectorAll('[data-i18n-content]'))element.setAttribute('content',translate(element.dataset.i18nContent));
  }
  modules.Localization=Object.freeze({detect,interpolate,apply});
})(window);
