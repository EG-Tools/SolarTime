/* Solar Time v0.53 — app implementation owner. */
(function () {
  'use strict';
  const $=id=>document.getElementById(id), A=window.SolarAstro,Modules=window.SolarModules;
  const Localization=Modules.Localization,LanguageData=Modules.LanguageData,Preferences=Modules.Preferences,UI=Modules.UI;
  const STORAGE_KEY='eg.solar-time.v0.01';
  const LANG_ORDER=['ao','ar','au','at','be','br','ca','cl','chn','co','cr','ec','fr','de','hk','hi','id','ie','it','jpn','kor','mx','mz','nl','nz','pa','pe','pt','sg','es','tw','eu','en','uy','ve'];
  const LANG_META={
    kor:{code:'KOR',name:'한국',locale:'ko-KR',html:'ko',copy:'kor'},
    en:{code:'EN',name:'USA',locale:'en-US',html:'en',copy:'en'},
    chn:{code:'CHN',name:'中国',locale:'zh-CN',html:'zh-Hans',copy:'chn'},
    tw:{code:'TW',name:'台灣',locale:'zh-TW',html:'zh-Hant-TW',copy:'zht'},
    hk:{code:'HK',name:'香港',locale:'zh-HK',html:'zh-Hant-HK',copy:'zht'},
    jpn:{code:'JPN',name:'日本',locale:'ja-JP',html:'ja',copy:'jpn'},
    eu:{code:'UK',name:'United Kingdom',locale:'en-GB',html:'en-GB',copy:'en'},
    hi:{code:'HI',name:'भारत',locale:'hi-IN',html:'hi',copy:'hi'},
    es:{code:'ES',name:'España',locale:'es-ES',html:'es',copy:'es'},
    de:{code:'DE',name:'Deutschland',locale:'de-DE',html:'de',copy:'de'},
    fr:{code:'FR',name:'France',locale:'fr-FR',html:'fr',copy:'fr'}
,
    pt:{code:'PT',name:'Portugal',locale:'pt-PT',html:'pt-PT',copy:'pt'},
    be:{code:'BE',name:'België',locale:'nl-BE',html:'nl-BE',copy:'nl'},
    nl:{code:'NL',name:'Nederland',locale:'nl-NL',html:'nl-NL',copy:'nl'},
    br:{code:'BR',name:'Brasil',locale:'pt-BR',html:'pt-BR',copy:'pt'},
    it:{code:'IT',name:'Italia',locale:'it-IT',html:'it',copy:'it'},
    mx:{code:'MX',name:'México',locale:'es-MX',html:'es-MX',copy:'es'},
    id:{code:'ID',name:'Indonesia',locale:'id-ID',html:'id',copy:'id'},
    ao:{code:"AO",name:"Angola",locale:"pt-AO",html:"pt-AO",copy:"pt"},
    ar:{code:"AR",name:"Argentina",locale:"es-AR",html:"es-AR",copy:"es"},
    au:{code:"AU",name:"Australia",locale:"en-AU",html:"en-AU",copy:"en"},
    at:{code:"AT",name:"Österreich",locale:"de-AT",html:"de-AT",copy:"de"},
    ca:{code:"CA",name:"Canada",locale:"en-CA",html:"en-CA",copy:"en"},
    cl:{code:"CL",name:"Chile",locale:"es-CL",html:"es-CL",copy:"es"},
    co:{code:"CO",name:"Colombia",locale:"es-CO",html:"es-CO",copy:"es"},
    cr:{code:"CR",name:"Costa Rica",locale:"es-CR",html:"es-CR",copy:"es"},
    ec:{code:"EC",name:"Ecuador",locale:"es-EC",html:"es-EC",copy:"es"},
    ie:{code:"IE",name:"Ireland",locale:"en-IE",html:"en-IE",copy:"en"},
    mz:{code:"MZ",name:"Moçambique",locale:"pt-MZ",html:"pt-MZ",copy:"pt"},
    sg:{code:'SG',name:'Singapore',locale:'en-SG',html:'en-SG',copy:'en'},
    nz:{code:"NZ",name:"New Zealand",locale:"en-NZ",html:"en-NZ",copy:"en"},
    pa:{code:"PA",name:"Panamá",locale:"es-PA",html:"es-PA",copy:"es"},
    pe:{code:"PE",name:"Perú",locale:"es-PE",html:"es-PE",copy:"es"},
    uy:{code:"UY",name:"Uruguay",locale:"es-UY",html:"es-UY",copy:"es"},
    ve:{code:"VE",name:"Venezuela",locale:"es-VE",html:"es-VE",copy:"es"}
  };
  const REGIONS={
    kor:{label:'KOREA',timeZone:'Asia/Seoul',latitude:37.5665,longitude:126.978,region:'한국',city:'서울'},
    en:{label:'USA',timeZone:'America/New_York',latitude:39.8283,longitude:-98.5795,region:'United States',city:'mainland center'},
    chn:{label:'CHINA',timeZone:'Asia/Shanghai',latitude:35.8617,longitude:104.1954,region:'中国',city:'国土中心'},
    tw:{label:'TAIWAN',timeZone:'Asia/Taipei',latitude:23.6978,longitude:120.9605,region:'台灣',city:'地理中心'},
    hk:{label:'HONG KONG',timeZone:'Asia/Hong_Kong',latitude:22.3193,longitude:114.1694,region:'香港',city:'地理中心'},
    jpn:{label:'JAPAN',timeZone:'Asia/Tokyo',latitude:35.6762,longitude:139.6503,region:'日本',city:'東京'},
    eu:{label:'UNITED KINGDOM',timeZone:'Europe/London',latitude:55.3781,longitude:-3.436,region:'United Kingdom',city:'geographic center'},
    hi:{label:'INDIA',timeZone:'Asia/Kolkata',latitude:22.5937,longitude:78.9629,region:'भारत',city:'देश का केंद्र'},
    es:{label:'SPAIN',timeZone:'Europe/Madrid',latitude:40.4637,longitude:-3.7492,region:'España',city:'centro geográfico'},
    de:{label:'GERMANY',timeZone:'Europe/Berlin',latitude:51.1657,longitude:10.4515,region:'Deutschland',city:'geografische Mitte'},
    fr:{label:'FRANCE',timeZone:'Europe/Paris',latitude:46.2276,longitude:2.2137,region:'France',city:'centre géographique'}
,
    pt:{label:'PORTUGAL',timeZone:'Europe/Lisbon',latitude:39.3999,longitude:-8.2245,region:'Portugal',city:'centro de Portugal'},
    // Representative cities from tzdb zone.tab; both regions share Dutch copy.
    be:{label:'BELGIUM',timeZone:'Europe/Brussels',latitude:50.833333333333336,longitude:4.333333333333333,region:'België',city:'Brussel'},
    nl:{label:'NETHERLANDS',timeZone:'Europe/Amsterdam',latitude:52.36666666666667,longitude:4.9,region:'Nederland',city:'Amsterdam'},
    br:{label:'BRAZIL',timeZone:'America/Sao_Paulo',latitude:-14.235,longitude:-51.9253,region:'Brasil',city:'centro do Brasil'},
    it:{label:'ITALY',timeZone:'Europe/Rome',latitude:41.8719,longitude:12.5674,region:'Italia',city:"centro d'Italia"},
    mx:{label:'MEXICO',timeZone:'America/Mexico_City',latitude:23.6345,longitude:-102.5528,region:'México',city:'centro de México'},
    id:{label:'INDONESIA',timeZone:'Asia/Jakarta',latitude:-2.5489,longitude:118.0149,region:'Indonesia',city:'pusat Indonesia'},
    ao:{label:"ANGOLA",timeZone:"Africa/Luanda",latitude:-11.2027,longitude:17.8739,region:"Angola",city:"centro geográfico"},
    ar:{label:"ARGENTINA",timeZone:"America/Argentina/Buenos_Aires",latitude:-38.4161,longitude:-63.6167,region:"Argentina",city:"centro geográfico"},
    au:{label:"AUSTRALIA",timeZone:"Australia/Sydney",latitude:-25.2744,longitude:133.7751,region:"Australia",city:"geographic center"},
    at:{label:"AUSTRIA",timeZone:"Europe/Vienna",latitude:47.5162,longitude:14.5501,region:"Österreich",city:"geografische Mitte"},
    ca:{label:"CANADA",timeZone:"America/Toronto",latitude:56.1304,longitude:-106.3468,region:"Canada",city:"geographic center"},
    cl:{label:"CHILE",timeZone:"America/Santiago",latitude:-35.6751,longitude:-71.543,region:"Chile",city:"centro geográfico"},
    co:{label:"COLOMBIA",timeZone:"America/Bogota",latitude:4.5709,longitude:-74.2973,region:"Colombia",city:"centro geográfico"},
    cr:{label:"COSTA RICA",timeZone:"America/Costa_Rica",latitude:9.7489,longitude:-83.7534,region:"Costa Rica",city:"centro geográfico"},
    ec:{label:"ECUADOR",timeZone:"America/Guayaquil",latitude:-1.8312,longitude:-78.1834,region:"Ecuador",city:"centro geográfico"},
    ie:{label:"IRELAND",timeZone:"Europe/Dublin",latitude:53.1424,longitude:-7.6921,region:"Ireland",city:"geographic center"},
    mz:{label:"MOZAMBIQUE",timeZone:"Africa/Maputo",latitude:-18.6657,longitude:35.5296,region:"Moçambique",city:"centro geográfico"},
    sg:{label:'SINGAPORE',timeZone:'Asia/Singapore',latitude:1.2833333333333334,longitude:103.85,region:'Singapore',city:'Singapore'},
    nz:{label:"NEW ZEALAND",timeZone:"Pacific/Auckland",latitude:-40.9006,longitude:174.886,region:"New Zealand",city:"geographic center"},
    pa:{label:"PANAMA",timeZone:"America/Panama",latitude:8.538,longitude:-80.7821,region:"Panamá",city:"centro geográfico"},
    pe:{label:"PERU",timeZone:"America/Lima",latitude:-9.19,longitude:-75.0152,region:"Perú",city:"centro geográfico"},
    uy:{label:"URUGUAY",timeZone:"America/Montevideo",latitude:-32.5228,longitude:-55.7658,region:"Uruguay",city:"centro geográfico"},
    ve:{label:"VENEZUELA",timeZone:"America/Caracas",latitude:6.4238,longitude:-66.5897,region:"Venezuela",city:"centro geográfico"}
  };
  const STAR_DENSITY_COPY=Object.freeze({
    kor:Object.freeze({label:'별 밀도',aria:'파티클 별 밀도. 0이면 파티클 별을 숨깁니다.'}),
    en:Object.freeze({label:'Star density',aria:'Particle star density. Zero hides particle stars.'}),
    chn:Object.freeze({label:'星星密度',aria:'粒子星星密度。设为 0 时隐藏粒子星星。'}),
    zht:Object.freeze({label:'星星密度',aria:'粒子星星密度。設為 0 時隱藏粒子星星。'}),
    jpn:Object.freeze({label:'星の密度',aria:'パーティクル星の密度。0 にするとパーティクル星を非表示にします。'}),
    eu:Object.freeze({label:'Star density',aria:'Particle star density. Zero hides particle stars.'}),
    hi:Object.freeze({label:'तारों का घनत्व',aria:'पार्टिकल तारों का घनत्व। 0 पर पार्टिकल तारे छिप जाते हैं।'}),
    es:Object.freeze({label:'Densidad de estrellas',aria:'Densidad de estrellas de partículas. Cero oculta las estrellas de partículas.'}),
    de:Object.freeze({label:'Sterndichte',aria:'Dichte der Partikelsterne. Bei 0 werden Partikelsterne ausgeblendet.'}),
    fr:Object.freeze({label:'Densité d’étoiles',aria:'Densité des étoiles particules. Zéro masque les étoiles particules.'})
,
    nl:Object.freeze({label:'Sterdichtheid',aria:'Dichtheid van de deeltjessterren. Bij nul zijn de deeltjessterren verborgen.'}),
    pt:Object.freeze({label:'Densidade de estrelas',aria:'Densidade das estrelas de partículas. Zero oculta as estrelas de partículas.'}),
    br:Object.freeze({label:'Densidade de estrelas',aria:'Densidade das estrelas de partículas. Zero oculta as estrelas de partículas.'}),
    it:Object.freeze({label:'Densità stellare',aria:'Densità delle stelle particellari. Zero nasconde le stelle particellari.'}),
    mx:Object.freeze({label:'Densidad de estrellas',aria:'Densidad de estrellas de partículas. Cero oculta las estrellas de partículas.'}),
    id:Object.freeze({label:'Kepadatan bintang',aria:'Kepadatan bintang partikel. Nol menyembunyikan bintang partikel.'})
  });
  const FACTORY_OPTIONS=Object.freeze({actualScale:false,overviewOrbitGap:86,orbitBrightness:.5,starDensity:1,dollyZoom:false,labels:true,avoidLabels:false,twinkle:true,activity:true,earthNightLights:true,pluto:true,moon:true,skyMotion:true,comets:true,quality:'auto'});
  const FACTORY_BODY_SCALES=Object.freeze({sun:1.54,mercury:3.79,venus:3.06,earth:5.05,mars:4.28,jupiter:2,saturn:2.42,uranus:3.04,neptune:2.32,pluto:5.23,moon:3.7,europa:3.44});
  const FACTORY_ORBIT_SCALES=Object.freeze({sun:.16,earth:.43,jupiter:1});
  const FACTORY_AUTO_ROTATE=1;
  const MUSIC_TRACKS=Object.freeze([
    {title:'Celestial Drift',file:'01 - Celestial Drift.mp3'},
    {title:'Cosmic Drift',file:'02 - Cosmic Drift.mp3'},
    {title:'Cosmic Hum',file:'03 - Cosmic Hum.mp3'},
    {title:'Cosmic Silence',file:'04 - Cosmic Silence.mp3'},
    {title:'Infinite Drift',file:'05 - Infinite Drift.mp3'},
    {title:'Near-Silence',file:'06 - Near-Silence.mp3'},
    {title:'Weightless Emptiness',file:'07 - Weightless Emptiness.mp3'}
  ]);
  const detectedLanguage=Localization.detect,detectedCopyLanguage=Localization.detectCopy,detectedTimeZone=Localization.detectTimeZone;
  // Country owns the clock/site while copy owns the interface language. In
  // automatic mode they may deliberately differ (for example an English
  // browser in Seoul still tracks Korea, but reads an English interface).
  const COPY_META=Object.freeze({
    kor:Object.freeze({locale:'ko-KR',html:'ko'}),en:Object.freeze({locale:'en-US',html:'en'}),
    chn:Object.freeze({locale:'zh-CN',html:'zh-Hans'}),zht:Object.freeze({locale:'zh-TW',html:'zh-Hant'}),
    jpn:Object.freeze({locale:'ja-JP',html:'ja'}),hi:Object.freeze({locale:'hi-IN',html:'hi'}),
    es:Object.freeze({locale:'es-ES',html:'es'}),de:Object.freeze({locale:'de-DE',html:'de'}),
    fr:Object.freeze({locale:'fr-FR',html:'fr'}),pt:Object.freeze({locale:'pt-PT',html:'pt'}),
    it:Object.freeze({locale:'it-IT',html:'it'}),id:Object.freeze({locale:'id-ID',html:'id'}),
    nl:Object.freeze({locale:'nl-NL',html:'nl'})
  });
  const COPY=Object.create(null),BODY_COPY=Object.create(null),PHASE_COPY=Object.create(null);
  async function hydrateLanguage(region,copyCode=LANG_META[region]?.copy||'kor'){
    const code=copyCode,bundle=await LanguageData.load(code);
    COPY[code]=bundle.copy;BODY_COPY[code]=bundle.bodies;PHASE_COPY[code]=bundle.phases;
  }
  // NASA/NSSDCA representative values. Gas- and ice-giant temperatures refer
  // to a comparable atmospheric pressure level because they have no hard surface.
  const BODY_ENVIRONMENT=Object.freeze({
    sun:{mean:5500,min:4400,max:6600,gravity:274},
    mercury:{mean:167,min:-180,max:430,gravity:3.7},venus:{mean:464,min:460,max:470,gravity:8.9},
    earth:{mean:15,min:-89,max:57,gravity:9.8},moon:{mean:-20,min:-173,max:127,gravity:1.6},
    mars:{mean:-65,min:-153,max:20,gravity:3.7},jupiter:{mean:-110,min:-145,max:-110,gravity:23.1},
    europa:{mean:-160,min:-223,max:-133,gravity:1.31},saturn:{mean:-140,min:-178,max:-140,gravity:9},
    uranus:{mean:-195,min:-224,max:-195,gravity:8.7},neptune:{mean:-200,min:-218,max:-200,gravity:11},
    pluto:{mean:-225,min:-240,max:-226,gravity:.7}
  });
  const interpolate=Localization.interpolate,showFading=UI.show,hideFading=UI.hide,uiElementVisible=UI.visible;
  UI.installDocumentGuards(document);
  const LIFE_USER_WATERMARK_KEY='releases/content/ui/life-user-watermark.webp?v=0.46-r1';
  function hydrateLifeUserWatermarks(){
    const base=window.SolarAssets?.materials?.earth?.base;if(!base)return;
    const url=new URL(LIFE_USER_WATERMARK_KEY,base).href;
    for(const image of document.querySelectorAll('img[data-life-user-watermark]'))image.src=url;
  }
  hydrateLifeUserWatermarks();
  let toastTimer,awakeTimer;
  function toast(message) { clearTimeout(toastTimer);$('toast').textContent=message;showFading($('toast'));toastTimer=setTimeout(()=>hideFading($('toast')),3400); }
  function fatal(error) { $('loading').hidden=true;$('fatal-error').hidden=false;$('fatal-message').textContent=error instanceof Error?error.message:String(error);console.error(error); }
  async function init() {
    try {
      const materials=new window.SolarMaterials.Owner();
      const bootWall=Date.now(),calibrationStarted=performance.now();
      A.calibrateAt(bootWall);
      const calibrationMs=performance.now()-calibrationStarted;
      const renderer=new window.SolarRenderer($('starfield'),$('universe'));
      Object.assign(renderer.options,FACTORY_OPTIONS);renderer.setBodyScales(FACTORY_BODY_SCALES);renderer.setSatelliteOrbitScales(FACTORY_ORBIT_SCALES);
      const clock=new A.SimulationClock(Date.now(),performance.now());
      let timezone='local',showSeconds=false,hourCycle='12',language=detectedLanguage(),languageMode='auto',activeCopyCode=detectedCopyLanguage(),autoTimeZone=detectedTimeZone(),zen=false,raf=0,lastFrame=0,effectTime=0,lastWallKey='',lastUi=0,disposed=false;
      let speedMode='day',speedValues={hour:1,day:1,year:1};
      const activeRegion=()=>REGIONS[language]||REGIONS.kor;
      autoTimeZone=autoTimeZone||activeRegion().timeZone;
      const activeTimeZone=()=>timezone==='utc'?'UTC':languageMode==='auto'?autoTimeZone:activeRegion().timeZone;
      const copyLanguage=()=>activeCopyCode;
      const copyMeta=()=>COPY_META[copyLanguage()]||COPY_META.en;
      const t=(key,values)=>interpolate(COPY[copyLanguage()]?.[key]??COPY.kor?.[key]??key,values);
      const bodyCopy=body=>copyLanguage()==='kor'?{name:body.ko,description:body.description}:{name:BODY_COPY[copyLanguage()]?.[body.id]?.[0]||body.en,description:BODY_COPY[copyLanguage()]?.[body.id]?.[1]||body.description};
      const phaseCopy=name=>copyLanguage()==='kor'?name:(PHASE_COPY[copyLanguage()]?.[name]||name);
      const quantity=(value,unit)=>['en','hi','es','de','fr','pt','it','id','nl'].includes(copyLanguage())?`${value} ${t(unit)}`:`${value}${t(unit)}`;
      const music=Modules.MusicPlayer.create({
        audio:$('background-music'),tracks:MUSIC_TRACKS,
        folder:/\/dist\/[^/]+\.html$/i.test(location.pathname)?'../assets/music/':'assets/music/',
        translate:t,notify:toast,button:$('music-toggle'),previous:$('music-previous'),next:$('music-next'),title:$('music-title'),now:$('music-now')
      });
      const musicUi=()=>music.refresh(),setMusicEnabled=value=>music.setEnabled(value);
      function translateStatic(){
        document.documentElement.lang=languageMode==='auto'?copyMeta().html:LANG_META[language].html;
        Localization.apply(document,t);
        const automaticLabel=Localization.automaticLanguageLabel();$('auto-language-mode').textContent=automaticLabel[0];$('auto-language-name').textContent=automaticLabel[1];
        const lang=$('language-toggle');lang.textContent=LANG_META[language].code;lang.setAttribute('aria-label',`${t('languageChange')}. ${LANG_META[language].name}`);lang.title=`${t('languageChange')} · ${LANG_META[language].code}`;
        const menu=$('language-menu');menu.setAttribute('aria-label',t('languageChange'));
        const starCopy=STAR_DENSITY_COPY[copyLanguage()]||STAR_DENSITY_COPY.kor;
        $('star-density-label').textContent=starCopy.label;$('star-density').setAttribute('aria-label',starCopy.aria);
        menu.querySelector('[data-language-auto]')?.setAttribute('aria-checked',String(languageMode==='auto'));
        for(const option of menu.querySelectorAll('[data-language]'))option.setAttribute('aria-checked',String(languageMode==='manual'&&option.dataset.language===language));
        $('fit-view').setAttribute('aria-label',t('homeView'));$('fit-view').title=t('homeView')+' · 0';
        $('fullscreen-button').setAttribute('aria-label',t(document.fullscreenElement?'fullscreenExit':'fullscreen'));$('fullscreen-button').title=t(document.fullscreenElement?'fullscreenExit':'fullscreen')+' · F';
        $('zen-toggle').setAttribute('aria-label',t(zen?'zenOff':'zenOn'));$('zen-toggle').title=t(zen?'normalMode':'zenMode')+' · H';
        musicUi();
      }
      const CLOCK_FONTS=Object.freeze({
        aptos:'"Aptos Display","Segoe UI Light","Segoe UI",Arial,sans-serif',
        'segoe-variable':'"Segoe UI Variable Display","Segoe UI Variable","Segoe UI",Arial,sans-serif',
        segoe:'"Segoe UI Light","Segoe UI",Arial,sans-serif',
        bahnschrift:'"Bahnschrift Light","Bahnschrift","Segoe UI",Arial,sans-serif',
        calibri:'"Calibri Light",Calibri,"Segoe UI",Arial,sans-serif',
        corbel:'"Corbel Light",Corbel,"Segoe UI",Arial,sans-serif',
        candara:'"Candara Light",Candara,"Segoe UI",Arial,sans-serif',
        century:'"Century Gothic","Segoe UI",Arial,sans-serif',
        trebuchet:'"Trebuchet MS","Segoe UI",Arial,sans-serif',
        arial:'Arial,"Segoe UI",sans-serif',
        georgia:'Georgia,"Times New Roman",serif',
        times:'"Times New Roman",Times,serif',
        cascadia:'"Cascadia Mono","Cascadia Code",Consolas,monospace',
        consolas:'Consolas,"Cascadia Mono",monospace',
        lucida:'"Lucida Console",Consolas,monospace'
      });
      const CLOCK_FONT_ORDER=Object.freeze(Object.keys(CLOCK_FONTS));
      let clockFont='georgia',savedAutoRotateDirection=FACTORY_AUTO_ROTATE,overviewCamera=renderer.defaultCameraSnapshot();
      renderer.options.twinkle=true;
      const validKeys={actualScale:'actual-scale',labels:'show-labels',avoidLabels:'avoid-labels',activity:'show-activity',earthNightLights:'earth-night-lights',pluto:'show-pluto',moon:'show-moon',comets:'show-comets'};
      try {
        const saved=Preferences.read(STORAGE_KEY);
        if(saved&&typeof saved==='object') {
          for(const key of Object.keys(validKeys))if(typeof saved[key]==='boolean')renderer.options[key]=saved[key];
          if(Number.isFinite(saved.orbitBrightness))renderer.options.orbitBrightness=A.clamp(saved.orbitBrightness,0,1);
          else if(typeof saved.orbits==='boolean')renderer.options.orbitBrightness=saved.orbits?.5:0;
          if(Number.isFinite(saved.starDensity))renderer.options.starDensity=A.clamp(saved.starDensity,0,3);
           if(typeof saved.dollyZoom==='boolean')renderer.options.dollyZoom=saved.dollyZoom;
           if([-1,0,1].includes(saved.autoRotateDirection))savedAutoRotateDirection=saved.autoRotateDirection;
          if(Number.isFinite(saved.overviewOrbitGap))renderer.options.overviewOrbitGap=A.clamp(Math.round(saved.overviewOrbitGap),A.OVERVIEW_ORBIT.minGap,A.OVERVIEW_ORBIT.maxGap);
          if(saved.languageMode==='auto'){languageMode='auto';language=detectedLanguage();}
          else if(LANG_ORDER.includes(saved.language)){language=saved.language;languageMode='manual';}
          if(typeof saved.showSeconds==='boolean')showSeconds=saved.showSeconds;
          if(saved.hourCycle==='12'||saved.hourCycle==='24')hourCycle=saved.hourCycle;
          if(typeof saved.clockFont==='string'&&CLOCK_FONTS[saved.clockFont])clockFont=saved.clockFont;
          if(['hour','day','year'].includes(saved.speedMode))speedMode=saved.speedMode;
          if(saved.speedValues&&typeof saved.speedValues==='object'){
            if(Number.isFinite(saved.speedValues.hour))speedValues.hour=A.clamp(Math.round(saved.speedValues.hour),1,1440);
            if(Number.isFinite(saved.speedValues.day))speedValues.day=A.clamp(Math.round(saved.speedValues.day),1,365);
            if(Number.isFinite(saved.speedValues.year))speedValues.year=A.clamp(Math.round(saved.speedValues.year),1,20);
          }
          renderer.setBodyScales(saved.bodyScales);renderer.setSatelliteOrbitScales(saved.satelliteOrbitScales);
          const savedCamera=saved.camera&&{...saved.camera,focus:null,mode:saved.dollyZoom?'move':'zoom'};
          if(window.SolarRenderer.validCamera(savedCamera))renderer.restoreCamera(savedCamera);
          else{
            if(Number.isFinite(saved.elevation))renderer.setOrbitView(renderer.camera.azimuth,saved.elevation*A.DEG);
            if(Number.isFinite(saved.panY))renderer.setPanY(saved.panY);
            if(Number.isFinite(saved.panX))renderer.setPan(saved.panX);
          }
        }
      } catch (_) { /* Private browsing, corrupt JSON and blocked storage must not break the clock. */ }
      activeCopyCode=languageMode==='auto'?detectedCopyLanguage():(LANG_META[language]?.copy||'kor');
      if(languageMode==='auto')autoTimeZone=detectedTimeZone()||activeRegion().timeZone;
      await hydrateLanguage(language,activeCopyCode);
      overviewCamera={...renderer.cameraSnapshot(),focus:null};
      renderer.setOption('actualScale',renderer.options.actualScale,false);
      renderer.setOption('dollyZoom',renderer.options.dollyZoom,false);
      renderer.setSite(activeRegion());
      if(savedAutoRotateDirection)renderer.setAutoRotate(savedAutoRotateDirection,performance.now());
      translateStatic();
      renderer.resize();
      for(const [key,id] of Object.entries(validKeys))$(id).checked=renderer.options[key];
      $('show-seconds').checked=showSeconds;$('seconds-group').hidden=!showSeconds;
      $('ampm').hidden=false;syncHourCycleUi();
      $('clock-font').value=clockFont;document.documentElement.style.setProperty('--clock-font',CLOCK_FONTS[clockFont]);
      function syncOrbitSpacingControl(){
        const input=$('overview-orbit-gap'),value=Math.round(renderer.options.overviewOrbitGap),locked=renderer.options.actualScale;
        input.value=value;input.disabled=locked;$('overview-orbit-gap-output').textContent=String(value);$('overview-orbit-gap-control').classList.toggle('locked',locked);
      }
      syncOrbitSpacingControl();
      function syncOrbitBrightnessControl(){
        const value=Math.round(A.clamp(renderer.options.orbitBrightness,0,1)*100);
        $('orbit-brightness').value=String(value);$('orbit-brightness-output').textContent=value+'%';
      }
      syncOrbitBrightnessControl();
      function syncStarDensityControl(){
        const value=Math.round(A.clamp(Number(renderer.options.starDensity) || 0,0,3)*100);
        $('star-density').value=String(value);$('star-density-output').textContent=value+'%';
      }
      syncStarDensityControl();
      const zoneLabel=()=>timezone==='utc'?'UTC':activeRegion().label;
      function syncHourCycleUi(period){
        const control=$('ampm'),twentyFour=hourCycle==='24';
        if(period==='AM'||period==='PM')control.dataset.period=period;
        $('hour-cycle').checked=twentyFour;
        control.textContent=twentyFour?'24H':(control.dataset.period||'AM');
        control.setAttribute('aria-pressed',String(twentyFour));
      }
      function persist() {const camera=renderer.cameraSnapshot();if(camera.focus===null)overviewCamera={...camera,focus:null};Preferences.write(STORAGE_KEY,{...renderer.options,bodyScales:renderer.getBodyScales(),satelliteOrbitScales:renderer.getSatelliteOrbitScales(),autoRotateDirection:renderer.autoRotateDirection,timezone,showSeconds,hourCycle,clockFont,speedMode,speedValues,language,languageMode,camera:overviewCamera,elevation:overviewCamera.elevation/A.DEG,panY:overviewCamera.panY,panX:overviewCamera.panX});}
      let cameraUiSignature='';
      function cameraUi(force=false) {
        const controlState=renderer.cameraTween?.input?renderer.cameraTween.to:renderer.camera;
        const move=renderer.options.dollyZoom,level=move?(controlState.dolly??1):controlState.zoom,levelText=level.toFixed(1)+'×';
        const mode=$('camera-mode-toggle'),modeLabel=t(move?'moveMode':'zoomMode'),zoomLabel=t(move?'moveValue':'zoomValue');
        const rotateRight=t('rotateRight'),rotateLeft=t('rotateLeft'),direction=renderer.autoRotateDirection;
        const signature=[levelText,move,direction,renderer.randomRotateEnabled,language,zoomLabel,modeLabel,rotateRight,rotateLeft].join('|');
        if(!force&&signature===cameraUiSignature)return;
        cameraUiSignature=signature;
        const zoomValue=$('zoom-value');if(zoomValue.textContent!==levelText)zoomValue.textContent=levelText;
        zoomValue.setAttribute('aria-label',zoomLabel);
        mode.dataset.mode=move?'move':'zoom';mode.setAttribute('aria-pressed',String(move));
        mode.setAttribute('aria-label',t('cameraModeAria',{mode:modeLabel}));mode.title=t('cameraMode',{mode:modeLabel});
        for(const [id,turn,label] of [['rotate-left',-1,rotateRight],['rotate-right',1,rotateLeft]]){
          const active=direction===turn,b=$(id);
          b.setAttribute('aria-pressed',String(active));b.setAttribute('aria-label',label+' '+t(active?'stop':'start'));
          b.title=t(active?'rotateRunning':'rotateRate',{direction:label});
        }
        const randomButton=$('random-rotate'),randomEnabled=renderer.randomRotateEnabled;
        randomButton.setAttribute('aria-pressed',String(randomEnabled));
        randomButton.setAttribute('aria-label',t('randomRotate'));
        randomButton.title=t('randomRotate')+' · '+t(randomEnabled?'stop':'start');
      }
      cameraUi();
      const PRESETS_KEY='solar-time.camera-presets.v1';
      let cameraPresets=[null,null,null],presetAction=null,presetStorageAvailable=true;
      const presetDialog=$('preset-dialog');
      try {
        const saved=Preferences.read(PRESETS_KEY);
        if([1,2].includes(saved?.schema)&&Array.isArray(saved.slots))cameraPresets=cameraPresets.map((_,i)=>{
          const legacy=saved.slots[i],value=legacy&&{...legacy,dolly:Number.isFinite(legacy.dolly)?legacy.dolly:1,mode:legacy.mode||'zoom'};
          return window.SolarRenderer.validCamera(value)?value:null;
        });
      }catch(_){/* Corrupt or inaccessible settings never affect the running camera. */}
      function presetUi() {
        cameraPresets.forEach((value,i)=>{
          const b=$('camera-preset-'+(i+1));b.classList.toggle('saved',!!value);b.dataset.saved=String(!!value);
          const mode=value?t(value.mode==='move'?'moveMode':'zoomMode'):'';
          b.title=t('presetButtonTitle',{n:i+1})+(mode?' · '+mode:'');
          b.setAttribute('aria-label',t('presetAria',{n:i+1,state:t(value?'saved':'empty')})+(mode?' · '+mode:''));
        });
      }
      function writePresets() {
        presetStorageAvailable=Preferences.write(PRESETS_KEY,{schema:2,slots:cameraPresets});
        presetUi();
      }
      function recallPreset(index) {
        const value=cameraPresets[index];
        if(!value){toast(t('emptyPreset',{n:index+1}));return;}
        cancelGesture();
        const satellite=A.SATELLITES.some(body=>body.id===value.focus);
        if(satellite&&!renderer.options.moon){renderer.setOption('moon',true);$('show-moon').checked=true;navVisibility();}
        if(value.focus==='pluto'&&!renderer.options.pluto){renderer.setOption('pluto',true);$('show-pluto').checked=true;navVisibility();}
        if(!renderer.animateCamera(value,performance.now(),1100)){toast(t('hiddenBody'));return;}
        cameraUi();
        // Persist only after the single renderer-owned transition has completed.
        if(!renderer.cameraTween)persist();
      }
      function closePresetDialog(restoreFocus=true) {
        const action=presetAction;presetAction=null;
        if(presetDialog.open)hideFading(presetDialog,()=>presetDialog.close());
        if(restoreFocus&&action)$('camera-preset-'+(action.index+1)).focus({preventScroll:true});
        if(action&&zen)wakePointer();
      }
      function openPresetDialog(index,event) {
        event.preventDefault();const value=cameraPresets[index];
        closePresetDialog(false);renderer.cancelCameraMotion(performance.now());cameraUi();
        presetAction={index,previous:value,snapshot:renderer.cameraSnapshot()};
        $('preset-title').textContent=t('presetTitle',{n:index+1});
        $('preset-note').textContent=t(value?'presetSavedNote':'presetEmptyNote');
        $('preset-apply').disabled=!value;$('preset-delete').disabled=!value;
        showFading(presetDialog,()=>presetDialog.showModal());
        const button=$('camera-preset-'+(index+1)).getBoundingClientRect();
        const keyboard=!event.clientX&&!event.clientY;
        const x=keyboard?button.left:event.clientX,y=keyboard?button.bottom:event.clientY;
        const box=presetDialog.getBoundingClientRect();
        presetDialog.style.left=Math.max(8,Math.min(x+8,innerWidth-box.width-8))+'px';
        presetDialog.style.top=Math.max(8,Math.min(y+8,innerHeight-box.height-8))+'px';
        $('preset-cancel').focus({preventScroll:true});wakePointer();
      }
      for(let i=0;i<3;i++) {
        const b=$('camera-preset-'+(i+1));b.addEventListener('click',event=>openPresetDialog(i,event));
        b.addEventListener('contextmenu',event=>openPresetDialog(i,event));
      }
      $('preset-cancel').addEventListener('click',()=>closePresetDialog());
      $('preset-apply').addEventListener('click',()=>{
        const action=presetAction;if(!action||!cameraPresets[action.index])return;
        closePresetDialog();recallPreset(action.index);
      });
      for(const kind of ['save','delete'])$('preset-'+kind).addEventListener('click',()=>{
        const action=presetAction;
        if(action&&cameraPresets[action.index]===action.previous){
          cameraPresets[action.index]=kind==='delete'?null:action.snapshot;writePresets();
          toast(t(kind==='delete'?'presetDeleted':'presetSaved',{n:action.index+1})+(presetStorageAvailable?'':t('temporaryOnly')));
        }
        closePresetDialog();
      });
      UI.bindDialog(presetDialog,options=>closePresetDialog(options?.restoreFocus!==false));
      window.addEventListener('resize',()=>{closePresetDialog(false);if(!$('body-panel').hidden)anchorBodyPanel();},{passive:true});
      presetUi();
      const realFormat=()=>new Intl.DateTimeFormat(languageMode==='auto'?copyMeta().locale:LANG_META[language].locale,{year:'numeric',month:'long',day:'numeric',weekday:'long',timeZone:activeTimeZone()});
      const partFormat=()=>new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',timeZone:activeTimeZone()});
      let dateFormatter=realFormat(),wallPartsFormatter=partFormat();
      const two=v=>String(v).padStart(2,'0');
      function refreshTimeFormats(){dateFormatter=realFormat();wallPartsFormatter=partFormat();}
      function dateParts(ms) {const values={};for(const part of wallPartsFormatter.formatToParts(new Date(ms)))if(part.type!=='literal')values[part.type]=Number(part.value);return {y:values.year,mo:values.month,d:values.day,h:values.hour,mi:values.minute,s:values.second};}
      function compactDay(ms) {const d=dateParts(ms);return `${d.y}.${two(d.mo)}.${two(d.d)}`;}
      function compactDate(ms) {const d=dateParts(ms);return `${d.y}.${two(d.mo)}.${two(d.d)}  ${two(d.h)}:${two(d.mi)}`;}
      function updateWall(wall) {
        const p=dateParts(wall),key=[p.y,p.mo,p.d,p.h,p.mi,showSeconds?p.s:0,timezone,showSeconds,hourCycle].join('-');if(key===lastWallKey)return;lastWallKey=key;
        const twelve=hourCycle==='12',displayHour=twelve?((p.h+11)%12)+1:p.h,period=p.h<12?'AM':'PM';
        $('hours').textContent=two(displayHour);$('minutes').textContent=two(p.mi);$('seconds').textContent=two(p.s);
        $('ampm').hidden=false;syncHourCycleUi(period);
        const spoken=twelve?`${period} ${two(displayHour)}:${two(p.mi)}${showSeconds?':'+two(p.s):''}`:`${two(p.h)}:${two(p.mi)}${showSeconds?':'+two(p.s):''}`;
        $('wall-clock').dateTime=new Date(wall).toISOString();$('wall-clock').setAttribute('aria-label',t('wallClockAria',{time:spoken}));
        $('wall-date').textContent=dateFormatter.format(new Date(wall));$('timezone-button').textContent=zoneLabel();
        const regionAction=t('koreaView',{region:activeRegion().region});$('timezone-button').setAttribute('aria-label',regionAction);$('timezone-button').title=regionAction;
      }
      // Display each satellite immediately after its parent while the renderer
      // uses the same parent relationship for the actual scene hierarchy.
      const satellites=A.SATELLITES||[A.MOON];
      const bodies=[A.SUN,...A.BODIES.flatMap(body=>[body,...satellites.filter(satellite=>satellite.parent===body.id)])];
      const navButtons=new Map();
      for(const b of bodies) {
        const button=document.createElement('button');button.type='button';button.dataset.body=b.id;button.style.setProperty('--planet',b.color);
        if(b.parent){button.dataset.parent=b.parent;button.classList.add('satellite');}
        const copy=bodyCopy(b);button.setAttribute('aria-pressed','false');button.setAttribute('aria-label',t('bodyInfo',{name:copy.name}));
        const dot=document.createElement('i');dot.setAttribute('aria-hidden','true');button.append(dot,document.createTextNode(copy.name));
        button.addEventListener('click',event=>{if(event.detail<2)selectBody(b.id);});
        button.addEventListener('dblclick',event=>{
          event.preventDefault();
          if(renderer.selected!==b.id)selectBody(b.id);
          focusBody(b.id);
        });
        $('planet-nav').append(button);navButtons.set(b.id,button);
      }
      function refreshNavLabels(){
        for(const b of bodies){const button=navButtons.get(b.id),copy=bodyCopy(b);button.lastChild.textContent=copy.name;button.setAttribute('aria-label',t('bodyInfo',{name:copy.name}));}
      }
      function navVisibility() {navButtons.get('pluto').hidden=!renderer.options.pluto;for(const satellite of A.SATELLITES)navButtons.get(satellite.id).hidden=!renderer.options.moon;}
      navVisibility();
      function syncBodySizeControl(body=bodies.find(value=>value.id===renderer.selected)) {
        if(!body)return;
        const locked=renderer.options.actualScale,value=Math.round(renderer.bodySizeScale(body)*100),limits=renderer.bodyScaleLimits(body),hasOrbitControl=['sun','earth','jupiter'].includes(body.id);
        $('body-size-slider').min=Math.round(limits.min*100);$('body-size-slider').max=Math.round(limits.max*100);
        $('body-size-slider').value=value;$('body-size-output').textContent=value+'%';
        const orbitControl=$('satellite-orbit-control'),orbitSlider=$('satellite-orbit-slider'),orbitValue=Math.round(renderer.satelliteOrbitScale(body)*100),solar=body.id==='sun';
        orbitControl.hidden=!hasOrbitControl;orbitSlider.value=orbitValue;$('satellite-orbit-output').textContent=orbitValue+'%';orbitSlider.disabled=locked;
        $('body-orbit-label').textContent=t(solar?'solarOrbitSpacing':'satelliteOrbitSpacing');orbitSlider.setAttribute('aria-label',t(solar?'solarOrbitSpacingAria':'satelliteOrbitSpacingAria'));
        $('body-size-slider').disabled=locked;$('body-size-reset').disabled=locked||(value===100&&(!hasOrbitControl||orbitValue===100));
        $('body-size-lock').hidden=!locked;$('body-size-control').classList.toggle('locked',locked);
        $('earth-night-lights-control').hidden=body.id!=='earth';$('earth-night-lights').checked=renderer.options.earthNightLights!==false;
        $('sun-shine-control').hidden=body.id!=='sun';$('show-activity').checked=renderer.options.activity!==false;
      }
      $('body-size-slider').addEventListener('input',()=>{
        const body=bodies.find(value=>value.id===renderer.selected);if(!body)return;
        renderer.setBodyScale(body.id,Number($('body-size-slider').value)/100);syncBodySizeControl(body);
      });
      $('body-size-slider').addEventListener('change',persist);
      $('satellite-orbit-slider').addEventListener('input',()=>{
        const body=bodies.find(value=>value.id===renderer.selected);if(!body)return;
        renderer.setSatelliteOrbitScale(body.id,Number($('satellite-orbit-slider').value)/100);syncBodySizeControl(body);
      });
      $('satellite-orbit-slider').addEventListener('change',persist);
      $('body-size-reset').addEventListener('click',()=>{
        const body=bodies.find(value=>value.id===renderer.selected);if(!body)return;
        const sizeReset=renderer.resetBodyScale(body.id),orbitReset=renderer.resetSatelliteOrbitScale(body.id);
        if(sizeReset||orbitReset){syncBodySizeControl(body);persist();}
      });
      const eclipseTargets=new Map();
      function syncEclipseControl(bodyId=renderer.selected) {
        const available=bodyId==='moon'||bodyId==='europa',target=eclipseTargets.get(bodyId);
        $('eclipse-control').hidden=!available;
        $('eclipse-date').textContent=available&&Number.isFinite(target)?compactDate(target):'—';
      }
      function travelToEclipse(direction) {
        const id=renderer.selected;if(id!=='moon'&&id!=='europa')return;
        const mono=performance.now(),base=clock.travel?.targetMs??clock.value(mono),event=A.eclipseEvent(id,base,direction);
        if(!event){toast(t('eclipseUnavailable'));return;}
        eclipseTargets.set(id,event.ms);syncEclipseControl(id);
        // Eclipse navigation changes simulation time only. Preserve the exact
        // current camera, whether it is a home/preset/free view or is already
        // tracking Moon/Europa.
        renderer.invalidateSurfaces();clock.travelTo(event.ms,mono,id==='moon'?2200:1500);
        const ms=clock.value(mono);updateControls(ms);updateBody(ms);
      }
      $('eclipse-previous').addEventListener('click',()=>travelToEclipse(-1));
      $('eclipse-next').addEventListener('click',()=>travelToEclipse(1));
      let alignmentTarget=null;
      function syncAlignmentControl(bodyId=renderer.selected) {
        const available=bodyId==='sun',output=$('alignment-date');
        $('alignment-control').hidden=!available;
        output.textContent=available&&alignmentTarget?compactDay(alignmentTarget.ms):'—';
        output.classList.toggle('space-alignment',available&&alignmentTarget?.kind==='space');
        output.classList.toggle('sky-alignment',available&&alignmentTarget?.kind==='sky');
        if(available&&alignmentTarget){
          const names=alignmentTarget.planets.map(id=>{const body=bodies.find(value=>value.id===id);return body?bodyCopy(body).name:id;});
          output.title=`${compactDate(alignmentTarget.ms)} · ${activeTimeZone()} · ${alignmentTarget.planets.length} · ${names.join(' · ')}`;
        }else output.removeAttribute('title');
      }
      function travelToAlignment(direction) {
        if(renderer.selected!=='sun')return;
        const mono=performance.now(),base=clock.travel?.targetMs??clock.value(mono),event=A.planetaryAlignmentEvent(base,direction);
        if(!event){toast(t('alignmentUnavailable'));return;}
        alignmentTarget=event;renderer.setAlignmentGuide(event);syncAlignmentControl('sun');
        // Catalog navigation changes time only, matching eclipse navigation and
        // preserving the user's current free, preset or tracking camera.
        renderer.invalidateSurfaces();clock.travelTo(event.ms,mono,2000);
        const ms=clock.value(mono);updateControls(ms);updateBody(ms);
      }
      $('alignment-previous').addEventListener('click',()=>travelToAlignment(-1));
      $('alignment-next').addEventListener('click',()=>travelToAlignment(1));
      const statNodes=new Map();let bodyInfoSignature='';
      function setStat(id,value,unit) {
        let record=statNodes.get(id);
        if(!record){const el=$(id),text=document.createTextNode(''),small=document.createElement('small');el.replaceChildren(text,small);record={text,small};statNodes.set(id,record);}
        const label=String(value)+(unit?' ':'');
        if(record.text.nodeValue!==label)record.text.nodeValue=label;
        if(record.small.textContent!==(unit||''))record.small.textContent=unit||'';
        if(record.small.hidden!==!unit)record.small.hidden=!unit;
      }
      function updateBody(ms) {
        const b=bodies.find(v=>v.id===renderer.selected);if(!b)return;
        const material=window.SolarAssets.materialInfo?.[b.id],signature=b.id+'|'+copyLanguage()+'|'+(material?.credit||'');
        const staticChanged=signature!==bodyInfoSignature;bodyInfoSignature=signature;
        if(staticChanged)$('body-material').textContent=material?material.credit+' · '+t('photoMap'):b.id==='earth'?'NASA Blue Marble · '+t('builtInImage'):t('builtInMaterial')+' · '+t('publicPhotoUnavailable');
        if(b.id==='sun') {
          if(staticChanged)$('stat-label-one').textContent=t('representation');setStat('stat-value-one',t('star'),'');
          if(staticChanged)$('stat-label-two').textContent=t('systemCenter');setStat('stat-value-two','SUN','');
        } else if(b.id==='moon') {
          if(staticChanged)$('stat-label-one').textContent=t('earthOrbitPeriod');setStat('stat-value-one','27.32',t('dayUnit'));
          const phase=A.moonPhase(ms);if(staticChanged)$('stat-label-two').textContent=t('brightSide');setStat('stat-value-two',t('approximately',{value:Math.round(phase.fraction*100)}),'%');
        } else if(b.id==='europa') {
          if(staticChanged)$('stat-label-one').textContent=t('jupiterOrbitPeriod');setStat('stat-value-one','3.55',t('dayUnit'));
          if(staticChanged)$('stat-label-two').textContent=t('jupiterDistance');setStat('stat-value-two','671,000','km');
        } else {
          if(staticChanged)$('stat-label-one').textContent=t('orbitPeriod');setStat('stat-value-one',b.period>1000?(b.period/365.25).toFixed(1):b.period.toFixed(2),t(b.period>1000?'yearUnit':'dayUnit'));
          const p=A.positionAt(b,ms);if(staticChanged)$('stat-label-two').textContent=t('sunDistance');setStat('stat-value-two',Math.hypot(p.x,p.y,p.z).toFixed(2),'AU');
        }
        if(!staticChanged)return;
        const environment=BODY_ENVIRONMENT[b.id]||BODY_ENVIRONMENT.earth,gravityRatio=environment.gravity/BODY_ENVIRONMENT.earth.gravity;
        if(staticChanged)$('stat-label-temperature').textContent=t('meanTemperature');setStat('stat-value-temperature',String(environment.mean),'°C');
        $('stat-temperature-range').textContent=t('temperatureRange',{min:environment.min,max:environment.max});
        if(staticChanged)$('stat-label-gravity').textContent=t('surfaceGravity');setStat('stat-value-gravity',environment.gravity.toFixed(environment.gravity<2?2:1),'m/s²');
        $('stat-gravity-ratio').textContent=t('earthGravityRatio',{value:gravityRatio.toFixed(gravityRatio>=10?1:2)});
      }
      function anchorBodyPanel(){const panel=$('body-panel');panel.style.removeProperty('top');panel.style.removeProperty('bottom');panel.style.removeProperty('--body-panel-top');const top=Math.max(8,panel.getBoundingClientRect().top);panel.style.top=top+'px';panel.style.bottom='auto';panel.style.setProperty('--body-panel-top',top+'px');}
      function closeBody() {renderer.selected=null;hideFading($('body-panel'));for(const button of navButtons.values()){button.classList.remove('active');button.setAttribute('aria-pressed','false');}}
      function selectBody(id) {
        if(id===renderer.selected||!id){closeBody();return;}
        const b=bodies.find(v=>v.id===id);if(!b)return;
        renderer.selected=id;showFading($('body-panel'));settings(false);$('settings-button').setAttribute('aria-expanded','false');
        $('body-category').textContent=id==='sun'?'THE HEART OF OUR SYSTEM':id==='earth'?'OUR PALE BLUE HOME':id==='moon'?'EARTH’S COMPANION':id==='europa'?'JUPITER’S ICY MOON':id==='pluto'?'A DISTANT DWARF PLANET':'A WORLD IN MOTION';
        const copy=bodyCopy(b);$('body-name').textContent=copy.name;$('body-english').textContent=b.en;$('body-description').textContent=copy.description;
        for(const [key,button] of navButtons){button.classList.toggle('active',key===id);button.setAttribute('aria-pressed',String(key===id));}
        $('feature-view').hidden=!['earth','jupiter'].includes(id);$('feature-view').textContent=id==='earth'?t('koreaView',{region:activeRegion().region}):t('stormView');
        syncBodySizeControl(b);
        syncEclipseControl(id);
        syncAlignmentControl(id);
        updateBody(clock.value(performance.now()));
        anchorBodyPanel();requestAnimationFrame(()=>updateBodyScrollCues());
      }
      $('body-close').addEventListener('click',()=>{const id=renderer.selected;closeBody();navButtons.get(id)?.focus({preventScroll:true});});
      const SPEED_MODES={
        hour:{min:1,max:1440,step:1,rate:v=>v*60},
        day:{min:1,max:365,step:1,rate:v=>v*86400},
        year:{min:1,max:20,step:1,rate:v=>v*31557600}
      };
      function speedText(mode=speedMode,value=speedValues[mode]) {
        value=Math.round(value);
        if(mode==='hour'){const h=Math.floor(value/60),m=value%60;return h?(m?`${quantity(h,'hourUnit')} ${quantity(m,'minuteUnit')} / ${t('secondUnit')}`:`${quantity(h,'hourUnit')} / ${t('secondUnit')}`):`${quantity(m,'minuteUnit')} / ${t('secondUnit')}`;}
        if(mode==='day')return `${quantity(value,'dayUnit')} / ${t('secondUnit')}`;
        return `${quantity(value,'yearUnit')} / ${t('secondUnit')}`;
      }
      function syncSpeedUi(){
        const cfg=SPEED_MODES[speedMode],slider=$('speed-slider'),button=$('speed-mode-button');
        slider.min=cfg.min;slider.max=cfg.max;slider.step=cfg.step;slider.value=speedValues[speedMode];
        const selectedText=speedText(),active=selectedSpeedActive();
        slider.setAttribute('aria-valuetext',active?selectedText:t('speedUnitReady',{unit:selectedText}));
        const label=t(speedMode==='hour'?'hourUnit':speedMode==='day'?'dayUnit':'yearUnit');
        button.textContent=label;button.dataset.speedMode=speedMode;
        button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
        button.setAttribute('aria-label',t(active?'speedUnitActive':'speedUnitReady',{unit:label}));
      }
      function selectedSpeedActive(){const cfg=SPEED_MODES[speedMode];return !clock.live&&Math.abs(clock.rate-cfg.rate(speedValues[speedMode]))<1e-9;}
      function applySpeed(value=speedValues[speedMode]){
        const cfg=SPEED_MODES[speedMode],v=A.clamp(Math.round(Number(value)||cfg.min),cfg.min,cfg.max);speedValues[speedMode]=v;
        renderer.invalidateSurfaces();clock.setRate(cfg.rate(v),performance.now());syncSpeedUi();uiNow();persist();
      }
      function updateControls(ms) {
        $('pause-button').setAttribute('aria-pressed',String(clock.paused));$('pause-button').setAttribute('aria-label',t(clock.paused?'orbitPlay':'orbitPause'));
        $('pause-button').title=t(clock.paused?'orbitPlay':'orbitPause')+' · Space';$('pause-icon').toggleAttribute('hidden',clock.paused);$('play-icon').toggleAttribute('hidden',!clock.paused);
        $('live-button').classList.toggle('active',clock.live);$('live-button').setAttribute('aria-pressed',String(clock.live));
        $('status-dot').classList.toggle('simulated',!clock.live);$('status-dot').classList.toggle('paused',clock.paused);
        $('mode-label').textContent=clock.paused?'PAUSED':clock.live?'LIVE ORBITS':'TIME TRAVEL';
        $('simulation-date').textContent=compactDate(ms);$('simulation-date').dateTime=new Date(ms).toISOString();
        // Travel completion pauses at real-time rate. Derive the readout from
        // the clock, not the last slider choice, so play and display agree.
        $('speed-value').textContent=clock.paused?'PAUSED':clock.live||Math.abs(clock.rate-1)<1e-9?'1 ×':speedText();
        syncSpeedUi();
      }
      function uiNow() {const mono=performance.now(),wall=Date.now(),ms=clock.value(mono,wall);updateWall(wall);updateControls(ms);updateBody(ms);}
      function now() {
        const mono=performance.now();A.calibrateAt(Date.now());renderer.invalidateSurfaces();clock.now(mono);eclipseTargets.clear();alignmentTarget=null;renderer.setAlignmentGuide(null);syncEclipseControl();syncAlignmentControl();
        uiNow();toast(t('returnedNow'));
      }
      $('live-button').addEventListener('click',now);
      $('speed-mode-button').addEventListener('click',()=>{
        // A unit shown as "ready" is always applied first. Only the active unit
        // advances, including after a different control changed the clock rate.
        if(!selectedSpeedActive()){applySpeed();return;}
        const order=['hour','day','year'];speedMode=order[(order.indexOf(speedMode)+1)%order.length];applySpeed();
      });
      $('speed-slider').addEventListener('input',()=>applySpeed($('speed-slider').value));
      syncSpeedUi();
      function pause() {renderer.invalidateSurfaces();clock.toggle(performance.now());uiNow();}
      $('pause-button').addEventListener('click',pause);
      const scrollCueUpdates=[];
      const bindScrollCues=(container,scroller)=>{const binding=UI.bindScrollCues(container,scroller);scrollCueUpdates.push(binding.update);return binding.update;};
      const settingsPanel=$('settings-panel'),settingsScroll=$('settings-scroll');
      const updateSettingsScrollCues=bindScrollCues(settingsPanel,settingsScroll);
      const updateBodyScrollCues=bindScrollCues($('body-panel'),$('body-scroll'));
      bindScrollCues($('kakao-pay-dialog'),$('kakao-pay-scroll'));
      function settings(open) {const next=open===undefined?!uiElementVisible(settingsPanel):open;if(next){showFading(settingsPanel);updateSettingsScrollCues();requestAnimationFrame(updateSettingsScrollCues);}else hideFading(settingsPanel);$('settings-button').setAttribute('aria-expanded',String(next));if(next)closeBody();}
      UI.bindPopup(settingsPanel,()=>settings(false));
      UI.bindPopup($('body-panel'),closeBody);
      UI.bindPopup($('toast'),()=>{clearTimeout(toastTimer);hideFading($('toast'));});
      $('settings-button').addEventListener('click',()=>settings());$('settings-close').addEventListener('click',()=>{settings(false);$('settings-button').focus();});
      for(const [key,id] of Object.entries(validKeys))$(id).addEventListener('change',()=>{renderer.setOption(key,$(id).checked);if(key==='actualScale'){syncOrbitSpacingControl();if(renderer.selected)syncBodySizeControl();}if(key==='pluto'&&!$(id).checked&&renderer.selected==='pluto')closeBody();if(key==='moon'&&!$(id).checked&&A.SATELLITES.some(body=>body.id===renderer.selected))closeBody();navVisibility();persist();});
      $('overview-orbit-gap').addEventListener('input',()=>{renderer.setOption('overviewOrbitGap',$('overview-orbit-gap').value);syncOrbitSpacingControl();});
      $('overview-orbit-gap').addEventListener('change',persist);
      $('orbit-brightness').addEventListener('input',()=>{renderer.setOption('orbitBrightness',Number($('orbit-brightness').value)/100);syncOrbitBrightnessControl();});
      $('orbit-brightness').addEventListener('change',persist);
      $('star-density').addEventListener('input',()=>{renderer.setOption('starDensity',Number($('star-density').value)/100);syncStarDensityControl();});
      $('star-density').addEventListener('change',persist);
      $('show-seconds').addEventListener('change',()=>{showSeconds=$('show-seconds').checked;$('seconds-group').hidden=!showSeconds;lastWallKey='';uiNow();persist();});
      function setHourCycle(next){hourCycle=next==='24'?'24':'12';$('ampm').hidden=false;syncHourCycleUi();lastWallKey='';uiNow();persist();}
      const toggleHourCycle=()=>setHourCycle(hourCycle==='12'?'24':'12');
      $('hour-cycle').addEventListener('change',()=>setHourCycle($('hour-cycle').checked?'24':'12'));
      $('ampm').addEventListener('click',event=>{event.stopPropagation();toggleHourCycle();});
      $('ampm').addEventListener('keydown',event=>{if(event.key!=='Enter'&&event.key!==' ')return;event.preventDefault();event.stopPropagation();toggleHourCycle();});
      function setClockFont(next){if(!CLOCK_FONTS[next])return;clockFont=next;$('clock-font').value=clockFont;document.documentElement.style.setProperty('--clock-font',CLOCK_FONTS[clockFont]);persist();}
      $('clock-font').addEventListener('change',()=>setClockFont($('clock-font').value));
      $('wall-clock').addEventListener('click',event=>{if(event.target===$('ampm'))return;const index=CLOCK_FONT_ORDER.indexOf(clockFont);setClockFont(CLOCK_FONT_ORDER[(index+1)%CLOCK_FONT_ORDER.length]);});
      const resetDefaultsDialog=$('reset-defaults-dialog');
      function closeResetDefaults(restoreFocus=true){if(resetDefaultsDialog.open)hideFading(resetDefaultsDialog,()=>resetDefaultsDialog.close());if(restoreFocus)$('reset-defaults').focus({preventScroll:true});}
      async function applyFactoryDefaults(){
        const nextLanguage=detectedLanguage(),nextCopy=detectedCopyLanguage(),nextTimeZone=detectedTimeZone()||REGIONS[nextLanguage]?.timeZone||'UTC',request=++languageRequest;
        try{await hydrateLanguage(nextLanguage,nextCopy);}catch(error){if(request===languageRequest&&!disposed)toast(error.message);return;}
        if(request!==languageRequest||disposed)return;
        const mono=performance.now();closeResetDefaults(false);renderer.cancelCameraMotion(mono);renderer.stopAutoRotate(mono);
        for(const [key,value] of Object.entries(FACTORY_OPTIONS))renderer.setOption(key,value,false);
        window.SolarVisualEffects?.regenerateStars?.(renderer.sky);
        renderer.setBodyScales(FACTORY_BODY_SCALES);renderer.setSatelliteOrbitScales(FACTORY_ORBIT_SCALES);
        renderer.restoreCamera(renderer.defaultCameraSnapshot());renderer.setAutoRotate(FACTORY_AUTO_ROTATE,mono);overviewCamera=renderer.defaultCameraSnapshot();
        A.calibrateAt(Date.now());clock.now(mono);eclipseTargets.clear();alignmentTarget=null;renderer.setAlignmentGuide(null);renderer.invalidateSurfaces();
        timezone='local';showSeconds=false;hourCycle='12';clockFont='georgia';speedMode='day';speedValues={hour:1,day:1,year:1};language=nextLanguage;languageMode='auto';activeCopyCode=nextCopy;autoTimeZone=nextTimeZone;
        renderer.setSite(activeRegion());for(const [key,id] of Object.entries(validKeys))$(id).checked=renderer.options[key];
        $('show-seconds').checked=showSeconds;$('seconds-group').hidden=true;$('ampm').hidden=false;syncHourCycleUi();
        $('clock-font').value=clockFont;document.documentElement.style.setProperty('--clock-font',CLOCK_FONTS[clockFont]);
        translateStatic();refreshTimeFormats();refreshNavLabels();syncOrbitSpacingControl();syncOrbitBrightnessControl();syncStarDensityControl();syncSpeedUi();cameraUi();navVisibility();closeBody();lastWallKey='';uiNow();persist();toast(t('resetComplete'));
      }
      $('reset-defaults').addEventListener('click',()=>{showFading(resetDefaultsDialog,()=>resetDefaultsDialog.showModal());$('reset-defaults-no').focus({preventScroll:true});});
      $('reset-defaults-no').addEventListener('click',()=>closeResetDefaults());$('reset-defaults-yes').addEventListener('click',()=>applyFactoryDefaults().catch(fatal));
      UI.bindDialog(resetDefaultsDialog,options=>closeResetDefaults(options?.restoreFocus!==false));
      function reset() {cancelGesture();renderer.animateHome(performance.now(),1100);cameraUi();}
      $('fit-view').addEventListener('click',reset);
      $('camera-mode-toggle').addEventListener('click',()=>{renderer.setDollyMode(!renderer.options.dollyZoom,true);cameraUi();persist();});
      function zoom(factor) {
        const mono=performance.now(),state=renderer.cameraInputState(mono);
        if(renderer.options.dollyZoom)renderer.smoothDolly((state.dolly??1)*factor,renderer.selected,mono);
        else renderer.smoothZoom(state.zoom*factor,null,mono);
        cameraUi();
      }
      function focusBody(id) {
        if(!id)return;
        cancelGesture();renderer.animateFocus(id);cameraUi();
      }
      $('focus-body').addEventListener('click',()=>focusBody(renderer.selected));
      $('feature-view').addEventListener('click',()=>{const id=renderer.selected;if(!['earth','jupiter'].includes(id))return;cancelGesture();const region=activeRegion();renderer.animateFeature(id,id==='earth'?region.latitude:-22,id==='earth'?region.longitude:(window.SolarAssets.materialInfo?.jupiter?.feature?.longitude??70),clock.value(performance.now()));cameraUi();});
      function trackActiveRegion(){const region=activeRegion();cancelGesture();settings(false);renderer.animateFeature('earth',region.latitude,region.longitude,clock.value(performance.now()));cameraUi();}
      const regionReadout=$('timezone-button');regionReadout.setAttribute('role','button');regionReadout.tabIndex=0;
      regionReadout.addEventListener('click',trackActiveRegion);
      regionReadout.addEventListener('keydown',event=>{if(event.key!=='Enter'&&event.key!==' ')return;event.preventDefault();trackActiveRegion();});
      for(const [id,direction] of [['rotate-left',-1],['rotate-right',1]])$(id).addEventListener('click',()=>{
        renderer.setAutoRotate(renderer.autoRotateDirection===direction?0:direction,performance.now());cameraUi();persist();
      });
      $('random-rotate').addEventListener('click',()=>{
        renderer.setRandomRotate(!renderer.randomRotateEnabled,performance.now());cameraUi();persist();
      });
      let fullscreenBusy=false;
      async function exitFullscreen() {
        if(!document.fullscreenElement||fullscreenBusy)return;
        fullscreenBusy=true;
        try{await document.exitFullscreen();}
        catch(_){toast(t('fullscreenExitFailed'));}
        finally{fullscreenBusy=false;}
      }
      async function fullscreen() {
        if(document.fullscreenElement)return exitFullscreen();
        if(fullscreenBusy)return;
        if(!document.documentElement.requestFullscreen){toast(t('fullscreenUnsupported'));return;}
        fullscreenBusy=true;
        try{await document.documentElement.requestFullscreen();}
        catch(_){toast(t('fullscreenOpenFailed'));}
        finally{fullscreenBusy=false;}
      }
      $('fullscreen-button').addEventListener('click',fullscreen);
      document.addEventListener('fullscreenchange',()=>{
        $('fullscreen-button').setAttribute('aria-label',t(document.fullscreenElement?'fullscreenExit':'fullscreen'));
        $('fullscreen-button').title=t(document.fullscreenElement?'fullscreenExit':'fullscreen')+' · F';
        refreshViewport();
      });
      function handleEscape() {
        // Fullscreen always exits on the first short press; remaining UI closes step by step.
        if(document.fullscreenElement){exitFullscreen();return;}
        if(!$('language-menu').hidden){closeLanguageMenu();return;}
        if(UI.dismissTopDialog())return;
        if(zen){setZen(false);return;}
        settings(false);closeBody();
      }
      // A single idle owner controls the cursor, complete toolbar and hit/tab targets.
      const viewControls=$('view-controls'),idleDelay=1800;
      function showAwake(value) {
        const awake=zen&&value&&!disposed&&!document.hidden;
        // Prepare the lens number before the toolbar becomes visible; otherwise
        // the output can miss the first compositor paint of the fade-in.
        if(awake)cameraUi();
        document.body.classList.toggle('pointer-awake',awake);
        // Move keyboard focus out before hiding/inerting the action group. The
        // programmatic canvas focus below must not wake it again (see focusin).
        if(zen&&!awake&&viewControls.contains(document.activeElement))$('universe').focus({preventScroll:true});
        viewControls.inert=zen&&!awake;
        viewControls.setAttribute('aria-hidden',String(zen&&!awake));
      }
      function clearAwake() {clearTimeout(awakeTimer);awakeTimer=undefined;showAwake(false);}
      function wakePointer(event) {
        if(event?.type==='focusin'&&event.target===$('universe'))return;
        clearTimeout(awakeTimer);awakeTimer=undefined;
        if(!zen||disposed||document.hidden)return;
        showAwake(true);
        if(pointers.size||event?.buttons||presetDialog.open)return; // Keep controls awake throughout a held drag/pinch.
        awakeTimer=setTimeout(()=>{awakeTimer=undefined;showAwake(false);},idleDelay);
      }
      function setZen(value) {
        if(value)UI.dismissAll();else closePresetDialog(false);
        zen=!!value;clearAwake();document.body.classList.toggle('zen',zen);
        $('zen-toggle').setAttribute('aria-pressed',String(zen));$('zen-toggle').setAttribute('aria-label',t(zen?'zenOff':'zenOn'));$('zen-toggle').title=t(zen?'normalMode':'zenMode')+' · H';
        // Keep the complete clock/date/timezone block pixel-identical in zen mode.
        // One timezone element is shared by both modes, so SEOUL/UTC never swaps or disappears.
        for(const el of document.querySelectorAll('.ui,#timezone-button'))el.inert=zen;
        renderer.hover=null;
        if(zen){$('universe').focus({preventScroll:true});wakePointer();}
        else {$('zen-toggle').focus({preventScroll:true});viewControls.inert=false;viewControls.setAttribute('aria-hidden','false');}
      }
      $('zen-toggle').addEventListener('click',()=>setZen(!zen));
      for(const event of ['pointermove','pointerdown','pointerup','pointercancel','wheel','keydown','focusin'])document.addEventListener(event,wakePointer,{passive:true});
      const helpDialog=$('help-dialog');
      const helpScroll=$('help-scroll');
      const kakaoPayDialog=$('kakao-pay-dialog');
      function closeKakaoPay(restoreFocus=true){if(kakaoPayDialog.open)hideFading(kakaoPayDialog,()=>kakaoPayDialog.close());if(restoreFocus)$('kakao-pay-link').focus({preventScroll:true});}
      $('kakao-pay-link').addEventListener('click',event=>{event.preventDefault();if(!kakaoPayDialog.open)showFading(kakaoPayDialog,()=>kakaoPayDialog.showModal());});
      kakaoPayDialog.querySelector('form').addEventListener('submit',event=>{event.preventDefault();closeKakaoPay();});
      UI.bindDialog(kakaoPayDialog,options=>closeKakaoPay(options?.restoreFocus!==false));
      const updateHelpScrollCues=bindScrollCues(helpDialog,helpScroll);
      let releaseNotesApi=null,releaseNotesNavigator=null;
      function loadReleaseNotes(){
        if(releaseNotesApi)return Promise.resolve(releaseNotesApi);
        return UI.loadScript('src/release-notes.js?v=0.53-r1','SolarReleaseNotes').then(api=>{if(!releaseNotesApi){releaseNotesApi=api;releaseNotesNavigator=api.createReleaseNotesNavigator();}return releaseNotesApi;});
      }
      function formatReleaseNotesBytes(bytes){const value=Math.max(0,Number(bytes)||0);return value<1024?value+' B':(value/1024).toFixed(1)+' KB';}
      function renderReleaseNotes(state=releaseNotesNavigator?.current()){
        if(!releaseNotesApi||!releaseNotesNavigator)return;const release=state?.release;if(!release)return;
        $('release-notes-version').textContent='v'+release.version;
        $('release-notes-date').textContent=release.date||'';
        $('release-notes-size').textContent=formatReleaseNotesBytes(releaseNotesApi.SOURCE_BYTES);
        const fragment=document.createDocumentFragment();
        for(const item of releaseNotesApi.itemsFor(release,copyLanguage()).slice(0,10)){const row=document.createElement('li');row.textContent=item;fragment.append(row);}
        $('release-notes-list').replaceChildren(fragment);
        $('release-notes-position').textContent=`${state.index+1} / ${state.total}`;
        $('release-notes-newer').disabled=!state.hasNewer;$('release-notes-older').disabled=!state.hasOlder;
        requestAnimationFrame(updateHelpScrollCues);
      }
      function setReleaseNotes(open){
        const next=!!open,toggle=$('release-notes-toggle');
        $('release-notes-panel').hidden=!next;toggle.setAttribute('aria-expanded',String(next));
        if(next)renderReleaseNotes();requestAnimationFrame(updateHelpScrollCues);
      }
      $('release-notes-toggle').addEventListener('click',async()=>{
        const next=$('release-notes-toggle').getAttribute('aria-expanded')!=='true';
        if(next)try{await loadReleaseNotes();if(releaseNotesNavigator)renderReleaseNotes(releaseNotesNavigator.reset());}catch(error){toast(error.message);return;}
        setReleaseNotes(next);
      });
      $('release-notes-newer').addEventListener('click',()=>renderReleaseNotes(releaseNotesNavigator?.newer()));
      $('release-notes-older').addEventListener('click',()=>renderReleaseNotes(releaseNotesNavigator?.older()));
      function help(open){
        const next=open===undefined?!uiElementVisible(helpDialog):open;
        if(next&&!helpDialog.open){
          setReleaseNotes(false);showFading(helpDialog,()=>helpDialog.show());helpScroll.scrollTop=0;updateHelpScrollCues();requestAnimationFrame(updateHelpScrollCues);
          $('help-button').focus({preventScroll:true});
        }else if(next)showFading(helpDialog);else if(helpDialog.open)hideFading(helpDialog,()=>helpDialog.close());
        $('help-button').setAttribute('aria-expanded',String(next));
      }
      $('help-button').addEventListener('click',()=>help());
      helpDialog.querySelector('form').addEventListener('submit',event=>{event.preventDefault();help(false);});
      window.addEventListener('resize',()=>{for(const update of scrollCueUpdates)update();},{passive:true});
      helpDialog.addEventListener('close',()=>$('help-button').setAttribute('aria-expanded','false'));
      UI.bindDialog(helpDialog,()=>help(false),{backdrop:false});
      let languageRequest=0;
      async function setLanguage(next){
        const automatic=next==='auto',target=automatic?detectedLanguage():next,mode=automatic?'auto':'manual';
        const targetCopy=automatic?detectedCopyLanguage():(LANG_META[target]?.copy||'kor');
        const targetTimeZone=automatic?(detectedTimeZone()||REGIONS[target]?.timeZone||'UTC'):autoTimeZone;
        if(!LANG_ORDER.includes(target))return;
        const request=++languageRequest;
        if(target===language&&mode===languageMode&&targetCopy===activeCopyCode&&(!automatic||targetTimeZone===autoTimeZone)){persist();return;}
        try{await hydrateLanguage(target,targetCopy);}catch(error){if(request===languageRequest&&!disposed)toast(error.message);return;}
        if(request!==languageRequest||disposed)return;
        language=target;languageMode=mode;activeCopyCode=targetCopy;if(automatic)autoTimeZone=targetTimeZone;renderer.setSite(activeRegion());translateStatic();renderReleaseNotes();refreshTimeFormats();lastWallKey='';
        refreshNavLabels();presetUi();cameraUi();syncSpeedUi();
        if(presetAction){const value=cameraPresets[presetAction.index];$('preset-title').textContent=t('presetTitle',{n:presetAction.index+1});$('preset-note').textContent=t(value?'presetSavedNote':'presetEmptyNote');}
        const selected=bodies.find(body=>body.id===renderer.selected);
        if(selected){const copy=bodyCopy(selected);$('body-name').textContent=copy.name;$('body-description').textContent=copy.description;$('feature-view').textContent=selected.id==='earth'?t('koreaView',{region:activeRegion().region}):t('stormView');syncBodySizeControl(selected);syncEclipseControl(selected.id);syncAlignmentControl(selected.id);updateBody(clock.value(performance.now()));}
        uiNow();persist();if(helpDialog.open)requestAnimationFrame(updateHelpScrollCues);
      }
      const languageControl=$('language-control'),languageMenu=$('language-menu'),languageScroll=$('language-scroll'),languageToggle=$('language-toggle');
      const updateLanguageScrollCues=bindScrollCues(languageMenu,languageScroll);
      function openLanguageMenu(){
        showFading(languageMenu);languageToggle.setAttribute('aria-expanded','true');updateLanguageScrollCues();requestAnimationFrame(updateLanguageScrollCues);
        const current=languageMode==='auto'?languageMenu.querySelector('[data-language-auto]'):languageMenu.querySelector(`[data-language="${language}"]`);requestAnimationFrame(()=>{current?.scrollIntoView({block:'nearest'});current?.focus({preventScroll:true});updateLanguageScrollCues();});
      }
      function closeLanguageMenu(returnFocus=false){hideFading(languageMenu);languageToggle.setAttribute('aria-expanded','false');if(returnFocus)languageToggle.focus({preventScroll:true});}
      UI.bindPopup(languageMenu,()=>closeLanguageMenu());
      languageToggle.addEventListener('click',()=>uiElementVisible(languageMenu)?closeLanguageMenu():openLanguageMenu());
      languageMenu.querySelector('[data-language-auto]').addEventListener('click',()=>{closeLanguageMenu(true);setLanguage('auto');});
      for(const option of languageMenu.querySelectorAll('[data-language]'))option.addEventListener('click',()=>{const next=option.dataset.language;closeLanguageMenu(true);setLanguage(next);});
      window.addEventListener('languagechange',()=>{if(disposed)return;if(languageMode==='auto')setLanguage('auto').catch(fatal);else translateStatic();});
      const refreshAutomaticContext=()=>{if(!disposed&&languageMode==='auto')setLanguage('auto').catch(fatal);};
      languageMenu.addEventListener('keydown',event=>{
        const options=[...languageMenu.querySelectorAll('[role="menuitemradio"]')],index=options.indexOf(document.activeElement);let next=-1;
        if(event.key==='ArrowDown')next=(index+1)%options.length;else if(event.key==='ArrowUp')next=(index-1+options.length)%options.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=options.length-1;else return;
        event.preventDefault();options[next].focus({preventScroll:true});options[next].scrollIntoView({block:'nearest'});updateLanguageScrollCues();
      });
      document.addEventListener('pointerdown',event=>{if(uiElementVisible(languageMenu)&&!languageControl.contains(event.target))closeLanguageMenu();});
      const canvas=$('universe'),pointers=new Map();
      let drag=null,pinchDistance=0,pinchLevel=1,pinchOrigin=null,pinched=false,clickGestures=0;
      function cancelGesture() {
        const ids=[...pointers.keys()];pointers.clear();drag=null;pinched=false;clickGestures=0;pinchDistance=0;pinchOrigin=null;
        for(const id of ids)if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
        canvas.classList.remove('dragging');canvas.style.cursor='grab';
      }
      function pointerPosition(event) {const r=canvas.getBoundingClientRect();return {x:event.clientX-r.left,y:event.clientY-r.top};}
      canvas.addEventListener('pointerdown',event=>{
        if(event.pointerType==='mouse'&&event.button!==0&&event.button!==1&&event.button!==2)return;
        // Preserve the active rotation mode. Manual deltas add to its current view.
        renderer.cancelCameraTween(performance.now());
        const pan=event.pointerType==='mouse'&&event.button===1,dolly=event.pointerType==='mouse'&&event.button===2;
        if(pan||dolly)event.preventDefault();
        const p=pointerPosition(event);pointers.set(event.pointerId,p);canvas.setPointerCapture(event.pointerId);
        if(pointers.size===1){drag={x:p.x,y:p.y,startX:p.x,startY:p.y,startPanY:renderer.camera.panY,startPanX:renderer.camera.panX,startDolly:renderer.camera.dolly??1,mode:pan?'pan':dolly?'dolly':'orbit',moved:false};pinched=false;}
        if(zen&&pointers.size===3){setZen(false);pinched=true;if(drag)drag.moved=true;return;}
        if(pointers.size===2){clickGestures=0;const [a,b]=[...pointers.values()];pinchDistance=Math.hypot(a.x-b.x,a.y-b.y);pinchLevel=renderer.options.dollyZoom?(renderer.camera.dolly??1):renderer.camera.zoom;pinchOrigin={x:(a.x+b.x)/2,y:(a.y+b.y)/2,panX:renderer.camera.panX,panY:renderer.camera.panY};pinched=true;}
      });
      canvas.addEventListener('pointermove',event=>{
        const p=pointerPosition(event);
        if(!pointers.has(event.pointerId)) {renderer.hover=zen?null:renderer.hit(p.x,p.y);canvas.style.cursor=renderer.hover?'pointer':'grab';return;}
        pointers.set(event.pointerId,p);
        if(pointers.size>=2) {
          const [a,b]=[...pointers.values()];if(pinchDistance>0){const level=pinchLevel*Math.hypot(a.x-b.x,a.y-b.y)/pinchDistance;if(renderer.options.dollyZoom)renderer.setDolly(level,renderer.selected);else renderer.setZoom(level);}if(pinchOrigin){const centerX=(a.x+b.x)/2,centerY=(a.y+b.y)/2;renderer.setPan(pinchOrigin.panX+(centerX-pinchOrigin.x)/renderer.w,pinchOrigin.panY+(centerY-pinchOrigin.y)/renderer.h);}cameraUi();if(drag)drag.moved=true;return;
        }
        if(!drag)return;
        const wasMoved=drag.moved,dx=p.x-drag.x,dy=p.y-drag.y;
        if(Math.hypot(p.x-drag.startX,p.y-drag.startY)>4)drag.moved=true;
        if(drag.moved&&!pinched){
          if(drag.mode==='pan')renderer.setPan(drag.startPanX+(p.x-drag.startX)/renderer.w,drag.startPanY+(p.y-drag.startY)/renderer.h);
          else if(drag.mode==='dolly')renderer.setDolly(drag.startDolly*Math.exp((drag.startY-p.y)*.006),renderer.selected);
          else renderer.rotateViewBy((wasMoved?dx:p.x-drag.startX)*.004,(wasMoved?dy:p.y-drag.startY)*.003,performance.now());
          cameraUi();canvas.classList.add('dragging');canvas.style.cursor=drag.mode==='pan'?'move':drag.mode==='dolly'?'ns-resize':'grabbing';
        }
        drag.x=p.x;drag.y=p.y;
      });
      function endPointer(event,cancel=false) {
        if(!pointers.has(event.pointerId))return;const p=pointerPosition(event);pointers.delete(event.pointerId);
        const clicked=!cancel&&!pinched&&drag&&drag.mode==='orbit'&&!drag.moved&&pointers.size===0;
        // Pointer capture can still produce a native dblclick after a short drag.
        // Tracking is intentional only when BOTH completed gestures were clicks.
        clickGestures=clicked?Math.min(2,clickGestures+1):0;
        if(clicked){if(!zen)selectBody(renderer.hit(p.x,p.y));settings(false);}
        if(pointers.size===0){drag=null;pinched=false;canvas.classList.remove('dragging');canvas.style.cursor='grab';persist();}
        else if(drag){const last=[...pointers.values()][0];drag.x=last.x;drag.y=last.y;drag.moved=true;}
        if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
      }
      // Suppress middle-button autoscroll and right-button browser menus only over the viewport.
      for(const type of ['mousedown','auxclick'])canvas.addEventListener(type,event=>{if(event.button===1||event.button===2)event.preventDefault();});
      canvas.addEventListener('contextmenu',event=>event.preventDefault());
      canvas.addEventListener('pointerup',event=>endPointer(event));canvas.addEventListener('pointercancel',event=>endPointer(event,true));
      canvas.addEventListener('lostpointercapture',event=>{pointers.delete(event.pointerId);if(!pointers.size){drag=null;canvas.classList.remove('dragging');wakePointer();}});
      canvas.addEventListener('pointerleave',()=>{if(!pointers.size)renderer.hover=null;});
      canvas.addEventListener('wheel',event=>{event.preventDefault();zoom(Math.exp(-A.clamp(event.deltaY,-120,120)*.0017));},{passive:false});
      canvas.addEventListener('dblclick',event=>{if(event.button!==0||clickGestures<2)return;clickGestures=0;const p=pointerPosition(event),id=renderer.hit(p.x,p.y);if(id)focusBody(id);});
      window.addEventListener('keydown',event=>{
        if(disposed)return;
        if(event.key==='Escape'||event.code==='Escape'){
          // Outside the Web Fullscreen API, leave the native Escape action available.
          // This lets Chrome/Edge exit --start-fullscreen with one short press.
          if(document.fullscreenElement||UI.topDialog()){event.preventDefault();event.stopImmediatePropagation();}
          if(!event.repeat)handleEscape();return;
        }
        // Do not take OS/browser shortcut combinations or interrupt an IME composition.
        if(event.ctrlKey||event.metaKey||event.altKey||event.isComposing)return;
        const physical=event.code||'',key=/^Key[A-Z]$/.test(physical)?physical.slice(3).toLowerCase():event.key.toLowerCase();
        const digit=/^(?:Digit|Numpad)[123]$/.test(physical)?physical.slice(-1):/^[123]$/.test(key)?key:null;
        const editing=!!event.target.closest?.('input,select,textarea,[contenteditable]:not([contenteditable="false"])');
        if(digit){
          // Always recall while the app has focus, including open dialogs/fields.
          // In a field, keep native numeric entry; preset recall should not swallow typed digits.
          if(!editing)event.preventDefault();event.stopPropagation();
          if(!event.repeat){if(presetDialog.open)closePresetDialog(false);recallPreset(Number(digit)-1);wakePointer();}
          return;
        }
        if(event.repeat||editing)return;
        if(key==='f'||key==='h'||key==='0'){
          event.preventDefault();event.stopPropagation();
          if(key==='f')fullscreen();else if(key==='h')setZen(!zen);else reset();return;
        }
        if(presetDialog.open||$('help-dialog').open||event.target.closest?.('button,a'))return;
        if(key===' '){event.preventDefault();pause();}
        else if(key==='r')now();
        else if(key==='+'||key==='='){event.preventDefault();zoom(1.15);}
        else if(key==='-'){event.preventDefault();zoom(1/1.15);}
        else if(event.target===canvas&&['arrowleft','arrowright','arrowup','arrowdown'].includes(key)) {
          event.preventDefault();let azimuth=renderer.camera.azimuth,elevation=renderer.camera.elevation;
          if(key==='arrowleft')azimuth-=.08;if(key==='arrowright')azimuth+=.08;
          if(key==='arrowup')elevation+=3*A.DEG;if(key==='arrowdown')elevation-=3*A.DEG;
          renderer.setOrbitView(azimuth,elevation);cameraUi();persist();
        }
      },{capture:true});
      // Finish the first direct-GPU texture upload under the loading cover. The
      // shader and embedded textures are then already warm when the user rotates.
      async function warmInitialScene(maxMs=1200) {
        const started=performance.now();
        while(performance.now()-started<maxMs){
          const surface=renderer.surface;if(surface?.stats?.accepted>0&&!surface.inflight)return true;
          await new Promise(resolve=>setTimeout(resolve,16));
        }
        return false;
      }
      let materialRefreshTimer=0;
      function scheduleMaterialRefresh(){
        materialRefreshTimer=setTimeout(()=>{
          materialRefreshTimer=0;
          const run=()=>{if(!disposed)materials.load();};
          if(typeof requestIdleCallback==='function')requestIdleCallback(run,{timeout:3000});else run();
        },2200);
      }
      // Optional public planet maps refresh quietly after the first interactive window.
      let resizeFrame=0,viewportRevision=0;
      const viewportLayers=[$('planet-layer'),$('universe')];
      function holdViewportLayers(){for(const layer of viewportLayers)layer.classList.add('viewport-resizing');}
      function revealViewportLayers(){for(const layer of viewportLayers)layer.classList.remove('viewport-resizing');}
      function prepareViewportFrame(mono){
        // Resize, fully redraw and submit the GPU layer while both foreground
        // canvases are hidden. This prevents an old-size ring/orbit buffer from
        // becoming visible for one frame during browser-level F11 transitions.
        renderer.resize();renderer.draw(clock.value(mono,Date.now()),effectTime,mono);renderer.gpu?.flush?.();cameraUi();
      }
      function scheduleViewportSettle(){
        if(resizeFrame)return;
        let paintedRevision=-1,stablePaints=0;
        const paint=mono=>{
          resizeFrame=0;if(disposed)return;
          const revision=viewportRevision;prepareViewportFrame(mono);
          if(revision===paintedRevision)stablePaints++;else {paintedRevision=revision;stablePaints=1;}
          if(stablePaints<2||revision!==viewportRevision){resizeFrame=requestAnimationFrame(paint);return;}
          // Wait one compositor frame after two complete same-size renders. Any
          // late F11 resize restarts settling instead of revealing stale buffers.
          resizeFrame=requestAnimationFrame(()=>{
            resizeFrame=0;if(disposed)return;
            if(paintedRevision!==viewportRevision){scheduleViewportSettle();return;}
            revealViewportLayers();
          });
        };
        resizeFrame=requestAnimationFrame(paint);
      }
      function refreshViewport(){
        holdViewportLayers();viewportRevision++;renderer.resize();cameraUi();scheduleViewportSettle();
      }
      window.addEventListener('resize',refreshViewport,{passive:true});
      const frameGate=window.SolarPerformance.createFrameGate();
      function frame(mono) {
        if(disposed||document.hidden){raf=0;return;}
        raf=requestAnimationFrame(frame);
        const activeMotion=!!drag||pointers.size>0||!!renderer.cameraTween||!!renderer.autoRotation||
          mono-(renderer.cameraChangeAt??-Infinity)<180||(!clock.live&&!clock.paused);
        const frameInterval=window.SolarPerformance?.frameInterval(window.innerWidth,window.innerHeight,activeMotion)??(1000/(activeMotion&&window.innerWidth>=680?60:30));
        const frameDelta=lastFrame?Math.max(0,mono-lastFrame):frameInterval;
        if(!frameGate(mono,frameInterval,!lastFrame))return;
        const dt=lastFrame?frameDelta/1000:0;lastFrame=mono;
        window.SolarPerformance?.reportFrameTiming?.(frameDelta,frameInterval);
        if(!clock.paused)effectTime+=dt;
        const wall=Date.now(),ms=clock.value(mono,wall);
        if(!clock.paused&&!clock.live&&ms>=A.MAX_TIME){clock.anchorMs=A.MAX_TIME;clock.anchorMono=mono;clock.paused=true;toast(t('yearLimit'));}
        try {
          const wasTransitioning=!!renderer.cameraTween,renderStarted=performance.now();
          renderer.draw(ms,effectTime,mono);window.SolarPerformance?.reportRenderCost(performance.now()-renderStarted);
          if(wasTransitioning||renderer.cameraTween)cameraUi();
          if(wasTransitioning&&!renderer.cameraTween)persist();
          if(mono-lastUi>200){lastUi=mono;updateWall(wall);updateControls(ms);cameraUi();if(renderer.selected)updateBody(ms);}
        } catch(error){disposed=true;setMusicEnabled(false);UI.dispose();music.dispose();renderer.dispose();materials.dispose();cancelAnimationFrame(raf);cancelAnimationFrame(resizeFrame);clearAwake();clearTimeout(toastTimer);clearTimeout(materialRefreshTimer);fatal(error);}
      }
      document.addEventListener('visibilitychange',()=>{
        if(document.hidden){closePresetDialog(false);renderer.suspend();cancelAnimationFrame(raf);raf=0;lastFrame=0;clearAwake();}
        else if(!disposed){
          renderer.resume();
          refreshAutomaticContext();
          if(viewportLayers.some(layer=>layer.classList.contains('viewport-resizing')))refreshViewport();
          if(!raf){lastFrame=0;uiNow();wakePointer();raf=requestAnimationFrame(frame);}
        }
      });
      window.addEventListener('pagehide',event=>{closePresetDialog(false);setMusicEnabled(false);materials.cancel();if(event.persisted)renderer.suspend();else {disposed=true;UI.dispose();music.dispose();renderer.dispose();materials.dispose();}cancelAnimationFrame(raf);cancelAnimationFrame(resizeFrame);resizeFrame=0;raf=0;lastFrame=0;clearAwake();clearTimeout(toastTimer);clearTimeout(materialRefreshTimer);materialRefreshTimer=0;});
      window.addEventListener('pageshow',event=>{if(!disposed&&!document.hidden){renderer.resume();refreshAutomaticContext();if(event.persisted){refreshViewport();scheduleMaterialRefresh();}else if(viewportLayers.some(layer=>layer.classList.contains('viewport-resizing')))refreshViewport();if(!raf){lastFrame=0;wakePointer();raf=requestAnimationFrame(frame);}}});
      window.addEventListener('focus',refreshAutomaticContext,{passive:true});
      // A small, documented inspection surface for automated tests and future development.
      window.SolarTime=Object.freeze({version:'0.53',revision:'r1',translate:t,clock,renderer,materials,calibrationMs,setLanguage,getPresets:()=>cameraPresets.map(v=>v?{...v}:null),getModel:()=>A.modelStatus(),getState:()=>({fullscreen:!!document.fullscreenElement,escapeLock:'native',simulationMs:clock.value(performance.now()),wallMs:Date.now(),rate:clock.rate,live:clock.live,paused:clock.paused,timezone,timeZone:activeTimeZone(),region:activeRegion().label,showSeconds,hourCycle,clockFont,starDensity:renderer.options.starDensity,earthNightLights:renderer.options.earthNightLights!==false,randomRotate:renderer.randomRotateEnabled,language,copyLanguage:copyLanguage(),languageMode,zen,musicEnabled:music.enabled,musicTrack:music.track,effectTime,frameCount:renderer.frameCount})});
      uiNow();
      const bootMono=performance.now(),bootMs=clock.value(bootMono);renderer.draw(bootMs,0,bootMono);
      await warmInitialScene();
      if(!disposed){const revealMono=performance.now();renderer.startOrbitReveal(revealMono);renderer.draw(clock.value(revealMono),0,revealMono);$('loading').classList.add('done');setTimeout(()=>$('loading').hidden=true,450);scheduleMaterialRefresh();}
      if(!document.hidden&&!disposed)raf=requestAnimationFrame(frame);
    } catch(error){fatal(error);}
  }
  requestAnimationFrame(()=>setTimeout(init,0));
})();
