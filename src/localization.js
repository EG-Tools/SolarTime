/* Solar Time localization mechanics; translated content remains release data. */
(function(root){
  'use strict';
  const modules=root.SolarModules||(root.SolarModules={});
  function detect(){
    const zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'',languages=(navigator.languages?.length?navigator.languages:[navigator.language||'']).map(value=>String(value).toLowerCase());
    if(/taipei/i.test(zone))return 'tw';
    if(/hong_kong/i.test(zone))return 'hk';
    if(/(?:shanghai|chongqing|urumqi|macau)/i.test(zone))return 'chn';
    if(/seoul/i.test(zone))return 'kor';
    if(/^Europe\/(?:Amsterdam|Brussels)$/i.test(zone)){
      // These zone IDs can be aliases in tzdb/ICU. An explicit NL/BE locale
      // disambiguates the country without changing other regions' precedence.
      for(const value of languages){
        if(/^nl-nl(?:-|$)/.test(value))return 'nl';
        if(/^(?:nl|fr|de)-be(?:-|$)/.test(value))return 'be';
      }
      return /Amsterdam$/i.test(zone)?'nl':'be';
    }
    if(/^(?:Asia\/)?Singapore$/i.test(zone))return 'sg';
    if(/jakarta|pontianak|makassar|ujung_pandang|jayapura/i.test(zone))return 'id';
    if(/^Australia\//i.test(zone))return 'au';
    if(/auckland|chatham/i.test(zone))return 'nz';
    if(/toronto|vancouver|edmonton|winnipeg|halifax|st_johns|regina|whitehorse|iqaluit|moncton|yellowknife/i.test(zone))return 'ca';
    if(/buenos_aires|argentina\//i.test(zone))return 'ar';
    if(/santiago|easter/i.test(zone))return 'cl';
    if(/bogota/i.test(zone))return 'co';
    if(/costa_rica/i.test(zone))return 'cr';
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
    const localeMap=[
      ['zh-tw','tw'],['zh-hk','hk'],['zh-hant-tw','tw'],['zh-hant-hk','hk'],['zh','chn'],['ja','jpn'],['ko','kor'],['en-sg','sg'],['en-ca','ca'],['en-au','au'],['en-nz','nz'],['en-ie','ie'],['en-gb','eu'],
      // Country selection and display language remain linked, as for Canada and Singapore.
      // Belgium is multilingual; this entry currently uses the Dutch interface.
      ['nl-be','be'],['fr-be','be'],['de-be','be'],['nl','nl'],
      ['pt-ao','ao'],['pt-mz','mz'],['pt-br','br'],['pt','pt'],
      ['es-ar','ar'],['es-cl','cl'],['es-co','co'],['es-cr','cr'],['es-ec','ec'],['es-mx','mx'],['es-pa','pa'],['es-pe','pe'],['es-uy','uy'],['es-ve','ve'],['es','es'],
      ['de-at','at'],['de','de'],['fr','fr'],['hi','hi'],['it','it'],['id','id']
    ];
    for(const [prefix,language] of localeMap)if(languages.some(value=>value===prefix||value.startsWith(prefix+'-')))return language;
    return 'en';
  }
  const interpolate=(text,values={})=>String(text).replace(/\{(\w+)\}/g,(_,key)=>values[key]??'');
  const AUTO_LANGUAGE_LABELS=Object.freeze({
    kor:Object.freeze(['자동','언어']),en:Object.freeze(['AUTO','Language']),chn:Object.freeze(['自动','语言']),zht:Object.freeze(['自動','語言']),jpn:Object.freeze(['自動','言語']),
    hi:Object.freeze(['ऑटो','भाषा']),es:Object.freeze(['AUTO','Idioma']),de:Object.freeze(['AUTO','Sprache']),fr:Object.freeze(['AUTO','Langue']),pt:Object.freeze(['AUTO','Idioma']),
    it:Object.freeze(['AUTO','Lingua']),id:Object.freeze(['AUTO','Bahasa']),nl:Object.freeze(['AUTO','Taal'])
  });
  function detectCopy(){
    const languages=(navigator.languages?.length?navigator.languages:[navigator.language||'']).map(value=>String(value).toLowerCase());
    const patterns=[[/^zh-(?:tw|hk|hant)(?:-|$)/,'zht'],[/^zh(?:-|$)/,'chn'],[/^ko(?:-|$)/,'kor'],[/^ja(?:-|$)/,'jpn'],[/^hi(?:-|$)/,'hi'],[/^es(?:-|$)/,'es'],[/^de(?:-|$)/,'de'],[/^fr(?:-|$)/,'fr'],[/^pt(?:-|$)/,'pt'],[/^it(?:-|$)/,'it'],[/^id(?:-|$)/,'id'],[/^nl(?:-|$)/,'nl'],[/^en(?:-|$)/,'en']];
    for(const language of languages)for(const [pattern,code] of patterns)if(pattern.test(language))return code;
    return 'en';
  }
  function automaticLanguageLabel(){return AUTO_LANGUAGE_LABELS[detectCopy()]||AUTO_LANGUAGE_LABELS.en;}
  function apply(document,translate){
    for(const element of document.querySelectorAll('[data-i18n]'))element.textContent=translate(element.dataset.i18n);
    for(const element of document.querySelectorAll('[data-i18n-aria]'))element.setAttribute('aria-label',translate(element.dataset.i18nAria));
    for(const element of document.querySelectorAll('[data-i18n-title]'))element.title=translate(element.dataset.i18nTitle);
    for(const element of document.querySelectorAll('[data-i18n-content]'))element.setAttribute('content',translate(element.dataset.i18nContent));
  }
  modules.Localization=Object.freeze({detect,detectCopy,automaticLanguageLabel,interpolate,apply});
})(window);
