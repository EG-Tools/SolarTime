/* Solar Time v0.38 — clock, interaction and accessible UI. */
(function () {
  'use strict';
  const $=id=>document.getElementById(id), A=window.SolarAstro;
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
  function detectedLanguage(){
    const zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'',languages=(navigator.languages?.length?navigator.languages:[navigator.language||'']).map(value=>String(value).toLowerCase());
    if(/(?:shanghai|chongqing|urumqi|hong_kong|macau)/i.test(zone))return 'chn';
    if(/tokyo/i.test(zone))return 'jpn';
    if(/seoul/i.test(zone))return 'kor';
    if(/london|belfast/i.test(zone))return 'eu';
    if(/kolkata|calcutta/i.test(zone))return 'hi';
    if(/madrid|canary/i.test(zone))return 'es';
    if(/berlin|busingen/i.test(zone))return 'de';
    if(/paris/i.test(zone))return 'fr';
    if(/^America\//i.test(zone))return 'en';
    if(languages.some(value=>/^zh(?:-|$)/.test(value)))return 'chn';
    if(languages.some(value=>/^ja(?:-|$)/.test(value)))return 'jpn';
    if(languages.some(value=>/^ko(?:-|$)/.test(value)))return 'kor';
    if(languages.some(value=>/^en-gb(?:-|$)/.test(value)))return 'eu';
    if(languages.some(value=>/^hi(?:-|$)/.test(value)))return 'hi';
    if(languages.some(value=>/^es(?:-|$)/.test(value)))return 'es';
    if(languages.some(value=>/^de(?:-|$)/.test(value)))return 'de';
    if(languages.some(value=>/^fr(?:-|$)/.test(value)))return 'fr';
    return 'en';
  }
  const COPY={
    kor:{
      metaDescription:'별빛과 함께 흐르는 태양계 시계. 실제 시각, 행성의 공전, 지구와 달을 만나는 작은 우주.',
      universeAria:'태양계. 좌클릭 드래그로 시점을 자유 회전하고, 가운데 버튼 드래그로 상하좌우 이동합니다. 우측 줌·이동 버튼으로 휠 작동 방식을 바꿀 수 있습니다.',
      languageChange:'언어 변경',languageCurrent:'현재 한국어',musicOn:'배경음악 켜기',musicOff:'배경음악 끄기',musicPrevious:'이전 음악',musicNext:'다음 음악',musicUnavailable:'배경음악을 재생할 수 없습니다.',helpLabel:'사용 방법과 계산 기준',settings:'화면 설정',settingsClose:'설정 닫기',
      actualScale:'실제 크기 비율',orbitSpacing:'일반 보기 궤도 간격',orbitSpacingAria:'일반 보기의 행성 궤도 간격',orbitBrightness:'궤도 밝기',orbitBrightnessAria:'궤도선 밝기. 0이면 궤도선이 숨겨집니다.',displaySize:'화면 표시 크기',displaySizeAria:'선택한 천체의 화면 표시 크기',satelliteOrbitSpacing:'위성 궤도 간격',satelliteOrbitSpacingAria:'선택한 행성의 위성 궤도 간격',solarOrbitSpacing:'수성 궤도 간격',solarOrbitSpacingAria:'태양을 기준으로 수성과 바깥 행성 전체의 궤도 간격',resetSize:'크기, 궤도 리셋',actualSizeLocked:'실제 크기 비율에서는 크기와 궤도를 조절할 수 없습니다.',resetDefaults:'초기화',resetDefaultsTitle:'초기 설정으로 돌아갈까요?',resetDefaultsPrompt:'옵션과 천체 크기, 궤도 및 일반 시점이 초기값으로 돌아갑니다. 카메라 1·2·3 저장값은 유지됩니다.',resetComplete:'초기 설정으로 돌아왔습니다.',yes:'예',no:'아니오',bodyNames:'천체 이름',avoidLabels:'이름 겹침 자동 정리',showSeconds:'시계 초 표시',hourCycle:'24시간 표기',hourCycleAria:'24시간 표기. 켜면 24시간, 끄면 12시간',hour24:'24시간',hour12:'12시간',clockFont:'시계 숫자 폰트',sunShine:'태양 샤인',satellites:'주요 위성 · 달과 유로파',pluto:'명왕성',dwarfPlanet:'왜행성',comets:'멀리 지나는 혜성',
      selectedBody:'선택한 천체 정보',bodyClose:'천체 정보 닫기',focusBody:'가까이 보기 · 천체 추적',viewControls:'시점 조절',zoomIn:'확대',zoomOut:'축소',moveCloser:'앞으로 이동',moveFarther:'뒤로 이동',zoomValue:'화면 확대 배율',moveValue:'카메라 이동 배율',zoomMode:'줌',moveMode:'이동',cameraMode:'휠 작동 방식 · {mode}',cameraModeAria:'휠 모드: {mode}. 누르면 다른 방식으로 전환',homeView:'기본 시점',cameraPresets:'카메라 시점 저장',
      playbackControls:'공전 재생 조절',realTime:'실제 시간',orbitSpeed:'공전 속도',speedSlider:'1초당 진행하는 시간',sources:'출처',bodySelect:'천체 선택',scaleNoteLineOne:'크기·거리 축척 조정 · 평균 궤도 근사',scaleNoteLineTwo:'자전·공전 시간 연동',
      apply:'이동',save:'저장',delete:'삭제',cancel:'취소',helpClose:'도움말 닫기',helpTitle:'사용 방법과 계산 기준',releaseNotes:'업데이트 내역',releaseNotesNewer:'최신 업데이트 내역',releaseNotesOlder:'과거 업데이트 내역',basicControls:'기본 조작',supportMessage:'이 프로그램이 도움이 되셨다면 개발자에게 커피 한 잔 후원해 주세요!',supportDetail:'여러분들의 도움이 서버 유지와 개발을 지속하는데 큰 도움이 됩니다!',supportKrw:'원화로 후원',supportUsd:'달러로 후원',
      basicHelp:'좌클릭 드래그는 위아래 제한 없이 시점을 한 바퀴 계속 회전합니다. 가운데 버튼 드래그는 화면을 상하좌우 ±80% 이동합니다. 우측 맨 위 버튼에서 휠을 평면적인 줌 또는 원근감이 생기는 실제 카메라 이동으로 전환할 수 있습니다. 천체를 더블클릭하거나 «가까이 보기»를 누르면 추적합니다. 0은 기본 시점, 1·2·3은 줌/이동 방식까지 함께 저장하는 시점입니다.',
      timeAndCalculation:'시간과 계산',timeHelp:'상단 시계는 선택한 언어·지역에 맞춰 현지 실제 시간을 표시합니다. 하단 실제 시간을 끄면 시간·일·년 단위의 슬라이더로 시뮬레이션 속도를 조절합니다. 시간은 1분~24시간, 일은 1~365일, 년은 1~20년 범위입니다.',
      orbitHelp:'행성은 타원 궤도를 따라 근점에서 빠르고 원점에서 느리게 움직입니다. 달과 유로파는 각각 지구와 목성의 자식으로 현재 시뮬레이션 시각의 위치를 계산하며, 이심률은 0.05와 0.01만 적용합니다. 장기 섭동과 미세 거리 변화는 제외하므로 관측·항법·일식/월식 예측용 정밀 천문력이 아닙니다.',
      pause:'일시정지',fullscreen:'전체 화면',zenMode:'감상 모드',savedViews:'저장 시점',stepExit:'단계별 종료',loading:'작은 우주를 펼치는 중',fatalTitle:'화면을 시작하지 못했습니다.',fatalRetry:'최신 Edge 또는 Chrome에서 다시 열어 주세요.',loadingTime:'시간을 불러오는 중',
      rotateRight:'우회전',rotateLeft:'좌회전',start:'시작',stop:'정지',rotateRunning:'{direction} 중 · 누르면 정지',rotateRate:'{direction} · 초당 2°',
      presetButtonTitle:'{n}번 카메라 · 좌·우클릭: 적용/저장/삭제/취소 · 숫자 {n}: 부드럽게 이동',presetAria:'{n}번 카메라 {state}. 좌·우클릭으로 카메라 메뉴 열기. 숫자 {n}로 불러오기.',saved:'저장됨',empty:'비어 있음',
      emptyPreset:'{n}번은 비어 있습니다. 숫자 버튼을 눌러 먼저 저장하세요.',hiddenBody:'저장된 천체의 표시를 켠 뒤 다시 불러오세요.',presetTitle:'{n}번 카메라',presetSavedNote:'저장된 시점을 적용하거나 현재 시점으로 덮어씁니다.',presetEmptyNote:'비어 있는 카메라입니다. 저장을 누르면 현재 시점을 보관합니다.',presetSaved:'{n}번 카메라를 저장했습니다.',presetDeleted:'{n}번 카메라를 삭제했습니다.',temporaryOnly:' 현재 창에서만 유지됩니다.',
      wallClockAria:'실제 기기 시각 {time}',timezoneTitle:'현지 시간 / UTC 전환',timezoneAria:'{zone} 표시 중. 눌러서 시간대 전환',localTime:'현지 시간',bodyInfo:'{name} 정보',photoMap:'사진 지도',builtInImage:'내장 이미지',builtInMaterial:'내장 재질',publicPhotoUnavailable:'공개 사진 미수신',
      hourUnit:'시간',minuteUnit:'분',secondUnit:'초',dayUnit:'일',yearUnit:'년',timesPerSecond:'초당 {value}회',secondsPerTurn:'{value}초에 1회',paused:'일시정지',rotationSummary:'자전 주기 약 {period}{retrograde} · {playback} · 공전과 같은 시간 배율',retrograde:' · 역행 자전',
      meanTemperature:'평균 기온',temperatureRange:'최저 {min} · 최고 {max} °C',surfaceGravity:'표면 중력',earthGravityRatio:'지구 대비 {value}배',
      representation:'표현',star:'항성',systemCenter:'태양계의 중심',sunNote:'표면은 자전하며 밝고 어두운 플라스마 결이 미세하게 흐릅니다. 주변 샤인과 표면 움직임은 관상용이며 실시간 태양 관측 데이터가 아닙니다.',earthOrbitPeriod:'지구 공전 주기',brightSide:'지구에서 본 밝은 면 · 근사',approximately:'약 {value}',moonNote:'{phase} · JPL 기준 시각에 맞춘 평균 궤도 위치 · 평균 거리는 고정입니다.',jupiterOrbitPeriod:'목성 공전 주기',jupiterDistance:'목성까지 평균 거리',europaNote:'JPL 기준 시각에 맞춘 현재 공전 위치 · 평균 거리는 고정이며 장기적인 미세 변화는 계산하지 않습니다.',orbitPeriod:'공전 주기',sunDistance:'태양까지 거리 · 근사',plutoNote:'고정된 평균 궤도 · 정밀 위치 예측용이 아닙니다.',earthNote:'{region} · {city} 기준 {dayNight} / 태양 고도 약 {altitude}° · 간단한 근사',day:'낮',night:'밤',auNote:'1 AU는 지구와 태양 사이의 평균 거리입니다. 크기와 거리는 화면에서 축척을 조정했습니다.',koreaView:'{region} 보기 · 낮/밤 확인',stormView:'붉은 소용돌이 보기',
      speedUnitActive:'속도 단위 {unit}. 누르면 다음 단위로 전환',speedUnitReady:'속도 단위 {unit} 대기. 누르면 이 단위로 배속 시작',orbitPlay:'공전 재생',orbitPause:'공전 일시정지',returnedNow:'현재 시각의 태양계로 돌아왔습니다.',escapePermission:'ESC 순차 해제에는 키보드 권한이 필요합니다. 권한이 없으면 브라우저가 전체 화면을 먼저 종료할 수 있습니다.',fullscreenExitFailed:'전체 화면을 종료하지 못했습니다. ESC를 다시 누르세요.',fullscreenUnsupported:'이 브라우저는 전체 화면을 지원하지 않습니다.',fullscreenOpenFailed:'전체 화면을 열지 못했습니다. 브라우저의 전체 화면 권한을 확인하세요.',fullscreenExit:'전체 화면 종료',zenOff:'감상 모드 끄기',zenOn:'감상 모드 켜기',normalMode:'일반 모드',yearLimit:'2999년 끝에 도달해 정지했습니다. 실제 시간으로 돌아갈 수 있습니다.'
    },
    en:{
      metaDescription:'A solar-system clock flowing with the stars—real time, planetary orbits, Earth and Moon in a small cosmos.',
      universeAria:'Solar system. Left-drag rotates freely, middle-drag pans, and the top-right Zoom/Move control changes the wheel camera mode.',
      languageChange:'Change language',languageCurrent:'English selected',musicOn:'Play background music',musicOff:'Stop background music',musicPrevious:'Previous track',musicNext:'Next track',musicUnavailable:'Background music could not be played.',helpLabel:'Guide and calculation notes',settings:'Display settings',settingsClose:'Close settings',
      actualScale:'True size ratio',orbitSpacing:'Overview orbit spacing',orbitSpacingAria:'Planet orbit spacing in overview mode',orbitBrightness:'Orbit brightness',orbitBrightnessAria:'Orbit-line brightness. Zero hides orbit lines.',displaySize:'Display size',displaySizeAria:'Display size of the selected body',satelliteOrbitSpacing:'Moon orbit spacing',satelliteOrbitSpacingAria:'Orbit spacing for the selected planet’s moon',solarOrbitSpacing:'Mercury orbit spacing',solarOrbitSpacingAria:'Orbit spacing of Mercury and every outer planet relative to the Sun',resetSize:'Reset size & orbit',actualSizeLocked:'Size and orbit adjustment is unavailable in true-size mode.',resetDefaults:'Reset',resetDefaultsTitle:'Return to the initial setup?',resetDefaultsPrompt:'Options, body sizes, orbits and the normal view will return to their initial values. Camera slots 1–3 will be kept.',resetComplete:'Initial setup restored.',yes:'Yes',no:'No',bodyNames:'Body names',avoidLabels:'Prevent label overlap',showSeconds:'Show clock seconds',hourCycle:'24-hour clock',hourCycleAria:'24-hour clock. On is 24-hour, off is 12-hour',hour24:'24 hour',hour12:'12 hour',clockFont:'Clock numeral font',sunShine:'Solar shine',satellites:'Major moons · Moon and Europa',pluto:'Pluto',dwarfPlanet:'Dwarf planet',comets:'Distant comets',
      selectedBody:'Selected body information',bodyClose:'Close body information',focusBody:'Closer view · Track body',viewControls:'View controls',zoomIn:'Zoom in',zoomOut:'Zoom out',moveCloser:'Move closer',moveFarther:'Move farther',zoomValue:'View zoom level',moveValue:'Camera travel level',zoomMode:'ZOOM',moveMode:'MOVE',cameraMode:'Wheel mode · {mode}',cameraModeAria:'Wheel mode: {mode}. Press to switch modes.',homeView:'Default view',cameraPresets:'Saved camera views',
      playbackControls:'Orbit playback controls',realTime:'Real time',orbitSpeed:'Orbit speed',speedSlider:'Time advanced per second',sources:'Sources',bodySelect:'Select body',scaleNoteLineOne:'Adjusted size and distance scale · Mean orbit approximation',scaleNoteLineTwo:'Rotation and orbit linked to time',
      apply:'Move',save:'Save',delete:'Delete',cancel:'Cancel',helpClose:'Close help',helpTitle:'Guide and calculation notes',releaseNotes:'Update history',releaseNotesNewer:'Newer update',releaseNotesOlder:'Older update',basicControls:'Basic controls',supportMessage:'If this program has been helpful, please support the developer with a cup of coffee!',supportDetail:'Your support makes a big difference in keeping the servers running and development going!',supportKrw:'Support in KRW',supportUsd:'Support in USD',
      basicHelp:'Left-drag rotates continuously through a full turn without a vertical stop. Middle-drag pans up, down, left or right by ±80%. The top button on the right switches the wheel between flat zoom and true camera travel with perspective. Double-click a body or choose “Closer view” to track it. 0 restores the default view; 1·2·3 save the view together with its Zoom/Move mode.',
      timeAndCalculation:'Time and calculation',timeHelp:'The upper clock follows the real local time of the selected language and region. Turn off Real time below to adjust simulation speed in hours, days or years. The ranges are 1 minute–24 hours, 1–365 days, and 1–20 years per second.',
      orbitHelp:'Planets move on elliptical orbits, faster near perihelion and slower near aphelion. Moon and Europa are children of Earth and Jupiter, with positions calculated for the simulation time and eccentricities of 0.05 and 0.01. Long-term perturbations and minute distance changes are omitted, so this is not a precision ephemeris for observation, navigation or eclipse prediction.',
      pause:'Pause',fullscreen:'Fullscreen',zenMode:'Viewing mode',savedViews:'Saved views',stepExit:'Step-by-step exit',loading:'Opening a small cosmos',fatalTitle:'Unable to start the view.',fatalRetry:'Open it again in the latest Edge or Chrome.',loadingTime:'Loading time',
      rotateRight:'Rotate right',rotateLeft:'Rotate left',start:'start',stop:'stop',rotateRunning:'{direction} · click to stop',rotateRate:'{direction} · 2° per second',
      presetButtonTitle:'Camera {n} · left/right click: apply/save/delete/cancel · number {n}: smooth recall',presetAria:'Camera {n} is {state}. Left- or right-click to open its menu. Press {n} to recall it.',saved:'saved',empty:'empty',
      emptyPreset:'Camera {n} is empty. Use its number button to save a view first.',hiddenBody:'Turn on the saved body, then recall this view again.',presetTitle:'Camera {n}',presetSavedNote:'Apply the saved view or overwrite it with the current view.',presetEmptyNote:'This camera slot is empty. Save to keep the current view.',presetSaved:'Camera {n} saved.',presetDeleted:'Camera {n} deleted.',temporaryOnly:' It will remain only in this window.',
      wallClockAria:'Device time {time}',timezoneTitle:'Switch local time / UTC',timezoneAria:'Showing {zone}. Press to switch time zone.',localTime:'local time',bodyInfo:'Information about {name}',photoMap:'photographic map',builtInImage:'built-in image',builtInMaterial:'built-in material',publicPhotoUnavailable:'public image unavailable',
      hourUnit:'Hour',minuteUnit:'min',secondUnit:'sec',dayUnit:'Day',yearUnit:'Year',timesPerSecond:'{value} rotations per second',secondsPerTurn:'one rotation every {value} seconds',paused:'Paused',rotationSummary:'Rotation period about {period}{retrograde} · {playback} · same time scale as orbit',retrograde:' · retrograde rotation',
      meanTemperature:'Mean temperature',temperatureRange:'Low {min} · high {max} °C',surfaceGravity:'Surface gravity',earthGravityRatio:'{value}× Earth',
      representation:'Type',star:'Star',systemCenter:'Center of the solar system',sunNote:'Bright and dark plasma detail drifts subtly across the rotating surface. Its motion and surrounding shine are visual effects.',earthOrbitPeriod:'Orbit around Earth',brightSide:'Illuminated side seen from Earth · approximate',approximately:'about {value}',moonNote:'{phase} · mean orbit position aligned to a JPL reference time',jupiterOrbitPeriod:'Orbit around Jupiter',jupiterDistance:'Mean distance to Jupiter',europaNote:'Current orbital position aligned to a JPL reference time',orbitPeriod:'Orbital period',sunDistance:'Distance from Sun · approximate',plutoNote:'Fixed mean orbit',earthNote:'{region} · {city}',day:'daylight',night:'night',auNote:'',koreaView:'View {region} · day/night',stormView:'View the Great Red Spot',
      speedUnitActive:'Speed unit: {unit}. Press to cycle units.',speedUnitReady:'Speed unit {unit} ready. Press to start at this unit.',orbitPlay:'Play orbits',orbitPause:'Pause orbits',returnedNow:'Returned to the solar system at the current time.',escapePermission:'Sequential ESC handling needs keyboard permission. Without it, the browser may exit fullscreen first.',fullscreenExitFailed:'Could not exit fullscreen. Press ESC again.',fullscreenUnsupported:'This browser does not support fullscreen.',fullscreenOpenFailed:'Could not open fullscreen. Check the browser fullscreen permission.',fullscreenExit:'Exit fullscreen',zenOff:'Turn off viewing mode',zenOn:'Turn on viewing mode',normalMode:'Normal mode',yearLimit:'Stopped at the end of year 2999. You can return to Real time.'
    },
    chn:{
      metaDescription:'伴随星光流动的太阳系时钟，在小宇宙中呈现实时时间、行星公转、地球与月球。',
      universeAria:'太阳系。按住左键可自由旋转，按住中键可平移，右上角的缩放/移动按钮可切换滚轮相机模式。',
      languageChange:'切换语言',languageCurrent:'当前为中文',musicOn:'播放背景音乐',musicOff:'停止背景音乐',musicPrevious:'上一首',musicNext:'下一首',musicUnavailable:'无法播放背景音乐。',helpLabel:'使用方法与计算说明',settings:'显示设置',settingsClose:'关闭设置',
      actualScale:'真实大小比例',orbitSpacing:'普通视图轨道间距',orbitSpacingAria:'普通视图中的行星轨道间距',orbitBrightness:'轨道亮度',orbitBrightnessAria:'轨道线亮度。设为 0 时隐藏轨道线。',displaySize:'显示大小',displaySizeAria:'所选天体的显示大小',satelliteOrbitSpacing:'卫星轨道间距',satelliteOrbitSpacingAria:'所选行星的卫星轨道间距',solarOrbitSpacing:'水星轨道间距',solarOrbitSpacingAria:'以太阳为中心的水星及所有外侧行星轨道间距',resetSize:'重置大小与轨道',actualSizeLocked:'真实大小比例下无法调整大小与轨道。',resetDefaults:'重置',resetDefaultsTitle:'恢复初始设置吗？',resetDefaultsPrompt:'选项、天体大小、轨道和普通视角将恢复初始值。相机 1–3 的保存内容会保留。',resetComplete:'已恢复初始设置。',yes:'是',no:'否',bodyNames:'天体名称',avoidLabels:'自动避免名称重叠',showSeconds:'显示时钟秒数',hourCycle:'24小时制',hourCycleAria:'24小时制。开启为24小时，关闭为12小时',hour24:'24小时',hour12:'12小时',clockFont:'时钟数字字体',sunShine:'太阳光芒',satellites:'主要卫星 · 月球与木卫二',pluto:'冥王星',dwarfPlanet:'矮行星',comets:'远方彗星',
      selectedBody:'所选天体信息',bodyClose:'关闭天体信息',focusBody:'近距离查看 · 跟踪天体',viewControls:'视角控制',zoomIn:'放大',zoomOut:'缩小',moveCloser:'向前移动',moveFarther:'向后移动',zoomValue:'视图缩放倍率',moveValue:'相机移动倍率',zoomMode:'缩放',moveMode:'移动',cameraMode:'滚轮模式 · {mode}',cameraModeAria:'滚轮模式：{mode}。点击可切换。',homeView:'默认视角',cameraPresets:'保存的相机视角',
      playbackControls:'公转播放控制',realTime:'实时',orbitSpeed:'公转速度',speedSlider:'每秒推进的时间',sources:'来源',bodySelect:'选择天体',scaleNoteLineOne:'大小与距离比例已调整 · 平均轨道近似',scaleNoteLineTwo:'自转和公转与时间联动',
      apply:'移动',save:'保存',delete:'删除',cancel:'取消',helpClose:'关闭帮助',helpTitle:'使用方法与计算说明',releaseNotes:'更新记录',releaseNotesNewer:'较新更新',releaseNotesOlder:'较早更新',basicControls:'基本操作',supportMessage:'如果这个程序对您有所帮助，欢迎请开发者喝杯咖啡！',supportDetail:'您的支持将为服务器维护和持续开发提供莫大的帮助！',supportKrw:'韩元赞助',supportUsd:'美元赞助',
      basicHelp:'按住左键拖动可不受上下限制地连续旋转一周；按住中键拖动可向上下左右平移 ±80%。右侧最上方按钮可在平面缩放与具有透视感的真实相机移动之间切换滚轮模式。双击天体或选择“近距离查看”可跟踪天体。0 恢复默认视角，1·2·3 会连同缩放/移动模式一起保存。',
      timeAndCalculation:'时间与计算',timeHelp:'上方时钟会显示所选语言和地区的当地实际时间。关闭下方“实时”后，可按小时、日或年调整模拟速度。范围为每秒 1 分钟–24 小时、1–365 日或 1–20 年。',
      orbitHelp:'行星沿椭圆轨道运行，靠近近日点时较快，靠近远日点时较慢。月球和木卫二分别作为地球和木星的子天体，按模拟时间计算位置，离心率仅采用 0.05 和 0.01。未计算长期摄动和细微距离变化，因此不可用于观测、导航或日月食预测等精密星历用途。',
      pause:'暂停',fullscreen:'全屏',zenMode:'观赏模式',savedViews:'保存视角',stepExit:'逐步退出',loading:'正在展开一片小宇宙',fatalTitle:'无法启动画面。',fatalRetry:'请使用最新版 Edge 或 Chrome 重新打开。',loadingTime:'正在读取时间',
      rotateRight:'向右旋转',rotateLeft:'向左旋转',start:'开始',stop:'停止',rotateRunning:'{direction}中 · 点击停止',rotateRate:'{direction} · 每秒 2°',
      presetButtonTitle:'相机 {n} · 左/右键：应用/保存/删除/取消 · 数字 {n}：平滑移动',presetAria:'相机 {n} 为{state}。左键或右键单击可打开相机菜单。按数字 {n} 调用。',saved:'已保存',empty:'空',
      emptyPreset:'相机 {n} 为空。请先用数字按钮保存视角。',hiddenBody:'请先显示已保存视角中的天体，再重新调用。',presetTitle:'相机 {n}',presetSavedNote:'应用已保存视角，或用当前视角覆盖。',presetEmptyNote:'此相机位为空。点击保存可保留当前视角。',presetSaved:'已保存相机 {n}。',presetDeleted:'已删除相机 {n}。',temporaryOnly:' 仅在当前窗口中保留。',
      wallClockAria:'设备时间 {time}',timezoneTitle:'切换本地时间 / UTC',timezoneAria:'当前显示{zone}。点击切换时区。',localTime:'本地时间',bodyInfo:'{name}信息',photoMap:'照片贴图',builtInImage:'内置图像',builtInMaterial:'内置材质',publicPhotoUnavailable:'未获取公开照片',
      hourUnit:'小时',minuteUnit:'分',secondUnit:'秒',dayUnit:'日',yearUnit:'年',timesPerSecond:'每秒 {value} 圈',secondsPerTurn:'每 {value} 秒 1 圈',paused:'暂停',rotationSummary:'自转周期约 {period}{retrograde} · {playback} · 与公转使用相同时间倍率',retrograde:' · 逆行自转',
      meanTemperature:'平均温度',temperatureRange:'最低 {min} · 最高 {max} °C',surfaceGravity:'表面重力',earthGravityRatio:'地球的 {value} 倍',
      representation:'类型',star:'恒星',systemCenter:'太阳系中心',sunNote:'明暗等离子纹理会在自转表面上轻微流动。其运动与周围光芒均为观赏效果，并非实时太阳观测数据。',earthOrbitPeriod:'绕地球公转周期',brightSide:'从地球看到的亮面 · 近似',approximately:'约 {value}',moonNote:'{phase} · 与 JPL 参考时刻对齐的平均轨道位置 · 平均距离固定',jupiterOrbitPeriod:'绕木星公转周期',jupiterDistance:'到木星的平均距离',europaNote:'与 JPL 参考时刻对齐的当前公转位置 · 平均距离固定，不计算长期细微变化。',orbitPeriod:'公转周期',sunDistance:'距太阳距离 · 近似',plutoNote:'固定平均轨道 · 不用于精确位置预测。',earthNote:'{region} · {city}当前为{dayNight} / 太阳高度约 {altitude}° · 简单近似',day:'白昼',night:'夜晚',auNote:'1 AU 是地球与太阳之间的平均距离。大小和距离已为画面显示调整比例。',koreaView:'查看{region} · 昼夜',stormView:'查看大红斑',
      speedUnitActive:'速度单位：{unit}。点击切换下一单位。',speedUnitReady:'速度单位 {unit} 待用。点击以该单位开始倍速。',orbitPlay:'播放公转',orbitPause:'暂停公转',returnedNow:'已返回当前时刻的太阳系。',escapePermission:'ESC 逐步退出需要键盘权限；若无权限，浏览器可能先退出全屏。',fullscreenExitFailed:'无法退出全屏，请再次按 ESC。',fullscreenUnsupported:'此浏览器不支持全屏。',fullscreenOpenFailed:'无法打开全屏，请检查浏览器的全屏权限。',fullscreenExit:'退出全屏',zenOff:'关闭观赏模式',zenOn:'开启观赏模式',normalMode:'普通模式',yearLimit:'已在 2999 年末停止，可返回实时模式。'
    },
    jpn:{
      metaDescription:'星明かりとともに流れる太陽系時計。リアルタイムの惑星軌道と、地球・月を小さな宇宙に描きます。',
      universeAria:'太陽系。左ドラッグで自由回転、中ボタンドラッグで平行移動し、右上のズーム・移動ボタンでホイールのカメラ方式を切り替えます。',
      languageChange:'言語を変更',languageCurrent:'日本語を選択中',musicOn:'BGMを再生',musicOff:'BGMを停止',musicPrevious:'前の曲',musicNext:'次の曲',musicUnavailable:'BGMを再生できません。',helpLabel:'操作方法と計算基準',settings:'表示設定',settingsClose:'設定を閉じる',
      actualScale:'実際の大きさの比率',orbitSpacing:'通常表示の軌道間隔',orbitSpacingAria:'通常表示での惑星軌道の間隔',orbitBrightness:'軌道の明るさ',orbitBrightnessAria:'軌道線の明るさ。0にすると軌道線を非表示にします。',displaySize:'表示サイズ',displaySizeAria:'選択した天体の表示サイズ',satelliteOrbitSpacing:'衛星の軌道間隔',satelliteOrbitSpacingAria:'選択した惑星の衛星軌道間隔',solarOrbitSpacing:'水星の軌道間隔',solarOrbitSpacingAria:'太陽を基準にした水星と外側の全惑星の軌道間隔',resetSize:'サイズ・軌道をリセット',actualSizeLocked:'実際の大きさの比率ではサイズと軌道を調整できません。',resetDefaults:'初期化',resetDefaultsTitle:'初期設定に戻しますか？',resetDefaultsPrompt:'オプション、天体サイズ、軌道、通常視点を初期値へ戻します。カメラ1・2・3の保存内容は維持されます。',resetComplete:'初期設定に戻しました。',yes:'はい',no:'いいえ',bodyNames:'天体名',avoidLabels:'ラベルの重なりを自動調整',showSeconds:'時計に秒を表示',hourCycle:'24時間表示',hourCycleAria:'24時間表示。オンは24時間、オフは12時間',hour24:'24時間',hour12:'12時間',clockFont:'時計の数字フォント',sunShine:'太陽の輝き',satellites:'主な衛星 · 月とエウロパ',pluto:'冥王星',dwarfPlanet:'準惑星',comets:'遠方を通る彗星',
      selectedBody:'選択した天体の情報',bodyClose:'天体情報を閉じる',focusBody:'近くで見る · 天体を追跡',viewControls:'視点調整',zoomIn:'拡大',zoomOut:'縮小',moveCloser:'前へ移動',moveFarther:'後ろへ移動',zoomValue:'画面の拡大率',moveValue:'カメラ移動倍率',zoomMode:'ズーム',moveMode:'移動',cameraMode:'ホイール方式 · {mode}',cameraModeAria:'ホイール方式：{mode}。押すと切り替わります。',homeView:'標準視点',cameraPresets:'保存したカメラ視点',
      playbackControls:'公転再生コントロール',realTime:'リアルタイム',orbitSpeed:'公転速度',speedSlider:'1秒あたりに進む時間',sources:'出典',bodySelect:'天体を選択',scaleNoteLineOne:'大きさ・距離の縮尺を調整 · 平均軌道による近似',scaleNoteLineTwo:'自転と公転を時間に連動',
      apply:'移動',save:'保存',delete:'削除',cancel:'キャンセル',helpClose:'ヘルプを閉じる',helpTitle:'操作方法と計算基準',releaseNotes:'更新履歴',releaseNotesNewer:'新しい更新',releaseNotesOlder:'過去の更新',basicControls:'基本操作',supportMessage:'このプログラムがお役に立てたら、開発者にコーヒー一杯分のご支援をお願いします！',supportDetail:'皆さまのご支援が、サーバーの維持と継続的な開発の大きな力になります！',supportKrw:'韓国ウォンで支援',supportUsd:'米ドルで支援',
      basicHelp:'左ドラッグは上下で止まらず一周連続して回転します。中ボタンドラッグは上下左右へ ±80% 移動します。右側最上部のボタンで、平面的なズームと遠近感のある実カメラ移動を切り替えられます。天体をダブルクリックするか「近くで見る」で追跡します。0 は標準視点、1・2・3 はズーム/移動方式も一緒に保存します。',
      timeAndCalculation:'時刻と計算',timeHelp:'上部の時計は選択した言語と地域の現地時刻を表示します。下部のリアルタイムをオフにすると、時・日・年単位でシミュレーション速度を調整できます。範囲は1秒あたり1分〜24時間、1〜365日、1〜20年です。',
      orbitHelp:'惑星は楕円軌道を進み、近日点では速く、遠日点では遅くなります。月とエウロパは地球と木星の子天体としてシミュレーション時刻の位置を計算し、離心率は 0.05 と 0.01 のみを適用します。長期摂動や微小な距離変化は省略しているため、観測・航法・食予測用の精密暦ではありません。',
      pause:'一時停止',fullscreen:'全画面',zenMode:'鑑賞モード',savedViews:'保存視点',stepExit:'段階的に終了',loading:'小さな宇宙を開いています',fatalTitle:'画面を開始できませんでした。',fatalRetry:'最新の Edge または Chrome で開き直してください。',loadingTime:'時刻を読み込み中',
      rotateRight:'右回転',rotateLeft:'左回転',start:'開始',stop:'停止',rotateRunning:'{direction}中 · クリックで停止',rotateRate:'{direction} · 毎秒2°',
      presetButtonTitle:'カメラ {n} · 左/右クリック：適用/保存/削除/キャンセル · 数字 {n}：滑らかに移動',presetAria:'カメラ {n} は{state}。左または右クリックでメニューを開き、数字 {n} で呼び出します。',saved:'保存済み',empty:'空',
      emptyPreset:'カメラ {n} は空です。先に数字ボタンから視点を保存してください。',hiddenBody:'保存した天体の表示をオンにしてから、もう一度呼び出してください。',presetTitle:'カメラ {n}',presetSavedNote:'保存した視点へ移動するか、現在の視点で上書きします。',presetEmptyNote:'このカメラ枠は空です。保存すると現在の視点を保持します。',presetSaved:'カメラ {n} を保存しました。',presetDeleted:'カメラ {n} を削除しました。',temporaryOnly:' 現在のウィンドウでのみ保持されます。',
      wallClockAria:'現在時刻 {time}',timezoneTitle:'現地時刻 / UTC を切り替え',timezoneAria:'{zone} を表示中。押すとタイムゾーンを切り替えます。',localTime:'現地時刻',bodyInfo:'{name}の情報',photoMap:'写真テクスチャ',builtInImage:'内蔵画像',builtInMaterial:'内蔵マテリアル',publicPhotoUnavailable:'公開画像を取得できません',
      hourUnit:'時間',minuteUnit:'分',secondUnit:'秒',dayUnit:'日',yearUnit:'年',timesPerSecond:'1秒あたり {value} 回転',secondsPerTurn:'{value}秒で1回転',paused:'一時停止',rotationSummary:'自転周期 約{period}{retrograde} · {playback} · 公転と同じ時間倍率',retrograde:' · 逆行自転',
      meanTemperature:'平均気温',temperatureRange:'最低 {min} · 最高 {max} °C',surfaceGravity:'表面重力',earthGravityRatio:'地球の {value} 倍',
      representation:'分類',star:'恒星',systemCenter:'太陽系の中心',sunNote:'明暗のプラズマ模様が自転する表面を微かに流れます。表面の動きと周囲の輝きは鑑賞用で、リアルタイムの太陽観測データではありません。',earthOrbitPeriod:'地球の周りの公転周期',brightSide:'地球から見た明るい面 · 近似',approximately:'約 {value}',moonNote:'{phase} · JPL 基準時刻に合わせた平均軌道位置 · 平均距離は固定',jupiterOrbitPeriod:'木星の周りの公転周期',jupiterDistance:'木星までの平均距離',europaNote:'JPL 基準時刻に合わせた現在の公転位置 · 平均距離は固定し、長期的な微小変化は省略します。',orbitPeriod:'公転周期',sunDistance:'太陽までの距離 · 近似',plutoNote:'固定平均軌道 · 精密な位置予測用ではありません。',earthNote:'{region} · {city} は{dayNight} / 太陽高度 約{altitude}° · 簡易近似',day:'昼',night:'夜',auNote:'1 AU は地球と太陽の平均距離です。大きさと距離は画面表示用に調整しています。',koreaView:'{region}を見る · 昼/夜',stormView:'大赤斑を見る',
      speedUnitActive:'速度単位：{unit}。押すと次の単位へ切り替えます。',speedUnitReady:'速度単位 {unit} を待機中。押すとこの単位で倍速を開始します。',orbitPlay:'公転を再生',orbitPause:'公転を一時停止',returnedNow:'現在時刻の太陽系に戻りました。',escapePermission:'ESC の段階的な解除にはキーボード権限が必要です。権限がない場合、ブラウザが先に全画面を終了することがあります。',fullscreenExitFailed:'全画面を終了できませんでした。もう一度 ESC を押してください。',fullscreenUnsupported:'このブラウザは全画面表示に対応していません。',fullscreenOpenFailed:'全画面を開始できませんでした。ブラウザの全画面権限を確認してください。',fullscreenExit:'全画面を終了',zenOff:'鑑賞モードを終了',zenOn:'鑑賞モードを開始',normalMode:'通常モード',yearLimit:'2999年末に達したため停止しました。リアルタイムへ戻れます。'
    }
  };
  Object.assign(COPY,{
    hi:{...COPY.en,
      metaDescription:'तारों के साथ बहती सौरमंडल घड़ी—वास्तविक समय, ग्रहों की कक्षाएँ, पृथ्वी और चंद्रमा का एक छोटा ब्रह्मांड।',
      universeAria:'सौरमंडल। बायाँ ड्रैग दृश्य घुमाता है, मध्य ड्रैग स्थान बदलता है और ऊपर-दाएँ ज़ूम/मूव नियंत्रण से व्हील का कैमरा मोड बदलता है।',
      languageChange:'भाषा बदलें',languageCurrent:'हिन्दी चयनित',musicOn:'पृष्ठभूमि संगीत चलाएँ',musicOff:'पृष्ठभूमि संगीत बंद करें',musicPrevious:'पिछला संगीत',musicNext:'अगला संगीत',musicUnavailable:'पृष्ठभूमि संगीत नहीं चल सका।',helpLabel:'उपयोग और गणना मार्गदर्शिका',settings:'स्क्रीन सेटिंग',settingsClose:'सेटिंग बंद करें',
      actualScale:'वास्तविक आकार अनुपात',orbitSpacing:'सामान्य दृश्य कक्षा अंतर',orbitSpacingAria:'सामान्य दृश्य में ग्रहों की कक्षा का अंतर',orbitBrightness:'कक्षा की चमक',orbitBrightnessAria:'कक्षा रेखाओं की चमक। शून्य पर रेखाएँ छिप जाती हैं।',displaySize:'दिखाई देने वाला आकार',displaySizeAria:'चुने गए खगोलीय पिंड का आकार',satelliteOrbitSpacing:'उपग्रह कक्षा अंतर',satelliteOrbitSpacingAria:'चुने गए ग्रह के उपग्रह की कक्षा का अंतर',solarOrbitSpacing:'बुध कक्षा अंतर',solarOrbitSpacingAria:'सूर्य के सापेक्ष बुध और सभी बाहरी ग्रहों की कक्षा का अंतर',resetSize:'आकार और कक्षा रीसेट',actualSizeLocked:'वास्तविक आकार मोड में आकार और कक्षा बदले नहीं जा सकते।',resetDefaults:'रीसेट',resetDefaultsTitle:'आरंभिक सेटिंग पर लौटें?',resetDefaultsPrompt:'विकल्प, पिंडों के आकार, कक्षाएँ और सामान्य दृश्य आरंभिक मान पर लौटेंगे। कैमरा 1–3 सुरक्षित रहेंगे।',resetComplete:'आरंभिक सेटिंग बहाल हुई।',yes:'हाँ',no:'नहीं',bodyNames:'पिंडों के नाम',avoidLabels:'नामों का ओवरलैप रोकें',showSeconds:'घड़ी में सेकंड',hourCycle:'24 घंटे का समय',hourCycleAria:'24 घंटे का समय। चालू होने पर 24 घंटे, बंद होने पर 12 घंटे',hour24:'24 घंटे',hour12:'12 घंटे',clockFont:'घड़ी का अंक फ़ॉन्ट',sunShine:'सूर्य की चमक',satellites:'मुख्य उपग्रह · चंद्रमा और यूरोपा',pluto:'प्लूटो',dwarfPlanet:'बौना ग्रह',comets:'दूरस्थ धूमकेतु',
      selectedBody:'चुने गए पिंड की जानकारी',bodyClose:'पिंड की जानकारी बंद करें',focusBody:'पास से देखें · पिंड का अनुसरण',viewControls:'दृश्य नियंत्रण',zoomIn:'ज़ूम इन',zoomOut:'ज़ूम आउट',moveCloser:'पास जाएँ',moveFarther:'दूर जाएँ',zoomValue:'दृश्य ज़ूम स्तर',moveValue:'कैमरा दूरी स्तर',zoomMode:'ज़ूम',moveMode:'मूव',cameraMode:'व्हील मोड · {mode}',cameraModeAria:'व्हील मोड: {mode}। बदलने के लिए दबाएँ।',homeView:'मूल दृश्य',cameraPresets:'सहेजे गए कैमरा दृश्य',
      playbackControls:'कक्षा प्लेबैक नियंत्रण',realTime:'वास्तविक समय',orbitSpeed:'कक्षा गति',speedSlider:'प्रति सेकंड आगे बढ़ने वाला समय',sources:'स्रोत',bodySelect:'पिंड चुनें',scaleNoteLineOne:'आकार और दूरी का समायोजित पैमाना · औसत कक्षा अनुमान',scaleNoteLineTwo:'घूर्णन और कक्षा समय से जुड़े हैं',
      apply:'जाएँ',save:'सहेजें',delete:'हटाएँ',cancel:'रद्द करें',helpClose:'सहायता बंद करें',helpTitle:'उपयोग और गणना मार्गदर्शिका',releaseNotes:'अपडेट इतिहास',releaseNotesNewer:'नया अपडेट',releaseNotesOlder:'पुराना अपडेट',basicControls:'मूल नियंत्रण',supportMessage:'यदि यह प्रोग्राम उपयोगी रहा है, तो डेवलपर को एक कॉफ़ी के साथ सहयोग दें!',supportDetail:'आपका सहयोग सर्वर को चालू रखने और विकास जारी रखने में बहुत मदद करता है!',supportKrw:'KRW में सहयोग',supportUsd:'USD में सहयोग',
      basicHelp:'बायाँ ड्रैग दृश्य को बिना ऊर्ध्व सीमा के पूरा घुमाता है। मध्य ड्रैग स्क्रीन को ऊपर, नीचे, बाएँ या दाएँ ±80% खिसकाता है। दाएँ ऊपर का बटन व्हील को सपाट ज़ूम और परिप्रेक्ष्य वाले वास्तविक कैमरा मूव के बीच बदलता है। किसी पिंड पर डबल-क्लिक करें या “पास से देखें” चुनें। 0 मूल दृश्य लौटाता है; 1·2·3 ज़ूम/मूव मोड सहित दृश्य सहेजते हैं।',
      timeAndCalculation:'समय और गणना',timeHelp:'ऊपरी घड़ी चुने गए क्षेत्र का वास्तविक समय दिखाती है। नीचे वास्तविक समय बंद करके घंटे, दिन या वर्ष में सिमुलेशन गति बदली जा सकती है।',
      orbitHelp:'ग्रह दीर्घवृत्ताकार कक्षाओं में उपसौर पर तेज़ और अपसौर पर धीमे चलते हैं। चंद्रमा और यूरोपा पृथ्वी और बृहस्पति की संतान संरचना में हैं। दीर्घकालीन सूक्ष्म बदलाव शामिल नहीं हैं, इसलिए यह सटीक खगोलीय पंचांग नहीं है।',
      pause:'रोकें',fullscreen:'पूर्ण स्क्रीन',zenMode:'दर्शन मोड',savedViews:'सहेजे दृश्य',stepExit:'क्रमिक निकास',loading:'छोटा ब्रह्मांड खोला जा रहा है',fatalTitle:'दृश्य शुरू नहीं हो सका।',fatalRetry:'नवीनतम Edge या Chrome में फिर खोलें।',loadingTime:'समय लोड हो रहा है',
      rotateRight:'दाएँ घुमाएँ',rotateLeft:'बाएँ घुमाएँ',start:'शुरू',stop:'रोकें',rotateRunning:'{direction} · रोकने के लिए क्लिक करें',rotateRate:'{direction} · 2° प्रति सेकंड',
      presetButtonTitle:'कैमरा {n} · लागू/सहेजें/हटाएँ/रद्द करें',presetAria:'कैमरा {n} {state} है। मेनू खोलने के लिए क्लिक करें।',saved:'सहेजा गया',empty:'खाली',emptyPreset:'कैमरा {n} खाली है। पहले दृश्य सहेजें।',hiddenBody:'सहेजे गए पिंड को चालू करके फिर प्रयास करें।',presetTitle:'कैमरा {n}',presetSavedNote:'सहेजा दृश्य लागू करें या वर्तमान दृश्य से बदलें।',presetEmptyNote:'यह कैमरा स्लॉट खाली है।',presetSaved:'कैमरा {n} सहेजा गया।',presetDeleted:'कैमरा {n} हटाया गया।',temporaryOnly:' यह केवल इस विंडो में रहेगा।',
      wallClockAria:'वास्तविक समय {time}',timezoneTitle:'स्थानीय समय / UTC बदलें',timezoneAria:'{zone} दिख रहा है। समय क्षेत्र बदलने के लिए दबाएँ।',localTime:'स्थानीय समय',bodyInfo:'{name} की जानकारी',photoMap:'फोटो मानचित्र',builtInImage:'अंतर्निहित चित्र',builtInMaterial:'अंतर्निहित सामग्री',publicPhotoUnavailable:'सार्वजनिक चित्र उपलब्ध नहीं',
      hourUnit:'घंटा',minuteUnit:'मिनट',secondUnit:'सेकंड',dayUnit:'दिन',yearUnit:'वर्ष',timesPerSecond:'प्रति सेकंड {value} चक्कर',secondsPerTurn:'हर {value} सेकंड में एक चक्कर',paused:'रुका हुआ',rotationSummary:'घूर्णन अवधि लगभग {period}{retrograde} · {playback} · कक्षा के समान समय पैमाना',retrograde:' · विपरीत घूर्णन',
      meanTemperature:'औसत तापमान',temperatureRange:'न्यूनतम {min} · अधिकतम {max} °C',surfaceGravity:'सतही गुरुत्व',earthGravityRatio:'पृथ्वी का {value} गुना',
      representation:'प्रकार',star:'तारा',systemCenter:'सौरमंडल का केंद्र',sunNote:'घूमती सतह पर चमकीली और गहरी प्लाज़्मा बनावट धीरे बहती है। गति और चमक दृश्य प्रभाव हैं।',earthOrbitPeriod:'पृथ्वी के चारों ओर अवधि',brightSide:'पृथ्वी से दिखने वाला प्रकाशित भाग · अनुमान',approximately:'लगभग {value}',moonNote:'{phase} · JPL संदर्भ समय से मेल खाती औसत कक्षा स्थिति',jupiterOrbitPeriod:'बृहस्पति के चारों ओर अवधि',jupiterDistance:'बृहस्पति से औसत दूरी',europaNote:'JPL संदर्भ समय से मेल खाती वर्तमान कक्षा स्थिति',orbitPeriod:'कक्षा अवधि',sunDistance:'सूर्य से दूरी · अनुमान',plutoNote:'स्थिर औसत कक्षा',earthNote:'{region} · {city}',day:'दिन',night:'रात',koreaView:'{region} देखें · दिन/रात',stormView:'महान लाल धब्बा देखें',
      speedUnitActive:'गति इकाई {unit}। अगली इकाई के लिए दबाएँ।',speedUnitReady:'गति इकाई {unit} तैयार। शुरू करने के लिए दबाएँ।',orbitPlay:'कक्षाएँ चलाएँ',orbitPause:'कक्षाएँ रोकें',returnedNow:'वर्तमान समय के सौरमंडल पर लौट आए।',fullscreenExitFailed:'पूर्ण स्क्रीन बंद नहीं हुई। ESC फिर दबाएँ।',fullscreenUnsupported:'यह ब्राउज़र पूर्ण स्क्रीन समर्थित नहीं करता।',fullscreenOpenFailed:'पूर्ण स्क्रीन नहीं खुली। ब्राउज़र अनुमति जाँचें।',fullscreenExit:'पूर्ण स्क्रीन बंद करें',zenOff:'दर्शन मोड बंद करें',zenOn:'दर्शन मोड चालू करें',normalMode:'सामान्य मोड',yearLimit:'वर्ष 2999 के अंत पर रुक गया।'
    },
    es:{...COPY.en,
      metaDescription:'Un reloj del sistema solar que fluye con las estrellas: hora real, órbitas planetarias, la Tierra y la Luna en un pequeño cosmos.',
      universeAria:'Sistema solar. Arrastra con el botón izquierdo para girar, con el central para desplazar y usa el control Zoom/Mover para cambiar el modo de la rueda.',
      languageChange:'Cambiar idioma',languageCurrent:'Español seleccionado',musicOn:'Reproducir música de fondo',musicOff:'Detener música de fondo',musicPrevious:'Pista anterior',musicNext:'Pista siguiente',musicUnavailable:'No se pudo reproducir la música de fondo.',helpLabel:'Guía y criterios de cálculo',settings:'Ajustes de pantalla',settingsClose:'Cerrar ajustes',
      actualScale:'Proporción de tamaño real',orbitSpacing:'Separación orbital general',orbitSpacingAria:'Separación de las órbitas en la vista general',orbitBrightness:'Brillo de las órbitas',orbitBrightnessAria:'Brillo de las líneas orbitales. Cero las oculta.',displaySize:'Tamaño mostrado',displaySizeAria:'Tamaño mostrado del cuerpo seleccionado',satelliteOrbitSpacing:'Separación de satélites',satelliteOrbitSpacingAria:'Separación orbital del satélite del planeta seleccionado',solarOrbitSpacing:'Separación de Mercurio',solarOrbitSpacingAria:'Separación de Mercurio y los planetas exteriores respecto al Sol',resetSize:'Restablecer tamaño y órbita',actualSizeLocked:'El tamaño y la órbita no se pueden ajustar en modo de tamaño real.',resetDefaults:'Restablecer',resetDefaultsTitle:'¿Volver a la configuración inicial?',resetDefaultsPrompt:'Las opciones, tamaños, órbitas y vista normal volverán a sus valores iniciales. Se conservarán las cámaras 1–3.',resetComplete:'Configuración inicial restaurada.',yes:'Sí',no:'No',bodyNames:'Nombres de los cuerpos',avoidLabels:'Evitar nombres superpuestos',showSeconds:'Mostrar segundos',hourCycle:'Formato de 24 horas',hourCycleAria:'Formato de 24 horas. Activado: 24 horas; desactivado: 12 horas',hour24:'24 horas',hour12:'12 horas',clockFont:'Fuente de los números',sunShine:'Brillo solar',satellites:'Satélites principales · Luna y Europa',pluto:'Plutón',dwarfPlanet:'Planeta enano',comets:'Cometas lejanos',
      selectedBody:'Información del cuerpo',bodyClose:'Cerrar información',focusBody:'Vista cercana · Seguir cuerpo',viewControls:'Controles de vista',zoomIn:'Acercar',zoomOut:'Alejar',moveCloser:'Avanzar',moveFarther:'Retroceder',zoomValue:'Nivel de zoom',moveValue:'Nivel de desplazamiento',zoomMode:'ZOOM',moveMode:'MOVER',cameraMode:'Modo de rueda · {mode}',cameraModeAria:'Modo de rueda: {mode}. Pulsa para cambiar.',homeView:'Vista inicial',cameraPresets:'Vistas de cámara guardadas',
      playbackControls:'Controles de órbita',realTime:'Tiempo real',orbitSpeed:'Velocidad orbital',speedSlider:'Tiempo avanzado por segundo',sources:'Fuentes',bodySelect:'Seleccionar cuerpo',scaleNoteLineOne:'Escala de tamaño y distancia ajustada · Órbita media aproximada',scaleNoteLineTwo:'Rotación y órbita vinculadas al tiempo',
      apply:'Mover',save:'Guardar',delete:'Eliminar',cancel:'Cancelar',helpClose:'Cerrar ayuda',helpTitle:'Guía y criterios de cálculo',releaseNotes:'Historial de actualizaciones',releaseNotesNewer:'Actualización más reciente',releaseNotesOlder:'Actualización anterior',basicControls:'Controles básicos',supportMessage:'Si este programa te ha resultado útil, invita al desarrollador a un café.',supportDetail:'Tu apoyo es de gran ayuda para mantener los servidores y continuar el desarrollo.',supportKrw:'Apoyar en KRW',supportUsd:'Apoyar en USD',
      basicHelp:'Arrastrar con el botón izquierdo gira sin límite vertical. El botón central desplaza la pantalla hasta ±80%. El botón superior derecho cambia la rueda entre zoom plano y movimiento real de cámara con perspectiva. Haz doble clic en un cuerpo o elige «Vista cercana» para seguirlo. 0 restaura la vista inicial; 1·2·3 guardan la vista y su modo Zoom/Mover.',
      timeAndCalculation:'Tiempo y cálculo',timeHelp:'El reloj superior muestra la hora real de la región elegida. Desactiva Tiempo real para ajustar la simulación por horas, días o años.',
      orbitHelp:'Los planetas recorren órbitas elípticas, más rápido cerca del perihelio y más lento cerca del afelio. La Luna y Europa son hijos de la Tierra y Júpiter. No se incluyen perturbaciones a largo plazo, por lo que no es una efeméride de precisión.',
      pause:'Pausa',fullscreen:'Pantalla completa',zenMode:'Modo contemplación',savedViews:'Vistas guardadas',stepExit:'Salida por pasos',loading:'Abriendo un pequeño cosmos',fatalTitle:'No se pudo iniciar la vista.',fatalRetry:'Ábrelo de nuevo en la versión más reciente de Edge o Chrome.',loadingTime:'Cargando hora',
      rotateRight:'Girar a la derecha',rotateLeft:'Girar a la izquierda',start:'iniciar',stop:'detener',rotateRunning:'{direction} · pulsa para detener',rotateRate:'{direction} · 2° por segundo',
      presetButtonTitle:'Cámara {n} · aplicar/guardar/eliminar/cancelar',presetAria:'La cámara {n} está {state}. Pulsa para abrir el menú.',saved:'guardada',empty:'vacía',emptyPreset:'La cámara {n} está vacía. Guarda primero una vista.',hiddenBody:'Activa el cuerpo guardado y vuelve a intentarlo.',presetTitle:'Cámara {n}',presetSavedNote:'Aplica la vista guardada o sustitúyela por la actual.',presetEmptyNote:'Esta cámara está vacía.',presetSaved:'Cámara {n} guardada.',presetDeleted:'Cámara {n} eliminada.',temporaryOnly:' Solo permanecerá en esta ventana.',
      wallClockAria:'Hora real {time}',timezoneTitle:'Cambiar hora local / UTC',timezoneAria:'Mostrando {zone}. Pulsa para cambiar de zona horaria.',localTime:'hora local',bodyInfo:'Información de {name}',photoMap:'mapa fotográfico',builtInImage:'imagen integrada',builtInMaterial:'material integrado',publicPhotoUnavailable:'imagen pública no disponible',
      hourUnit:'Hora',minuteUnit:'min',secondUnit:'s',dayUnit:'Día',yearUnit:'Año',timesPerSecond:'{value} vueltas por segundo',secondsPerTurn:'una vuelta cada {value} segundos',paused:'En pausa',rotationSummary:'Periodo de rotación aprox. {period}{retrograde} · {playback} · misma escala temporal que la órbita',retrograde:' · rotación retrógrada',
      meanTemperature:'Temperatura media',temperatureRange:'Mín. {min} · máx. {max} °C',surfaceGravity:'Gravedad superficial',earthGravityRatio:'{value}× la Tierra',
      representation:'Tipo',star:'Estrella',systemCenter:'Centro del sistema solar',sunNote:'Los detalles claros y oscuros del plasma se desplazan sutilmente por la superficie. El movimiento y el brillo son efectos visuales.',earthOrbitPeriod:'Órbita alrededor de la Tierra',brightSide:'Cara iluminada vista desde la Tierra · aproximada',approximately:'aprox. {value}',moonNote:'{phase} · posición orbital media alineada con una referencia JPL',jupiterOrbitPeriod:'Órbita alrededor de Júpiter',jupiterDistance:'Distancia media a Júpiter',europaNote:'Posición orbital actual alineada con una referencia JPL',orbitPeriod:'Periodo orbital',sunDistance:'Distancia al Sol · aproximada',plutoNote:'Órbita media fija',earthNote:'{region} · {city}',day:'día',night:'noche',koreaView:'Ver {region} · día/noche',stormView:'Ver la Gran Mancha Roja',
      speedUnitActive:'Unidad de velocidad: {unit}. Pulsa para cambiar.',speedUnitReady:'Unidad {unit} preparada. Pulsa para iniciar.',orbitPlay:'Reproducir órbitas',orbitPause:'Pausar órbitas',returnedNow:'De vuelta al sistema solar en la hora actual.',fullscreenExitFailed:'No se pudo salir de pantalla completa. Pulsa ESC de nuevo.',fullscreenUnsupported:'Este navegador no admite pantalla completa.',fullscreenOpenFailed:'No se pudo abrir la pantalla completa. Revisa el permiso del navegador.',fullscreenExit:'Salir de pantalla completa',zenOff:'Desactivar modo contemplación',zenOn:'Activar modo contemplación',normalMode:'Modo normal',yearLimit:'Detenido al final del año 2999.'
    },
    de:{...COPY.en,
      metaDescription:'Eine Sonnensystem-Uhr im Fluss der Sterne – Echtzeit, Planetenbahnen, Erde und Mond in einem kleinen Kosmos.',
      universeAria:'Sonnensystem. Links ziehen dreht die Ansicht, mit der mittleren Taste verschieben; Zoom/Bewegen ändert den Modus des Mausrads.',
      languageChange:'Sprache ändern',languageCurrent:'Deutsch ausgewählt',musicOn:'Hintergrundmusik abspielen',musicOff:'Hintergrundmusik stoppen',musicPrevious:'Vorheriger Titel',musicNext:'Nächster Titel',musicUnavailable:'Die Hintergrundmusik konnte nicht abgespielt werden.',helpLabel:'Bedienung und Berechnungsgrundlagen',settings:'Anzeigeeinstellungen',settingsClose:'Einstellungen schließen',
      actualScale:'Reales Größenverhältnis',orbitSpacing:'Bahnabstand der Übersicht',orbitSpacingAria:'Abstand der Planetenbahnen in der Übersicht',orbitBrightness:'Helligkeit der Bahnen',orbitBrightnessAria:'Helligkeit der Bahnlinien. Null blendet sie aus.',displaySize:'Darstellungsgröße',displaySizeAria:'Darstellungsgröße des ausgewählten Körpers',satelliteOrbitSpacing:'Mondbahn-Abstand',satelliteOrbitSpacingAria:'Bahnabstand des Mondes des ausgewählten Planeten',solarOrbitSpacing:'Merkurbahn-Abstand',solarOrbitSpacingAria:'Abstand von Merkur und allen äußeren Planeten relativ zur Sonne',resetSize:'Größe und Bahn zurücksetzen',actualSizeLocked:'Im Modus mit realen Größen sind Größe und Bahn gesperrt.',resetDefaults:'Zurücksetzen',resetDefaultsTitle:'Zur Ausgangseinstellung zurückkehren?',resetDefaultsPrompt:'Optionen, Größen, Bahnen und Normalansicht werden zurückgesetzt. Kamera 1–3 bleiben erhalten.',resetComplete:'Ausgangseinstellung wiederhergestellt.',yes:'Ja',no:'Nein',bodyNames:'Himmelskörpernamen',avoidLabels:'Überlappende Namen vermeiden',showSeconds:'Sekunden anzeigen',hourCycle:'24-Stunden-Anzeige',hourCycleAria:'24-Stunden-Anzeige. Ein: 24 Stunden, aus: 12 Stunden',hour24:'24 Stunden',hour12:'12 Stunden',clockFont:'Ziffernschrift',sunShine:'Sonnenschein',satellites:'Wichtige Monde · Mond und Europa',pluto:'Pluto',dwarfPlanet:'Zwergplanet',comets:'Ferne Kometen',
      selectedBody:'Informationen zum Himmelskörper',bodyClose:'Informationen schließen',focusBody:'Nahansicht · Körper verfolgen',viewControls:'Ansichtssteuerung',zoomIn:'Vergrößern',zoomOut:'Verkleinern',moveCloser:'Näher bewegen',moveFarther:'Weiter entfernen',zoomValue:'Zoomstufe',moveValue:'Kamerafahrt',zoomMode:'ZOOM',moveMode:'BEWEGEN',cameraMode:'Mausradmodus · {mode}',cameraModeAria:'Mausradmodus: {mode}. Zum Wechseln drücken.',homeView:'Ausgangsansicht',cameraPresets:'Gespeicherte Kameraansichten',
      playbackControls:'Bahnwiedergabe',realTime:'Echtzeit',orbitSpeed:'Bahngeschwindigkeit',speedSlider:'Fortschritt pro Sekunde',sources:'Quellen',bodySelect:'Himmelskörper auswählen',scaleNoteLineOne:'Angepasster Größen- und Entfernungsmaßstab · Mittlere Bahnnäherung',scaleNoteLineTwo:'Rotation und Umlauf an Zeit gekoppelt',
      apply:'Bewegen',save:'Speichern',delete:'Löschen',cancel:'Abbrechen',helpClose:'Hilfe schließen',helpTitle:'Bedienung und Berechnungsgrundlagen',releaseNotes:'Update-Verlauf',releaseNotesNewer:'Neueres Update',releaseNotesOlder:'Älteres Update',basicControls:'Grundsteuerung',supportMessage:'Wenn dieses Programm hilfreich war, spendiere dem Entwickler einen Kaffee.',supportDetail:'Deine Unterstützung hilft sehr dabei, die Server zu betreiben und die Entwicklung fortzusetzen.',supportKrw:'In KRW unterstützen',supportUsd:'In USD unterstützen',
      basicHelp:'Ziehen mit der linken Maustaste dreht die Ansicht ohne vertikale Begrenzung. Die mittlere Taste verschiebt um bis zu ±80%. Die obere rechte Taste wechselt das Mausrad zwischen flachem Zoom und echter Kamerafahrt mit Perspektive. Doppelklick oder „Nahansicht“ verfolgt einen Körper. 0 stellt die Ausgangsansicht her; 1·2·3 speichern Ansicht und Zoom/Bewegen-Modus.',
      timeAndCalculation:'Zeit und Berechnung',timeHelp:'Die obere Uhr zeigt die Echtzeit der gewählten Region. Echtzeit kann ausgeschaltet werden, um die Simulation in Stunden, Tagen oder Jahren zu steuern.',
      orbitHelp:'Planeten bewegen sich auf elliptischen Bahnen, am Perihel schneller und am Aphel langsamer. Mond und Europa sind der Erde bzw. Jupiter untergeordnet. Langfristige Störungen fehlen; dies ist daher keine Präzisionsephemeride.',
      pause:'Pause',fullscreen:'Vollbild',zenMode:'Betrachtungsmodus',savedViews:'Gespeicherte Ansichten',stepExit:'Schrittweise beenden',loading:'Ein kleiner Kosmos öffnet sich',fatalTitle:'Die Ansicht konnte nicht gestartet werden.',fatalRetry:'Bitte erneut im neuesten Edge oder Chrome öffnen.',loadingTime:'Zeit wird geladen',
      rotateRight:'Nach rechts drehen',rotateLeft:'Nach links drehen',start:'starten',stop:'stoppen',rotateRunning:'{direction} · zum Stoppen klicken',rotateRate:'{direction} · 2° pro Sekunde',
      presetButtonTitle:'Kamera {n} · anwenden/speichern/löschen/abbrechen',presetAria:'Kamera {n} ist {state}. Klicken, um das Menü zu öffnen.',saved:'gespeichert',empty:'leer',emptyPreset:'Kamera {n} ist leer. Bitte zuerst eine Ansicht speichern.',hiddenBody:'Den gespeicherten Körper einschalten und erneut versuchen.',presetTitle:'Kamera {n}',presetSavedNote:'Gespeicherte Ansicht anwenden oder mit der aktuellen überschreiben.',presetEmptyNote:'Dieser Kameraplatz ist leer.',presetSaved:'Kamera {n} gespeichert.',presetDeleted:'Kamera {n} gelöscht.',temporaryOnly:' Bleibt nur in diesem Fenster erhalten.',
      wallClockAria:'Aktuelle Zeit {time}',timezoneTitle:'Ortszeit / UTC umschalten',timezoneAria:'{zone} wird angezeigt. Zum Wechseln der Zeitzone drücken.',localTime:'Ortszeit',bodyInfo:'Informationen zu {name}',photoMap:'Fotokarte',builtInImage:'integriertes Bild',builtInMaterial:'integriertes Material',publicPhotoUnavailable:'öffentliches Bild nicht verfügbar',
      hourUnit:'Stunde',minuteUnit:'Min.',secondUnit:'Sek.',dayUnit:'Tag',yearUnit:'Jahr',timesPerSecond:'{value} Umdrehungen pro Sekunde',secondsPerTurn:'eine Umdrehung alle {value} Sekunden',paused:'Pausiert',rotationSummary:'Rotationsdauer ca. {period}{retrograde} · {playback} · gleicher Zeitmaßstab wie Umlauf',retrograde:' · rückläufige Rotation',
      meanTemperature:'Mittlere Temperatur',temperatureRange:'Min. {min} · max. {max} °C',surfaceGravity:'Oberflächengravitation',earthGravityRatio:'{value}× Erde',
      representation:'Typ',star:'Stern',systemCenter:'Zentrum des Sonnensystems',sunNote:'Helle und dunkle Plasmastrukturen bewegen sich dezent über die Oberfläche. Bewegung und Glanz sind visuelle Effekte.',earthOrbitPeriod:'Umlauf um die Erde',brightSide:'Von der Erde sichtbare helle Seite · Näherung',approximately:'ca. {value}',moonNote:'{phase} · mittlere Bahnposition nach einer JPL-Referenzzeit',jupiterOrbitPeriod:'Umlauf um Jupiter',jupiterDistance:'Mittlere Entfernung zu Jupiter',europaNote:'Aktuelle Bahnposition nach einer JPL-Referenzzeit',orbitPeriod:'Umlaufzeit',sunDistance:'Entfernung zur Sonne · Näherung',plutoNote:'Feste mittlere Bahn',earthNote:'{region} · {city}',day:'Tag',night:'Nacht',koreaView:'{region} ansehen · Tag/Nacht',stormView:'Großen Roten Fleck ansehen',
      speedUnitActive:'Geschwindigkeitseinheit {unit}. Zum Wechseln drücken.',speedUnitReady:'Einheit {unit} bereit. Zum Starten drücken.',orbitPlay:'Bahnen abspielen',orbitPause:'Bahnen pausieren',returnedNow:'Zum Sonnensystem der aktuellen Zeit zurückgekehrt.',fullscreenExitFailed:'Vollbild konnte nicht beendet werden. ESC erneut drücken.',fullscreenUnsupported:'Dieser Browser unterstützt kein Vollbild.',fullscreenOpenFailed:'Vollbild konnte nicht geöffnet werden. Browserberechtigung prüfen.',fullscreenExit:'Vollbild beenden',zenOff:'Betrachtungsmodus ausschalten',zenOn:'Betrachtungsmodus einschalten',normalMode:'Normalmodus',yearLimit:'Am Ende des Jahres 2999 angehalten.'
    },
    fr:{...COPY.en,
      metaDescription:'Une horloge du système solaire au fil des étoiles : heure réelle, orbites planétaires, Terre et Lune dans un petit cosmos.',
      universeAria:'Système solaire. Glissez à gauche pour tourner, avec le bouton central pour déplacer, et utilisez Zoom/Déplacement pour changer le mode de la molette.',
      languageChange:'Changer de langue',languageCurrent:'Français sélectionné',musicOn:'Lire la musique de fond',musicOff:'Arrêter la musique de fond',musicPrevious:'Piste précédente',musicNext:'Piste suivante',musicUnavailable:'Impossible de lire la musique de fond.',helpLabel:'Guide et principes de calcul',settings:'Réglages d’affichage',settingsClose:'Fermer les réglages',
      actualScale:'Rapport de taille réel',orbitSpacing:'Espacement orbital général',orbitSpacingAria:'Espacement des orbites dans la vue générale',orbitBrightness:'Luminosité des orbites',orbitBrightnessAria:'Luminosité des lignes orbitales. Zéro les masque.',displaySize:'Taille affichée',displaySizeAria:'Taille affichée de l’astre sélectionné',satelliteOrbitSpacing:'Espacement des satellites',satelliteOrbitSpacingAria:'Espacement orbital du satellite de la planète sélectionnée',solarOrbitSpacing:'Espacement de Mercure',solarOrbitSpacingAria:'Espacement de Mercure et des planètes extérieures par rapport au Soleil',resetSize:'Réinitialiser taille et orbite',actualSizeLocked:'La taille et l’orbite sont verrouillées en mode de taille réelle.',resetDefaults:'Réinitialiser',resetDefaultsTitle:'Revenir aux réglages initiaux ?',resetDefaultsPrompt:'Les options, tailles, orbites et la vue normale reviendront aux valeurs initiales. Les caméras 1–3 seront conservées.',resetComplete:'Réglages initiaux restaurés.',yes:'Oui',no:'Non',bodyNames:'Noms des astres',avoidLabels:'Éviter le chevauchement des noms',showSeconds:'Afficher les secondes',hourCycle:'Format 24 heures',hourCycleAria:'Format 24 heures. Activé : 24 heures, désactivé : 12 heures',hour24:'24 heures',hour12:'12 heures',clockFont:'Police des chiffres',sunShine:'Éclat solaire',satellites:'Satellites principaux · Lune et Europe',pluto:'Pluton',dwarfPlanet:'Planète naine',comets:'Comètes lointaines',
      selectedBody:'Informations sur l’astre',bodyClose:'Fermer les informations',focusBody:'Vue rapprochée · Suivre l’astre',viewControls:'Commandes de vue',zoomIn:'Zoom avant',zoomOut:'Zoom arrière',moveCloser:'Avancer',moveFarther:'Reculer',zoomValue:'Niveau de zoom',moveValue:'Niveau de déplacement',zoomMode:'ZOOM',moveMode:'DÉPLACER',cameraMode:'Mode molette · {mode}',cameraModeAria:'Mode molette : {mode}. Appuyez pour changer.',homeView:'Vue initiale',cameraPresets:'Vues caméra enregistrées',
      playbackControls:'Commandes des orbites',realTime:'Temps réel',orbitSpeed:'Vitesse orbitale',speedSlider:'Temps écoulé par seconde',sources:'Sources',bodySelect:'Sélectionner un astre',scaleNoteLineOne:'Échelle de taille et de distance ajustée · Orbite moyenne approximative',scaleNoteLineTwo:'Rotation et orbite liées au temps',
      apply:'Déplacer',save:'Enregistrer',delete:'Supprimer',cancel:'Annuler',helpClose:'Fermer l’aide',helpTitle:'Guide et principes de calcul',releaseNotes:'Historique des mises à jour',releaseNotesNewer:'Mise à jour plus récente',releaseNotesOlder:'Mise à jour plus ancienne',basicControls:'Commandes de base',supportMessage:'Si ce programme vous a été utile, offrez un café au développeur.',supportDetail:'Votre soutien contribue grandement au maintien des serveurs et à la poursuite du développement.',supportKrw:'Soutenir en KRW',supportUsd:'Soutenir en USD',
      basicHelp:'Le glissement gauche fait tourner la vue sans limite verticale. Le bouton central déplace l’écran jusqu’à ±80 %. Le bouton supérieur droit alterne la molette entre zoom plat et déplacement réel de la caméra avec perspective. Double-cliquez sur un astre ou choisissez « Vue rapprochée » pour le suivre. 0 restaure la vue initiale ; 1·2·3 enregistrent la vue avec son mode Zoom/Déplacement.',
      timeAndCalculation:'Temps et calcul',timeHelp:'L’horloge supérieure affiche l’heure réelle de la région choisie. Désactivez Temps réel pour régler la simulation en heures, jours ou années.',
      orbitHelp:'Les planètes suivent des orbites elliptiques, plus vite au périhélie et plus lentement à l’aphélie. La Lune et Europe sont rattachées à la Terre et à Jupiter. Les perturbations à long terme sont omises : ce n’est pas une éphéméride de précision.',
      pause:'Pause',fullscreen:'Plein écran',zenMode:'Mode contemplation',savedViews:'Vues enregistrées',stepExit:'Sortie par étapes',loading:'Ouverture d’un petit cosmos',fatalTitle:'Impossible de démarrer la vue.',fatalRetry:'Ouvrez-la à nouveau dans la dernière version d’Edge ou Chrome.',loadingTime:'Chargement de l’heure',
      rotateRight:'Tourner à droite',rotateLeft:'Tourner à gauche',start:'démarrer',stop:'arrêter',rotateRunning:'{direction} · cliquer pour arrêter',rotateRate:'{direction} · 2° par seconde',
      presetButtonTitle:'Caméra {n} · appliquer/enregistrer/supprimer/annuler',presetAria:'La caméra {n} est {state}. Cliquez pour ouvrir le menu.',saved:'enregistrée',empty:'vide',emptyPreset:'La caméra {n} est vide. Enregistrez d’abord une vue.',hiddenBody:'Activez l’astre enregistré puis réessayez.',presetTitle:'Caméra {n}',presetSavedNote:'Appliquez la vue enregistrée ou remplacez-la par la vue actuelle.',presetEmptyNote:'Cet emplacement caméra est vide.',presetSaved:'Caméra {n} enregistrée.',presetDeleted:'Caméra {n} supprimée.',temporaryOnly:' Elle restera uniquement dans cette fenêtre.',
      wallClockAria:'Heure actuelle {time}',timezoneTitle:'Basculer heure locale / UTC',timezoneAria:'Affichage de {zone}. Appuyez pour changer de fuseau.',localTime:'heure locale',bodyInfo:'Informations sur {name}',photoMap:'carte photographique',builtInImage:'image intégrée',builtInMaterial:'matériau intégré',publicPhotoUnavailable:'image publique indisponible',
      hourUnit:'Heure',minuteUnit:'min',secondUnit:'s',dayUnit:'Jour',yearUnit:'Année',timesPerSecond:'{value} rotations par seconde',secondsPerTurn:'une rotation toutes les {value} secondes',paused:'En pause',rotationSummary:'Période de rotation env. {period}{retrograde} · {playback} · même échelle de temps que l’orbite',retrograde:' · rotation rétrograde',
      meanTemperature:'Température moyenne',temperatureRange:'Min. {min} · max. {max} °C',surfaceGravity:'Gravité de surface',earthGravityRatio:'{value}× la Terre',
      representation:'Type',star:'Étoile',systemCenter:'Centre du système solaire',sunNote:'Les détails clairs et sombres du plasma dérivent subtilement sur la surface. Le mouvement et l’éclat sont des effets visuels.',earthOrbitPeriod:'Orbite autour de la Terre',brightSide:'Face éclairée vue depuis la Terre · approximation',approximately:'env. {value}',moonNote:'{phase} · position orbitale moyenne alignée sur une référence JPL',jupiterOrbitPeriod:'Orbite autour de Jupiter',jupiterDistance:'Distance moyenne à Jupiter',europaNote:'Position orbitale actuelle alignée sur une référence JPL',orbitPeriod:'Période orbitale',sunDistance:'Distance au Soleil · approximation',plutoNote:'Orbite moyenne fixe',earthNote:'{region} · {city}',day:'jour',night:'nuit',koreaView:'Voir {region} · jour/nuit',stormView:'Voir la Grande Tache rouge',
      speedUnitActive:'Unité de vitesse : {unit}. Appuyez pour changer.',speedUnitReady:'Unité {unit} prête. Appuyez pour démarrer.',orbitPlay:'Lire les orbites',orbitPause:'Mettre les orbites en pause',returnedNow:'Retour au système solaire à l’heure actuelle.',fullscreenExitFailed:'Impossible de quitter le plein écran. Appuyez à nouveau sur ESC.',fullscreenUnsupported:'Ce navigateur ne prend pas en charge le plein écran.',fullscreenOpenFailed:'Impossible d’ouvrir le plein écran. Vérifiez l’autorisation du navigateur.',fullscreenExit:'Quitter le plein écran',zenOff:'Désactiver le mode contemplation',zenOn:'Activer le mode contemplation',normalMode:'Mode normal',yearLimit:'Arrêt à la fin de l’année 2999.'
    }
  });
  const BODY_COPY={
    en:{sun:['Sun','A star made mostly of hydrogen and helium. Fusion in its core releases energy as hot plasma and light.'],mercury:['Mercury','A rocky planet with an unusually large metallic core. Its water survives mainly as ice in permanently shadowed polar craters.'],venus:['Venus','A silicate-rock planet beneath a dense carbon-dioxide atmosphere and sulfuric-acid clouds; liquid water is absent from the surface.'],earth:['Earth','A planet of silicate rock and a metallic core. Liquid-water oceans cover most of its surface, beneath a nitrogen- and oxygen-rich atmosphere.'],moon:['Moon','Earth’s rocky, silicate-rich natural satellite. Water occurs mainly as ice in permanently shadowed polar soil and craters.'],mars:['Mars','A rocky planet reddened by iron-oxide dust. Most known water remains as ice in the polar caps and subsurface.'],jupiter:['Jupiter','A gas giant made mostly of hydrogen and helium, with no solid surface—only deep atmosphere, cloud layers, and giant storms.'],europa:['Europa','A Galilean moon covered by a water-ice crust. A vast, likely salty liquid ocean may lie beneath the ice.'],saturn:['Saturn','A gas giant made mostly of hydrogen and helium. Its rings are dominated by water ice mixed with rock and dust.'],uranus:['Uranus','An ice giant with hydrogen and helium above a deep interior rich in water-, ammonia-, and methane-bearing material; it also has a tipped axis and faint rings.'],neptune:['Neptune','An ice giant with hydrogen and helium above water-, ammonia-, and methane-rich material. Atmospheric methane contributes to its blue appearance.'],pluto:['Pluto','A dwarf planet of rock and water ice, with a surface coated in nitrogen, methane, and carbon-monoxide ices.']},
    chn:{sun:['太阳','一颗主要由氢和氦组成的恒星。核心核聚变产生的能量以高温等离子体和光的形式释放。'],mercury:['水星','一颗拥有巨大金属核的岩石行星。水主要以冰的形式保存在极地永久阴影陨石坑中。'],venus:['金星','一颗硅酸盐岩石行星。浓密的二氧化碳大气和硫酸云覆盖全球，表面没有液态水。'],earth:['地球','一颗由硅酸盐岩石和金属核组成的行星。液态海洋覆盖大部分表面，大气以氮和氧为主。'],moon:['月球','地球的天然岩石卫星，主要由硅酸盐组成。水主要以冰的形式存在于极地永久阴影土壤和陨石坑中。'],mars:['火星','一颗因含氧化铁的岩石和尘埃而呈红色的行星。已知水主要以冰的形式存在于极冠和地下。'],jupiter:['木星','一颗主要由氢和氦组成的气态巨行星，没有固体表面，只有深厚大气、云层和巨大风暴。'],europa:['木卫二','一颗表面覆盖水冰地壳的伽利略卫星。冰层下可能存在巨大的含盐液态海洋。'],saturn:['土星','一颗主要由氢和氦组成的气态巨行星。光环以水冰为主，并混有岩石和尘埃。'],uranus:['天王星','一颗冰巨星，氢氦大气下富含水、氨和甲烷类物质，并具有倾斜的自转轴与淡薄光环。'],neptune:['海王星','一颗冰巨星，氢氦大气下富含水、氨和甲烷类物质。大气中的甲烷影响其蓝色外观。'],pluto:['冥王星','一颗由岩石和水冰构成的矮行星，表面覆盖氮、甲烷和一氧化碳冰。']},
    jpn:{sun:['太陽','主に水素とヘリウムからなる恒星です。中心部の核融合エネルギーが高温のプラズマと光として放出されます。'],mercury:['水星','非常に大きな金属核を持つ岩石惑星です。水は主に、極域の永久影にあるクレーター内に氷として残っています。'],venus:['金星','ケイ酸塩岩石からなる惑星です。濃い二酸化炭素大気と硫酸の雲に覆われ、表面に液体の水はありません。'],earth:['地球','ケイ酸塩岩石と金属核からなる惑星です。表面の大部分を液体の海が覆い、大気は主に窒素と酸素です。'],moon:['月','ケイ酸塩岩石を主体とする地球の天然衛星です。水は主に、極域の永久影にある土壌やクレーター内に氷として存在します。'],mars:['火星','酸化鉄を含む岩石とちりで赤く見える惑星です。水は主に極冠と地下に氷として残っています。'],jupiter:['木星','主に水素とヘリウムからなるガス巨大惑星です。固体表面はなく、深い大気と雲層、巨大な嵐があります。'],europa:['エウロパ','水の氷からなる地殻に覆われたガリレオ衛星です。氷の下には巨大な塩水の液体海洋が存在する可能性が高いと考えられます。'],saturn:['土星','主に水素とヘリウムからなるガス巨大惑星です。環は水の氷が主体で、岩石とちりが混じっています。'],uranus:['天王星','水素・ヘリウム大気の下に水・アンモニア・メタン系物質を多く含む氷巨大惑星で、傾いた自転軸と淡い環を持ちます。'],neptune:['海王星','水素・ヘリウム大気の下に水・アンモニア・メタン系物質を多く含む氷巨大惑星です。大気中のメタンが青い外観に影響します。'],pluto:['冥王星','岩石と水の氷からなる準惑星で、表面は窒素・メタン・一酸化炭素の氷に覆われています。']}
  };
  Object.assign(BODY_COPY,{
    hi:{
      sun:['सूर्य','मुख्यतः हाइड्रोजन और हीलियम से बना तारा। इसके केंद्र का नाभिकीय संलयन गर्म प्लाज़्मा और प्रकाश के रूप में ऊर्जा छोड़ता है।'],
      mercury:['बुध','असामान्य रूप से बड़े धात्विक केंद्र वाला पथरीला ग्रह। पानी मुख्यतः ध्रुवों के स्थायी छाया वाले गड्ढों में बर्फ के रूप में बचा है।'],
      venus:['शुक्र','सिलिकेट चट्टानों का ग्रह। घना कार्बन-डाइऑक्साइड वायुमंडल और सल्फ्यूरिक-अम्ल के बादल इसे ढकते हैं; सतह पर तरल पानी नहीं है।'],
      earth:['पृथ्वी','सिलिकेट चट्टानों और धात्विक केंद्र वाला ग्रह। तरल पानी के महासागर अधिकांश सतह को ढकते हैं और वायुमंडल में मुख्यतः नाइट्रोजन व ऑक्सीजन है।'],
      moon:['चंद्रमा','सिलिकेट-समृद्ध चट्टानों से बना पृथ्वी का प्राकृतिक उपग्रह। पानी मुख्यतः ध्रुवों की स्थायी छाया वाली मिट्टी और गड्ढों में बर्फ के रूप में है।'],
      mars:['मंगल','लौह-ऑक्साइड वाली चट्टान और धूल से लाल दिखने वाला ग्रह। ज्ञात पानी मुख्यतः ध्रुवीय टोपियों और भूमिगत भाग में बर्फ के रूप में है।'],
      jupiter:['बृहस्पति','मुख्यतः हाइड्रोजन और हीलियम का गैस दानव। इसकी ठोस सतह नहीं, बल्कि गहरा वायुमंडल, बादलों की परतें और विशाल तूफ़ान हैं।'],
      europa:['यूरोपा','पानी की बर्फ की पपड़ी से ढका गैलीलियन उपग्रह। बर्फ के नीचे विशाल, संभवतः खारा तरल महासागर हो सकता है।'],
      saturn:['शनि','मुख्यतः हाइड्रोजन और हीलियम का गैस दानव। इसके छल्लों में पानी की बर्फ प्रमुख है, जिसमें चट्टान और धूल मिली है।'],
      uranus:['यूरेनस','हाइड्रोजन-हीलियम वायुमंडल के नीचे पानी, अमोनिया और मीथेन-समृद्ध पदार्थ वाला हिम दानव; इसकी धुरी झुकी और छल्ले हल्के हैं।'],
      neptune:['नेपच्यून','हाइड्रोजन-हीलियम वायुमंडल के नीचे पानी, अमोनिया और मीथेन-समृद्ध पदार्थ वाला हिम दानव। वायुमंडलीय मीथेन इसके नीले रंग में योगदान देती है।'],
      pluto:['प्लूटो','चट्टान और पानी की बर्फ से बना बौना ग्रह, जिसकी सतह नाइट्रोजन, मीथेन और कार्बन-मोनोऑक्साइड की बर्फ से ढकी है।']
    },
    es:{
      sun:['Sol','Estrella compuesta principalmente por hidrógeno y helio. La fusión de su núcleo libera energía como plasma caliente y luz.'],
      mercury:['Mercurio','Planeta rocoso con un núcleo metálico excepcionalmente grande. El agua subsiste sobre todo como hielo en cráteres polares en sombra permanente.'],
      venus:['Venus','Planeta de roca silicatada bajo una densa atmósfera de dióxido de carbono y nubes de ácido sulfúrico; no hay agua líquida en la superficie.'],
      earth:['Tierra','Planeta de roca silicatada y núcleo metálico. Océanos de agua líquida cubren la mayor parte de la superficie bajo una atmósfera rica en nitrógeno y oxígeno.'],
      moon:['Luna','Satélite natural rocoso y rico en silicatos de la Tierra. El agua aparece principalmente como hielo en suelo y cráteres polares en sombra permanente.'],
      mars:['Marte','Planeta rocoso enrojecido por polvo de óxido de hierro. La mayor parte del agua conocida permanece como hielo en los casquetes polares y el subsuelo.'],
      jupiter:['Júpiter','Gigante gaseoso compuesto principalmente por hidrógeno y helio, sin superficie sólida: solo atmósfera profunda, capas de nubes y tormentas gigantes.'],
      europa:['Europa','Luna galileana cubierta por una corteza de hielo de agua. Bajo el hielo podría existir un enorme océano líquido, probablemente salado.'],
      saturn:['Saturno','Gigante gaseoso compuesto principalmente por hidrógeno y helio. Sus anillos son sobre todo hielo de agua mezclado con roca y polvo.'],
      uranus:['Urano','Gigante de hielo con hidrógeno y helio sobre un interior rico en agua, amoníaco y metano; también posee un eje inclinado y anillos tenues.'],
      neptune:['Neptuno','Gigante de hielo con hidrógeno y helio sobre material rico en agua, amoníaco y metano. El metano atmosférico contribuye a su aspecto azul.'],
      pluto:['Plutón','Planeta enano de roca y hielo de agua, con una superficie cubierta de hielos de nitrógeno, metano y monóxido de carbono.']
    },
    de:{
      sun:['Sonne','Ein Stern, der überwiegend aus Wasserstoff und Helium besteht. Kernfusion setzt Energie als heißes Plasma und Licht frei.'],
      mercury:['Merkur','Ein Gesteinsplanet mit ungewöhnlich großem Metallkern. Wasser bleibt vor allem als Eis in dauerhaft verschatteten Polkratern erhalten.'],
      venus:['Venus','Ein Planet aus Silikatgestein unter einer dichten Kohlendioxidatmosphäre und Schwefelsäurewolken; flüssiges Wasser fehlt an der Oberfläche.'],
      earth:['Erde','Ein Planet aus Silikatgestein mit Metallkern. Ozeane aus flüssigem Wasser bedecken den größten Teil der Oberfläche; die Atmosphäre besteht vor allem aus Stickstoff und Sauerstoff.'],
      moon:['Mond','Der felsige, silikatreiche natürliche Satellit der Erde. Wasser kommt vor allem als Eis in dauerhaft verschattetem Polboden und in Kratern vor.'],
      mars:['Mars','Ein durch Eisenoxidstaub rot gefärbter Gesteinsplanet. Das bekannte Wasser liegt vor allem als Eis in den Polkappen und im Untergrund vor.'],
      jupiter:['Jupiter','Ein Gasriese hauptsächlich aus Wasserstoff und Helium, ohne feste Oberfläche – nur mit tiefer Atmosphäre, Wolkenschichten und riesigen Stürmen.'],
      europa:['Europa','Ein Galileischer Mond mit einer Kruste aus Wassereis. Unter dem Eis könnte ein gewaltiger, wahrscheinlich salzhaltiger flüssiger Ozean liegen.'],
      saturn:['Saturn','Ein Gasriese hauptsächlich aus Wasserstoff und Helium. Seine Ringe bestehen überwiegend aus Wassereis, vermischt mit Gestein und Staub.'],
      uranus:['Uranus','Ein Eisriese mit Wasserstoff und Helium über einem an Wasser, Ammoniak und Methan reichen Inneren; hinzu kommen eine gekippte Achse und schwache Ringe.'],
      neptune:['Neptun','Ein Eisriese mit Wasserstoff und Helium über wasser-, ammoniak- und methanreichem Material. Atmosphärisches Methan trägt zu seinem blauen Aussehen bei.'],
      pluto:['Pluto','Ein Zwergplanet aus Gestein und Wassereis, dessen Oberfläche von Stickstoff-, Methan- und Kohlenmonoxideis bedeckt ist.']
    },
    fr:{
      sun:['Soleil','Une étoile composée surtout d’hydrogène et d’hélium. La fusion de son cœur libère de l’énergie sous forme de plasma chaud et de lumière.'],
      mercury:['Mercure','Une planète rocheuse dotée d’un noyau métallique exceptionnellement grand. L’eau subsiste surtout sous forme de glace dans les cratères polaires toujours à l’ombre.'],
      venus:['Vénus','Une planète de roches silicatées sous une dense atmosphère de dioxyde de carbone et des nuages d’acide sulfurique ; sa surface ne porte pas d’eau liquide.'],
      earth:['Terre','Une planète de roches silicatées et à noyau métallique. Des océans d’eau liquide couvrent la majeure partie de sa surface sous une atmosphère riche en azote et en oxygène.'],
      moon:['Lune','Le satellite naturel rocheux et riche en silicates de la Terre. L’eau se trouve surtout sous forme de glace dans les sols et cratères polaires toujours à l’ombre.'],
      mars:['Mars','Une planète rocheuse rougie par la poussière d’oxyde de fer. L’eau connue subsiste surtout sous forme de glace dans les calottes polaires et le sous-sol.'],
      jupiter:['Jupiter','Une géante gazeuse composée surtout d’hydrogène et d’hélium, sans surface solide : seulement une atmosphère profonde, des couches nuageuses et d’immenses tempêtes.'],
      europa:['Europe','Une lune galiléenne couverte d’une croûte de glace d’eau. Un immense océan liquide, probablement salé, pourrait se trouver sous la glace.'],
      saturn:['Saturne','Une géante gazeuse composée surtout d’hydrogène et d’hélium. Ses anneaux sont dominés par la glace d’eau mêlée de roche et de poussière.'],
      uranus:['Uranus','Une géante de glace avec de l’hydrogène et de l’hélium au-dessus d’un intérieur riche en eau, ammoniac et méthane ; elle possède aussi un axe incliné et de faibles anneaux.'],
      neptune:['Neptune','Une géante de glace avec de l’hydrogène et de l’hélium au-dessus de matière riche en eau, ammoniac et méthane. Le méthane atmosphérique contribue à son aspect bleu.'],
      pluto:['Pluton','Une planète naine de roche et de glace d’eau, dont la surface est couverte de glaces d’azote, de méthane et de monoxyde de carbone.']
    }
  });
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
  const PHASE_COPY={en:{'삭 부근':'near new moon','초승달':'waxing crescent','상현달':'first quarter','차오르는 달':'waxing gibbous','보름달 부근':'near full moon','기우는 달':'waning gibbous','하현달':'last quarter','그믐달':'waning crescent'},chn:{'삭 부근':'接近新月','초승달':'娥眉月','상현달':'上弦月','차오르는 달':'盈凸月','보름달 부근':'接近满月','기우는 달':'亏凸月','하현달':'下弦月','그믐달':'残月'},jpn:{'삭 부근':'新月付近','초승달':'三日月','상현달':'上弦の月','차오르는 달':'満ちていく月','보름달 부근':'満月付近','기우는 달':'欠けていく月','하현달':'下弦の月','그믐달':'有明月'}};
  Object.assign(PHASE_COPY,{
    hi:{'삭 부근':'अमावस्या के पास','초승달':'बढ़ता अर्धचंद्र','상현달':'प्रथम चतुर्थांश','차오르는 달':'बढ़ता उभरा चंद्र','보름달 부근':'पूर्णिमा के पास','기우는 달':'घटता उभरा चंद्र','하현달':'अंतिम चतुर्थांश','그믐달':'घटता अर्धचंद्र'},
    es:{'삭 부근':'cerca de luna nueva','초승달':'creciente','상현달':'cuarto creciente','차오르는 달':'gibosa creciente','보름달 부근':'cerca de luna llena','기우는 달':'gibosa menguante','하현달':'cuarto menguante','그믐달':'menguante'},
    de:{'삭 부근':'nahe Neumond','초승달':'zunehmende Sichel','상현달':'erstes Viertel','차오르는 달':'zunehmender Mond','보름달 부근':'nahe Vollmond','기우는 달':'abnehmender Mond','하현달':'letztes Viertel','그믐달':'abnehmende Sichel'},
    fr:{'삭 부근':'près de la nouvelle lune','초승달':'premier croissant','상현달':'premier quartier','차오르는 달':'gibbeuse croissante','보름달 부근':'près de la pleine lune','기우는 달':'gibbeuse décroissante','하현달':'dernier quartier','그믐달':'dernier croissant'}
  });
  const interpolate=(text,values={})=>String(text).replace(/\{(\w+)\}/g,(_,key)=>values[key]??'');
  // The scene is an application surface, not a document: suppress the browser
  // context menu and accidental drag-selection without changing button controls.
  document.addEventListener('contextmenu',event=>event.preventDefault());
  document.addEventListener('selectstart',event=>event.preventDefault());
  const UI_FADE_MS=1000,uiFadeTimers=new WeakMap();
  const uiFadeDuration=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches?0:UI_FADE_MS;
  const uiElementShown=element=>element.tagName==='DIALOG'?element.open:!element.hidden;
  const uiElementVisible=element=>uiElementShown(element)&&!element.classList.contains('ui-fade-closing');
  function showFading(element,show){
    const timer=uiFadeTimers.get(element);if(timer)clearTimeout(timer);uiFadeTimers.delete(element);
    element.classList.add('ui-fade');element.classList.remove('ui-fade-closing');
    const alreadyShown=uiElementShown(element);if(!alreadyShown){if(show)show();else element.hidden=false;}
    if(alreadyShown||!uiFadeDuration()){element.classList.add('ui-fade-visible');return;}
    element.classList.remove('ui-fade-visible');void element.offsetWidth;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{if(uiElementShown(element)&&!element.classList.contains('ui-fade-closing'))element.classList.add('ui-fade-visible');}));
  }
  function hideFading(element,hide){
    const timer=uiFadeTimers.get(element);if(timer)clearTimeout(timer);uiFadeTimers.delete(element);
    if(!uiElementShown(element))return;
    element.classList.add('ui-fade','ui-fade-closing');element.classList.remove('ui-fade-visible');
    const finish=()=>{uiFadeTimers.delete(element);if(!element.classList.contains('ui-fade-closing'))return;if(hide)hide();else element.hidden=true;element.classList.remove('ui-fade','ui-fade-closing','ui-fade-visible');};
    const duration=uiFadeDuration();if(!duration)finish();else uiFadeTimers.set(element,setTimeout(finish,duration));
  }
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
      const t=(key,values)=>interpolate(COPY[copyLanguage()]?.[key]??COPY.kor[key]??key,values);
      const bodyCopy=body=>copyLanguage()==='kor'?{name:body.ko,description:body.description}:{name:BODY_COPY[copyLanguage()]?.[body.id]?.[0]||body.en,description:BODY_COPY[copyLanguage()]?.[body.id]?.[1]||body.description};
      const phaseCopy=name=>copyLanguage()==='kor'?name:(PHASE_COPY[copyLanguage()]?.[name]||name);
      const quantity=(value,unit)=>['en','hi','es','de','fr'].includes(copyLanguage())?`${value} ${t(unit)}`:`${value}${t(unit)}`;
      const musicAudio=$('background-music'),musicFolder=/\/dist\/[^/]+\.html$/i.test(location.pathname)?'../assets/music/':'assets/music/';
      let musicEnabled=false,musicIndex=-1,musicOrder=[],musicPosition=-1,musicToken=0,musicFailures=0,lastMusicFailure=-1;
      musicAudio.volume=.55;musicAudio.muted=true;
      function musicAssetUrl(file,fallback=false){
        const asset=window.SolarAssets?.music?.[file];
        if(asset){if(fallback||!asset.base)return asset.fallback;return new URL(asset.path,asset.base).href;}
        return new URL(musicFolder+encodeURIComponent(file),location.href).href;
      }
      function fadeMusicVolume(target,duration,token){
        const from=musicAudio.volume,start=performance.now();
        return new Promise(resolve=>{
          let raf=0,settled=false;
          const finish=value=>{if(settled)return;settled=true;if(raf)cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',onVisibilityChange);resolve(value);};
          const onVisibilityChange=()=>{if(!document.hidden)return;if(token!==musicToken){finish(false);return;}musicAudio.volume=target;finish(true);};
          const tick=now=>{
            if(token!==musicToken){finish(false);return;}
            if(document.hidden){musicAudio.volume=target;finish(true);return;}
            const progress=Math.min(1,(now-start)/duration),ease=progress*progress*(3-2*progress);
            musicAudio.volume=from+(target-from)*ease;
            if(progress<1)raf=requestAnimationFrame(tick);else finish(true);
          };
          document.addEventListener('visibilitychange',onVisibilityChange);
          if(document.hidden)onVisibilityChange();else raf=requestAnimationFrame(tick);
        });
      }
      function prepareMusicOrder(){
        const next=MUSIC_TRACKS.map((_,index)=>index);
        for(let i=next.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[next[i],next[j]]=[next[j],next[i]];}
        musicOrder=next;musicPosition=0;
      }
      function musicUi(){
        const button=$('music-toggle'),track=MUSIC_TRACKS[musicIndex],label=t(musicEnabled?'musicOff':'musicOn');
        button.setAttribute('aria-pressed',String(musicEnabled));button.setAttribute('aria-label',label);button.title=label;
        $('music-title').textContent=track?.title||'';$('music-now').hidden=!(musicEnabled&&track);
        for(const [id,key] of [['music-previous','musicPrevious'],['music-next','musicNext']]){$(id).setAttribute('aria-label',t(key));$(id).title=t(key);}
      }
      function musicFailure(token){
        if(!musicEnabled||token!==musicToken||lastMusicFailure===token)return;
        lastMusicFailure=token;
        if(++musicFailures<MUSIC_TRACKS.length){stepMusic(1,false);return;}
        setMusicEnabled(false);toast(t('musicUnavailable'));
      }
      async function playMusicAt(position,useFallback=false){
        if(!musicEnabled)return;
        if(!musicOrder.length)prepareMusicOrder();
        musicPosition=(position+musicOrder.length)%musicOrder.length;musicIndex=musicOrder[musicPosition];
        const track=MUSIC_TRACKS[musicIndex],token=++musicToken;
        musicUi();
        if(!musicAudio.paused&&!musicAudio.ended&&musicAudio.currentTime>0){
          if(!await fadeMusicVolume(0,90,token))return;
          musicAudio.pause();
        }
        if(token!==musicToken||!musicEnabled)return;
        musicAudio.src=musicAssetUrl(track.file,useFallback);musicAudio.volume=0;musicAudio.muted=false;musicAudio.load();
        try{
          await musicAudio.play();
          if(token===musicToken){musicFailures=0;await fadeMusicVolume(.55,180,token);}
        }catch(_){const primary=musicAssetUrl(track.file),fallback=musicAssetUrl(track.file,true);if(!useFallback&&primary!==fallback){playMusicAt(position,true);return;}musicFailure(token);}
      }
      function stepMusic(direction,resetFailures=true){if(!musicEnabled)return;if(!musicOrder.length)prepareMusicOrder();if(resetFailures)musicFailures=0;playMusicAt(musicPosition+direction);}
      function playFirstMusic(){prepareMusicOrder();playMusicAt(0);}
      function setMusicEnabled(value){
        const next=!!value;if(next===musicEnabled)return;musicEnabled=next;
        if(!next){++musicToken;musicAudio.pause();musicAudio.muted=true;musicUi();return;}
        musicAudio.muted=false;musicFailures=0;lastMusicFailure=-1;
        if(musicIndex>=0&&musicAudio.src&&!musicAudio.ended&&!musicAudio.error){const token=++musicToken;musicUi();musicAudio.volume=0;musicAudio.play().then(()=>fadeMusicVolume(.55,180,token)).catch(()=>musicFailure(token));}
        else playFirstMusic();
      }
      musicAudio.addEventListener('ended',()=>stepMusic(1));
      $('music-toggle').addEventListener('click',()=>setMusicEnabled(!musicEnabled));
      $('music-previous').addEventListener('click',()=>stepMusic(-1));
      $('music-next').addEventListener('click',()=>stepMusic(1));
      function translateStatic(){
        document.documentElement.lang=LANG_META[language].html;
        for(const el of document.querySelectorAll('[data-i18n]'))el.textContent=t(el.dataset.i18n);
        for(const el of document.querySelectorAll('[data-i18n-aria]'))el.setAttribute('aria-label',t(el.dataset.i18nAria));
        for(const el of document.querySelectorAll('[data-i18n-title]'))el.title=t(el.dataset.i18nTitle);
        for(const el of document.querySelectorAll('[data-i18n-content]'))el.setAttribute('content',t(el.dataset.i18nContent));
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
        const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
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
      function persist() { try {const camera=renderer.cameraSnapshot();if(camera.focus===null)overviewCamera={...camera,focus:null};localStorage.setItem(STORAGE_KEY,JSON.stringify({...renderer.options,bodyScales:renderer.getBodyScales(),satelliteOrbitScales:renderer.getSatelliteOrbitScales(),autoRotateDirection:renderer.autoRotateDirection,timezone,showSeconds,hourCycle,clockFont,speedMode,speedValues,language,camera:overviewCamera,elevation:overviewCamera.elevation/A.DEG,panY:overviewCamera.panY,panX:overviewCamera.panX})); } catch (_) {} }
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
        const saved=JSON.parse(localStorage.getItem(PRESETS_KEY)||'null');
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
        try{localStorage.setItem(PRESETS_KEY,JSON.stringify({schema:2,slots:cameraPresets}));presetStorageAvailable=true;}
        catch(_){presetStorageAvailable=false;}
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
      function bindScrollCues(container,scroller){
        const update=()=>{const remaining=scroller.scrollHeight-scroller.clientHeight-scroller.scrollTop;container.classList.toggle('can-scroll-up',scroller.scrollTop>3);container.classList.toggle('can-scroll-down',remaining>3);};
        scroller.addEventListener('scroll',update,{passive:true});
        if(typeof ResizeObserver==='function')new ResizeObserver(()=>requestAnimationFrame(update)).observe(scroller);
        scrollCueUpdates.push(update);return update;
      }
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
      function applyFactoryDefaults(){
        const mono=performance.now();closeResetDefaults(false);renderer.cancelCameraMotion(mono);renderer.stopAutoRotate(mono);
        for(const [key,value] of Object.entries(FACTORY_OPTIONS))renderer.setOption(key,value,false);
        renderer.setBodyScales(FACTORY_BODY_SCALES);renderer.setSatelliteOrbitScales(FACTORY_ORBIT_SCALES);
        renderer.restoreCamera(renderer.defaultCameraSnapshot());renderer.setAutoRotate(FACTORY_AUTO_ROTATE,mono);overviewCamera=renderer.defaultCameraSnapshot();
        timezone='local';showSeconds=false;hourCycle='12';clockFont='georgia';speedMode='day';speedValues={hour:1,day:1,year:1};language=detectedLanguage();
        renderer.setSite(activeRegion());for(const [key,id] of Object.entries(validKeys))$(id).checked=renderer.options[key];
        $('show-seconds').checked=showSeconds;$('seconds-group').hidden=true;$('hour-cycle').checked=false;$('ampm').hidden=false;
        $('clock-font').value=clockFont;document.documentElement.style.setProperty('--clock-font',CLOCK_FONTS[clockFont]);
        translateStatic();refreshTimeFormats();refreshNavLabels();syncOrbitSpacingControl();syncOrbitBrightnessControl();syncSpeedUi();cameraUi();navVisibility();closeBody();lastWallKey='';uiNow();persist();toast(t('resetComplete'));
      }
      $('reset-defaults').addEventListener('click',()=>{showFading(resetDefaultsDialog,()=>resetDefaultsDialog.showModal());$('reset-defaults-no').focus({preventScroll:true});});
      $('reset-defaults-no').addEventListener('click',()=>closeResetDefaults());$('reset-defaults-yes').addEventListener('click',applyFactoryDefaults);
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
      const updateHelpScrollCues=bindScrollCues(helpDialog,helpScroll);
      const releaseNotesApi=window.SolarReleaseNotes,releaseNotesNavigator=releaseNotesApi?.createReleaseNotesNavigator?.();
      function formatReleaseNotesBytes(bytes){const value=Math.max(0,Number(bytes)||0);return value<1024?value+' B':(value/1024).toFixed(1)+' KB';}
      function renderReleaseNotes(state=releaseNotesNavigator?.current()){
        const release=state?.release;if(!release)return;
        $('release-notes-version').textContent='v'+release.version;
        $('release-notes-date').textContent=release.date||'';
        $('release-notes-size').textContent=formatReleaseNotesBytes(releaseNotesApi.SOURCE_BYTES);
        const fragment=document.createDocumentFragment();
        for(const item of release.items.slice(0,10)){const row=document.createElement('li');row.textContent=item;fragment.append(row);}
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
      function setLanguage(next){
        if(!LANG_ORDER.includes(next)||next===language)return;
        language=next;renderer.setSite(activeRegion());translateStatic();refreshTimeFormats();lastWallKey='';
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
      for(const option of languageMenu.querySelectorAll('[data-language]'))option.addEventListener('click',()=>{setLanguage(option.dataset.language);closeLanguageMenu(true);});
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
      window.SolarTime=Object.freeze({version:'0.38',clock,renderer,materials,calibrationMs,setLanguage,getPresets:()=>cameraPresets.map(v=>v?{...v}:null),getModel:()=>A.modelStatus(),getState:()=>({fullscreen:!!document.fullscreenElement,escapeLock:'native',simulationMs:clock.value(performance.now()),wallMs:Date.now(),rate:clock.rate,live:clock.live,paused:clock.paused,timezone,timeZone:activeTimeZone(),region:activeRegion().label,showSeconds,hourCycle,clockFont,language,zen,musicEnabled,musicTrack:MUSIC_TRACKS[musicIndex]?.title||null,effectTime,frameCount:renderer.frameCount})});
      uiNow();
      const bootMono=performance.now(),bootMs=clock.value(bootMono);renderer.draw(bootMs,0,bootMono);
      await warmInitialScene();
      if(!disposed){const revealMono=performance.now();renderer.startOrbitReveal(revealMono);renderer.draw(clock.value(revealMono),0,revealMono);$('loading').classList.add('done');setTimeout(()=>$('loading').hidden=true,450);scheduleMaterialRefresh();}
      if(!document.hidden&&!disposed)raf=requestAnimationFrame(frame);
    } catch(error){fatal(error);}
  }
  requestAnimationFrame(()=>setTimeout(init,0));
})();
