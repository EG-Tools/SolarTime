/* Solar Time v0.40 — clock, interaction and accessible UI. */
(function () {
  'use strict';
  const $=id=>document.getElementById(id), A=window.SolarAstro,Modules=window.SolarModules;
  const Localization=Modules.Localization,LanguageData=Modules.LanguageData,Preferences=Modules.Preferences,UI=Modules.UI;
  const STORAGE_KEY='eg.solar-time.v0.01';
  const LANG_ORDER=['kor','en','chn','jpn','eu','hi','es','de','fr'];
  const LANG_META={
    kor:{code:'KOR',name:'한국어',locale:'ko-KR',html:'ko',copy:'kor'},
    en:{code:'EN',name:'English',locale:'en-US',html:'en',copy:'en'},
    chn:{code:'CHN',name:'中文',locale:'zh-CN',html:'zh-Hans',copy:'chn'},
    jpn:{code:'JPN',name:'日本語',locale:'ja-JP',html:'ja',copy:'jpn'},
    eu:{code:'EU',name:'Europe',locale:'en-GB',html:'en-GB',copy:'en'},
    hi:{code:'HI',name:'हिन्दी',locale:'hi-IN',html:'hi',copy:'hi'},
    es:{code:'ES',name:'Español',locale:'es-ES',html:'es',copy:'es'},
    de:{code:'DE',name:'Deutsch',locale:'de-DE',html:'de',copy:'de'},
    fr:{code:'FR',name:'Français',locale:'fr-FR',html:'fr',copy:'fr'}
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
    fr:{label:'FRANCE',timeZone:'Europe/Paris',latitude:46.2276,longitude:2.2137,region:'France',city:'centre géographique'}
  };
  const FACTORY_OPTIONS=Object.freeze({actualScale:false,overviewOrbitGap:86,orbitBrightness:.5,dollyZoom:false,labels:true,avoidLabels:false,twinkle:true,activity:true,pluto:true,moon:true,skyMotion:true,comets:true,quality:'auto'});
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
      const quantity=(value,unit)=>['en','hi','es','de','fr'].includes(copyLanguage())?`${value} ${t(unit)}`:`${value}${t(unit)}`;
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
        for(const option of menu.querySelectorAll('[data-language]'))option.setAttribute('aria-checked',String(option.dataset.language===language));
        for(const [id,key] of [['zoom-in','zoomIn'],['zoom-out','zoomOut']]){$(id).setAttribute('aria-label',t(key));$(id).title=t(key);}
        $('fit-view').setAttribute('aria-label',t('homeView'));$('fit-view').title=t('homeView')+' · 0';
        $('fullscreen-button').setAttribute('aria-label',t(document.fullscreenElement?'fullscreenExit':'fullscreen'));$('fullscreen-button').title=t(document.fullscreenElement?'fullscreenExit':'fullscreen')+' · F';
        $('zen-toggle').setAttribute('aria-label',t(zen?'zenOff':'zenOn'));$('zen-toggle').title=t(zen?'normalMode':'zenMode')+' · H';
        $('timezone-button').title=t('timezoneTitle');
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
      let clockFont='georgia',savedAutoRotateDirection=FACTORY_AUTO_ROTATE,overviewCamera=renderer.defaultCameraSnapshot();
      renderer.options.twinkle=true;
      const validKeys={actualScale:'actual-scale',labels:'show-labels',avoidLabels:'avoid-labels',activity:'show-activity',pluto:'show-pluto',moon:'show-moon',comets:'show-comets'};
      try {
        const saved=Preferences.read(STORAGE_KEY);
        if(saved&&typeof saved==='object') {
          for(const key of Object.keys(validKeys))if(typeof saved[key]==='boolean')renderer.options[key]=saved[key];
          if(Number.isFinite(saved.orbitBrightness))renderer.options.orbitBrightness=A.clamp(saved.orbitBrightness,0,1);
          else if(typeof saved.orbits==='boolean')renderer.options.orbitBrightness=saved.orbits?.5:0;
           if(saved.timezone==='utc')timezone='utc';
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
      $('hour-cycle').checked=hourCycle==='24';$('ampm').hidden=hourCycle!=='12';
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
      const zoneLabel=()=>timezone==='utc'?'UTC':activeRegion().label;
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
        $('ampm').hidden=!twelve;$('ampm').textContent=period;
        const spoken=twelve?`${period} ${two(displayHour)}:${two(p.mi)}${showSeconds?':'+two(p.s):''}`:`${two(p.h)}:${two(p.mi)}${showSeconds?':'+two(p.s):''}`;
        $('wall-clock').dateTime=new Date(wall).toISOString();$('wall-clock').setAttribute('aria-label',t('wallClockAria',{time:spoken}));
        $('wall-date').textContent=dateFormatter.format(new Date(wall));$('timezone-button').textContent=zoneLabel();
        $('timezone-button').setAttribute('aria-label',t('timezoneAria',{zone:zoneLabel()}));
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
      $('timezone-button').addEventListener('click',()=>{timezone=timezone==='local'?'utc':'local';refreshTimeFormats();lastWallKey='';uiNow();persist();});
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
      $('show-seconds').addEventListener('change',()=>{showSeconds=$('show-seconds').checked;$('seconds-group').hidden=!showSeconds;lastWallKey='';uiNow();persist();});
      $('hour-cycle').addEventListener('change',()=>{hourCycle=$('hour-cycle').checked?'24':'12';lastWallKey='';uiNow();persist();});
      $('clock-font').addEventListener('change',()=>{const next=$('clock-font').value;if(!CLOCK_FONTS[next])return;clockFont=next;document.documentElement.style.setProperty('--clock-font',CLOCK_FONTS[clockFont]);persist();});
      const resetDefaultsDialog=$('reset-defaults-dialog');
      function closeResetDefaults(restoreFocus=true){if(resetDefaultsDialog.open)hideFading(resetDefaultsDialog,()=>resetDefaultsDialog.close());if(restoreFocus)$('reset-defaults').focus({preventScroll:true});}
      async function applyFactoryDefaults(){
        const mono=performance.now();closeResetDefaults(false);renderer.cancelCameraMotion(mono);renderer.stopAutoRotate(mono);
        for(const [key,value] of Object.entries(FACTORY_OPTIONS))renderer.setOption(key,value,false);
        renderer.setBodyScales(FACTORY_BODY_SCALES);renderer.setSatelliteOrbitScales(FACTORY_ORBIT_SCALES);
        renderer.restoreCamera(renderer.defaultCameraSnapshot());renderer.setAutoRotate(FACTORY_AUTO_ROTATE,mono);overviewCamera=renderer.defaultCameraSnapshot();
        timezone='local';showSeconds=false;hourCycle='12';clockFont='georgia';speedMode='day';speedValues={hour:1,day:1,year:1};language=detectedLanguage();
        await hydrateLanguage(language);
        renderer.setSite(activeRegion());for(const [key,id] of Object.entries(validKeys))$(id).checked=renderer.options[key];
        $('show-seconds').checked=showSeconds;$('seconds-group').hidden=true;$('hour-cycle').checked=false;$('ampm').hidden=false;
        $('clock-font').value=clockFont;document.documentElement.style.setProperty('--clock-font',CLOCK_FONTS[clockFont]);
        translateStatic();refreshTimeFormats();refreshNavLabels();syncOrbitSpacingControl();syncOrbitBrightnessControl();syncSpeedUi();cameraUi();navVisibility();closeBody();lastWallKey='';uiNow();persist();toast(t('resetComplete'));
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
      const releaseNotesApi=window.SolarReleaseNotes,releaseNotesNavigator=releaseNotesApi?.createReleaseNotesNavigator?.();
      function formatReleaseNotesBytes(bytes){const value=Math.max(0,Number(bytes)||0);return value<1024?value+' B':(value/1024).toFixed(1)+' KB';}
      function renderReleaseNotes(state=releaseNotesNavigator?.current()){
        const release=state?.release;if(!release)return;
        $('release-notes-version').textContent='v'+release.version;
        $('release-notes-date').textContent=release.date||'';
        $('release-notes-size').textContent=formatReleaseNotesBytes(releaseNotesApi.SOURCE_BYTES);
        const fragment=document.createDocumentFragment();
        for(const item of releaseNotesApi.itemsFor(release,language).slice(0,10)){const row=document.createElement('li');row.textContent=item;fragment.append(row);}
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
      $('release-notes-toggle').addEventListener('click',()=>setReleaseNotes($('release-notes-toggle').getAttribute('aria-expanded')!=='true'));
      $('release-notes-newer').addEventListener('click',()=>renderReleaseNotes(releaseNotesNavigator?.newer()));
      $('release-notes-older').addEventListener('click',()=>renderReleaseNotes(releaseNotesNavigator?.older()));
      renderReleaseNotes(releaseNotesNavigator?.reset());
      function help(open){
        const next=open===undefined?!uiElementVisible(helpDialog):open;
        if(next&&!helpDialog.open){
          setReleaseNotes(false);renderReleaseNotes(releaseNotesNavigator?.reset());showFading(helpDialog,()=>helpDialog.show());helpScroll.scrollTop=0;updateHelpScrollCues();requestAnimationFrame(updateHelpScrollCues);
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
      const languageControl=$('language-control'),languageMenu=$('language-menu'),languageToggle=$('language-toggle');
      function openLanguageMenu(){
        showFading(languageMenu);languageToggle.setAttribute('aria-expanded','true');
        const current=languageMenu.querySelector(`[data-language="${language}"]`);requestAnimationFrame(()=>current?.focus({preventScroll:true}));
      }
      function closeLanguageMenu(returnFocus=false){hideFading(languageMenu);languageToggle.setAttribute('aria-expanded','false');if(returnFocus)languageToggle.focus({preventScroll:true});}
      languageToggle.addEventListener('click',()=>uiElementVisible(languageMenu)?closeLanguageMenu():openLanguageMenu());
      for(const option of languageMenu.querySelectorAll('[data-language]'))option.addEventListener('click',()=>{const next=option.dataset.language;closeLanguageMenu(true);setLanguage(next).catch(fatal);});
      languageMenu.addEventListener('keydown',event=>{
        const options=[...languageMenu.querySelectorAll('[data-language]')],index=options.indexOf(document.activeElement);let next=-1;
        if(event.key==='ArrowDown')next=(index+1)%options.length;else if(event.key==='ArrowUp')next=(index-1+options.length)%options.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=options.length-1;else return;
        event.preventDefault();options[next].focus({preventScroll:true});
      });
      document.addEventListener('pointerdown',event=>{if(uiElementVisible(languageMenu)&&!languageControl.contains(event.target))closeLanguageMenu();});
      const canvas=$('universe'),pointers=new Map();
      let drag=null,pinchDistance=0,pinchLevel=1,pinched=false,clickGestures=0;
      function cancelGesture() {
        const ids=[...pointers.keys()];pointers.clear();drag=null;pinched=false;clickGestures=0;pinchDistance=0;
        for(const id of ids)if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
        canvas.classList.remove('dragging');canvas.style.cursor='grab';
      }
      function pointerPosition(event) {const r=canvas.getBoundingClientRect();return {x:event.clientX-r.left,y:event.clientY-r.top};}
      canvas.addEventListener('pointerdown',event=>{
        if(event.pointerType==='mouse'&&event.button!==0&&event.button!==1)return;
        // A wake-up click is not a drag: preserve automatic yaw until manual movement begins.
        renderer.cancelCameraTween(performance.now());
        const pan=event.pointerType==='mouse'&&event.button===1;
        if(pan)event.preventDefault();
        const p=pointerPosition(event);pointers.set(event.pointerId,p);canvas.setPointerCapture(event.pointerId);
        if(pointers.size===1){drag={x:p.x,y:p.y,startX:p.x,startY:p.y,startPanY:renderer.camera.panY,startPanX:renderer.camera.panX,startAzimuth:renderer.camera.azimuth,startElevation:renderer.camera.elevation,mode:pan?'pan':'orbit',moved:false};pinched=false;}
        if(zen&&pointers.size===3){setZen(false);pinched=true;if(drag)drag.moved=true;return;}
        if(pointers.size===2){clickGestures=0;const [a,b]=[...pointers.values()];pinchDistance=Math.hypot(a.x-b.x,a.y-b.y);pinchLevel=renderer.options.dollyZoom?(renderer.camera.dolly??1):renderer.camera.zoom;pinched=true;}
      });
      canvas.addEventListener('pointermove',event=>{
        const p=pointerPosition(event);
        if(!pointers.has(event.pointerId)) {renderer.hover=zen?null:renderer.hit(p.x,p.y);canvas.style.cursor=renderer.hover?'pointer':'grab';return;}
        pointers.set(event.pointerId,p);
        if(pointers.size>=2) {
          const [a,b]=[...pointers.values()];if(pinchDistance>0){const level=pinchLevel*Math.hypot(a.x-b.x,a.y-b.y)/pinchDistance;if(renderer.options.dollyZoom)renderer.setDolly(level,renderer.selected);else renderer.setZoom(level);cameraUi();}if(drag)drag.moved=true;return;
        }
        if(!drag)return;
        const dx=p.x-drag.x,dy=p.y-drag.y;
        if(Math.hypot(p.x-drag.startX,p.y-drag.startY)>4)drag.moved=true;
        if(drag.moved&&!pinched){
          if(drag.mode==='pan')renderer.setPan(drag.startPanX+(p.x-drag.startX)/renderer.w,drag.startPanY+(p.y-drag.startY)/renderer.h);
          else renderer.setOrbitView(drag.startAzimuth+(p.x-drag.startX)*.004,drag.startElevation+(p.y-drag.startY)*.003);
          cameraUi();canvas.classList.add('dragging');canvas.style.cursor=drag.mode==='pan'?'move':'grabbing';
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
      // Suppress middle-button autoscroll / aux-click only over the viewport.
      for(const type of ['mousedown','auxclick'])canvas.addEventListener(type,event=>{if(event.button===1)event.preventDefault();});
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
        const fps=window.innerWidth<680?30:60;
        if(mono-lastFrame<1000/fps-.5)return;
        const dt=lastFrame?Math.max(0,(mono-lastFrame)/1000):0;lastFrame=mono;
        if(!clock.paused)effectTime+=dt;
        const wall=Date.now(),ms=clock.value(mono,wall);
        if(!clock.paused&&!clock.live&&ms>=A.MAX_TIME){clock.anchorMs=A.MAX_TIME;clock.anchorMono=mono;clock.paused=true;toast(t('yearLimit'));}
        try {
          const wasTransitioning=!!renderer.cameraTween;
          renderer.draw(ms,effectTime,mono);
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
      window.SolarTime=Object.freeze({version:'0.40',clock,renderer,materials,calibrationMs,setLanguage,getPresets:()=>cameraPresets.map(v=>v?{...v}:null),getModel:()=>A.modelStatus(),getState:()=>({fullscreen:!!document.fullscreenElement,escapeLock:'native',simulationMs:clock.value(performance.now()),wallMs:Date.now(),rate:clock.rate,live:clock.live,paused:clock.paused,timezone,timeZone:activeTimeZone(),region:activeRegion().label,showSeconds,hourCycle,clockFont,language,zen,musicEnabled:music.enabled,musicTrack:music.track,effectTime,frameCount:renderer.frameCount})});
      uiNow();
      const bootMono=performance.now(),bootMs=clock.value(bootMono);renderer.draw(bootMs,0,bootMono);
      await warmInitialScene();
      if(!disposed){const revealMono=performance.now();renderer.startOrbitReveal(revealMono);renderer.draw(clock.value(revealMono),0,revealMono);$('loading').classList.add('done');setTimeout(()=>$('loading').hidden=true,450);scheduleMaterialRefresh();}
      if(!document.hidden&&!disposed)raf=requestAnimationFrame(frame);
    } catch(error){fatal(error);}
  }
  requestAnimationFrame(()=>setTimeout(init,0));
})();
