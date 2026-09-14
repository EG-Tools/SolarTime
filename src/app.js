/* Solar Time v0.34 — clock, interaction and accessible UI. */
(function () {
  'use strict';
  const $=id=>document.getElementById(id), A=window.SolarAstro;
  const STORAGE_KEY='eg.solar-time.v0.01';
  const LANG_ORDER=['kor','en','chn','jpn','eu'];
  const LANG_META={
    kor:{code:'KOR',locale:'ko-KR',html:'ko',copy:'kor'},
    en:{code:'EN',locale:'en-US',html:'en',copy:'en'},
    chn:{code:'CHN',locale:'zh-CN',html:'zh-Hans',copy:'chn'},
    jpn:{code:'JPN',locale:'ja-JP',html:'ja',copy:'jpn'},
    eu:{code:'EU',locale:'en-GB',html:'en-GB',copy:'en'}
  };
  const REGIONS={
    kor:{label:'KOREA',timeZone:'Asia/Seoul',latitude:37.5665,longitude:126.978,region:'한국',city:'서울'},
    en:{label:'USA',timeZone:'America/New_York',latitude:39.8283,longitude:-98.5795,region:'United States',city:'mainland center'},
    chn:{label:'CHINA',timeZone:'Asia/Shanghai',latitude:35.8617,longitude:104.1954,region:'中国',city:'国土中心'},
    jpn:{label:'JAPAN',timeZone:'Asia/Tokyo',latitude:35.6762,longitude:139.6503,region:'日本',city:'東京'},
    eu:{label:'UK',timeZone:'Europe/London',latitude:54.0037,longitude:-2.5479,region:'United Kingdom',city:'geographic centre'}
  };
  const FACTORY_OPTIONS=Object.freeze({actualScale:false,overviewOrbitGap:86,dollyZoom:false,orbits:true,labels:true,avoidLabels:false,twinkle:true,activity:true,pluto:true,moon:true,skyMotion:true,comets:true,quality:'auto'});
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
    if(/^America\//i.test(zone))return 'en';
    if(languages.some(value=>/^zh(?:-|$)/.test(value)))return 'chn';
    if(languages.some(value=>/^ja(?:-|$)/.test(value)))return 'jpn';
    if(languages.some(value=>/^ko(?:-|$)/.test(value)))return 'kor';
    if(languages.some(value=>/^en-gb(?:-|$)/.test(value)))return 'eu';
    return 'en';
  }
  const COPY={
    kor:{
      metaDescription:'별빛과 함께 흐르는 태양계 시계. 실제 시각, 행성의 공전, 지구와 달을 만나는 작은 우주.',
      universeAria:'태양계. 좌클릭 드래그로 시점을 자유 회전하고, 가운데 버튼 드래그로 상하좌우 이동합니다. 우측 줌·이동 버튼으로 휠 작동 방식을 바꿀 수 있습니다.',
      languageChange:'언어 변경',languageCurrent:'현재 한국어',musicOn:'배경음악 켜기',musicOff:'배경음악 끄기',musicPrevious:'이전 음악',musicNext:'다음 음악',musicUnavailable:'배경음악을 재생할 수 없습니다.',helpLabel:'사용 방법과 계산 기준',settings:'화면 설정',settingsClose:'설정 닫기',
      actualScale:'실제 크기 비율',orbitSpacing:'일반 보기 궤도 간격',orbitSpacingAria:'일반 보기의 행성 궤도 간격',displaySize:'화면 표시 크기',displaySizeAria:'선택한 천체의 화면 표시 크기',satelliteOrbitSpacing:'위성 궤도 간격',satelliteOrbitSpacingAria:'선택한 행성의 위성 궤도 간격',solarOrbitSpacing:'수성 궤도 간격',solarOrbitSpacingAria:'태양을 기준으로 수성과 바깥 행성 전체의 궤도 간격',resetSize:'크기, 궤도 리셋',actualSizeLocked:'실제 크기 비율에서는 크기와 궤도를 조절할 수 없습니다.',resetDefaults:'초기화',resetDefaultsTitle:'초기 설정으로 돌아갈까요?',resetDefaultsPrompt:'옵션과 천체 크기, 궤도 및 일반 시점이 초기값으로 돌아갑니다. 카메라 1·2·3 저장값은 유지됩니다.',resetComplete:'초기 설정으로 돌아왔습니다.',yes:'예',no:'아니오',orbits:'궤도선',bodyNames:'천체 이름',avoidLabels:'이름 겹침 자동 정리',showSeconds:'시계 초 표시',hourCycle:'24시간 표기',hourCycleAria:'24시간 표기. 켜면 24시간, 끄면 12시간',hour24:'24시간',hour12:'12시간',clockFont:'시계 숫자 폰트',sunShine:'태양 샤인',satellites:'주요 위성 · 달과 유로파',pluto:'명왕성',dwarfPlanet:'왜행성',comets:'멀리 지나는 혜성',
      selectedBody:'선택한 천체 정보',bodyClose:'천체 정보 닫기',focusBody:'가까이 보기 · 천체 추적',viewControls:'시점 조절',zoomIn:'확대',zoomOut:'축소',moveCloser:'앞으로 이동',moveFarther:'뒤로 이동',zoomValue:'화면 확대 배율',moveValue:'카메라 이동 배율',zoomMode:'줌',moveMode:'이동',cameraMode:'휠 작동 방식 · {mode}',cameraModeAria:'휠 모드: {mode}. 누르면 다른 방식으로 전환',homeView:'기본 시점',cameraPresets:'카메라 시점 저장',
      playbackControls:'공전 재생 조절',realTime:'실제 시간',orbitSpeed:'공전 속도',speedSlider:'1초당 진행하는 시간',sources:'출처',bodySelect:'천체 선택',scaleNoteLineOne:'크기·거리 축척 조정 · 평균 궤도 근사',scaleNoteLineTwo:'자전·공전 시간 연동',
      apply:'이동',save:'저장',delete:'삭제',cancel:'취소',helpClose:'도움말 닫기',helpTitle:'사용 방법과 계산 기준',basicControls:'기본 조작',supportLink:'Solar Time 후원하기',supportNote:'후원금은 서버 운영비와 Solar Time의 지속적인 개발 비용으로 사용됩니다.',
      basicHelp:'좌클릭 드래그는 위아래 제한 없이 시점을 한 바퀴 계속 회전합니다. 가운데 버튼 드래그는 화면을 상하좌우 ±80% 이동합니다. 우측 맨 위 버튼에서 휠을 평면적인 줌 또는 원근감이 생기는 실제 카메라 이동으로 전환할 수 있습니다. 천체를 더블클릭하거나 «가까이 보기»를 누르면 추적합니다. 0은 기본 시점, 1·2·3은 줌/이동 방식까지 함께 저장하는 시점입니다.',
      releaseHelp:'승인된 화면 구도와 모든 표시 옵션을 초기 설정으로 확정하고, 초기화할 때 카메라 1·2·3 저장값은 유지하도록 했습니다. 토성과 천왕성의 고리는 거리에 따라 세부 띠를 부드럽게 합쳐 모아레를 줄입니다.',
      timeAndCalculation:'시간과 계산',timeHelp:'상단 시계는 선택한 지역에 맞춰 한국·미국 동부·중국·일본·영국의 실제 시간을 표시합니다. 하단 실제 시간을 끄면 시간·일·년 단위의 슬라이더로 시뮬레이션 속도를 조절합니다. 시간은 1분~24시간, 일은 1~365일, 년은 1~20년 범위입니다.',
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
      actualScale:'True size ratio',orbitSpacing:'Overview orbit spacing',orbitSpacingAria:'Planet orbit spacing in overview mode',displaySize:'Display size',displaySizeAria:'Display size of the selected body',satelliteOrbitSpacing:'Moon orbit spacing',satelliteOrbitSpacingAria:'Orbit spacing for the selected planet’s moon',solarOrbitSpacing:'Mercury orbit spacing',solarOrbitSpacingAria:'Orbit spacing of Mercury and every outer planet relative to the Sun',resetSize:'Reset size & orbit',actualSizeLocked:'Size and orbit adjustment is unavailable in true-size mode.',resetDefaults:'Reset',resetDefaultsTitle:'Return to the initial setup?',resetDefaultsPrompt:'Options, body sizes, orbits and the normal view will return to their initial values. Camera slots 1–3 will be kept.',resetComplete:'Initial setup restored.',yes:'Yes',no:'No',orbits:'Orbit lines',bodyNames:'Body names',avoidLabels:'Prevent label overlap',showSeconds:'Show clock seconds',hourCycle:'24-hour clock',hourCycleAria:'24-hour clock. On is 24-hour, off is 12-hour',hour24:'24 hour',hour12:'12 hour',clockFont:'Clock numeral font',sunShine:'Solar shine',satellites:'Major moons · Moon and Europa',pluto:'Pluto',dwarfPlanet:'Dwarf planet',comets:'Distant comets',
      selectedBody:'Selected body information',bodyClose:'Close body information',focusBody:'Closer view · Track body',viewControls:'View controls',zoomIn:'Zoom in',zoomOut:'Zoom out',moveCloser:'Move closer',moveFarther:'Move farther',zoomValue:'View zoom level',moveValue:'Camera travel level',zoomMode:'ZOOM',moveMode:'MOVE',cameraMode:'Wheel mode · {mode}',cameraModeAria:'Wheel mode: {mode}. Press to switch modes.',homeView:'Default view',cameraPresets:'Saved camera views',
      playbackControls:'Orbit playback controls',realTime:'Real time',orbitSpeed:'Orbit speed',speedSlider:'Time advanced per second',sources:'Sources',bodySelect:'Select body',scaleNoteLineOne:'Adjusted size and distance scale · Mean orbit approximation',scaleNoteLineTwo:'Rotation and orbit linked to time',
      apply:'Move',save:'Save',delete:'Delete',cancel:'Cancel',helpClose:'Close help',helpTitle:'Guide and calculation notes',basicControls:'Basic controls',supportLink:'Support Solar Time',supportNote:'Donations help cover server costs and ongoing development.',
      basicHelp:'Left-drag rotates continuously through a full turn without a vertical stop. Middle-drag pans up, down, left or right by ±80%. The top button on the right switches the wheel between flat zoom and true camera travel with perspective. Double-click a body or choose “Closer view” to track it. 0 restores the default view; 1·2·3 save the view together with its Zoom/Move mode.',
      releaseHelp:'The approved composition and display options now form the factory preset, while reset keeps camera slots 1–3. Saturn and Uranus rings blend subpixel bands by distance to reduce moiré.',
      timeAndCalculation:'Time and calculation',timeHelp:'The upper clock follows the selected region: Korea, U.S. Eastern, China, Japan, or the United Kingdom. Turn off Real time below to adjust simulation speed in hours, days or years. The ranges are 1 minute–24 hours, 1–365 days, and 1–20 years per second.',
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
      actualScale:'真实大小比例',orbitSpacing:'普通视图轨道间距',orbitSpacingAria:'普通视图中的行星轨道间距',displaySize:'显示大小',displaySizeAria:'所选天体的显示大小',satelliteOrbitSpacing:'卫星轨道间距',satelliteOrbitSpacingAria:'所选行星的卫星轨道间距',solarOrbitSpacing:'水星轨道间距',solarOrbitSpacingAria:'以太阳为中心的水星及所有外侧行星轨道间距',resetSize:'重置大小与轨道',actualSizeLocked:'真实大小比例下无法调整大小与轨道。',resetDefaults:'重置',resetDefaultsTitle:'恢复初始设置吗？',resetDefaultsPrompt:'选项、天体大小、轨道和普通视角将恢复初始值。相机 1–3 的保存内容会保留。',resetComplete:'已恢复初始设置。',yes:'是',no:'否',orbits:'轨道线',bodyNames:'天体名称',avoidLabels:'自动避免名称重叠',showSeconds:'显示时钟秒数',hourCycle:'24小时制',hourCycleAria:'24小时制。开启为24小时，关闭为12小时',hour24:'24小时',hour12:'12小时',clockFont:'时钟数字字体',sunShine:'太阳光芒',satellites:'主要卫星 · 月球与木卫二',pluto:'冥王星',dwarfPlanet:'矮行星',comets:'远方彗星',
      selectedBody:'所选天体信息',bodyClose:'关闭天体信息',focusBody:'近距离查看 · 跟踪天体',viewControls:'视角控制',zoomIn:'放大',zoomOut:'缩小',moveCloser:'向前移动',moveFarther:'向后移动',zoomValue:'视图缩放倍率',moveValue:'相机移动倍率',zoomMode:'缩放',moveMode:'移动',cameraMode:'滚轮模式 · {mode}',cameraModeAria:'滚轮模式：{mode}。点击可切换。',homeView:'默认视角',cameraPresets:'保存的相机视角',
      playbackControls:'公转播放控制',realTime:'实时',orbitSpeed:'公转速度',speedSlider:'每秒推进的时间',sources:'来源',bodySelect:'选择天体',scaleNoteLineOne:'大小与距离比例已调整 · 平均轨道近似',scaleNoteLineTwo:'自转和公转与时间联动',
      apply:'移动',save:'保存',delete:'删除',cancel:'取消',helpClose:'关闭帮助',helpTitle:'使用方法与计算说明',basicControls:'基本操作',supportLink:'支持 Solar Time',supportNote:'赞助资金将用于服务器运行和持续开发。',
      basicHelp:'按住左键拖动可不受上下限制地连续旋转一周；按住中键拖动可向上下左右平移 ±80%。右侧最上方按钮可在平面缩放与具有透视感的真实相机移动之间切换滚轮模式。双击天体或选择“近距离查看”可跟踪天体。0 恢复默认视角，1·2·3 会连同缩放/移动模式一起保存。',
      releaseHelp:'已将确认后的画面构图和显示选项设为初始设置，重置时会保留相机 1·2·3。土星与天王星的细环会按距离平滑合并，以减少摩尔纹。',
      timeAndCalculation:'时间与计算',timeHelp:'上方时钟会按所选地区显示韩国、美国东部、中国、日本或英国的实际时间。关闭下方“实时”后，可按小时、日或年调整模拟速度。范围为每秒 1 分钟–24 小时、1–365 日或 1–20 年。',
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
      actualScale:'実際の大きさの比率',orbitSpacing:'通常表示の軌道間隔',orbitSpacingAria:'通常表示での惑星軌道の間隔',displaySize:'表示サイズ',displaySizeAria:'選択した天体の表示サイズ',satelliteOrbitSpacing:'衛星の軌道間隔',satelliteOrbitSpacingAria:'選択した惑星の衛星軌道間隔',solarOrbitSpacing:'水星の軌道間隔',solarOrbitSpacingAria:'太陽を基準にした水星と外側の全惑星の軌道間隔',resetSize:'サイズ・軌道をリセット',actualSizeLocked:'実際の大きさの比率ではサイズと軌道を調整できません。',resetDefaults:'初期化',resetDefaultsTitle:'初期設定に戻しますか？',resetDefaultsPrompt:'オプション、天体サイズ、軌道、通常視点を初期値へ戻します。カメラ1・2・3の保存内容は維持されます。',resetComplete:'初期設定に戻しました。',yes:'はい',no:'いいえ',orbits:'軌道線',bodyNames:'天体名',avoidLabels:'ラベルの重なりを自動調整',showSeconds:'時計に秒を表示',hourCycle:'24時間表示',hourCycleAria:'24時間表示。オンは24時間、オフは12時間',hour24:'24時間',hour12:'12時間',clockFont:'時計の数字フォント',sunShine:'太陽の輝き',satellites:'主な衛星 · 月とエウロパ',pluto:'冥王星',dwarfPlanet:'準惑星',comets:'遠方を通る彗星',
      selectedBody:'選択した天体の情報',bodyClose:'天体情報を閉じる',focusBody:'近くで見る · 天体を追跡',viewControls:'視点調整',zoomIn:'拡大',zoomOut:'縮小',moveCloser:'前へ移動',moveFarther:'後ろへ移動',zoomValue:'画面の拡大率',moveValue:'カメラ移動倍率',zoomMode:'ズーム',moveMode:'移動',cameraMode:'ホイール方式 · {mode}',cameraModeAria:'ホイール方式：{mode}。押すと切り替わります。',homeView:'標準視点',cameraPresets:'保存したカメラ視点',
      playbackControls:'公転再生コントロール',realTime:'リアルタイム',orbitSpeed:'公転速度',speedSlider:'1秒あたりに進む時間',sources:'出典',bodySelect:'天体を選択',scaleNoteLineOne:'大きさ・距離の縮尺を調整 · 平均軌道による近似',scaleNoteLineTwo:'自転と公転を時間に連動',
      apply:'移動',save:'保存',delete:'削除',cancel:'キャンセル',helpClose:'ヘルプを閉じる',helpTitle:'操作方法と計算基準',basicControls:'基本操作',supportLink:'Solar Timeを支援',supportNote:'ご支援はサーバー運営費と継続的な開発費に充てられます。',
      basicHelp:'左ドラッグは上下で止まらず一周連続して回転します。中ボタンドラッグは上下左右へ ±80% 移動します。右側最上部のボタンで、平面的なズームと遠近感のある実カメラ移動を切り替えられます。天体をダブルクリックするか「近くで見る」で追跡します。0 は標準視点、1・2・3 はズーム/移動方式も一緒に保存します。',
      releaseHelp:'確定した画面構図と表示オプションを初期設定にし、リセット時もカメラ1・2・3は保持します。土星と天王星の細いリングは距離に応じて滑らかに統合し、モアレを抑えます。',
      timeAndCalculation:'時刻と計算',timeHelp:'上部の時計は選択した地域に合わせて、韓国・米国東部・中国・日本・英国の現在時刻を表示します。下部のリアルタイムをオフにすると、時・日・年単位でシミュレーション速度を調整できます。範囲は1秒あたり1分〜24時間、1〜365日、1〜20年です。',
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
  const BODY_COPY={
    en:{sun:['Sun','The center of the solar system. Granular surface detail and soft shine are visual effects.'],mercury:['Mercury','A small rocky planet closest to the Sun. Its rapid orbit makes the shortest year in this solar system.'],venus:['Venus','Venus is wrapped in thick clouds and rotates very slowly in the opposite direction to most planets.'],earth:['Earth','The blue planet by which we keep time. Its Moon travels around the Sun together with Earth.'],moon:['Moon','Earth’s only natural satellite, orbiting in about 27.32 days. Its position follows the current simulation time; distance and size are enlarged for clarity.'],mars:['Mars','Our neighboring planet colored red by iron oxide, with a longer year than Earth.'],jupiter:['Jupiter','The largest planet in the solar system, shown with cloud bands and its giant storm.'],europa:['Europa','An icy Galilean moon. It orbits Jupiter in about 3.55 days and follows the current simulation time.'],saturn:['Saturn','A planet surrounded by rings of ice and rock particles, layered in 3D in front of and behind the planet.'],uranus:['Uranus','A cyan ice giant distinguished by its nearly sideways rotation axis and faint rings.'],neptune:['Neptune','The deep-blue outer planet, taking about 165 years to complete one orbit.'],pluto:['Pluto','A dwarf planet rather than a planet. Its tilted elliptical orbit is approximated with fixed mean elements.']},
    chn:{sun:['太阳','太阳系的中心。表面颗粒与柔和光芒为观赏用视觉效果。'],mercury:['水星','最靠近太阳的小型岩石行星，快速公转形成太阳系中最短的一年。'],venus:['金星','被浓厚云层覆盖，并以与多数行星相反的方向缓慢自转。'],earth:['地球','我们用来计量时间的蓝色行星，月球与地球一同绕太阳旅行。'],moon:['月球','地球唯一的天然卫星，约 27.32 日绕行一周。位置随当前模拟时间变化，距离和大小为便于观看而放大。'],mars:['火星','被氧化铁染红的邻近行星，一年比地球更长。'],jupiter:['木星','太阳系最大的行星，画面表现了条带状云层与巨大风暴。'],europa:['木卫二','伽利略卫星之一的冰世界，约 3.55 日绕木星一周，位置随当前模拟时间变化。'],saturn:['土星','由冰与岩石颗粒组成的光环环绕其周围，光环前后与行星呈立体交叠。'],uranus:['天王星','青色冰巨星，近乎横躺的自转轴与淡薄光环是其特点。'],neptune:['海王星','深蓝色的外侧行星，完成一次公转约需 165 年。'],pluto:['冥王星','它是矮行星而非行星，倾斜的椭圆轨道以固定平均轨道要素近似呈现。']},
    jpn:{sun:['太陽','太陽系の中心。粒状の表面と柔らかな輝きは鑑賞用の視覚効果です。'],mercury:['水星','太陽に最も近い小さな岩石惑星で、速い公転によって太陽系で最も短い一年を持ちます。'],venus:['金星','厚い雲に覆われ、多くの惑星とは逆向きに非常にゆっくり自転します。'],earth:['地球','私たちが時間の基準にする青い惑星。月とともに太陽の周りを進みます。'],moon:['月','地球唯一の天然衛星で、約27.32日で一周します。位置は現在のシミュレーション時刻に従い、見やすさのため距離と大きさを拡大しています。'],mars:['火星','酸化鉄によって赤く見える隣の惑星で、一年は地球より長くなります。'],jupiter:['木星','太陽系最大の惑星。縞状の雲と巨大な嵐を表現しています。'],europa:['エウロパ','ガリレオ衛星の一つである氷の世界。約3.55日で木星を一周し、現在のシミュレーション時刻に従います。'],saturn:['土星','氷と岩石の粒子からなる環に囲まれ、環は惑星の前後に立体的に重なります。'],uranus:['天王星','ほぼ横倒しの自転軸と淡い環が特徴のシアン色の氷巨星です。'],neptune:['海王星','深い青色の外惑星で、一周の公転に約165年かかります。'],pluto:['冥王星','惑星ではなく準惑星です。傾いた楕円軌道を固定平均要素で近似しています。']}
  };
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
    const alreadyShown=uiElementShown(element);if(!alreadyShown){if(show)show();else element.hidden=false;}
    element.classList.add('ui-fade');element.classList.remove('ui-fade-closing');
    if(alreadyShown||!uiFadeDuration()){element.classList.add('ui-fade-visible');return;}
    element.classList.remove('ui-fade-visible');void element.offsetWidth;
    requestAnimationFrame(()=>{if(uiElementShown(element)&&!element.classList.contains('ui-fade-closing'))element.classList.add('ui-fade-visible');});
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
      const quantity=(value,unit)=>copyLanguage()==='en'?`${value} ${t(unit)}`:`${value}${t(unit)}`;
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
          const tick=now=>{
            if(token!==musicToken){resolve(false);return;}
            const progress=Math.min(1,(now-start)/duration),ease=progress*progress*(3-2*progress);
            musicAudio.volume=from+(target-from)*ease;
            if(progress<1)requestAnimationFrame(tick);else resolve(true);
          };
          requestAnimationFrame(tick);
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
        const lang=$('language-toggle');lang.textContent=LANG_META[language].code;lang.setAttribute('aria-label',`${t('languageChange')}. ${t('languageCurrent')}`);lang.title=`${t('languageChange')} · ${LANG_META[language].code}`;
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
      const validKeys={actualScale:'actual-scale',orbits:'show-orbits',labels:'show-labels',avoidLabels:'avoid-labels',activity:'show-activity',pluto:'show-pluto',moon:'show-moon',comets:'show-comets'};
      try {
        const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
        if(saved&&typeof saved==='object') {
          for(const key of Object.keys(validKeys))if(typeof saved[key]==='boolean')renderer.options[key]=saved[key];
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
          const mode=value?t(value.mode==='move'?'moveMode':'zoomMode'):'';b.dataset.modeShort=value?.mode==='move'?'M':value?'Z':'';
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
        for(const id of ['moon','pluto'])if(value.focus===id&&!renderer.options[id]){renderer.setOption(id,true);$(validKeys[id]).checked=true;navVisibility();}
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
        button.addEventListener('click',()=>selectBody(b.id));$('planet-nav').append(button);navButtons.set(b.id,button);
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
        scroller.addEventListener('scroll',update,{passive:true});scrollCueUpdates.push(update);return update;
      }
      const settingsPanel=$('settings-panel'),settingsScroll=$('settings-scroll');
      const updateSettingsScrollCues=bindScrollCues(settingsPanel,settingsScroll);
      function settings(open) {const next=open===undefined?!uiElementVisible(settingsPanel):open;if(next){showFading(settingsPanel);updateSettingsScrollCues();requestAnimationFrame(updateSettingsScrollCues);}else hideFading(settingsPanel);$('settings-button').setAttribute('aria-expanded',String(next));if(next)closeBody();}
      $('settings-button').addEventListener('click',()=>settings());$('settings-close').addEventListener('click',()=>{settings(false);$('settings-button').focus();});
      for(const [key,id] of Object.entries(validKeys))$(id).addEventListener('change',()=>{renderer.setOption(key,$(id).checked);if(key==='actualScale'){syncOrbitSpacingControl();if(renderer.selected)syncBodySizeControl();}if(key==='pluto'&&!$(id).checked&&renderer.selected==='pluto')closeBody();if(key==='moon'&&!$(id).checked&&A.SATELLITES.some(body=>body.id===renderer.selected))closeBody();navVisibility();persist();});
      $('overview-orbit-gap').addEventListener('input',()=>{renderer.setOption('overviewOrbitGap',$('overview-orbit-gap').value);syncOrbitSpacingControl();});
      $('overview-orbit-gap').addEventListener('change',persist);
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
        translateStatic();refreshTimeFormats();refreshNavLabels();syncOrbitSpacingControl();syncSpeedUi();cameraUi();navVisibility();closeBody();lastWallKey='';uiNow();persist();toast(t('resetComplete'));
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
      function help(open){
        const next=open===undefined?!uiElementVisible(helpDialog):open;
        if(next&&!helpDialog.open){
          showFading(helpDialog,()=>helpDialog.show());helpScroll.scrollTop=0;updateHelpScrollCues();requestAnimationFrame(updateHelpScrollCues);
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
      $('language-toggle').addEventListener('click',()=>setLanguage(LANG_ORDER[(LANG_ORDER.indexOf(language)+1)%LANG_ORDER.length]));
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
      window.SolarTime=Object.freeze({version:'0.34',clock,renderer,materials,calibrationMs,setLanguage,getPresets:()=>cameraPresets.map(v=>v?{...v}:null),getModel:()=>A.modelStatus(),getState:()=>({fullscreen:!!document.fullscreenElement,escapeLock:'native',simulationMs:clock.value(performance.now()),wallMs:Date.now(),rate:clock.rate,live:clock.live,paused:clock.paused,timezone,timeZone:activeTimeZone(),region:activeRegion().label,showSeconds,hourCycle,clockFont,language,zen,musicEnabled,musicTrack:MUSIC_TRACKS[musicIndex]?.title||null,effectTime,frameCount:renderer.frameCount})});
      uiNow();
      const bootMono=performance.now(),bootMs=clock.value(bootMono);renderer.draw(bootMs,0,bootMono);
      await warmInitialScene();
      if(!disposed){const revealMono=performance.now();renderer.startOrbitReveal(revealMono);renderer.draw(clock.value(revealMono),0,revealMono);$('loading').classList.add('done');setTimeout(()=>$('loading').hidden=true,450);scheduleMaterialRefresh();}
      if(!document.hidden&&!disposed)raf=requestAnimationFrame(frame);
    } catch(error){fatal(error);}
  }
  requestAnimationFrame(()=>setTimeout(init,0));
})();
