/* Solar Time language payload loader. Web and local launches fetch one active
   locale from the public Cloudflare site and therefore require a connection. */
(function(root){
  'use strict';
  const modules=root.SolarModules||(root.SolarModules={});
  const supported=Object.freeze(['kor','en','chn','zht','jpn','hi','es','de','fr','pt','it','id','nl']);
  // Traditional Chinese was introduced after the other public locale bundles.
  // If an older deployment does not contain it yet, keep Taiwan/Hong Kong usable
  // with the existing Chinese payload instead of exposing a raw HTTP error.
  const missingFallback=Object.freeze({zht:'chn'});
  // A file:// launch must read the last public locale bundle because browsers
  // block local JSON fetches. Keep the current local-only controls translated
  // until those locale files are published with the next deployment.
  const localCopy=Object.freeze({
    kor:Object.freeze({eclipseView:'일식',eclipsePrevious:'이전 일식으로 이동',eclipseNext:'다음 일식으로 이동',eclipseUnavailable:'계산 가능한 일식을 찾지 못했습니다.',alignmentView:'행성 정렬',alignmentPrevious:'이전 행성 정렬로 이동',alignmentNext:'다음 행성 정렬로 이동',alignmentUnavailable:'목록에서 더 이상 행성 정렬을 찾지 못했습니다.'}),
    en:Object.freeze({eclipseView:'Eclipse',eclipsePrevious:'Travel to previous eclipse',eclipseNext:'Travel to next eclipse',eclipseUnavailable:'No eclipse was found within the supported range.',alignmentView:'Planetary alignment',alignmentPrevious:'Travel to previous planetary alignment',alignmentNext:'Travel to next planetary alignment',alignmentUnavailable:'No further planetary alignment was found in the catalog.'}),
    chn:Object.freeze({eclipseView:'日食',eclipsePrevious:'前往上一次日食',eclipseNext:'前往下一次日食',eclipseUnavailable:'在支持的范围内未找到日食。',alignmentView:'行星排列',alignmentPrevious:'前往上一次行星排列',alignmentNext:'前往下一次行星排列',alignmentUnavailable:'目录中没有更多行星排列。'}),
    zht:Object.freeze({eclipseView:'日食',eclipsePrevious:'前往上一次日食',eclipseNext:'前往下一次日食',eclipseUnavailable:'在支援的範圍內找不到日食。',alignmentView:'行星排列',alignmentPrevious:'前往上一次行星排列',alignmentNext:'前往下一次行星排列',alignmentUnavailable:'目錄中沒有更多行星排列。'}),
    jpn:Object.freeze({eclipseView:'日食',eclipsePrevious:'前の日食へ移動',eclipseNext:'次の日食へ移動',eclipseUnavailable:'対応範囲内に日食が見つかりません。',alignmentView:'惑星直列',alignmentPrevious:'前の惑星直列へ移動',alignmentNext:'次の惑星直列へ移動',alignmentUnavailable:'一覧にこれ以上の惑星直列はありません。'}),
    hi:Object.freeze({eclipseView:'ग्रहण',eclipsePrevious:'पिछले ग्रहण पर जाएँ',eclipseNext:'अगले ग्रहण पर जाएँ',eclipseUnavailable:'समर्थित सीमा में कोई ग्रहण नहीं मिला।',alignmentView:'ग्रहों का संरेखण',alignmentPrevious:'पिछले ग्रह संरेखण पर जाएँ',alignmentNext:'अगले ग्रह संरेखण पर जाएँ',alignmentUnavailable:'सूची में कोई और ग्रह संरेखण नहीं मिला।'}),
    es:Object.freeze({eclipseView:'Eclipse',eclipsePrevious:'Ir al eclipse anterior',eclipseNext:'Ir al eclipse siguiente',eclipseUnavailable:'No se encontró ningún eclipse en el intervalo admitido.',alignmentView:'Alineación planetaria',alignmentPrevious:'Ir a la alineación planetaria anterior',alignmentNext:'Ir a la siguiente alineación planetaria',alignmentUnavailable:'No hay más alineaciones planetarias en el catálogo.'}),
    de:Object.freeze({eclipseView:'Finsternis',eclipsePrevious:'Zur vorherigen Finsternis',eclipseNext:'Zur nächsten Finsternis',eclipseUnavailable:'Im unterstützten Zeitraum wurde keine Finsternis gefunden.',alignmentView:'Planetenausrichtung',alignmentPrevious:'Zur vorherigen Planetenausrichtung',alignmentNext:'Zur nächsten Planetenausrichtung',alignmentUnavailable:'Keine weitere Planetenausrichtung im Katalog gefunden.'}),
    fr:Object.freeze({eclipseView:'Éclipse',eclipsePrevious:'Aller à l’éclipse précédente',eclipseNext:'Aller à l’éclipse suivante',eclipseUnavailable:'Aucune éclipse n’a été trouvée dans la période prise en charge.',alignmentView:'Alignement planétaire',alignmentPrevious:'Aller à l’alignement planétaire précédent',alignmentNext:'Aller à l’alignement planétaire suivant',alignmentUnavailable:'Aucun autre alignement planétaire dans le catalogue.'}),
    pt:Object.freeze({eclipseView:'Eclipse',eclipsePrevious:'Ir para o eclipse anterior',eclipseNext:'Ir para o eclipse seguinte',eclipseUnavailable:'Não foi encontrado nenhum eclipse no intervalo suportado.',alignmentView:'Alinhamento planetário',alignmentPrevious:'Ir para o alinhamento planetário anterior',alignmentNext:'Ir para o próximo alinhamento planetário',alignmentUnavailable:'Não há mais alinhamentos planetários no catálogo.'}),
    it:Object.freeze({eclipseView:'Eclissi',eclipsePrevious:'Vai all’eclissi precedente',eclipseNext:'Vai all’eclissi successiva',eclipseUnavailable:'Nessuna eclissi trovata nell’intervallo supportato.',alignmentView:'Allineamento planetario',alignmentPrevious:'Vai all’allineamento planetario precedente',alignmentNext:'Vai all’allineamento planetario successivo',alignmentUnavailable:'Nessun altro allineamento planetario nel catalogo.'}),
    id:Object.freeze({eclipseView:'Gerhana',eclipsePrevious:'Ke gerhana sebelumnya',eclipseNext:'Ke gerhana berikutnya',eclipseUnavailable:'Tidak ada gerhana dalam rentang yang didukung.',alignmentView:'Keselarasan planet',alignmentPrevious:'Ke keselarasan planet sebelumnya',alignmentNext:'Ke keselarasan planet berikutnya',alignmentUnavailable:'Tidak ada lagi keselarasan planet dalam katalog.'}),
    nl:Object.freeze({eclipseView:'Eclips',eclipsePrevious:'Naar de vorige eclips',eclipseNext:'Naar de volgende eclips',eclipseUnavailable:'Geen eclips gevonden binnen het ondersteunde bereik.',alignmentView:'Planeetuitlijning',alignmentPrevious:'Naar de vorige planeetuitlijning',alignmentNext:'Naar de volgende planeetuitlijning',alignmentUnavailable:'Geen verdere planeetuitlijning in de catalogus gevonden.'})
  });
  const cache=new Map(),pending=new Map();
  const scriptUrl=new URL(document.currentScript?.src||location.href,location.href);
  const valid=value=>value&&typeof value.copy==='object'&&typeof value.bodies==='object'&&typeof value.phases==='object';
  async function request(code,base){
    const url=new URL(code+'.json',base);url.search=scriptUrl.search;
    const response=await fetch(url,{cache:'no-cache',credentials:'same-origin',signal:AbortSignal.timeout(15000)});
    if(!response.ok){
      const fallback=missingFallback[code];
      if(response.status===404&&fallback)return request(fallback,base);
      throw Error('Language data could not be loaded: '+code+' ('+response.status+')');
    }
    const data=await response.json();if(!valid(data))throw Error('Language data is invalid: '+code);
    return data;
  }
  async function load(code){
    if(!supported.includes(code))code='kor';
    if(cache.has(code))return cache.get(code);
    if(pending.has(code))return pending.get(code);
    const task=(async()=>{
      const base=location.protocol==='file:'?new URL('https://solartime.app/src/locales/'):new URL('locales/',scriptUrl);
      const data=await request(code,base);
      if(location.protocol==='file:')Object.assign(data.copy,localCopy[code]||localCopy.en);
      cache.set(code,data);return data;
    })();
    pending.set(code,task);
    try{return await task;}finally{pending.delete(code);}
  }
  modules.LanguageData=Object.freeze({supported,load,loaded:code=>cache.has(code)});
})(window);
