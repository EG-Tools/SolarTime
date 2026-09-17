/* Solar Time localization mechanics; translated content remains release data. */
(function(root){
  'use strict';
  const modules=root.SolarModules||(root.SolarModules={});
  function detect(){
    const zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'',languages=(navigator.languages?.length?navigator.languages:[navigator.language||'']).map(value=>String(value).toLowerCase());
    if(/(?:shanghai|chongqing|urumqi|hong_kong|macau)/i.test(zone))return 'chn';
    if(/jakarta|pontianak|makassar|ujung_pandang|jayapura/i.test(zone))return 'id';if(/tokyo/i.test(zone))return 'jpn';if(/seoul/i.test(zone))return 'kor';if(/london|belfast/i.test(zone))return 'eu';
    if(/kolkata|calcutta/i.test(zone))return 'hi';if(/madrid|canary/i.test(zone))return 'es';if(/berlin|busingen/i.test(zone))return 'de';if(/paris/i.test(zone))return 'fr';if(/lisbon|madeira|azores/i.test(zone))return 'pt';if(/rome|vatican|san_marino/i.test(zone))return 'it';if(/sao_paulo|recife|bahia|fortaleza|belem|manaus|cuiaba|campo_grande|porto_velho|rio_branco|noronha|maceio|santarem|araguaina/i.test(zone))return 'br';if(/mexico_city|cancun|merida|monterrey|matamoros|chihuahua|mazatlan|hermosillo|tijuana|bahia_banderas|ojinaga/i.test(zone))return 'mx';if(/^America\//i.test(zone))return 'en';
    for(const [prefix,language] of [['zh','chn'],['ja','jpn'],['ko','kor'],['en-gb','eu'],['hi','hi'],['es-mx','mx'],['es','es'],['de','de'],['fr','fr'],['pt-br','br'],['pt','pt'],['it','it'],['id','id']])if(languages.some(value=>value===prefix||value.startsWith(prefix+'-')))return language;
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
