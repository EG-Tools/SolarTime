/* Solar Time v0.45 r9 — optimized sky layers and expanded regional languages. */
(function () {
  'use strict';
  const $=id=>document.getElementById(id), A=window.SolarAstro,Modules=window.SolarModules;
  const Localization=Modules.Localization,LanguageData=Modules.LanguageData,Preferences=Modules.Preferences,UI=Modules.UI;
  const STORAGE_KEY='eg.solar-time.v0.01';
  const LANG_ORDER=['kor','en','chn','jpn','eu','hi','es','de','fr','pt','br','it','mx'];
  const LANG_META={
    kor:{code:'KOR',name:'한국어',locale:'ko-KR',html:'ko',copy:'kor'},
    en:{code:'EN',name:'English',locale:'en-US',html:'en',copy:'en'},
    chn:{code:'CHN',name:'中文',locale:'zh-CN',html:'zh-Hans',copy:'chn'},
    jpn:{code:'JPN',name:'日本語',locale:'ja-JP',html:'ja',copy:'jpn'},
    eu:{code:'EU',name:'Europe',locale:'en-GB',html:'en-GB',copy:'en'},
    hi:{code:'HI',name:'हिन्दी',locale:'hi-IN',html:'hi',copy:'hi'},
    es:{code:'ES',name:'Español',locale:'es-ES',html:'es',copy:'es'},
    de:{code:'DE',name:'Deutsch',locale:'de-DE',html:'de',copy:'de'},
    fr:{code:'FR',name:'Français',locale:'fr-FR',html:'fr',copy:'fr'},
    pt:{code:'PT',name:'Portugal',locale:'pt-PT',html:'pt-PT',copy:'pt'},
    br:{code:'BR',name:'Brasil',locale:'pt-BR',html:'pt-BR',copy:'pt'},
    it:{code:'IT',name:'Italia',locale:'it-IT',html:'it',copy:'it'},
    mx:{code:'MX',name:'México',locale:'es-MX',html:'es-MX',copy:'es'}
  };
  const REGIONS={
    kor:{label:'KOREA',timeZone:'Asia/Seoul',latitude:37.5665,longitude:126.978,region:'한국',city:'서울'},
    en:{label:'USA',timeZone:'America/New_York',latitude:39.8283,longitude:-98.5795,region:'United States',city:'mainland center'},
    chn:{label:'CHINA',timeZone:'Asia/Shanghai',latitude:35.8617,longitude:104.1954,region:'中国',city:'国土中心'},
    jpn:{label:'JAPAN',timeZone:'Asia/Tokyo',latitude:35.6762,longitude:139.6503,region:'日本',city:'東京'},
    eu:{label:'EUROPE',timeZone:'Europe/Berlin',latitude:50.1109,longitude:8.6821,region:'Europe',city:'central Europe'},
    hi:{label:'INDIA',timeZone:'Asia/Kolkata',latitude:22.5937,longitude:78.9629,region:'भारत',city:'देश का केंद्र'},
    es:{label:'SPAIN',timeZone:'Europe/Madrid',latitude:40.4637,longitude:-3.7492,region:'España',city:'centro geográfico'},
    de:{label:'GERMANY',timeZone:'Europe/Berlin',latitude:51.1657,longitude:10.4515,region:'Deutschland',city:'geografische Mitte'},
    fr:{label:'FRANCE',timeZone:'Europe/Paris',latitude:46.2276,longitude:2.2137,region:'France',city:'centre géographique'},
    pt:{label:'PORTUGAL',timeZone:'Europe/Lisbon',latitude:39.3999,longitude:-8.2245,region:'Portugal',city:'centro de Portugal'},
    br:{label:'BRAZIL',timeZone:'America/Sao_Paulo',latitude:-14.235,longitude:-51.9253,region:'Brasil',city:'centro do Brasil'},
    it:{label:'ITALY',timeZone:'Europe/Rome',latitude:41.8719,longitude:12.5674,region:'Italia',city:"centro d'Italia"},
    mx:{label:'MEXICO',timeZone:'America/Mexico_City',latitude:23.6345,longitude:-102.5528,region:'México',city:'centro de México'}
  };
  const STAR_DENSITY_COPY=Object.freeze({
    kor:Object.freeze({label:'별 밀도',aria:'파티클 별 밀도. 0이면 파티클 별을 숨깁니다.'}),
    en:Object.freeze({label:'Star density',aria:'Particle star density. Zero hides particle stars.'}),
    chn:Object.freeze({label:'星星密度',aria:'粒子星星密度。设为 0 时隐藏粒子星星。'}),
    jpn:Object.freeze({label:'星の密度',aria:'パーティクル星の密度。0 にするとパーティクル星を非表示にします。'}),
    eu:Object.freeze({label:'Star density',aria:'Particle star density. Zero hides particle stars.'}),
    hi:Object.freeze({label:'तारों का घनत्व',aria:'पार्टिकल तारों का घनत्व। 0 पर पार्टिकल तारे छिप जाते हैं।'}),
    es:Object.freeze({label:'Densidad de estrellas',aria:'Densidad de estrellas de partículas. Cero oculta las estrellas de partículas.'}),
    de:Object.freeze({label:'Sterndichte',aria:'Dichte der Partikelsterne. Bei 0 werden Partikelsterne ausgeblendet.'}),
    fr:Object.freeze({label:'Densité d’étoiles',aria:'Densité des étoiles particules. Zéro masque les étoiles particules.'}),
    pt:Object.freeze({label:'Densidade de estrelas',aria:'Densidade das estrelas de partículas. Zero oculta as estrelas de partículas.'}),
    br:Object.freeze({label:'Densidade de estrelas',aria:'Densidade das estrelas de partículas. Zero oculta as estrelas de partículas.'}),
    it:Object.freeze({label:'Densità stellare',aria:'Densità delle stelle particellari. Zero nasconde le stelle particellari.'}),
    mx:Object.freeze({label:'Densidad de estrellas',aria:'Densidad de estrellas de partículas. Cero oculta las estrellas de partículas.'})
  });
  const FACTORY_OPTIONS=Object.freeze({actualScale:false,overviewOrbitGap:86,orbitBrightness:.5,starDensity:1,dollyZoom:false,labels:true,avoidLabels:false,twinkle:true,activity:true,pluto:true,moon:true,skyMotion:true,comets:true,quality:'auto'});
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
  const detectedLanguage=Localization.detect;
  const COPY=Object.create(null),BODY_COPY=Object.create(null),PHASE_COPY=Object.create(null);
  async function hydrateLanguage(region){
    const code=LANG_META[region]?.copy||'kor',bundle=await LanguageData.load(code);
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
      let timezone='local',showSeconds=false,hourCycle='12',language=detectedLanguage(),zen=false,raf=0,lastFrame=0,effectTime=0,lastWallKey='',lastUi=0,disposed=false;
      let speedMode='day',speedValues={hour:1,day:1,year:1};
      const activeRegion=()=>REGIONS[language]||REGIONS.kor;
      const activeTimeZone=()=>timezone==='utc'?'UTC':activeRegion().timeZone;
      const copyLanguage=()=>LANG_META[language]?.copy||'kor';
      const t=(key,values)=>interpolate(COPY[copyLanguage()]?.[key]??COPY.kor?.[key]??key,values);
      const bodyCopy=body=>copyLanguage()==='kor'?{name:body.ko,description:body.description}:{name:BODY_COPY[copyLanguage()]?.[body.id]?.[0]||body.en,description:BODY_COPY[copyLanguage()]?.[body.id]?.[1]||body.description};
      const phaseCopy=name=>copyLanguage()==='kor'?name:(PHASE_COPY[copyLanguage()]?.[name]||name);
      const quantity=(value,unit)=>['en','hi','es','de','fr','pt','it'].includes(copyLanguage())?`${value} ${t(unit)}`:`${value}${t(unit)}`;
      const music=Modules.MusicPlayer.create({
        audio:$('background-music'),tracks:MUSIC_TRACKS,
        folder:/\/dist\/[^/]+\.html$/i.test(location.pathname)?'../assets/music/':'assets/music/',
        translate:t,notify:toast,button:$('music-toggle'),previous:$('music-previous'),next:$('music-next'),title:$('music-title'),now:$('music-now')
      });
      const musicUi=()=>music.refresh(),setMusicEnabled=value=>music.setEnabled(value);
      function translateStatic(){
        document.documentElement.lang=LANG_META[language].html;
        Localization.apply(document,t);
        const lang=$('language-toggle');lang.textContent=LANG_META[language].code;lang.setAttribute('aria-label',`${t('languageChange')}. ${LANG_META[language].name}`);lang.title=`${t('languageChange')} · ${LANG_META[language].code}`;
        const menu=$('language-menu');menu.setAttribute('aria-label',t('languageChange'));
        const starCopy=STAR_DENSITY_COPY[language]||STAR_DENSITY_COPY.kor;
        $('star-density-label').textContent=starCopy.label;$('star-density').setAttribute('aria-label',starCopy.aria);
        for(const option of menu.querySelectorAll('[data-language]'))option.setAttribute('aria-checked',String(option.dataset.language===language));
        for(const [id,key] of [['zoom-in','zoomIn'],['zoom-out','zoomOut']]){$(id).setAttribute('aria-label',t(key));$(id).title=t(key);}
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
      const validKeys={actualScale:'actual-scale',labels:'show-labels',avoidLabels:'avoid-labels',activity:'show-activity',pluto:'show-pluto',moon:'show-moon',comets:'show-comets'};
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
          if(LANG_ORDER.includes(saved.language))language=saved.language;
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
      await hydrateLanguage(language);
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
      function persist() {const camera=renderer.cameraSnapshot();if(camera.focus===null)overviewCamera={...camera,focus:null};Preferences.write(STORAGE_KEY,{...renderer.options,bodyScales:renderer.getBodyScales(),satelliteOrbitScales:renderer.getSatelliteOrbitScales(),autoRotateDirection:renderer.autoRotateDirection,timezone,showSeconds,hourCycle,clockFont,speedMode,speedValues,language,camera:overviewCamera,elevation:overviewCamera.elevation/A.DEG,panY:overviewCamera.panY,panX:overviewCamera.panX});}
      function cameraUi() {
        const controlState=renderer.cameraTween?.input?renderer.cameraTween.to:renderer.camera;
        const limits=renderer.zoomLimits,move=renderer.options.dollyZoom,level=move?(controlState.dolly??1):controlState.zoom;
        $('zoom-value').textContent=level.toFixed(1)+'×';
        $('zoom-value').setAttribute('aria-label',t(move?'moveValue':'zoomValue'));
        const mode=$('camera-mode-toggle'),modeLabel=t(move?'moveMode':'zoomMode');
        mode.dataset.mode=move?'move':'zoom';mode.setAttribute('aria-pressed',String(move));
        mode.setAttribute('aria-label',t('cameraModeAria',{mode:modeLabel}));mode.title=t('cameraMode',{mode:modeLabel});
        for(const [id,key] of [['zoom-in',move?'moveCloser':'zoomIn'],['zoom-out',move?'moveFarther':'zoomOut']]){$(id).setAttribute('aria-label',t(key));$(id).title=t(key);}
        $('zoom-in').disabled=level>=limits.maxZoom;$('zoom-out').disabled=level<=limits.minZoom;
        for(const [id,direction,label] of [['rotate-left',-1,t('rotateRight')],['rotate-right',1,t('rotateLeft')]]){
          const active=renderer.autoRotateDirection===direction,b=$(id);
          b.setAttribute('aria-pressed',String(active));b.setAttribute('aria-label',label+' '+t(active?'stop':'start'));
          b.title=t(active?'rotateRunning':'rotateRate',{direction:label});
        }
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
      presetDialog.addEventListener('cancel',event=>{event.preventDefault();handleEscape();});
      presetDialog.addEventListener('click',event=>{
        if(event.target!==presetDialog)return;const box=presetDialog.getBoundingClientRect();
        if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)closePresetDialog();
      });
      window.addEventListener('resize',()=>{closePresetDialog(false);if(!$('body-panel').hidden)anchorBodyPanel();},{passive:true});
      presetUi();
      const realFormat=()=>new Intl.DateTimeFormat(LANG_META[language].locale,{year:'numeric',month:'long',day:'numeric',weekday:'long',timeZone:activeTimeZone()});
      const partFormat=()=>new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',timeZone:activeTimeZone()});
      let dateFormatter=realFormat(),wallPartsFormatter=partFormat();
      const two=v=>String(v).padStart(2,'0');
      function refreshTimeFormats(){dateFormatter=realFormat();wallPartsFormatter=partFormat();}
      function dateParts(ms) {const values={};for(const part of wallPartsFormatter.formatToParts(new Date(ms)))if(part.type!=='literal')values[part.type]=Number(part.value);return {y:values.year,mo:values.month,d:values.day,h:values.hour,mi:values.minute,s:values.second};}
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
      function setStat(id,value,unit) {const el=$(id);el.replaceChildren(document.createTextNode(value+' '));if(unit){const small=document.createElement('small');small.textContent=unit;el.append(small);}}
      function updateBody(ms) {
        const b=bodies.find(v=>v.id===renderer.selected);if(!b)return;
        const material=window.SolarAssets.materialInfo?.[b.id];$('body-material').textContent=material?material.credit+' · '+t('photoMap'):b.id==='earth'?'NASA Blue Marble · '+t('builtInImage'):t('builtInMaterial')+' · '+t('publicPhotoUnavailable');
        if(b.id==='sun') {
          $('stat-label-one').textContent=t('representation');setStat('stat-value-one',t('star'),'');
          $('stat-label-two').textContent=t('systemCenter');setStat('stat-value-two','SUN','');
        } else if(b.id==='moon') {
          $('stat-label-one').textContent=t('earthOrbitPeriod');setStat('stat-value-one','27.32',t('dayUnit'));
          const phase=A.moonPhase(ms);$('stat-label-two').textContent=t('brightSide');setStat('stat-value-two',t('approximately',{value:Math.round(phase.fraction*100)}),'%');
        } else if(b.id==='europa') {
          $('stat-label-one').textContent=t('jupiterOrbitPeriod');setStat('stat-value-one','3.55',t('dayUnit'));
          $('stat-label-two').textContent=t('jupiterDistance');setStat('stat-value-two','671,000','km');
        } else {
          $('stat-label-one').textContent=t('orbitPeriod');setStat('stat-value-one',b.period>1000?(b.period/365.25).toFixed(1):b.period.toFixed(2),t(b.period>1000?'yearUnit':'dayUnit'));
          const p=A.positionAt(b,ms);$('stat-label-two').textContent=t('sunDistance');setStat('stat-value-two',Math.hypot(p.x,p.y,p.z).toFixed(2),'AU');
        }
        const environment=BODY_ENVIRONMENT[b.id]||BODY_ENVIRONMENT.earth,gravityRatio=environment.gravity/BODY_ENVIRONMENT.earth.gravity;
        $('stat-label-temperature').textContent=t('meanTemperature');setStat('stat-value-temperature',String(environment.mean),'°C');
        $('stat-temperature-range').textContent=t('temperatureRange',{min:environment.min,max:environment.max});
        $('stat-label-gravity').textContent=t('surfaceGravity');setStat('stat-value-gravity',environment.gravity.toFixed(environment.gravity<2?2:1),'m/s²');
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
        updateBody(clock.value(performance.now()));
        anchorBodyPanel();
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
        slider.setAttribute('aria-valuetext',speedText());
        const label=t(speedMode==='hour'?'hourUnit':speedMode==='day'?'dayUnit':'yearUnit');
        button.textContent=label;button.dataset.speedMode=speedMode;
        const active=!clock.live;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
        button.setAttribute('aria-label',t(active?'speedUnitActive':'speedUnitReady',{unit:label}));
      }
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
        $('speed-value').textContent=clock.paused?'PAUSED':clock.live?'1 ×':speedText();
        syncSpeedUi();
      }
      function uiNow() {const mono=performance.now(),wall=Date.now(),ms=clock.value(mono,wall);updateWall(wall);updateControls(ms);updateBody(ms);}
      function now() {A.calibrateAt(Date.now());renderer.invalidateSurfaces();clock.now(performance.now());uiNow();toast(t('returnedNow'));}
      $('live-button').addEventListener('click',now);
      $('speed-mode-button').addEventListener('click',()=>{
        // In live mode the first press activates the unit already shown instead of
        // skipping immediately to the next unit. Subsequent presses cycle units.
        if(clock.live){applySpeed();return;}
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
      function settings(open) {const next=open===undefined?!uiElementVisible(settingsPanel):open;if(next){showFading(settingsPanel);updateSettingsScrollCues();requestAnimationFrame(updateSettingsScrollCues);}else hideFading(settingsPanel);$('settings-button').setAttribute('aria-expanded',String(next));if(next)closeBody();}
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
        const mono=performance.now();closeResetDefaults(false);renderer.cancelCameraMotion(mono);renderer.stopAutoRotate(mono);
        for(const [key,value] of Object.entries(FACTORY_OPTIONS))renderer.setOption(key,value,false);
        window.SolarVisualEffects?.regenerateStars?.(renderer.sky);
        renderer.setBodyScales(FACTORY_BODY_SCALES);renderer.setSatelliteOrbitScales(FACTORY_ORBIT_SCALES);
        renderer.restoreCamera(renderer.defaultCameraSnapshot());renderer.setAutoRotate(FACTORY_AUTO_ROTATE,mono);overviewCamera=renderer.defaultCameraSnapshot();
        timezone='local';showSeconds=false;hourCycle='12';clockFont='georgia';speedMode='day';speedValues={hour:1,day:1,year:1};language=detectedLanguage();
        await hydrateLanguage(language);
        renderer.setSite(activeRegion());for(const [key,id] of Object.entries(validKeys))$(id).checked=renderer.options[key];
        $('show-seconds').checked=showSeconds;$('seconds-group').hidden=true;$('ampm').hidden=false;syncHourCycleUi();
        $('clock-font').value=clockFont;document.documentElement.style.setProperty('--clock-font',CLOCK_FONTS[clockFont]);
        translateStatic();refreshTimeFormats();refreshNavLabels();syncOrbitSpacingControl();syncOrbitBrightnessControl();syncStarDensityControl();syncSpeedUi();cameraUi();navVisibility();closeBody();lastWallKey='';uiNow();persist();toast(t('resetComplete'));
      }
      $('reset-defaults').addEventListener('click',()=>{showFading(resetDefaultsDialog,()=>resetDefaultsDialog.showModal());$('reset-defaults-no').focus({preventScroll:true});});
      $('reset-defaults-no').addEventListener('click',()=>closeResetDefaults());$('reset-defaults-yes').addEventListener('click',()=>applyFactoryDefaults().catch(fatal));
      resetDefaultsDialog.addEventListener('cancel',event=>{event.preventDefault();closeResetDefaults();});
      resetDefaultsDialog.addEventListener('click',event=>{if(event.target===resetDefaultsDialog)closeResetDefaults();});
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
      $('zoom-in').addEventListener('click',()=>zoom(1.2));$('zoom-out').addEventListener('click',()=>zoom(1/1.2));
      for(const [id,direction] of [['rotate-left',-1],['rotate-right',1]])$(id).addEventListener('click',()=>{
        renderer.setAutoRotate(renderer.autoRotateDirection===direction?0:direction,performance.now());cameraUi();persist();
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
        if(zen){setZen(false);return;}
        if(!$('language-menu').hidden){closeLanguageMenu();return;}
        if(resetDefaultsDialog.open){closeResetDefaults();return;}
        if(presetDialog.open){closePresetDialog();return;}
        if(kakaoPayDialog.open){closeKakaoPay();return;}
        if($('help-dialog').open){help(false);return;}
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
        closePresetDialog(false);zen=value;clearAwake();document.body.classList.toggle('zen',zen);
        $('zen-toggle').setAttribute('aria-pressed',String(zen));$('zen-toggle').setAttribute('aria-label',t(zen?'zenOff':'zenOn'));$('zen-toggle').title=t(zen?'normalMode':'zenMode')+' · H';
        // Keep the complete clock/date/timezone block pixel-identical in zen mode.
        // One timezone element is shared by both modes, so SEOUL/UTC never swaps or disappears.
        for(const el of document.querySelectorAll('.ui,#timezone-button'))el.inert=zen;
        renderer.hover=null;
        if(zen){closeBody();settings(false);clearTimeout(toastTimer);hideFading($('toast'));$('universe').focus({preventScroll:true});wakePointer();}
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
      kakaoPayDialog.addEventListener('cancel',event=>{event.preventDefault();closeKakaoPay();});
      kakaoPayDialog.addEventListener('click',event=>{if(event.target===kakaoPayDialog)closeKakaoPay();});
      const updateHelpScrollCues=bindScrollCues(helpDialog,helpScroll);
      const CURRENT_RELEASE=Object.freeze({version:'0.45',date:'2026.09.17'});
      const CURRENT_RELEASE_ITEMS=Object.freeze({
        kor:Object.freeze(['별 밀도 기본값을 100%로 조정하고 새로고침·재실행·초기화 때마다 별 위치를 새롭게 랜덤 배치하며, 크기·밝기·색상도 서로 독립적으로 랜덤화하고 황색 별 비중을 줄였습니다.','대부분의 별은 안정된 밝기를 유지하고 일부만 5~25초 범위로 느리고 불규칙하게 반짝이며, 아주 소수만 5~10초 동안 잠시 사라지거나 드물게 십자 광채를 냅니다.','태양 표면의 촘촘한 흐름 구조는 유지하면서 현재 효과에서 약 5% 더 낮춰 움직임을 조금 더 차분하게 조정했습니다.','목성의 실험적 제트·난류·대적점 셰이더를 제거하고 업그레이드 전 기본 가스행성 셰이더로 완전히 복원했습니다.','뷰포트에서 마우스 오른쪽 버튼을 누른 채 위아래로 드래그하면 휠 설정과 무관하게 카메라를 전진·후진할 수 있습니다.']),
        en:Object.freeze(['Star density now defaults to 100%; positions are randomized again on reload, restart and reset, while size, brightness and colour remain independently randomized.','Most stars remain steady; only some twinkle slowly and irregularly over 5–25 seconds, while a very small minority briefly disappear for 5–10 seconds or show rare cross flares.','The Sun keeps its fine flow structure while the current motion strength is reduced by another 5% for a calmer result.','Jupiter’s experimental jets, turbulence and Great Red Spot shader are removed, fully restoring the original gas-giant shader.','Dragging vertically with the right mouse button over the viewport now dollies the camera in and out independently of the wheel mode.']),
        chn:Object.freeze(['星星密度默认调整为 100%；页面刷新、重新启动或重置时都会重新随机分布星星位置，大小、亮度和颜色也保持彼此独立随机。','大多数星星保持稳定亮度，只有部分星星以 5～25 秒的周期缓慢且不规则地闪烁；极少数会短暂隐藏 5～10 秒或偶尔出现十字光芒。','太阳保留细密流动结构，并在当前效果基础上再降低约 5% 的运动强度。','移除木星实验性的喷流、湍流和大红斑着色效果，完全恢复升级前的基础气态巨行星着色器。','在视口中按住鼠标右键上下拖动，可不受滚轮模式影响直接前后移动相机。']),
        jpn:Object.freeze(['星の密度の初期値を 100% にし、再読み込み・再起動・初期化のたびに位置を再ランダム化し、大きさ・明るさ・色も独立してランダム化します。','大部分の星は安定した明るさを保ち、一部だけが 5～25 秒の範囲でゆっくり不規則に瞬きます。ごく少数だけが 5～10 秒消えたり、まれに十字光を見せます。','太陽は細かな流れを保ちながら、現在の表面運動をさらに約 5% 弱めました。','木星の実験的なジェット・乱流・大赤斑シェーダーを削除し、変更前の標準ガス惑星シェーダーへ完全に戻しました。','ビューポートで右ボタンを押したまま上下ドラッグすると、ホイール設定に関係なくカメラを前後移動できます。']),
        hi:Object.freeze(['Star density का default अब 100% है; reload, restart और reset पर positions फिर से random होती हैं, जबकि size, brightness और colour भी अलग-अलग random रहते हैं।','अधिकांश तारे स्थिर रहते हैं; कुछ ही 5–25 सेकंड में धीमे और अनियमित रूप से twinkle करते हैं, और बहुत कम तारे 5–10 सेकंड के लिए छिपते या कभी-कभार cross flare दिखाते हैं।','Sun की fine flow structure बनी रहती है, लेकिन मौजूदा motion strength को और लगभग 5% कम किया गया है।','Jupiter के experimental jets, turbulence और Great Red Spot shader हटाकर पुराने मूल gas-giant shader को पूरी तरह वापस किया गया है।','Viewport में right mouse button दबाकर ऊपर-नीचे drag करने पर wheel mode से स्वतंत्र camera dolly मिलता है।']),
        es:Object.freeze(['La densidad de estrellas pasa a 100% por defecto; las posiciones se vuelven a aleatorizar al recargar, reiniciar o restablecer, y tamaño, brillo y color siguen siendo independientes.','La mayoría mantiene un brillo estable; solo algunas centellean de forma lenta e irregular entre 5 y 25 segundos, y una fracción mínima desaparece 5–10 segundos o muestra raros destellos en cruz.','El Sol conserva su estructura fina, pero la intensidad del movimiento actual se reduce otro 5% para resultar más calmada.','Se eliminan los jets, turbulencias y el shader experimental de la Gran Mancha Roja de Júpiter, restaurando por completo el shader original de gigante gaseoso.','Al arrastrar verticalmente con el botón derecho sobre el visor, la cámara avanza o retrocede independientemente del modo de la rueda.']),
        de:Object.freeze(['Die Sterndichte ist standardmäßig 100%; bei Neuladen, Neustart und Zurücksetzen werden die Positionen neu zufällig verteilt, während Größe, Helligkeit und Farbe unabhängig bleiben.','Die meisten Sterne bleiben nahezu konstant; nur einige funkeln langsam und unregelmäßig über 5–25 Sekunden, während sehr wenige 5–10 Sekunden verschwinden oder selten Kreuzstrahlen zeigen.','Die feine Sonnenstruktur bleibt erhalten, die aktuelle Bewegungsstärke wird jedoch um weitere etwa 5% reduziert.','Die experimentellen Jupiter-Jets, Turbulenzen und der Shader für den Großen Roten Fleck werden entfernt; der ursprüngliche Gasriesen-Shader ist vollständig wiederhergestellt.','Vertikales Ziehen mit der rechten Maustaste im Ansichtsfenster bewegt die Kamera unabhängig vom Mausradmodus vor und zurück.']),
        fr:Object.freeze(['La densité d’étoiles passe à 100% par défaut ; les positions sont de nouveau randomisées au rechargement, au redémarrage et à la réinitialisation, tandis que taille, luminosité et couleur restent indépendantes.','La plupart restent presque stables ; seules certaines scintillent lentement et irrégulièrement sur 5 à 25 secondes, tandis qu’une très petite minorité disparaît 5 à 10 secondes ou produit rarement une lueur en croix.','Le Soleil conserve sa structure fine, mais l’intensité actuelle du mouvement est encore réduite d’environ 5%.','Les jets, turbulences et le shader expérimental de la Grande Tache rouge de Jupiter sont supprimés, rétablissant complètement le shader original de géante gazeuse.','Un glisser vertical avec le bouton droit dans la vue avance ou recule la caméra indépendamment du mode de la molette.'])
      });
      const PREVIOUS_RELEASE=Object.freeze({version:'0.43',date:'2026.09.17'});
      const PREVIOUS_RELEASE_ITEMS=Object.freeze({
        kor:Object.freeze(['별 밀도 기본값은 200%로 유지하면서 위치·크기·밝기·색·반짝임 주기를 서로 독립적으로 랜덤화해 규칙적인 별 배열을 없앴습니다.','별은 적색·백색·청백색·황색 계열이 낮은 채도로 섞이며, 아주 밝은 별 일부만 드물게 십자 광채가 나타납니다.','태양 표면은 속도는 유지하면서 더 촘촘한 흐름의 변형 강도를 높여 작은 규모의 꿈틀거림이 분명히 보이도록 조정했습니다.','별 파티클은 최대 풀을 GPU에 한 번 올린 뒤 슬라이더 값에 따라 그리는 개수만 바꾸도록 해 오래된 그래픽카드의 추가 부담을 제한했습니다.']),
        en:Object.freeze(['Star density stays at a 200% default while position, size, brightness, colour and twinkle timing are randomized independently to remove regular spacing.','Low-saturation red, white, blue-white and yellow stars are mixed, with rare cross-shaped flares only on a few bright stars.','The Sun keeps its motion speed but uses stronger fine-scale warping so small-scale surface motion is clearly visible.','The maximum star pool is uploaded to the GPU once, and the density slider changes only the draw count to keep extra load modest on older graphics cards.']),
        chn:Object.freeze(['星星密度默认保持 200%，位置、大小、亮度、颜色和闪烁周期彼此独立随机，去除规则排列感。','低饱和度的红、白、蓝白和黄色星光混合出现，只有极少数亮星偶尔出现十字光芒。','太阳保持原有运动速度，同时增强细密尺度的形变，让小范围表面运动更明显。','星星粒子最大池只上传到 GPU 一次，密度滑块只改变绘制数量，以限制旧显卡上的额外负担。']),
        jpn:Object.freeze(['星の密度は初期値 200% のまま、位置・大きさ・明るさ・色・瞬き周期を独立してランダム化し、規則的な並びをなくしました。','低彩度の赤・白・青白・黄の星を混ぜ、明るい星のごく一部だけにまれな十字光を加えました。','太陽は速度を変えず、細かなスケールの変形を強めて表面の小さな動きを見えやすくしました。','星パーティクルの最大プールは GPU に一度だけ送り、密度スライダーは描画数だけを変えることで古い GPU の追加負荷を抑えました。']),
        hi:Object.freeze(['Star density का default 200% रखते हुए position, size, brightness, colour और twinkle timing को अलग-अलग random किया गया है ताकि नियमित pattern न दिखे।','हल्के red, white, blue-white और yellow रंग मिलते हैं, और केवल कुछ चमकीले तारों पर कभी-कभार cross flare दिखाई देता है।','Sun की गति वही रखते हुए fine-scale warp मजबूत किया गया है ताकि छोटे surface motions साफ दिखें।','Maximum star pool को GPU पर एक बार upload किया जाता है और density slider केवल draw count बदलता है, जिससे पुराने GPU पर अतिरिक्त load सीमित रहता है।']),
        es:Object.freeze(['La densidad por defecto sigue en 200%, pero posición, tamaño, brillo, color y periodo de parpadeo se aleatorizan de forma independiente.','Se mezclan estrellas rojas, blancas, blanco-azuladas y amarillas con poca saturación, y solo unas pocas brillantes muestran destellos en cruz.','El Sol conserva la velocidad pero aumenta la deformación fina para que el movimiento de pequeña escala sea claramente visible.','El conjunto máximo de estrellas se carga una sola vez en la GPU y el control de densidad solo cambia la cantidad dibujada, limitando la carga adicional en GPU antiguas.']),
        de:Object.freeze(['Die Sterndichte bleibt standardmäßig bei 200%; Position, Größe, Helligkeit, Farbe und Funkelperiode werden unabhängig zufällig verteilt.','Dezent rote, weiße, blauweiße und gelbe Sterne werden gemischt; nur wenige helle Sterne zeigen selten ein Kreuzleuchten.','Die Sonne behält ihre Geschwindigkeit, erhält aber stärkere feine Verformungen für sichtbarere kleinräumige Bewegung.','Der maximale Sternpool wird nur einmal auf die GPU geladen; der Dichteregler ändert lediglich die Anzahl der gezeichneten Sterne und begrenzt so die Zusatzlast auf älteren GPUs.']),
        fr:Object.freeze(['La densité reste à 200% par défaut, tandis que position, taille, luminosité, couleur et période de scintillement sont randomisées indépendamment.','Des étoiles rouges, blanches, bleu-blanc et jaunes peu saturées sont mélangées, avec de rares éclats en croix sur quelques étoiles brillantes.','Le Soleil conserve sa vitesse mais renforce les déformations fines afin de rendre les petits mouvements de surface bien visibles.','Le pool maximal d’étoiles est envoyé une seule fois au GPU et le curseur de densité ne change que le nombre dessiné, afin de limiter la charge supplémentaire sur les anciens GPU.'])
      });
      const SECOND_PREVIOUS_RELEASE=Object.freeze({version:'0.42',date:'2026.09.17'});
      const SECOND_PREVIOUS_RELEASE_ITEMS=Object.freeze({
        kor:Object.freeze(['iPhone 안전 영역을 적용하고 국가명을 누르면 해당 지역의 지구를 바로 추적합니다.','GPU 텍스처 LRU와 자동 DPR·30/60fps 조절로 모바일 메모리와 렌더 부하를 줄였습니다.','256×128 저해상도 텍스처 단계를 추가하고 Cloudflare 배포에서 미디어를 같은 도메인으로 불러옵니다.','업데이트 내역을 필요할 때만 불러오고 같은 공개 버전 안의 r1·r2 패치도 자동 감지합니다.']),
        en:Object.freeze(['iPhone safe areas are respected, and clicking the region label tracks that location on Earth.','GPU texture LRU plus adaptive DPR and 30/60 fps reduce mobile memory and rendering load.','A 256×128 texture tier and same-origin Cloudflare media loading reduce transfer and connection overhead.','Release notes now load on demand, and r1/r2 patches can update automatically within the same public version.']),
        chn:Object.freeze(['适配 iPhone 安全区域，点击地区名称即可追踪地球上的对应位置。','加入 GPU 纹理 LRU、自动 DPR 与 30/60fps 调节，降低移动端内存和渲染负载。','新增 256×128 纹理层级，并在 Cloudflare 部署中使用同源媒体路径。','更新记录改为按需加载，同一公开版本内的 r1、r2 补丁也可自动检测。']),
        jpn:Object.freeze(['iPhone のセーフエリアに対応し、地域名を押すと地球上のその地域を追跡します。','GPU テクスチャ LRU と自動 DPR・30/60fps 制御でモバイルのメモリと描画負荷を軽減しました。','256×128 テクスチャ段階を追加し、Cloudflare では同一オリジンからメディアを読み込みます。','更新履歴を必要時のみ読み込み、同じ公開版の r1・r2 パッチも自動検出します。']),
        hi:Object.freeze(['iPhone safe area का समर्थन जोड़ा गया और क्षेत्र नाम दबाने पर पृथ्वी पर वही स्थान ट्रैक होता है।','GPU texture LRU तथा adaptive DPR और 30/60fps से मोबाइल मेमोरी और rendering load घटता है।','256×128 texture tier और Cloudflare same-origin media loading जोड़े गए।','Release notes अब जरूरत पर लोड होते हैं और उसी सार्वजनिक version के r1/r2 patch भी अपने-आप पहचाने जाते हैं।']),
        es:Object.freeze(['Se respetan las áreas seguras del iPhone y al pulsar la región se sigue esa ubicación en la Tierra.','El LRU de texturas GPU y el DPR/FPS adaptativo reducen memoria y carga gráfica en móviles.','Se añade el nivel 256×128 y la carga de medios desde el mismo origen en Cloudflare.','Las notas se cargan bajo demanda y los parches r1/r2 de la misma versión también se detectan automáticamente.']),
        de:Object.freeze(['iPhone-Safe-Areas werden berücksichtigt; ein Klick auf die Regionsanzeige verfolgt den Ort auf der Erde.','GPU-Textur-LRU sowie adaptive DPR- und 30/60-fps-Steuerung senken Speicher- und Renderlast auf Mobilgeräten.','Eine 256×128-Texturstufe und Same-Origin-Medien bei Cloudflare reduzieren Übertragung und Verbindungsaufwand.','Versionshinweise laden nur bei Bedarf; auch r1/r2-Patches derselben öffentlichen Version werden automatisch erkannt.']),
        fr:Object.freeze(['Les zones sûres de l’iPhone sont respectées et un clic sur la région suit cet emplacement sur la Terre.','Le LRU des textures GPU et l’ajustement automatique du DPR et des 30/60 i/s réduisent la mémoire et la charge mobile.','Un niveau 256×128 et le chargement des médias en même origine sur Cloudflare réduisent les transferts.','Les notes se chargent à la demande et les correctifs r1/r2 d’une même version sont détectés automatiquement.'])
      });
      function withCurrentRelease(base){
        if(!base)return base;
        const patches=[
          Object.freeze({meta:CURRENT_RELEASE,items:CURRENT_RELEASE_ITEMS}),
          Object.freeze({meta:PREVIOUS_RELEASE,items:PREVIOUS_RELEASE_ITEMS}),
          Object.freeze({meta:SECOND_PREVIOUS_RELEASE,items:SECOND_PREVIOUS_RELEASE_ITEMS})
        ];
        const known=new Set((base.RELEASES||[]).map(release=>release.version));
        const additions=patches.filter(entry=>!known.has(entry.meta.version)).map(entry=>Object.freeze({...entry.meta,items:entry.items.kor}));
        const releases=Object.freeze([...additions,...(base.RELEASES||[])]);
        const extra=patches.filter(entry=>!known.has(entry.meta.version)).reduce((sum,entry)=>sum+JSON.stringify(entry.items).length,0);
        const maps=Object.fromEntries(patches.map(entry=>[entry.meta.version,entry.items]));
        return Object.freeze({...base,RELEASES:releases,SOURCE_BYTES:(base.SOURCE_BYTES||0)+extra,itemsFor(release,code='kor'){const map=maps[release?.version];if(map)return map[code==='eu'?'en':code]||map.en;return base.itemsFor(release,code);},createReleaseNotesNavigator(){return base.createReleaseNotesNavigator(releases);}});
      }
      let releaseNotesApi=null,releaseNotesNavigator=null,releaseNotesLoading=null;
      function loadReleaseNotes(){
        if(releaseNotesApi)return Promise.resolve(releaseNotesApi);
        if(releaseNotesLoading)return releaseNotesLoading;
        releaseNotesLoading=new Promise((resolve,reject)=>{
          const existing=document.querySelector('script[data-solar-release-notes]');
          const finish=()=>{releaseNotesApi=withCurrentRelease(window.SolarReleaseNotes);if(!releaseNotesApi){reject(Error('Release notes module did not initialize.'));return;}releaseNotesNavigator=releaseNotesApi.createReleaseNotesNavigator?.()||null;resolve(releaseNotesApi);};
          if(existing){if(window.SolarReleaseNotes)finish();else{existing.addEventListener('load',finish,{once:true});existing.addEventListener('error',()=>reject(Error('Release notes could not be loaded.')),{once:true});}return;}
          const script=document.createElement('script');script.src='src/release-notes.js?v=0.45';script.async=true;script.dataset.solarReleaseNotes='true';script.addEventListener('load',finish,{once:true});script.addEventListener('error',()=>reject(Error('Release notes could not be loaded.')),{once:true});document.head.append(script);
        }).finally(()=>{if(!releaseNotesApi)releaseNotesLoading=null;});
        return releaseNotesLoading;
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
      helpDialog.addEventListener('cancel',event=>{event.preventDefault();handleEscape();});
      async function setLanguage(next){
        if(!LANG_ORDER.includes(next)||next===language)return;
        await hydrateLanguage(next);
        language=next;renderer.setSite(activeRegion());translateStatic();renderReleaseNotes();refreshTimeFormats();lastWallKey='';
        refreshNavLabels();presetUi();cameraUi();syncSpeedUi();
        if(presetAction){const value=cameraPresets[presetAction.index];$('preset-title').textContent=t('presetTitle',{n:presetAction.index+1});$('preset-note').textContent=t(value?'presetSavedNote':'presetEmptyNote');}
        const selected=bodies.find(body=>body.id===renderer.selected);
        if(selected){const copy=bodyCopy(selected);$('body-name').textContent=copy.name;$('body-description').textContent=copy.description;$('feature-view').textContent=selected.id==='earth'?t('koreaView',{region:activeRegion().region}):t('stormView');syncBodySizeControl(selected);updateBody(clock.value(performance.now()));}
        uiNow();persist();if(helpDialog.open)requestAnimationFrame(updateHelpScrollCues);
      }
      const languageControl=$('language-control'),languageMenu=$('language-menu'),languageScroll=$('language-scroll'),languageToggle=$('language-toggle');
      const updateLanguageScrollCues=bindScrollCues(languageMenu,languageScroll);
      function openLanguageMenu(){
        showFading(languageMenu);languageToggle.setAttribute('aria-expanded','true');updateLanguageScrollCues();requestAnimationFrame(updateLanguageScrollCues);
        const current=languageMenu.querySelector(`[data-language="${language}"]`);requestAnimationFrame(()=>{current?.scrollIntoView({block:'nearest'});current?.focus({preventScroll:true});updateLanguageScrollCues();});
      }
      function closeLanguageMenu(returnFocus=false){hideFading(languageMenu);languageToggle.setAttribute('aria-expanded','false');if(returnFocus)languageToggle.focus({preventScroll:true});}
      languageToggle.addEventListener('click',()=>uiElementVisible(languageMenu)?closeLanguageMenu():openLanguageMenu());
      for(const option of languageMenu.querySelectorAll('[data-language]'))option.addEventListener('click',()=>{const next=option.dataset.language;closeLanguageMenu(true);setLanguage(next).catch(fatal);});
      languageMenu.addEventListener('keydown',event=>{
        const options=[...languageMenu.querySelectorAll('[data-language]')],index=options.indexOf(document.activeElement);let next=-1;
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
        // A wake-up click is not a drag: preserve automatic yaw until manual movement begins.
        renderer.cancelCameraTween(performance.now());
        const pan=event.pointerType==='mouse'&&event.button===1,dolly=event.pointerType==='mouse'&&event.button===2;
        if(pan||dolly)event.preventDefault();
        const p=pointerPosition(event);pointers.set(event.pointerId,p);canvas.setPointerCapture(event.pointerId);
        if(pointers.size===1){drag={x:p.x,y:p.y,startX:p.x,startY:p.y,startPanY:renderer.camera.panY,startPanX:renderer.camera.panX,startAzimuth:renderer.camera.azimuth,startElevation:renderer.camera.elevation,startDolly:renderer.camera.dolly??1,mode:pan?'pan':dolly?'dolly':'orbit',moved:false};pinched=false;}
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
        const dx=p.x-drag.x,dy=p.y-drag.y;
        if(Math.hypot(p.x-drag.startX,p.y-drag.startY)>4)drag.moved=true;
        if(drag.moved&&!pinched){
          if(drag.mode==='pan')renderer.setPan(drag.startPanX+(p.x-drag.startX)/renderer.w,drag.startPanY+(p.y-drag.startY)/renderer.h);
          else if(drag.mode==='dolly')renderer.setDolly(drag.startDolly*Math.exp((drag.startY-p.y)*.006),renderer.selected);
          else renderer.setOrbitView(drag.startAzimuth+(p.x-drag.startX)*.004,drag.startElevation+(p.y-drag.startY)*.003);
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
          if(document.fullscreenElement){event.preventDefault();event.stopImmediatePropagation();}
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
          if(key==='f')fullscreen();else if(key==='h'){
            if($('help-dialog').open)help(false);
            setZen(!zen);
          }else reset();return;
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
      function frame(mono) {
        if(disposed||document.hidden){raf=0;return;}
        raf=requestAnimationFrame(frame);
        const frameInterval=window.SolarPerformance?.frameInterval(window.innerWidth,window.innerHeight)??(1000/(window.innerWidth<680?30:60));
        if(mono-lastFrame<frameInterval-.5)return;
        const dt=lastFrame?Math.max(0,(mono-lastFrame)/1000):0;lastFrame=mono;
        if(!clock.paused)effectTime+=dt;
        const wall=Date.now(),ms=clock.value(mono,wall);
        if(!clock.paused&&!clock.live&&ms>=A.MAX_TIME){clock.anchorMs=A.MAX_TIME;clock.anchorMono=mono;clock.paused=true;toast(t('yearLimit'));}
        try {
          const wasTransitioning=!!renderer.cameraTween,renderStarted=performance.now();
          renderer.draw(ms,effectTime,mono);window.SolarPerformance?.reportRenderCost(performance.now()-renderStarted);
          // Keep the lens readout on the same painted camera frame. The broader
          // clock/card refresh remains throttled, but zoom must not trail presets.
          if(wasTransitioning||renderer.cameraTween)cameraUi();
          if(wasTransitioning&&!renderer.cameraTween)persist();
          if(mono-lastUi>200){lastUi=mono;updateWall(wall);updateControls(ms);cameraUi();if(renderer.selected)updateBody(ms);}
        } catch(error){disposed=true;setMusicEnabled(false);renderer.dispose();materials.dispose();cancelAnimationFrame(raf);cancelAnimationFrame(resizeFrame);clearAwake();clearTimeout(toastTimer);clearTimeout(materialRefreshTimer);fatal(error);}
      }
      document.addEventListener('visibilitychange',()=>{
        if(document.hidden){closePresetDialog(false);renderer.suspend();cancelAnimationFrame(raf);raf=0;lastFrame=0;clearAwake();}
        else if(!raf&&!disposed){renderer.resume();lastFrame=0;uiNow();wakePointer();raf=requestAnimationFrame(frame);}
      });
      window.addEventListener('pagehide',event=>{closePresetDialog(false);setMusicEnabled(false);materials.cancel();if(event.persisted)renderer.suspend();else {disposed=true;renderer.dispose();materials.dispose();}cancelAnimationFrame(raf);cancelAnimationFrame(resizeFrame);resizeFrame=0;raf=0;lastFrame=0;clearAwake();clearTimeout(toastTimer);clearTimeout(materialRefreshTimer);});
      window.addEventListener('pageshow',()=>{if(!raf&&!disposed&&!document.hidden){renderer.resume();lastFrame=0;wakePointer();raf=requestAnimationFrame(frame);}});
      // A small, documented inspection surface for automated tests and future development.
      window.SolarTime=Object.freeze({version:'0.45',revision:'r9',clock,renderer,materials,calibrationMs,setLanguage,getPresets:()=>cameraPresets.map(v=>v?{...v}:null),getModel:()=>A.modelStatus(),getState:()=>({fullscreen:!!document.fullscreenElement,escapeLock:'native',simulationMs:clock.value(performance.now()),wallMs:Date.now(),rate:clock.rate,live:clock.live,paused:clock.paused,timezone,timeZone:activeTimeZone(),region:activeRegion().label,showSeconds,hourCycle,clockFont,starDensity:renderer.options.starDensity,language,zen,musicEnabled:music.enabled,musicTrack:music.track,effectTime,frameCount:renderer.frameCount})});
      uiNow();
      const bootMono=performance.now(),bootMs=clock.value(bootMono);renderer.draw(bootMs,0,bootMono);
      await warmInitialScene();
      if(!disposed){const revealMono=performance.now();renderer.startOrbitReveal(revealMono);renderer.draw(clock.value(revealMono),0,revealMono);$('loading').classList.add('done');setTimeout(()=>$('loading').hidden=true,450);scheduleMaterialRefresh();}
      if(!document.hidden&&!disposed)raf=requestAnimationFrame(frame);
    } catch(error){fatal(error);}
  }
  requestAnimationFrame(()=>setTimeout(init,0));
})();
