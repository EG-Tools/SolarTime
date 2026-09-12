/* Solar Time v0.23 — clock, interaction and accessible UI. */
(function () {
  'use strict';
  const $=id=>document.getElementById(id), A=window.SolarAstro;
  const STORAGE_KEY='eg.solar-time.v0.01';
  let toastTimer,awakeTimer;
  function toast(message) { clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,3400); }
  function fatal(error) { $('loading').hidden=true;$('fatal-error').hidden=false;$('fatal-message').textContent=error instanceof Error?error.message:String(error);console.error(error); }
  async function init() {
    try {
      const materials=new window.SolarMaterials.Owner();
      const bootWall=Date.now(),calibrationStarted=performance.now();
      A.calibrateAt(bootWall);
      const calibrationMs=performance.now()-calibrationStarted;
      const renderer=new window.SolarRenderer($('starfield'),$('universe'));
      const clock=new A.SimulationClock(Date.now(),performance.now());
      let timezone='local',showSeconds=false,hourCycle='24',zen=false,raf=0,lastFrame=0,effectTime=0,lastWallKey='',lastUi=0,disposed=false;
      let speedMode='day',speedValues={hour:60,day:1,year:1};
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
      let clockFont='aptos';
      const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      renderer.options.twinkle=!reduced;renderer.options.activity=!reduced;renderer.options.skyMotion=!reduced;renderer.options.comets=!reduced;
      const validKeys={orbits:'show-orbits',labels:'show-labels',avoidLabels:'avoid-labels',twinkle:'show-twinkle',activity:'show-activity',pluto:'show-pluto',moon:'show-moon',comets:'show-comets'};
      try {
        const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
        if(saved&&typeof saved==='object') {
          for(const key of Object.keys(validKeys))if(typeof saved[key]==='boolean')renderer.options[key]=saved[key];
          if(saved.timezone==='utc')timezone='utc';
          if(typeof saved.showSeconds==='boolean')showSeconds=saved.showSeconds;
          if(saved.hourCycle==='12'||saved.hourCycle==='24')hourCycle=saved.hourCycle;
          if(typeof saved.clockFont==='string'&&CLOCK_FONTS[saved.clockFont])clockFont=saved.clockFont;
          if(['hour','day','year'].includes(saved.speedMode))speedMode=saved.speedMode;
          if(saved.speedValues&&typeof saved.speedValues==='object'){
            if(Number.isFinite(saved.speedValues.hour))speedValues.hour=A.clamp(Math.round(saved.speedValues.hour),1,1440);
            if(Number.isFinite(saved.speedValues.day))speedValues.day=A.clamp(Math.round(saved.speedValues.day),1,365);
            if(Number.isFinite(saved.speedValues.year))speedValues.year=A.clamp(Math.round(saved.speedValues.year),1,20);
          }
          if(Number.isFinite(saved.elevation))renderer.setOrbitView(renderer.camera.azimuth,saved.elevation*A.DEG);
          if(Number.isFinite(saved.panY))renderer.setPanY(saved.panY);
          if(Number.isFinite(saved.panX))renderer.setPan(saved.panX);
        }
      } catch (_) { /* Private browsing, corrupt JSON and blocked storage must not break the clock. */ }
      renderer.resize();
      for(const [key,id] of Object.entries(validKeys))$(id).checked=renderer.options[key];
      $('show-seconds').checked=showSeconds;$('seconds-group').hidden=!showSeconds;
      $('hour-cycle').value=hourCycle;$('ampm').hidden=hourCycle!=='12';
      $('clock-font').value=clockFont;document.documentElement.style.setProperty('--clock-font',CLOCK_FONTS[clockFont]);
      const zoneLabel=()=>timezone==='utc'?'UTC':Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop().replaceAll('_',' ').toUpperCase();
      function persist() { try { localStorage.setItem(STORAGE_KEY,JSON.stringify({...renderer.options,timezone,showSeconds,hourCycle,clockFont,speedMode,speedValues,elevation:renderer.camera.elevation/A.DEG,panY:renderer.camera.panY,panX:renderer.camera.panX})); } catch (_) {} }
      function cameraUi() {
        const controlState=renderer.cameraTween?.input?renderer.cameraTween.to:renderer.camera;
        const zoom=controlState.zoom,limits=renderer.zoomLimits;
        $('zoom-value').textContent=zoom.toFixed(1)+'×';
        $('zoom-in').disabled=zoom>=limits.maxZoom;$('zoom-out').disabled=zoom<=limits.minZoom;
        for(const [id,direction,label] of [['rotate-left',-1,'좌회전'],['rotate-right',1,'우회전']]){
          const active=renderer.autoRotateDirection===direction,b=$(id);
          b.setAttribute('aria-pressed',String(active));b.setAttribute('aria-label',label+(active?' 정지':' 시작'));
          b.title=label+(active?' 중 · 누르면 정지':' · 초당 2°');
        }
      }
      cameraUi();
      const PRESETS_KEY='solar-time.camera-presets.v1';
      let cameraPresets=[null,null,null],presetAction=null,presetStorageAvailable=true;
      const presetDialog=$('preset-dialog');
      try {
        const saved=JSON.parse(localStorage.getItem(PRESETS_KEY)||'null');
        if(saved?.schema===1&&Array.isArray(saved.slots))cameraPresets=cameraPresets.map((_,i)=>
          window.SolarRenderer.validCamera(saved.slots[i])?{...saved.slots[i]}:null);
      }catch(_){/* Corrupt or inaccessible settings never affect the running camera. */}
      function presetUi() {
        cameraPresets.forEach((value,i)=>{
          const b=$('camera-preset-'+(i+1));b.classList.toggle('saved',!!value);b.dataset.saved=String(!!value);
          b.title=`${i+1}번 카메라 · 좌·우클릭: 적용/저장/삭제/취소 · 숫자 ${i+1}: 부드럽게 이동`;
          b.setAttribute('aria-label',`${i+1}번 카메라 ${value?'저장됨':'비어 있음'}. 좌·우클릭으로 카메라 메뉴 열기. 숫자 ${i+1}로 불러오기.`);
        });
      }
      function writePresets() {
        try{localStorage.setItem(PRESETS_KEY,JSON.stringify({schema:1,slots:cameraPresets}));presetStorageAvailable=true;}
        catch(_){presetStorageAvailable=false;}
        presetUi();
      }
      function recallPreset(index) {
        const value=cameraPresets[index];
        if(!value){toast(`${index+1}번은 비어 있습니다. 숫자 버튼을 눌러 먼저 저장하세요.`);return;}
        cancelGesture();
        for(const id of ['moon','pluto'])if(value.focus===id&&!renderer.options[id]){renderer.setOption(id,true);$(validKeys[id]).checked=true;navVisibility();}
        if(!renderer.animateCamera(value,performance.now(),1100)){toast('저장된 천체의 표시를 켠 뒤 다시 불러오세요.');return;}
        cameraUi();
        // Persist only after the single renderer-owned transition has completed.
        if(!renderer.cameraTween)persist();
      }
      function closePresetDialog(restoreFocus=true) {
        const action=presetAction;presetAction=null;
        if(presetDialog.open)presetDialog.close();
        if(restoreFocus&&action)$('camera-preset-'+(action.index+1)).focus({preventScroll:true});
        if(action&&zen)wakePointer();
      }
      function openPresetDialog(index,event) {
        event.preventDefault();const value=cameraPresets[index];
        closePresetDialog(false);renderer.cancelCameraMotion(performance.now());cameraUi();
        presetAction={index,previous:value,snapshot:renderer.cameraSnapshot()};
        $('preset-title').textContent=`${index+1}번 카메라`;
        $('preset-note').textContent=value?'저장된 시점을 적용하거나 현재 시점으로 덮어씁니다.':'비어 있는 카메라입니다. 저장을 누르면 현재 시점을 보관합니다.';
        $('preset-apply').disabled=!value;$('preset-delete').disabled=!value;
        presetDialog.showModal();
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
          toast(`${action.index+1}번 카메라를 ${kind==='delete'?'삭제':'저장'}했습니다.`+(presetStorageAvailable?'':' 현재 창에서만 유지됩니다.'));
        }
        closePresetDialog();
      });
      presetDialog.addEventListener('cancel',event=>{event.preventDefault();handleEscape();});
      presetDialog.addEventListener('click',event=>{
        if(event.target!==presetDialog)return;const box=presetDialog.getBoundingClientRect();
        if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)closePresetDialog();
      });
      window.addEventListener('resize',()=>closePresetDialog(false),{passive:true});
      presetUi();
      const realFormat=()=>new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long',...(timezone==='utc'?{timeZone:'UTC'}:{})});
      let dateFormatter=realFormat();
      const two=v=>String(v).padStart(2,'0');
      function dateParts(ms) {const d=new Date(ms),p=timezone==='utc'?'getUTC':'get';return {y:d[p+'FullYear'](),mo:d[p+'Month']()+1,d:d[p+'Date'](),h:d[p+'Hours'](),mi:d[p+'Minutes'](),s:d[p+'Seconds']()};}
      function compactDate(ms) {const d=dateParts(ms);return `${d.y}.${two(d.mo)}.${two(d.d)}  ${two(d.h)}:${two(d.mi)}`;}
      function updateWall(wall) {
        const p=dateParts(wall),key=[p.y,p.mo,p.d,p.h,p.mi,showSeconds?p.s:0,timezone,showSeconds,hourCycle].join('-');if(key===lastWallKey)return;lastWallKey=key;
        const twelve=hourCycle==='12',displayHour=twelve?((p.h+11)%12)+1:p.h,period=p.h<12?'AM':'PM';
        $('hours').textContent=two(displayHour);$('minutes').textContent=two(p.mi);$('seconds').textContent=two(p.s);
        $('ampm').hidden=!twelve;$('ampm').textContent=period;
        $('wall-clock').dateTime=new Date(wall).toISOString();$('wall-clock').setAttribute('aria-label',twelve?`실제 기기 시각 ${period} ${displayHour}시 ${p.mi}분${showSeconds?' '+p.s+'초':''}`:`실제 기기 시각 ${p.h}시 ${p.mi}분${showSeconds?' '+p.s+'초':''}`);
        $('wall-date').textContent=dateFormatter.format(new Date(wall));$('timezone-button').textContent=zoneLabel();
        $('timezone-button').setAttribute('aria-label',`${timezone==='utc'?'UTC':'현지 시간'} 표시 중. 눌러서 시간대 전환`);
      }
      const bodies=[A.SUN,...A.BODIES,A.MOON];
      const navButtons=new Map();
      for(const b of bodies) {
        const button=document.createElement('button');button.type='button';button.dataset.body=b.id;button.style.setProperty('--planet',b.color);
        button.setAttribute('aria-pressed','false');button.setAttribute('aria-label',`${b.ko} 정보`);
        const dot=document.createElement('i');dot.setAttribute('aria-hidden','true');button.append(dot,document.createTextNode(b.ko));
        button.addEventListener('click',()=>selectBody(b.id));$('planet-nav').append(button);navButtons.set(b.id,button);
      }
      function navVisibility() {navButtons.get('pluto').hidden=!renderer.options.pluto;navButtons.get('moon').hidden=!renderer.options.moon;}
      navVisibility();
      function setStat(id,value,unit) {const el=$(id);el.replaceChildren(document.createTextNode(value+' '));if(unit){const small=document.createElement('small');small.textContent=unit;el.append(small);}}
      function updateBody(ms) {
        const b=bodies.find(v=>v.id===renderer.selected);if(!b)return;
        const material=window.SolarAssets.materialInfo?.[b.id];$('body-material').textContent=material?material.credit+' · 사진 지도':b.id==='earth'?'NASA Blue Marble · 내장 이미지':'내장 재질 · 공개 사진 미수신';
        const spinSeconds=Math.round(Math.abs(b.spin)*86400),hours=Math.floor(spinSeconds/3600),minutes=Math.floor(spinSeconds%3600/60),seconds=spinSeconds%60;
        const period=hours>=48?Math.abs(b.spin).toFixed(2)+'일':`${hours}시간 ${minutes}분 ${seconds}초`;
        const screenSeconds=Math.abs(b.spin)*86400/clock.rate;
        const playback=clock.paused?'일시정지':clock.live?'실제 시간':screenSeconds<1?`초당 ${(1/screenSeconds).toFixed(2)}회`:`${screenSeconds.toFixed(screenSeconds<100?1:0)}초에 1회`;
        $('body-spin').textContent=`자전 주기 약 ${period}${b.spin<0?' · 역행 자전':''} · ${playback} · 공전과 같은 시간 배율`;
        if(b.id==='sun') {
          $('stat-label-one').textContent='표현';setStat('stat-value-one','항성','');
          $('stat-label-two').textContent='태양계의 중심';setStat('stat-value-two','SUN','');
          $('body-note').textContent='표면은 자전하며 주변에는 샤인만 표시합니다. 실시간 태양 관측 데이터가 아닙니다.';
        } else if(b.id==='moon') {
          $('stat-label-one').textContent='지구 공전 주기';setStat('stat-value-one','27.32','일');
          const phase=A.moonPhase(ms);$('stat-label-two').textContent='지구에서 본 밝은 면 · 근사';setStat('stat-value-two','약 '+Math.round(phase.fraction*100),'%');
          $('body-note').textContent=phase.name+' · 확대된 천체의 화면상 겹침은 실제 일식을 뜻하지 않습니다.';
        } else {
          $('stat-label-one').textContent='공전 주기';setStat('stat-value-one',b.period>1000?(b.period/365.25).toFixed(1):b.period.toFixed(2),b.period>1000?'년':'일');
          const p=A.positionAt(b,ms);$('stat-label-two').textContent='태양까지 거리 · 근사';setStat('stat-value-two',Math.hypot(p.x,p.y,p.z).toFixed(2),'AU');
          $('body-note').textContent=b.id==='pluto'?'고정된 평균 궤도 · 정밀 위치 예측용이 아닙니다.':b.id==='earth'?`한국 · 서울 기준 ${A.siteSun(ms).altitude>=0?'낮':'밤'} / 태양 고도 약 ${A.siteSun(ms).altitude.toFixed(1)}° · 간단한 근사`:'1 AU는 지구와 태양 사이의 평균 거리입니다. 크기와 거리는 화면에서 축척을 조정했습니다.';
        }
      }
      function closeBody() {renderer.selected=null;$('body-panel').hidden=true;for(const button of navButtons.values()){button.classList.remove('active');button.setAttribute('aria-pressed','false');}}
      function selectBody(id) {
        if(id===renderer.selected||!id){closeBody();return;}
        const b=bodies.find(v=>v.id===id);if(!b)return;
        renderer.selected=id;$('body-panel').hidden=false;$('settings-panel').hidden=true;$('settings-button').setAttribute('aria-expanded','false');
        $('body-category').textContent=id==='sun'?'THE HEART OF OUR SYSTEM':id==='earth'?'OUR PALE BLUE HOME':id==='moon'?'EARTH’S COMPANION':id==='pluto'?'A DISTANT DWARF PLANET':'A WORLD IN MOTION';
        $('body-name').textContent=b.ko;$('body-english').textContent=b.en;$('body-description').textContent=b.description;
        for(const [key,button] of navButtons){button.classList.toggle('active',key===id);button.setAttribute('aria-pressed',String(key===id));}
        $('feature-view').hidden=!['earth','jupiter'].includes(id);$('feature-view').textContent=id==='earth'?'한국 보기 · 낮/밤 확인':'붉은 소용돌이 보기';
        updateBody(clock.value(performance.now()));
      }
      $('body-close').addEventListener('click',()=>{const id=renderer.selected;closeBody();navButtons.get(id)?.focus({preventScroll:true});});
      const SPEED_MODES={
        hour:{min:1,max:1440,step:1,rate:v=>v*60},
        day:{min:1,max:365,step:1,rate:v=>v*86400},
        year:{min:1,max:20,step:1,rate:v=>v*31557600}
      };
      function speedText(mode=speedMode,value=speedValues[mode]) {
        value=Math.round(value);
        if(mode==='hour'){const h=Math.floor(value/60),m=value%60;return h?(m?`${h}시간 ${m}분 / 초`:`${h}시간 / 초`):`${m}분 / 초`;}
        if(mode==='day')return `${value}일 / 초`;
        return `${value}년 / 초`;
      }
      function syncSpeedUi(){
        const cfg=SPEED_MODES[speedMode],slider=$('speed-slider'),button=$('speed-mode-button');
        slider.min=cfg.min;slider.max=cfg.max;slider.step=cfg.step;slider.value=speedValues[speedMode];
        slider.setAttribute('aria-valuetext',speedText());
        const label=speedMode==='hour'?'시간':speedMode==='day'?'일':'년';
        button.textContent=label;button.dataset.speedMode=speedMode;
        const active=!clock.live;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
        button.setAttribute('aria-label',active?`속도 단위 ${label}. 누르면 다음 단위로 전환`:`속도 단위 ${label} 대기. 누르면 이 단위로 배속 시작`);
      }
      function applySpeed(value=speedValues[speedMode]){
        const cfg=SPEED_MODES[speedMode],v=A.clamp(Math.round(Number(value)||cfg.min),cfg.min,cfg.max);speedValues[speedMode]=v;
        renderer.invalidateSurfaces();clock.setRate(cfg.rate(v),performance.now());syncSpeedUi();uiNow();persist();
      }
      function updateControls(ms) {
        $('pause-button').setAttribute('aria-pressed',String(clock.paused));$('pause-button').setAttribute('aria-label',clock.paused?'공전 재생':'공전 일시정지');
        $('pause-button').title=(clock.paused?'공전 재생':'공전 일시정지')+' · Space';$('pause-icon').toggleAttribute('hidden',clock.paused);$('play-icon').toggleAttribute('hidden',!clock.paused);
        $('live-button').classList.toggle('active',clock.live);$('live-button').setAttribute('aria-pressed',String(clock.live));
        $('status-dot').classList.toggle('simulated',!clock.live);$('status-dot').classList.toggle('paused',clock.paused);
        $('mode-label').textContent=clock.paused?'PAUSED':clock.live?'LIVE ORBITS':'TIME TRAVEL';
        $('simulation-date').textContent=compactDate(ms);$('simulation-date').dateTime=new Date(ms).toISOString();
        $('speed-value').textContent=clock.paused?'PAUSED':clock.live?'1 ×':speedText();
        syncSpeedUi();
      }
      function uiNow() {const mono=performance.now(),wall=Date.now(),ms=clock.value(mono,wall);updateWall(wall);updateControls(ms);updateBody(ms);}
      function now() {A.calibrateAt(Date.now());renderer.invalidateSurfaces();clock.now(performance.now());uiNow();toast('현재 시각의 태양계로 돌아왔습니다.');}
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
      $('timezone-button').addEventListener('click',()=>{timezone=timezone==='local'?'utc':'local';dateFormatter=realFormat();lastWallKey='';uiNow();persist();});
      function settings(open) {const next=open===undefined?$('settings-panel').hidden:open;$('settings-panel').hidden=!next;$('settings-button').setAttribute('aria-expanded',String(next));if(next)closeBody();}
      $('settings-button').addEventListener('click',()=>settings());$('settings-close').addEventListener('click',()=>{settings(false);$('settings-button').focus();});
      for(const [key,id] of Object.entries(validKeys))$(id).addEventListener('change',()=>{renderer.setOption(key,$(id).checked);if((key==='pluto'||key==='moon')&&!$(id).checked&&renderer.selected===key)closeBody();navVisibility();persist();});
      $('show-seconds').addEventListener('change',()=>{showSeconds=$('show-seconds').checked;$('seconds-group').hidden=!showSeconds;lastWallKey='';uiNow();persist();});
      $('hour-cycle').addEventListener('change',()=>{hourCycle=$('hour-cycle').value==='12'?'12':'24';lastWallKey='';uiNow();persist();});
      $('clock-font').addEventListener('change',()=>{const next=$('clock-font').value;if(!CLOCK_FONTS[next])return;clockFont=next;document.documentElement.style.setProperty('--clock-font',CLOCK_FONTS[clockFont]);persist();});
      function reset() {cancelGesture();renderer.resetCamera();cameraUi();persist();}
      $('fit-view').addEventListener('click',reset);
      function zoom(factor) {const mono=performance.now();renderer.smoothZoom(renderer.cameraInputState(mono).zoom*factor,null,mono);cameraUi();}
      function focusBody(id) {
        if(!id)return;
        cancelGesture();renderer.animateFocus(id);cameraUi();
      }
      $('focus-body').addEventListener('click',()=>focusBody(renderer.selected));
      $('feature-view').addEventListener('click',()=>{const id=renderer.selected;if(!['earth','jupiter'].includes(id))return;cancelGesture();renderer.animateFeature(id,id==='earth'?37.5665:-22,id==='earth'?126.978:(window.SolarAssets.materialInfo?.jupiter?.feature?.longitude??70),clock.value(performance.now()));cameraUi();});
      $('zoom-in').addEventListener('click',()=>zoom(1.2));$('zoom-out').addEventListener('click',()=>zoom(1/1.2));
      for(const [id,direction] of [['rotate-left',-1],['rotate-right',1]])$(id).addEventListener('click',()=>{
        renderer.setAutoRotate(renderer.autoRotateDirection===direction?0:direction,performance.now());cameraUi();
      });
      let fullscreenBusy=false,keyboardEpoch=0,escapeLock='inactive';
      function unlockEscape() {
        keyboardEpoch++;escapeLock='inactive';
        try{navigator.keyboard?.unlock?.();}catch(_){/* Already released by the browser. */}
      }
      async function lockEscape() {
        if(!document.fullscreenElement||disposed)return;
        const ticket=++keyboardEpoch;
        if(!navigator.keyboard?.lock){escapeLock='unsupported';return;}
        escapeLock='pending';
        try {
          // Capture ESC only, never Ctrl/Alt/OS shortcuts. Long ESC is still a browser escape hatch.
          await navigator.keyboard.lock(['Escape']);
          if(ticket!==keyboardEpoch){if(disposed||!document.fullscreenElement){try{navigator.keyboard?.unlock?.();}catch(_){}}return;}
          if(disposed||!document.fullscreenElement){unlockEscape();return;}
          escapeLock='locked';
        } catch(_) {
          if(ticket!==keyboardEpoch)return;
          escapeLock='denied';
          toast('ESC 순차 해제에는 키보드 권한이 필요합니다. 권한이 없으면 브라우저가 전체 화면을 먼저 종료할 수 있습니다.');
        }
      }
      async function exitFullscreen() {
        if(!document.fullscreenElement||fullscreenBusy)return;
        fullscreenBusy=true;
        try{await document.exitFullscreen();}
        catch(_){toast('전체 화면을 종료하지 못했습니다. ESC를 길게 누르세요.');}
        finally{fullscreenBusy=false;if(!document.fullscreenElement)unlockEscape();}
      }
      async function fullscreen() {
        if(document.fullscreenElement)return exitFullscreen();
        if(fullscreenBusy)return;
        if(!document.documentElement.requestFullscreen){toast('이 브라우저는 전체 화면을 지원하지 않습니다.');return;}
        fullscreenBusy=true;
        try{await document.documentElement.requestFullscreen();}
        catch(_){toast('전체 화면을 열지 못했습니다. 브라우저의 전체 화면 권한을 확인하세요.');}
        finally{fullscreenBusy=false;}
      }
      $('fullscreen-button').addEventListener('click',fullscreen);
      document.addEventListener('fullscreenchange',()=>{
        $('fullscreen-button').setAttribute('aria-label',document.fullscreenElement?'전체 화면 종료':'전체 화면');
        if(document.fullscreenElement)lockEscape();else unlockEscape();
        renderer.resize();
      });
      function handleEscape() {
        // Exactly one state change per key press. Never toggle into fullscreen here.
        if(zen){setZen(false);return;}
        if(document.fullscreenElement){exitFullscreen();return;}
        if(presetDialog.open){closePresetDialog();return;}
        if($('help-dialog').open){$('help-dialog').close();return;}
        settings(false);closeBody();
      }
      // A single idle owner controls the cursor, complete toolbar and hit/tab targets.
      const viewControls=$('view-controls'),idleDelay=1800;
      function showAwake(value) {
        const awake=zen&&value&&!disposed&&!document.hidden;
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
        $('zen-toggle').setAttribute('aria-pressed',String(zen));$('zen-toggle').setAttribute('aria-label',zen?'감상 모드 끄기':'감상 모드 켜기');$('zen-toggle').title=(zen?'일반 모드':'감상 모드')+' · H';
        // Keep the complete clock/date/timezone block pixel-identical in zen mode.
        // One timezone element is shared by both modes, so SEOUL/UTC never swaps or disappears.
        for(const el of document.querySelectorAll('.ui,#timezone-button'))el.inert=zen;
        renderer.hover=null;
        if(zen){closeBody();settings(false);clearTimeout(toastTimer);$('toast').hidden=true;$('universe').focus({preventScroll:true});wakePointer();}
        else {$('zen-toggle').focus({preventScroll:true});viewControls.inert=false;viewControls.setAttribute('aria-hidden','false');}
      }
      $('zen-toggle').addEventListener('click',()=>setZen(!zen));
      for(const event of ['pointermove','pointerdown','pointerup','pointercancel','wheel','keydown','focusin'])document.addEventListener(event,wakePointer,{passive:true});
      $('help-button').addEventListener('click',()=>{$('help-dialog').showModal();});
      const helpDialog=$('help-dialog');
      helpDialog.addEventListener('click',event=>{if(event.target!==helpDialog)return;const r=helpDialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)helpDialog.close();});
      helpDialog.addEventListener('cancel',event=>{event.preventDefault();handleEscape();});
      const canvas=$('universe'),pointers=new Map();
      let drag=null,pinchDistance=0,pinchZoom=1,pinched=false,clickGestures=0;
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
        if(pointers.size===2){clickGestures=0;const [a,b]=[...pointers.values()];pinchDistance=Math.hypot(a.x-b.x,a.y-b.y);pinchZoom=renderer.camera.zoom;pinched=true;}
      });
      canvas.addEventListener('pointermove',event=>{
        const p=pointerPosition(event);
        if(!pointers.has(event.pointerId)) {renderer.hover=zen?null:renderer.hit(p.x,p.y);canvas.style.cursor=renderer.hover?'pointer':'grab';return;}
        pointers.set(event.pointerId,p);
        if(pointers.size>=2) {
          const [a,b]=[...pointers.values()];if(pinchDistance>0){renderer.setZoom(pinchZoom*Math.hypot(a.x-b.x,a.y-b.y)/pinchDistance,null);cameraUi();}if(drag)drag.moved=true;return;
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
          event.preventDefault();event.stopImmediatePropagation();
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
            if($('help-dialog').open)$('help-dialog').close();
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
      // Finish the first surface batch under the loading cover. The worker, WebGL
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
      let resizeTimer;
      window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>renderer.resize(),70);},{passive:true});
      function frame(mono) {
        if(disposed||document.hidden){raf=0;return;}
        raf=requestAnimationFrame(frame);
        const fps=window.innerWidth<680?30:60;
        if(mono-lastFrame<1000/fps-.5)return;
        const dt=lastFrame?Math.max(0,(mono-lastFrame)/1000):0;lastFrame=mono;
        if(!clock.paused)effectTime+=dt;
        const wall=Date.now(),ms=clock.value(mono,wall);
        if(!clock.paused&&!clock.live&&ms>=A.MAX_TIME){clock.anchorMs=A.MAX_TIME;clock.anchorMono=mono;clock.paused=true;toast('2999년 끝에 도달해 정지했습니다. 실제 시간으로 돌아갈 수 있습니다.');}
        try {
          const wasTransitioning=!!renderer.cameraTween;
          renderer.draw(ms,effectTime,mono);
          if(wasTransitioning&&!renderer.cameraTween)persist();
          if(mono-lastUi>200){lastUi=mono;updateWall(wall);updateControls(ms);cameraUi();if(renderer.selected)updateBody(ms);}
        } catch(error){disposed=true;renderer.dispose();materials.dispose();cancelAnimationFrame(raf);clearAwake();clearTimeout(toastTimer);clearTimeout(resizeTimer);clearTimeout(materialRefreshTimer);fatal(error);}
      }
      document.addEventListener('visibilitychange',()=>{
        if(document.hidden){closePresetDialog(false);renderer.suspend();cancelAnimationFrame(raf);raf=0;lastFrame=0;clearAwake();}
        else if(!raf&&!disposed){renderer.resume();lastFrame=0;uiNow();wakePointer();raf=requestAnimationFrame(frame);}
      });
      window.addEventListener('pagehide',event=>{unlockEscape();closePresetDialog(false);materials.cancel();if(event.persisted)renderer.suspend();else {disposed=true;renderer.dispose();materials.dispose();}cancelAnimationFrame(raf);raf=0;lastFrame=0;clearAwake();clearTimeout(toastTimer);clearTimeout(resizeTimer);clearTimeout(materialRefreshTimer);});
      window.addEventListener('pageshow',()=>{if(!raf&&!disposed&&!document.hidden){renderer.resume();lastFrame=0;wakePointer();raf=requestAnimationFrame(frame);}});
      // A small, documented inspection surface for automated tests and future development.
      window.SolarTime=Object.freeze({version:'0.23',clock,renderer,materials,calibrationMs,getPresets:()=>cameraPresets.map(v=>v?{...v}:null),getModel:()=>A.modelStatus(),getState:()=>({fullscreen:!!document.fullscreenElement,escapeLock,simulationMs:clock.value(performance.now()),wallMs:Date.now(),rate:clock.rate,live:clock.live,paused:clock.paused,timezone,showSeconds,hourCycle,clockFont,zen,effectTime,frameCount:renderer.frameCount})});
      uiNow();
      const bootMono=performance.now(),bootMs=clock.value(bootMono);renderer.draw(bootMs,0,bootMono);
      await warmInitialScene();
      if(!disposed){renderer.draw(clock.value(performance.now()),0,performance.now());$('loading').classList.add('done');setTimeout(()=>$('loading').hidden=true,450);scheduleMaterialRefresh();}
      if(!document.hidden&&!disposed)raf=requestAnimationFrame(frame);
    } catch(error){fatal(error);}
  }
  requestAnimationFrame(()=>setTimeout(init,0));
})();
