/* Solar Time v0.04 — clock, interaction and accessible UI. */
(function () {
  'use strict';
  const $=id=>document.getElementById(id), A=window.SolarAstro;
  const STORAGE_KEY='eg.solar-time.v0.01';
  let toastTimer,awakeTimer;
  function toast(message) { clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,3400); }
  function fatal(error) { $('loading').hidden=true;$('fatal-error').hidden=false;$('fatal-message').textContent=error instanceof Error?error.message:String(error);console.error(error); }
  function init() {
    try {
      const renderer=new window.SolarRenderer($('starfield'),$('universe'));
      const clock=new A.SimulationClock(Date.now(),performance.now());
      let timezone='local',zen=false,raf=0,lastFrame=0,effectTime=0,lastWallKey='',lastUi=0,disposed=false;
      const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      renderer.options.twinkle=!reduced;renderer.options.activity=!reduced;
      const validKeys={orbits:'show-orbits',labels:'show-labels',twinkle:'show-twinkle',activity:'show-activity',pluto:'show-pluto',moon:'show-moon'};
      try {
        const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
        if(saved&&typeof saved==='object') {
          for(const key of Object.keys(validKeys))if(typeof saved[key]==='boolean')renderer.options[key]=saved[key];
          if(saved.quality==='low'||saved.quality==='auto')renderer.options.quality=saved.quality;
          if(saved.timezone==='utc')timezone='utc';
          if(Number.isFinite(saved.elevation))renderer.setOrbitView(renderer.camera.azimuth,saved.elevation*A.DEG);
          if(Number.isFinite(saved.panY))renderer.setPanY(saved.panY);
        }
      } catch (_) { /* Private browsing, corrupt JSON and blocked storage must not break the clock. */ }
      renderer.resize();
      for(const [key,id] of Object.entries(validKeys))$(id).checked=renderer.options[key];
      $('quality').value=renderer.options.quality;
      const zoneLabel=()=>timezone==='utc'?'UTC':Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop().replaceAll('_',' ').toUpperCase();
      function persist() { try { localStorage.setItem(STORAGE_KEY,JSON.stringify({...renderer.options,timezone,elevation:renderer.camera.elevation/A.DEG,panY:renderer.camera.panY})); } catch (_) {} }
      function cameraUi() {
        const deg=Math.round(renderer.camera.elevation/A.DEG),zoom=renderer.camera.zoom,limits=renderer.zoomLimits;
        $('elevation').min=-90;$('elevation').max=90;
        $('elevation').value=deg;$('elevation-value').textContent=deg+'°';
        $('zoom-value').textContent=zoom.toFixed(1)+'×';
        $('zoom-in').disabled=zoom>=limits.maxZoom;$('zoom-out').disabled=zoom<=limits.minZoom;
        const target=[A.SUN,...A.BODIES,A.MOON].find(b=>b.id===renderer.camera.focus);
        $('focus-reset').hidden=!target;$('focus-label').textContent=target?target.ko+' 추적 중':'';
      }
      cameraUi();
      const realFormat=()=>new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long',...(timezone==='utc'?{timeZone:'UTC'}:{})});
      let dateFormatter=realFormat();
      const two=v=>String(v).padStart(2,'0');
      function dateParts(ms) {const d=new Date(ms),p=timezone==='utc'?'getUTC':'get';return {y:d[p+'FullYear'](),mo:d[p+'Month']()+1,d:d[p+'Date'](),h:d[p+'Hours'](),mi:d[p+'Minutes'](),s:d[p+'Seconds']()};}
      function compactDate(ms) {const d=dateParts(ms);return `${d.y}.${two(d.mo)}.${two(d.d)}  ${two(d.h)}:${two(d.mi)}`;}
      function updateWall(wall) {
        const p=dateParts(wall),key=[p.y,p.mo,p.d,p.h,p.mi,p.s,timezone].join('-');if(key===lastWallKey)return;lastWallKey=key;
        $('hours').textContent=two(p.h);$('minutes').textContent=two(p.mi);$('seconds').textContent=two(p.s);
        $('wall-clock').dateTime=new Date(wall).toISOString();$('wall-clock').setAttribute('aria-label',`실제 기기 시각 ${p.h}시 ${p.mi}분 ${p.s}초`);
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
        const spinSeconds=Math.round(Math.abs(b.spin)*86400),hours=Math.floor(spinSeconds/3600),minutes=Math.floor(spinSeconds%3600/60),seconds=spinSeconds%60;
        const period=hours>=48?Math.abs(b.spin).toFixed(3)+'일':`${hours}시간 ${minutes}분 ${seconds}초`;
        const screenSeconds=Math.abs(b.spin)*86400/clock.rate;
        const playback=clock.paused?'일시정지':clock.live?'실제 시간':screenSeconds<1?`초당 ${(1/screenSeconds).toFixed(2)}회`:`${screenSeconds.toFixed(screenSeconds<100?1:0)}초에 1회`;
        $('body-spin').textContent=`자전 주기 약 ${period}${b.spin<0?' · 역행 자전':''} · ${playback} · 공전과 같은 시간 배율`;
        if(b.id==='sun') {
          $('stat-label-one').textContent='표현';setStat('stat-value-one','항성','');
          $('stat-label-two').textContent='태양계의 중심';setStat('stat-value-two','SUN','');
          $('body-note').textContent='표면의 움직임과 홍염은 실시간 태양 관측이 아닌 절차적 시각 효과입니다.';
        } else if(b.id==='moon') {
          $('stat-label-one').textContent='지구 공전 주기';setStat('stat-value-one','27.32','일');
          const phase=A.moonPhase(ms);$('stat-label-two').textContent='지구에서 본 밝은 면 · 근사';setStat('stat-value-two','약 '+Math.round(phase.fraction*100),'%');
          $('body-note').textContent=phase.name+' · 평균 원 궤도 근사로 실제 달력의 월령과 차이가 있습니다.';
        } else {
          $('stat-label-one').textContent='공전 주기';setStat('stat-value-one',b.period>1000?(b.period/365.25).toFixed(1):b.period.toFixed(2),b.period>1000?'년':'일');
          const p=A.positionAt(b,ms);$('stat-label-two').textContent='태양까지 거리 · 근사';setStat('stat-value-two',Math.hypot(p.x,p.y,p.z).toFixed(2),'AU');
          $('body-note').textContent=b.id==='pluto'?'고정된 평균 궤도 · 정밀 위치 예측용이 아닙니다.':b.id==='earth'?'지구·달 질량중심을 지구 위치로 근사합니다. 달의 궤도는 크기와 별개로 축척을 조정합니다.':'1 AU는 지구와 태양 사이의 평균 거리입니다. 크기와 거리는 화면에서 축척을 조정했습니다.';
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
        updateBody(clock.value(performance.now()));
      }
      $('body-close').addEventListener('click',()=>{const id=renderer.selected;closeBody();navButtons.get(id)?.focus({preventScroll:true});});
      function updateControls(ms) {
        $('pause-button').setAttribute('aria-pressed',String(clock.paused));$('pause-button').setAttribute('aria-label',clock.paused?'공전 재생':'공전 일시정지');
        $('pause-button').title=(clock.paused?'공전 재생':'공전 일시정지')+' · Space';$('pause-icon').toggleAttribute('hidden',clock.paused);$('play-icon').toggleAttribute('hidden',!clock.paused);
        $('live-button').classList.toggle('active',clock.live);$('live-button').setAttribute('aria-pressed',String(clock.live));
        for(const b of document.querySelectorAll('[data-rate]')) {const active=!clock.live&&Number(b.dataset.rate)===clock.rate;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));}
        $('status-dot').classList.toggle('simulated',!clock.live);$('status-dot').classList.toggle('paused',clock.paused);
        $('mode-label').textContent=clock.paused?'PAUSED':clock.live?'LIVE ORBITS':'TIME TRAVEL';
        $('simulation-date').textContent=compactDate(ms);$('simulation-date').dateTime=new Date(ms).toISOString();
        const ratio=clock.rate===1?'1 ×':clock.rate===86400?'1 DAY / SEC':clock.rate===604800?'7 DAYS / SEC':'1 YEAR / SEC';
        $('speed-value').textContent=clock.paused?'PAUSED':ratio;
        $('playback-hint').textContent=clock.paused?'공전 일시정지 · 위 시계는 실제 시간입니다':clock.live?'지금, 이 순간의 태양계':clock.rate===86400?'1초 = 1일 · 목성 약 2.42회 / 초':'고배속 · 자전이 역회전·정지처럼 보일 수 있습니다';
      }
      function uiNow() {const mono=performance.now(),wall=Date.now(),ms=clock.value(mono,wall);updateWall(wall);updateControls(ms);updateBody(ms);}
      function now() {clock.now(performance.now());uiNow();toast('현재 시각의 태양계로 돌아왔습니다.');}
      $('live-button').addEventListener('click',now);
      for(const button of document.querySelectorAll('[data-rate]'))button.addEventListener('click',()=>{clock.setRate(Number(button.dataset.rate),performance.now());uiNow();});
      function pause() {clock.toggle(performance.now());uiNow();}
      $('pause-button').addEventListener('click',pause);
      $('timezone-button').addEventListener('click',()=>{timezone=timezone==='local'?'utc':'local';dateFormatter=realFormat();lastWallKey='';uiNow();persist();});
      function settings(open) {const next=open===undefined?$('settings-panel').hidden:open;$('settings-panel').hidden=!next;$('settings-button').setAttribute('aria-expanded',String(next));if(next)closeBody();}
      $('settings-button').addEventListener('click',()=>settings());$('settings-close').addEventListener('click',()=>{settings(false);$('settings-button').focus();});
      for(const [key,id] of Object.entries(validKeys))$(id).addEventListener('change',()=>{renderer.setOption(key,$(id).checked);if((key==='pluto'||key==='moon')&&!$(id).checked&&renderer.selected===key)closeBody();navVisibility();persist();});
      $('quality').addEventListener('change',()=>{renderer.setOption('quality',$('quality').value);persist();});
      $('elevation').addEventListener('input',()=>{renderer.setOrbitView(renderer.camera.azimuth,Number($('elevation').value)*A.DEG);cameraUi();persist();});
      function reset() {renderer.resetCamera();cameraUi();persist();}
      $('reset-view').addEventListener('click',reset);$('fit-view').addEventListener('click',reset);
      function zoom(factor,target=null) {renderer.setZoom(renderer.camera.zoom*factor,target);cameraUi();}
      function focusBody(id) {
        if(!id)return;
        renderer.focusBody(id);cameraUi();
      }
      $('focus-body').addEventListener('click',()=>focusBody(renderer.selected));
      $('focus-reset').addEventListener('click',reset);
      $('zoom-in').addEventListener('click',()=>zoom(1.2));$('zoom-out').addEventListener('click',()=>zoom(1/1.2));
      async function fullscreen() {
        try {if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('이 브라우저는 전체 화면을 지원하지 않습니다.');}
        catch(_){toast('전체 화면을 열지 못했습니다. 브라우저의 F11 키를 사용하세요.');}
      }
      $('fullscreen-button').addEventListener('click',fullscreen);
      document.addEventListener('fullscreenchange',()=>{$('fullscreen-button').setAttribute('aria-label',document.fullscreenElement?'전체 화면 종료':'전체 화면');renderer.resize();});
      // One idle owner for both the cursor and the viewing-mode exit affordance.
      function clearAwake() {clearTimeout(awakeTimer);awakeTimer=undefined;document.body.classList.remove('pointer-awake');}
      function wakePointer() {
        clearAwake();
        if(!zen||disposed||document.hidden)return;
        document.body.classList.add('pointer-awake');
        if(pointers.size)return; // Do not hide midway through a held drag/pinch.
        awakeTimer=setTimeout(()=>{awakeTimer=undefined;if(zen)document.body.classList.remove('pointer-awake');},1800);
      }
      function setZen(value) {
        zen=value;clearAwake();document.body.classList.toggle('zen',zen);$('show-ui').hidden=!zen;
        renderer.hover=null;
        if(zen){closeBody();settings(false);$('universe').focus({preventScroll:true});wakePointer();}
        else $('hide-ui').focus({preventScroll:true});
      }
      $('hide-ui').addEventListener('click',()=>setZen(true));$('show-ui').addEventListener('click',()=>setZen(false));
      for(const event of ['pointermove','pointerdown','pointerup','pointercancel','wheel','keydown','focusin'])document.addEventListener(event,wakePointer,{passive:true});
      $('help-button').addEventListener('click',()=>{$('help-dialog').showModal();});
      $('date-button').addEventListener('click',()=>{
        const p=dateParts(clock.value(performance.now()));$('date-input').value=`${p.y}-${two(p.mo)}-${two(p.d)}T${two(p.h)}:${two(p.mi)}`;
        $('date-timezone').textContent=timezone==='utc'?'UTC':zoneLabel()+' · 현지 시간';$('date-error').hidden=true;$('date-dialog').showModal();
      });
      $('date-close').addEventListener('click',()=>$('date-dialog').close());
      $('date-form').addEventListener('submit',event=>{
        event.preventDefault();const text=$('date-input').value;
        try {if(!text)throw new Error('날짜와 시간을 선택해 주세요.');const ms=new Date(text+(timezone==='utc'?'Z':'')).getTime();clock.setDate(ms,performance.now());renderer.dirty=true;$('date-dialog').close();uiNow();toast('선택한 순간입니다. 배속 버튼으로 공전을 시작하세요.');}
        catch(_){$('date-error').hidden=false;$('date-error').textContent='1800년부터 2999년 사이의 유효한 날짜를 선택해 주세요.';}
      });
      for(const dialog of [$('help-dialog'),$('date-dialog')])dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
      const canvas=$('universe'),pointers=new Map();
      let drag=null,pinchDistance=0,pinchZoom=1,pinched=false;
      function pointerPosition(event) {const r=canvas.getBoundingClientRect();return {x:event.clientX-r.left,y:event.clientY-r.top};}
      canvas.addEventListener('pointerdown',event=>{
        if(event.pointerType==='mouse'&&event.button!==0&&event.button!==1)return;
        const pan=event.pointerType==='mouse'&&event.button===1;
        if(pan)event.preventDefault();
        const p=pointerPosition(event);pointers.set(event.pointerId,p);canvas.setPointerCapture(event.pointerId);
        if(pointers.size===1){drag={x:p.x,y:p.y,startX:p.x,startY:p.y,startPanY:renderer.camera.panY,mode:pan?'pan':'orbit',moved:false};pinched=false;}
        if(pointers.size===2){const [a,b]=[...pointers.values()];pinchDistance=Math.hypot(a.x-b.x,a.y-b.y);pinchZoom=renderer.camera.zoom;pinched=true;}
      });
      canvas.addEventListener('pointermove',event=>{
        const p=pointerPosition(event);
        if(!pointers.has(event.pointerId)) {renderer.hover=zen?null:renderer.hit(p.x,p.y);canvas.style.cursor=renderer.hover?'pointer':'grab';return;}
        pointers.set(event.pointerId,p);
        if(pointers.size>=2) {
          const [a,b]=[...pointers.values()];if(pinchDistance>0){renderer.setZoom(pinchZoom*Math.hypot(a.x-b.x,a.y-b.y)/pinchDistance,renderer.hit((a.x+b.x)/2,(a.y+b.y)/2));cameraUi();}if(drag)drag.moved=true;return;
        }
        if(!drag)return;
        const dx=p.x-drag.x,dy=p.y-drag.y;
        if(Math.hypot(p.x-drag.startX,p.y-drag.startY)>4)drag.moved=true;
        if(drag.moved&&!pinched){
          if(drag.mode==='pan')renderer.setPanY(drag.startPanY+(p.y-drag.startY)/renderer.h);
          else renderer.setOrbitView(renderer.camera.azimuth+dx*.004,renderer.camera.elevation+dy*.003);
          cameraUi();canvas.classList.add('dragging');canvas.style.cursor=drag.mode==='pan'?'ns-resize':'grabbing';
        }
        drag.x=p.x;drag.y=p.y;
      });
      function endPointer(event,cancel=false) {
        if(!pointers.has(event.pointerId))return;const p=pointerPosition(event);pointers.delete(event.pointerId);
        if(!cancel&&!pinched&&drag&&drag.mode==='orbit'&&!drag.moved&&pointers.size===0){if(!zen)selectBody(renderer.hit(p.x,p.y));settings(false);}
        if(pointers.size===0){drag=null;pinched=false;canvas.classList.remove('dragging');canvas.style.cursor='grab';persist();}
        else if(drag){const last=[...pointers.values()][0];drag.x=last.x;drag.y=last.y;drag.moved=true;}
        if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
      }
      // Suppress middle-button autoscroll / aux-click only over the viewport.
      for(const type of ['mousedown','auxclick'])canvas.addEventListener(type,event=>{if(event.button===1)event.preventDefault();});
      canvas.addEventListener('pointerup',event=>endPointer(event));canvas.addEventListener('pointercancel',event=>endPointer(event,true));
      canvas.addEventListener('lostpointercapture',event=>{pointers.delete(event.pointerId);if(!pointers.size){drag=null;canvas.classList.remove('dragging');wakePointer();}});
      canvas.addEventListener('pointerleave',()=>{if(!pointers.size)renderer.hover=null;});
      canvas.addEventListener('wheel',event=>{event.preventDefault();const p=pointerPosition(event);zoom(Math.exp(-A.clamp(event.deltaY,-120,120)*.0017),renderer.hit(p.x,p.y));},{passive:false});
      canvas.addEventListener('dblclick',event=>{const p=pointerPosition(event),id=renderer.hit(p.x,p.y);if(id)focusBody(id);});
      document.addEventListener('keydown',event=>{
        if(event.key==='Escape'){if(!$('help-dialog').open&&!$('date-dialog').open){settings(false);closeBody();if(zen)setZen(false);}return;}
        if(event.repeat||event.ctrlKey||event.metaKey||event.altKey||$('help-dialog').open||$('date-dialog').open||event.target.closest?.('input,select,textarea,button,a,[contenteditable=true]'))return;
        const key=event.key.toLowerCase();
        if(key===' '){event.preventDefault();pause();}
        else if(key==='r')now();else if(key==='f')fullscreen();else if(key==='h')setZen(!zen);else if(key==='0')reset();
        else if(key==='+'||key==='=')zoom(1.15);else if(key==='-')zoom(1/1.15);
        else if(event.target===canvas&&['arrowleft','arrowright','arrowup','arrowdown'].includes(key)) {
          event.preventDefault();if(key==='arrowleft')renderer.camera.azimuth-=.08;if(key==='arrowright')renderer.camera.azimuth+=.08;
          if(key==='arrowup')renderer.camera.elevation+=3*A.DEG;if(key==='arrowdown')renderer.camera.elevation-=3*A.DEG;
          renderer.setOrbitView(renderer.camera.azimuth,renderer.camera.elevation);cameraUi();persist();
        }
      });
      let resizeTimer;
      window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>renderer.resize(),70);},{passive:true});
      function frame(mono) {
        if(disposed||document.hidden){raf=0;return;}
        raf=requestAnimationFrame(frame);
        const fps=renderer.options.quality==='low'?24:window.innerWidth<680?30:60;
        if(mono-lastFrame<1000/fps-.5)return;
        const dt=lastFrame?Math.max(0,(mono-lastFrame)/1000):0;lastFrame=mono;
        if(!clock.paused)effectTime+=dt;
        const wall=Date.now(),ms=clock.value(mono,wall);
        if(!clock.paused&&!clock.live&&ms>=A.MAX_TIME){clock.anchorMs=A.MAX_TIME;clock.anchorMono=mono;clock.paused=true;toast('2999년 끝에 도달해 정지했습니다. 실제 시간으로 돌아갈 수 있습니다.');}
        try {
          renderer.draw(ms,effectTime,mono);
          if(mono-lastUi>200){lastUi=mono;updateWall(wall);updateControls(ms);cameraUi();if(renderer.selected)updateBody(ms);}
        } catch(error){disposed=true;cancelAnimationFrame(raf);clearAwake();clearTimeout(toastTimer);clearTimeout(resizeTimer);fatal(error);}
      }
      document.addEventListener('visibilitychange',()=>{
        if(document.hidden){cancelAnimationFrame(raf);raf=0;lastFrame=0;clearAwake();}
        else if(!raf&&!disposed){lastFrame=0;uiNow();wakePointer();raf=requestAnimationFrame(frame);}
      });
      window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);raf=0;lastFrame=0;clearAwake();clearTimeout(toastTimer);clearTimeout(resizeTimer);});
      window.addEventListener('pageshow',()=>{if(!raf&&!disposed&&!document.hidden){lastFrame=0;wakePointer();raf=requestAnimationFrame(frame);}});
      // A small, documented inspection surface for automated tests and future development.
      window.SolarTime=Object.freeze({version:'0.04',clock,renderer,getState:()=>({simulationMs:clock.value(performance.now()),wallMs:Date.now(),rate:clock.rate,live:clock.live,paused:clock.paused,timezone,zen,effectTime,frameCount:renderer.frameCount})});
      uiNow();renderer.draw(clock.value(performance.now()),0);$('loading').classList.add('done');setTimeout(()=>$('loading').hidden=true,450);
      if(!document.hidden)raf=requestAnimationFrame(frame);
    } catch(error){fatal(error);}
  }
  requestAnimationFrame(()=>setTimeout(init,0));
})();
