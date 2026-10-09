/* Solar Time localization mechanics; translated content remains release data. */
(function(root){
  'use strict';
  const modules=root.SolarModules||(root.SolarModules={});
  // Region hints are only used to disambiguate shared tzdb aliases or when
  // the device supplies no known country zone. AUTO display language stays independent.
  const SHARED_REGION_ZONES=Object.freeze({
    'europe/oslo':'no','europe/stockholm':'se','europe/copenhagen':'dk',
    'europe/helsinki':'fi','atlantic/reykjavik':'is','iceland':'is','europe/malta':'mt',
    'asia/manila':'ph','asia/kuala_lumpur':'my','asia/kuching':'my',
    'africa/johannesburg':'za','africa/accra':'gh',
    'america/santo_domingo':'do','america/guatemala':'gt'
  });
  const SHARED_REGIONS=Object.freeze(['no','se','dk','fi','is','mt','ph','my','za','ng','gh','do','gt','by','bo','cm','ci','cu','sv','hn','kz','ke','kg','li','lu','ni','pk','py','sn','ch']);
  function sharedRegionHint(languages,allowed=SHARED_REGIONS){
    for(const language of languages){
      const region=/^[a-z]{2,3}(?:-[a-z]{4})?-([a-z]{2})(?:-|$)/.exec(language)?.[1];
      if(allowed.includes(region))return region;
    }
    // Native language preferences are hints, not additional translation bundles.
    const native={no:'no',nb:'no',nn:'no',sv:'se',da:'dk',fi:'fi',is:'is',mt:'mt',fil:'ph',tl:'ph',ms:'my',af:'za'};
    for(const language of languages){const parts=language.split('-'),region=native[parts[0]];if(parts.length===1&&allowed.includes(region))return region;}
    return null;
  }
  function detect(){
    const zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'',languages=(navigator.languages?.length?navigator.languages:[navigator.language||'']).map(value=>String(value).toLowerCase());
    if(/taipei/i.test(zone))return 'tw';
    if(/hong_kong/i.test(zone))return 'hk';
    if(/(?:shanghai|chongqing|urumqi|macau)/i.test(zone))return 'chn';
    if(/seoul/i.test(zone))return 'kor';
    if(/kyiv|kiev|uzhgorod|zaporozhye/i.test(zone))return 'ua';
    if(/minsk/i.test(zone))return 'by';
    if(/moscow|kaliningrad|kirov|volgograd|astrakhan|saratov|ulyanovsk|samara|yekaterinburg|omsk|novosibirsk|barnaul|tomsk|novokuznetsk|krasnoyarsk|irkutsk|chita|yakutsk|khandyga|vladivostok|ust-nera|ust_nera|magadan|sakhalin|srednekolymsk|kamchatka|anadyr/i.test(zone))return 'ru';
    if(/^Europe\/(?:Amsterdam|Brussels)$/i.test(zone)){
      // These zone IDs can be aliases in tzdb/ICU. An explicit NL/BE locale
      // disambiguates the country without changing other regions' precedence.
      for(const value of languages){
        if(/^nl-nl(?:-|$)/.test(value))return 'nl';
        if(/^(?:nl|fr|de)-be(?:-|$)/.test(value))return 'be';
        if(/^(?:fr|de|lb)-lu(?:-|$)/.test(value))return 'lu';
      }
      return /Amsterdam$/i.test(zone)?'nl':'be';
    }
    const zoneKey=zone.toLowerCase();
    // Recent tzdb can canonicalize NO/SE/DK to Berlin, MY to Singapore,
    // and IS/GH to Abidjan. Only a compatible regional hint overrides the zone.
    const aliases={'europe/berlin':['de','no','se','dk'],'europe/zurich':['ch','li'],'asia/singapore':['sg','my'],'singapore':['sg','my'],'africa/lagos':['ng','cm'],'africa/abidjan':['is','gh','ci','sn']};
    const aliasHint=aliases[zoneKey]&&sharedRegionHint(languages,aliases[zoneKey]);
    if(aliasHint)return aliasHint;
    if(zoneKey==='europe/zurich')return 'ch';
    if(zoneKey==='africa/lagos')return 'ng';
    if(SHARED_REGION_ZONES[zoneKey])return SHARED_REGION_ZONES[zoneKey];
    if(/^(?:Asia\/)?Singapore$/i.test(zone))return 'sg';
    if(/jakarta|pontianak|makassar|ujung_pandang|jayapura/i.test(zone))return 'id';
    if(/^Australia\//i.test(zone))return 'au';
    if(/auckland|chatham/i.test(zone))return 'nz';
    if(/almaty|aqtau|aqtobe|atyrau|oral|qyzylorda/i.test(zone))return 'kz';
    if(/karachi/i.test(zone))return 'pk';
    if(/bishkek/i.test(zone))return 'kg';
    if(/nairobi/i.test(zone))return 'ke';
    if(/douala/i.test(zone))return 'cm';
    if(/dakar/i.test(zone))return 'sn';
    if(/luxembourg/i.test(zone))return 'lu';
    if(/vaduz/i.test(zone))return 'li';
    if(/zurich/i.test(zone))return 'ch';
    if(/toronto|vancouver|edmonton|winnipeg|halifax|st_johns|regina|whitehorse|iqaluit|moncton|yellowknife/i.test(zone))return 'ca';
    if(/buenos_aires|argentina\//i.test(zone))return 'ar';
    if(/santiago|easter/i.test(zone))return 'cl';
    if(/bogota/i.test(zone))return 'co';
    if(/costa_rica/i.test(zone))return 'cr';
    if(/la_paz/i.test(zone))return 'bo';
    if(/asuncion/i.test(zone))return 'py';
    if(/havana/i.test(zone))return 'cu';
    if(/tegucigalpa/i.test(zone))return 'hn';
    if(/el_salvador/i.test(zone))return 'sv';
    if(/managua/i.test(zone))return 'ni';
    if(/guayaquil/i.test(zone))return 'ec';
    if(/dublin/i.test(zone))return 'ie';
    if(/luanda/i.test(zone))return 'ao';
    if(/maputo/i.test(zone))return 'mz';
    if(/panama/i.test(zone))return 'pa';
    if(/lima/i.test(zone))return 'pe';
    if(/montevideo/i.test(zone))return 'uy';
    if(/caracas/i.test(zone))return 've';
    if(/vienna/i.test(zone))return 'at';
    if(/tokyo/i.test(zone))return 'jpn';
    if(/london|belfast/i.test(zone))return 'eu';
    if(/kolkata|calcutta/i.test(zone))return 'hi';
    if(/madrid|canary/i.test(zone))return 'es';
    if(/berlin|busingen/i.test(zone))return 'de';
    if(/paris/i.test(zone))return 'fr';
    if(/lisbon|madeira|azores/i.test(zone))return 'pt';
    if(/rome|vatican|san_marino/i.test(zone))return 'it';
    if(/sao_paulo|recife|bahia|fortaleza|belem|manaus|cuiaba|campo_grande|porto_velho|rio_branco|noronha|maceio|santarem|araguaina/i.test(zone))return 'br';
    if(/mexico_city|cancun|merida|monterrey|matamoros|chihuahua|mazatlan|hermosillo|tijuana|bahia_banderas|ojinaga/i.test(zone))return 'mx';
    if(/^America\//i.test(zone))return 'en';
    const sharedHint=sharedRegionHint(languages);if(sharedHint)return sharedHint;
    const localeMap=[
      ['zh-tw','tw'],['zh-hk','hk'],['zh-hant-tw','tw'],['zh-hant-hk','hk'],['zh','chn'],['ja','jpn'],['ko','kor'],['en-sg','sg'],['en-ca','ca'],['en-au','au'],['en-nz','nz'],['en-ie','ie'],['en-gb','eu'],
      // Country selection and display language remain linked, as for Canada and Singapore.
      // Belgium is multilingual; this entry currently uses the Dutch interface.
      ['nl-be','be'],['fr-be','be'],['de-be','be'],['nl','nl'],
      ['pt-ao','ao'],['pt-mz','mz'],['pt-br','br'],['pt','pt'],
      ['es-ar','ar'],['es-bo','bo'],['es-cl','cl'],['es-co','co'],['es-cr','cr'],['es-cu','cu'],['es-ec','ec'],['es-sv','sv'],['es-hn','hn'],['es-mx','mx'],['es-ni','ni'],['es-pa','pa'],['es-py','py'],['es-pe','pe'],['es-uy','uy'],['es-ve','ve'],['es','es'],
      ['de-ch','ch'],['fr-ch','ch'],['it-ch','ch'],['de-li','li'],['de-at','at'],['de','de'],
      ['fr-cm','cm'],['en-cm','cm'],['fr-ci','ci'],['fr-lu','lu'],['de-lu','lu'],['lb-lu','lu'],['fr-sn','sn'],['fr','fr'],
      ['ru-by','by'],['be-by','by'],['ru-kz','kz'],['kk-kz','kz'],['ru-kg','kg'],['ky-kg','kg'],['ru','ru'],
      ['en-ke','ke'],['sw-ke','ke'],['en-pk','pk'],['ur-pk','pk'],['uk','ua'],['hi','hi'],['it','it'],['id','id']
    ];
    for(const [prefix,language] of localeMap)if(languages.some(value=>value===prefix||value.startsWith(prefix+'-')))return language;
    return 'en';
  }
  const interpolate=(text,values={})=>String(text).replace(/\{(\w+)\}/g,(_,key)=>values[key]??'');
  function detectCopy(){
    const languages=(navigator.languages?.length?navigator.languages:[navigator.language||'']).map(value=>String(value).toLowerCase());
    const patterns=modules.LanguageData.browserLanguagePatterns;
    for(const language of languages)for(const [pattern,code] of patterns)if(pattern.test(language))return code;
    return 'en';
  }
  function detectTimeZone(){
    try{
      const timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone;
      if(typeof timeZone!=='string'||!timeZone)return null;
      // Validate browser- or test-supplied values before they reach every clock formatter.
      Intl.DateTimeFormat('en-US',{timeZone}).format(0);return timeZone;
    }catch(_){return null;}
  }
  function automaticLanguageLabel(){return modules.LanguageData.automaticLabels[detectCopy()]||modules.LanguageData.automaticLabels.en;}
  function apply(document,translate){
    for(const element of document.querySelectorAll('[data-i18n]'))element.textContent=translate(element.dataset.i18n);
    for(const element of document.querySelectorAll('[data-i18n-aria]'))element.setAttribute('aria-label',translate(element.dataset.i18nAria));
    for(const element of document.querySelectorAll('[data-i18n-title]'))element.title=translate(element.dataset.i18nTitle);
    for(const element of document.querySelectorAll('[data-i18n-content]'))element.setAttribute('content',translate(element.dataset.i18nContent));
  }
  modules.Localization=Object.freeze({detect,detectCopy,detectTimeZone,automaticLanguageLabel,interpolate,apply});
})(window);
