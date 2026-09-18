/* Solar Time release history. Keep newest first and descriptions concise. */
(function (root) {
  'use strict';

  const release=(version,date,items)=>Object.freeze({version,date,items:Object.freeze(items)});
  const RELEASES=Object.freeze([
    release('0.46','2026.09.18',[
      '정지 화면 30fps와 활동 중 60fps 전환, 실제 RAF 지연 감지로 렌더 부하를 더 정교하게 조절합니다.',
      '배율·회전 UI의 중복 DOM 갱신과 라벨 충돌 계산을 줄였습니다.',
      'GPU 궤도 카메라·uniform 상태 재사용과 텍스처 업로드 상태 처리를 개선했습니다.',
      '행성 텍스처 seam 보정을 빌드 단계로 옮겨 확대 시 픽셀 작업과 순간 메모리 사용을 줄였습니다.',
      '렌더링·텍스처·라벨·UI hot path를 추가 정리해 미세 끊김을 줄였습니다.'
    ]),
    release('0.41','2026.09.16',[
      '시계 숫자를 누르면 설정된 폰트가 순서대로 전환됩니다.',
      'AM/PM을 눌러 12시간·24시간 표기를 바로 전환할 수 있습니다.',
      'iPhone 홈 화면에 공식 아이콘을 적용하고 두 손가락 화면 이동을 지원합니다.',
      '날짜·상태·브랜드·후원 영역의 간격과 동작을 정리했습니다.'
    ]),
    release('0.40','2026.09.15',[
      '태양 코로나와 홍염의 프레임별 합성을 GPU로 옮겼습니다.',
      '웹과 로컬 실행본 모두 언어와 고해상도 재질을 Cloudflare에서 불러옵니다.',
      '궤도 밝기 최대치를 높이고 로컬 직접 실행을 복구했습니다.',
      '불필요한 대용량 단독 HTML 생성과 중복 정적 에셋 배포를 제거했습니다.'
    ]),
    release('0.39','2026.09.15',[
      '궤도 좌표와 카메라 투영을 GPU 정적 버퍼·셰이더로 옮겨 프레임별 계산을 줄였습니다.',
      '언어·음악·저장·팝업 동작을 독립 모듈로 분리하고 스타일시트를 하나로 통합했습니다.',
      '기본시점과 휠 방식, 배경음악과 언어 버튼의 배치를 서로 바꿨습니다.'
    ]),
    release('0.38','2026.09.15',[
      '시간·옵션·천체 카드의 모든 슬라이더 디자인을 하나로 통일했습니다.',
      '업데이트 내역을 단일 파일로 합치고 이전·다음 화살표 탐색을 추가했습니다.',
      '저장한 100% 천체 크기와 궤도 간격이 재실행 때 정확히 복원되도록 수정했습니다.',
      '숨긴 유로파의 저장 카메라 복원과 스크롤 안내 갱신을 안정화했습니다.'
    ]),
    release('0.37','2026.09.14',[
      '화성 사진과 겹치던 합성 요철을 제거해 분화구 음영 과장을 줄였습니다.',
      '12개 천체 카드 설명을 주요 구성 물질 중심으로 갱신했습니다.',
      '카드 본문과 핵심 정보에 중복되던 공전주기 문장을 정리했습니다.'
    ]),
    release('0.36','2026.09.14',[
      '유로파를 균일한 4096×2048 얼음 표면으로 재구성했습니다.',
      '달과 수성 사진 위에 중복되던 합성 요철을 제거했습니다.',
      '후원 문구·링크·하단 크레딧 디자인을 정리했습니다.'
    ]),
    release('0.35','2026.09.14',[
      '지구를 제외한 주요 천체를 라이선스가 명확한 고해상도 구면 재질로 교체했습니다.',
      '화면 점유율에 따라 2K·4K 재질을 선택하는 거리별 품질 단계를 적용했습니다.',
      '원본 해상도 이상으로 가짜 선명도를 만드는 처리를 제거했습니다.'
    ]),
    release('0.34','2026.09.14',[
      'Chrome과 Edge의 투명 GPU 합성을 통일해 궤도선 표시 차이를 해결했습니다.',
      '전체 화면 전환 때 궤도선과 고리가 순간적으로 튀는 현상을 줄였습니다.',
      '팝업·메뉴·조작 패널의 페이드와 배율 표시 시점을 통일했습니다.',
      '새 릴리스 확인과 대용량 재질 캐시 주소를 분리했습니다.'
    ]),
    release('0.33','2026.09.13',[
      '사용자가 확정한 화면 옵션과 카메라 구도를 새 초기 설정으로 적용했습니다.',
      '천체 크기와 태양·지구·목성 하위 궤도 간격 조절을 추가했습니다.',
      '토성과 천왕성 고리의 모아레와 자글거림을 줄였습니다.',
      '초기화 확인창과 우주 배경 시작 방향을 정리했습니다.'
    ]),
    release('0.32','2026.09.13',[
      '실제 크기와 일반 보기의 행성·위성 계층을 분리했습니다.',
      '일반 보기 궤도 간격과 24시간 표기 옵션을 추가했습니다.',
      '줌과 실제 카메라 이동, 천체 중심 이동을 부드럽게 연결했습니다.',
      '좌·우 자동 회전 상태를 재실행 후에도 유지했습니다.',
      '배경과 다국어 UI를 보강했습니다.'
    ]),
    release('0.31','2026.09.13',[
      '우측 조작 패널에 줌·이동 방식을 추가했습니다.',
      '세로 회전 제한을 없애고 가운데 버튼 이동 범위를 넓혔습니다.',
      '카메라 1·2·3에 줌·이동 방식까지 함께 저장합니다.',
      '좌측 하단의 축척·출처·연락처·저작권 정보를 정리했습니다.'
    ]),
    release('0.3','2026.09.13',[
      '행성 표면과 고리를 3D 부모·자식 좌표계로 정리했습니다.',
      'GPU 직접 렌더링과 거리별 텍스처 해상도를 적용했습니다.',
      '태양 표면과 코로나의 움직임을 개선했습니다.',
      '실제 크기 비율 전환과 주요 지역 시각을 추가했습니다.',
      '시계·투명 카드·다국어 레이아웃을 다듬었습니다.'
    ]),
    release('0.26','2026.09.13',[
      '일반 확대에서도 64배 이후 태양 표면이 계속 커지도록 수정했습니다.',
      '도움말과 설정 카드의 확정된 투명 디자인을 고정했습니다.',
      '임시 디자인 조절 항목과 저장 코드를 제거했습니다.',
      '배포용 단일 HTML은 최신 파일만 유지하도록 정리했습니다.'
    ]),
    release('0.25','2026.09.13',[
      '별과 혜성을 행성 원판에서 가려 표면이 불투명하게 보이도록 했습니다.',
      '숫자 시간의 중앙을 유지하며 AM/PM을 독립 배치했습니다.',
      '명왕성·태양·천왕성의 구면용 재질을 보강했습니다.',
      '도움말·설정·시간 카드의 투명 디자인을 통일했습니다.',
      '지구-달과 목성-유로파의 부모·자식 궤도를 추가했습니다.'
    ]),
    release('0.24','2026.09.12',[
      '카메라 조작 때 행성 표면이 따라 회전하던 좌표 오류를 수정했습니다.',
      '행성과 고리가 동일한 축 프레임을 공유하도록 정리했습니다.',
      '행성별 자전축 기울기를 천문 기준값으로 정리했습니다.',
      '태양 코로나 효과와 고배속 표면 갱신 부하를 개선했습니다.',
      '숫자 시간 중앙을 AM/PM 폭과 분리했습니다.'
    ]),
    release('0.23','2026.09.12',[
      '12시간·24시간 시계 표기 선택을 추가했습니다.',
      '고배속 표면 렌더 작업의 제출 빈도를 제한했습니다.',
      '멀리 있는 천체의 표면 해상도 상한을 낮췄습니다.',
      '화면에서 큰 천체를 먼저 처리하도록 우선순위를 정리했습니다.'
    ]),
    release('0.22','2026.09.12',[
      '감상 모드에서도 지역·UTC 표기를 유지했습니다.',
      '시계 콜론 간격과 시스템 폰트 선택지를 개선했습니다.',
      '중복 시간대 표시 요소를 제거했습니다.',
      '매 프레임 실행되던 표면·배경 재개 처리를 탭 복귀 시점으로 옮겼습니다.'
    ]),
    release('0.21','2026.09.12',[
      '감상 모드의 시계 위치와 날짜 표시를 일반 모드와 통일했습니다.',
      '시뮬레이션 상태 표시 위치를 조정했습니다.',
      '시계 숫자 폰트 선택을 추가했습니다.',
      '첫 화면 아래에서 행성 표면 캐시를 미리 준비하도록 했습니다.'
    ]),
    release('0.20','2026.09.12',[
      '날짜 선택 UI와 연결된 이벤트를 제거했습니다.',
      '하단 재생 카드를 더 작게 정리했습니다.',
      '사용하지 않는 이미지 포함 HTML 저장 코드를 제거했습니다.',
      '숨겨진 품질 분기를 정리했습니다.'
    ]),
    release('0.18','2026.09.12',[
      '저장 시점 이동에서 천체 위치와 크기를 연속 보간했습니다.',
      '좌·우 회전 아이콘을 실제 동작과 맞췄습니다.',
      '하단 재생 카드를 축소했습니다.',
      '실제 시간에서 배속 단위 전환 흐름을 다듬었습니다.'
    ]),
    release('0.17','2026.09.12',[
      '수동 카메라 입력의 즉시 반응을 복원했습니다.',
      '가운데 버튼의 화면 이동 범위를 확대했습니다.',
      '천체 추적을 화면 중심까지 한 번에 이동하도록 바꿨습니다.',
      '시간·일·년 배속 범위를 정리했습니다.',
      '중복 속도 도움말과 설명을 제거했습니다.'
    ]),
    release('0.16','2026.09.12',[
      '카메라 전환을 직접 이동과 부드러운 시작·끝 곡선으로 통일했습니다.',
      '각도 변경 중 불필요한 자동 재프레이밍을 제거했습니다.',
      '자동 회전이 현재 팬·줌·화면 중심을 유지하도록 했습니다.',
      '지역 가까이 보기와 시간 배속 범위를 확장했습니다.'
    ]),
    release('0.15','2026.09.12',[
      '카메라 전환과 연속 입력을 하나의 보간 흐름으로 통일했습니다.',
      '숫자 1·2·3 저장 시점과 F·ESC 동작을 안정화했습니다.',
      '4096×2048 우주 배경을 구면용 WebP로 보강했습니다.',
      '배경·궤도·표면 계산의 캐시 재사용을 확대했습니다.',
      '단일 HTML의 배경 중복 포함을 제거했습니다.'
    ]),
    release('0.14','2026.09.12',[
      '4096×2048 구면 우주 배경을 제작했습니다.',
      '배경 전용 GPU·CPU 렌더 경로를 안정화했습니다.',
      '카메라와 궤도 투영 계산 캐시를 추가했습니다.',
      '탭 숨김과 WebGL 복구 처리를 개선했습니다.',
      '설치 없는 단일 HTML 갱신 도구를 추가했습니다.'
    ])
  ]);

  // One concise localized summary per release. Korean keeps the detailed
  // source notes above; every other supported language gets a complete,
  // arrow-navigable history instead of falling back to Korean.
  const LOCALIZED_SUMMARIES=Object.freeze({
    en:Object.freeze([
      "Static scenes now render at 30 fps, while dragging, auto-rotation, camera transitions and accelerated time continue at 60 fps.; Real RAF delay is monitored so sustained frame drops can lower load automatically, while duplicate zoom/rotation DOM writes and label-collision calculations are reduced.; GPU orbit rendering now reuses shared camera and uniform state, and texture-upload state handling has been cleaned up.; Planet-texture seam correction has moved from runtime to the build pipeline, reducing pixel read/write work and temporary memory use during close-ups.; Additional renderer, texture, label and UI hot-path cleanup reduces small stutters during long sessions and on lower-end hardware.",
      'Clicking the clock cycles through the configured fonts; clicking AM/PM switches directly between 12- and 24-hour time; iPhone home-screen icons and two-finger panning are now supported; spacing and behavior were refined across date, status, branding, and support areas.',
      'Moved solar corona and prominence compositing to the GPU, cloud-hosted language and high-resolution assets, increased maximum orbit brightness, and removed duplicate heavy builds.',
      'Moved orbit coordinates and camera projection to GPU buffers, separated language, music, storage, and popup modules, and reorganized the main controls.',
      'Unified all slider styles, consolidated update history, and stabilized saved body size, orbit spacing, camera restore, and scroll cues.',
      'Removed exaggerated synthetic craters from Mars and refreshed all 12 body descriptions around composition without repeating orbital periods.',
      'Rebuilt Europa as a uniform 4K ice surface, removed duplicate relief from the Moon and Mercury, and refined support links and credits.',
      'Upgraded major bodies except Earth to licensed high-resolution spherical textures with 2K/4K distance-based detail.',
      'Unified transparent GPU compositing in Chrome and Edge and smoothed orbit, ring, popup, menu, and zoom transitions.',
      'Applied the approved defaults, added body-size and child-orbit controls, reduced ring moiré, and refined reset and background startup behavior.',
      'Separated true-scale and overview hierarchies, added orbit-spacing and 24-hour options, and improved zoom, dolly, regional time, and multilingual UI.',
      'Added zoom and dolly camera modes, free vertical rotation, wider panning, complete camera presets, and clearer footer credits.',
      'Rebuilt body and ring transforms as a 3D hierarchy, added GPU rendering and texture LOD, improved the Sun, and expanded true-scale and regional-time views.',
      'Extended close solar zoom, finalized transparent cards, removed temporary design controls, and kept only the latest standalone build.',
      'Made body discs opaque to stars and comets, centered the numeric clock independently of AM/PM, improved key textures, and added Moon and Europa child orbits.',
      'Fixed planets rotating with the camera, unified body and ring axes, corrected axial tilts, and improved solar effects and high-speed updates.',
      'Added 12/24-hour clocks, limited high-speed surface work, lowered distant texture limits, and prioritized large visible bodies.',
      'Preserved region and UTC labels in viewing mode, improved clock spacing and fonts, removed duplicate timezone UI, and reduced per-frame resume work.',
      'Unified clock and date placement in viewing mode, adjusted simulation status, added clock fonts, and preloaded visible body textures.',
      'Removed the date picker, compacted playback controls, removed unused embedded images, and cleaned obsolete quality branches.',
      'Smoothed saved-view interpolation, matched rotation icons to behavior, compacted playback controls, and refined real-time speed units.',
      'Restored immediate manual camera response, expanded panning, centered tracked bodies, refined speed ranges, and removed duplicate help text.',
      'Unified camera transitions with easing, removed unwanted reframing, preserved framing during auto-rotation, and expanded close views and time rates.',
      'Unified camera animation and continuous input, stabilized presets and fullscreen keys, upgraded the spherical background, and expanded caching.',
      'Created a 4K spherical space background and stabilized dedicated background rendering, projection caching, tab suspension, and WebGL recovery.'
    ]),
    chn:Object.freeze([
      "静止画面改为 30fps 渲染，而拖动、自动旋转、相机切换和时间加速时仍保持 60fps。; 现在会监测真实的 RAF 延迟，在持续掉帧时自动降低负载，同时减少倍率/旋转界面的重复 DOM 更新和标签碰撞计算。; GPU 轨道渲染会复用共享的相机与 uniform 状态，并整理了纹理上传时的状态处理。; 行星纹理的接缝修正从运行时移到构建阶段，减少近距离放大时的像素读写与临时内存占用。; 进一步精简渲染、纹理、标签和界面的热路径，降低长时间运行及低性能设备上的细微卡顿。",
      '点击时钟可依次切换已配置字体；点击 AM/PM 可直接切换 12/24 小时制；现已支持 iPhone 主屏幕官方图标与双指平移；日期、状态、品牌和赞助区域的间距与行为得到优化。',
      '将太阳日冕与日珥合成迁移到 GPU，语言和高清素材改由云端加载，提高轨道最大亮度，并移除重复的大型构建。',
      '将轨道坐标与相机投影迁移到 GPU 缓冲区，拆分语言、音乐、存储和弹窗模块，并重新整理主要控制项。',
      '统一所有滑块样式，合并更新记录，并稳定天体大小、轨道间距、相机恢复与滚动提示。',
      '移除火星上过度的合成陨石坑，并以主要成分为中心更新 12 个天体说明，避免重复公转周期。',
      '将木卫二重制为统一的 4K 冰面，移除月球和水星的重复凹凸，并整理赞助链接与署名。',
      '除地球外的主要天体改用授权高清球面纹理，并加入按距离切换的 2K/4K 细节。',
      '统一 Chrome 与 Edge 的透明 GPU 合成，并平滑轨道、光环、弹窗、菜单和缩放过渡。',
      '应用确认后的默认设置，加入天体大小与子轨道控制，减少光环摩尔纹，并改进重置和背景启动。',
      '分离真实比例与总览层级，加入轨道间距和 24 小时选项，并改进缩放、移动、地区时间与多语言界面。',
      '加入缩放与相机移动模式、自由垂直旋转、更大平移范围、完整相机预设和更清晰的页脚信息。',
      '将天体与光环变换重建为 3D 层级，加入 GPU 渲染和纹理 LOD，改进太阳并扩展真实比例与地区时间。',
      '扩展太阳近距离缩放，确定透明卡片样式，移除临时设计控件，并只保留最新独立构建。',
      '让天体圆盘遮挡恒星与彗星，使数字时钟不受 AM/PM 影响居中，改进主要纹理，并加入月球和木卫二子轨道。',
      '修复行星随相机旋转的问题，统一天体与光环轴，校正自转轴倾角，并改进太阳效果与高速更新。',
      '加入 12/24 小时时钟，限制高速表面运算，降低远处纹理上限，并优先处理画面中较大的天体。',
      '在观赏模式保留地区与 UTC 标记，改进时钟间距和字体，移除重复时区界面，并减少逐帧恢复处理。',
      '统一观赏模式的时钟和日期位置，调整模拟状态，加入时钟字体，并预加载可见天体纹理。',
      '移除日期选择器，缩小播放控件，删除未使用的内嵌图像，并清理过时的质量分支。',
      '平滑保存视角的插值，使旋转图标与功能一致，缩小播放控件，并改进实时速度单位。',
      '恢复手动相机的即时响应，扩大平移范围，将跟踪天体置中，整理速度范围并移除重复帮助文字。',
      '统一带缓动的相机切换，移除不必要的重新构图，在自动旋转时保持画面，并扩展近景和时间倍率。',
      '统一相机动画与连续输入，稳定预设和全屏快捷键，升级球形背景并扩大缓存复用。',
      '制作 4K 球形宇宙背景，并稳定背景渲染、投影缓存、标签页暂停和 WebGL 恢复。'
    ]),
    jpn:Object.freeze([
      "静止した通常画面は 30fps に抑え、ドラッグ・自動回転・カメラ遷移・時間加速中は 60fps を維持するよう描画周期を最適化しました。; 実際の RAF 遅延を監視し、フレーム落ちが続く場合は自動的に負荷を下げるほか、倍率・回転 UI の重複 DOM 更新とラベル衝突計算を削減しました。; GPU の軌道描画で共通のカメラと uniform 状態を再利用し、テクスチャアップロード時の状態処理を整理しました。; 惑星テクスチャの継ぎ目補正を実行時からビルド時へ移し、接近表示時のピクセル読み書きと一時メモリ使用量を削減しました。; レンダリング・テクスチャ・ラベル・UI のホットパスをさらに整理し、長時間実行や低性能環境での細かな引っ掛かりを減らしました。",
      '時計を押すと設定済みフォントが順番に切り替わります；AM/PM を押すと 12/24 時間表示を直接切り替えられます；iPhone の公式ホーム画面アイコンと2本指パンに対応しました；日付・状態・ブランド・支援領域の間隔と動作を整えました。',
      '太陽コロナとプロミネンスの合成を GPU に移し、言語と高解像度素材をクラウド化し、軌道の最大輝度を上げ、重複する大型ビルドを削除しました。',
      '軌道座標とカメラ投影を GPU バッファへ移し、言語・音楽・保存・ポップアップを分離して主要操作を整理しました。',
      'すべてのスライダーを統一し、更新履歴を一本化して、天体サイズ・軌道間隔・カメラ復元・スクロール案内を安定化しました。',
      '火星の過剰な合成クレーターを除き、12天体の説明を主要成分中心に更新して公転周期の重複をなくしました。',
      'エウロパを均一な 4K 氷面として再構成し、月と水星の重複した凹凸を除き、支援リンクとクレジットを整理しました。',
      '地球以外の主要天体をライセンスが明確な高解像度球面テクスチャへ更新し、距離別 2K/4K LOD を追加しました。',
      'Chrome と Edge の透明 GPU 合成を統一し、軌道・環・ポップアップ・メニュー・倍率表示の遷移を滑らかにしました。',
      '確定した初期設定を適用し、天体サイズと子軌道の調整、環のモアレ軽減、リセットと背景起動の改善を行いました。',
      '実寸比と通常表示の階層を分離し、軌道間隔と24時間表示を追加して、ズーム・移動・地域時刻・多言語 UI を改善しました。',
      'ズームとカメラ移動方式、自由な縦回転、広いパン、完全なカメラプリセット、分かりやすいフッター情報を追加しました。',
      '天体と環を 3D 親子階層へ再構成し、GPU 描画とテクスチャ LOD、太陽表現、実寸比と地域時刻を強化しました。',
      '太陽の接近ズームを拡張し、透明カードを確定し、仮のデザイン調整を削除して最新の単体ビルドだけを残しました。',
      '天体面で星と彗星を隠し、AM/PM と独立して数字時計を中央配置し、主要テクスチャと月・エウロパの子軌道を改善しました。',
      '惑星がカメラと一緒に回る問題を修正し、天体と環の軸を統一し、自転軸傾斜と太陽効果、高速更新を改善しました。',
      '12/24時間表示を追加し、高速時の表面処理を制限し、遠距離テクスチャ上限を下げ、大きく見える天体を優先しました。',
      '鑑賞モードでも地域と UTC を維持し、時計間隔とフォントを改善し、重複する時差 UI と毎フレーム処理を削減しました。',
      '鑑賞モードの時計と日付位置を統一し、シミュレーション状態を調整し、時計フォントと表示天体の先読みを追加しました。',
      '日付選択を削除し、再生コントロールを小型化し、未使用の埋め込み画像と古い品質分岐を整理しました。',
      '保存視点の補間を滑らかにし、回転アイコンと動作を一致させ、再生 UI と実時間倍率を改善しました。',
      '手動カメラの即時応答を復元し、パン範囲を広げ、追跡天体を中央へ移し、倍率範囲と重複ヘルプを整理しました。',
      'カメラ遷移をイージングで統一し、不要な再構図を除き、自動回転中の構図を保ち、近接表示と時間倍率を拡張しました。',
      'カメラアニメーションと連続入力を統一し、プリセットと全画面キーを安定化し、球面背景とキャッシュを強化しました。',
      '4K 球面宇宙背景を作成し、背景描画・投影キャッシュ・タブ休止・WebGL 復旧を安定化しました。'
    ]),
    hi:Object.freeze([
      "स्थिर सामान्य दृश्य अब 30fps पर चलते हैं, जबकि drag, auto-rotation, camera transition और तेज समय-गति के दौरान 60fps बनाए रखा जाता है।; वास्तविक RAF delay को मॉनिटर किया जाता है ताकि लगातार frame drop होने पर load अपने-आप कम हो, और zoom/rotation UI के दोहराए गए DOM updates तथा label-collision गणना भी घटे।; GPU orbit rendering अब साझा camera और uniform state को reuse करता है, और texture upload state handling को व्यवस्थित किया गया है।; Planet texture seam correction को runtime से build stage में ले जाया गया है, जिससे close-up के समय pixel read/write और temporary memory उपयोग कम होता है।; Renderer, texture, label और UI hot paths की अतिरिक्त सफाई से लंबे उपयोग और कम-शक्ति वाले hardware पर छोटे stutter कम होते हैं।",
      'घड़ी पर क्लिक करने से चुने हुए फ़ॉन्ट क्रम से बदलते हैं; AM/PM पर क्लिक करके 12 और 24 घंटे का प्रारूप तुरंत बदला जा सकता है; iPhone होम-स्क्रीन आइकन और दो उंगली पैन अब समर्थित हैं; तारीख, स्थिति, ब्रांड और सहयोग क्षेत्रों का अंतर व व्यवहार सुधारा गया।',
      'सौर कोरोना और प्रोमिनेंस संयोजन को GPU पर ले जाया गया, भाषा व उच्च-रिज़ॉल्यूशन सामग्री क्लाउड से जोड़ी गई, कक्षा की अधिकतम चमक बढ़ी और दोहराए गए बड़े बिल्ड हटे।',
      'कक्षा निर्देशांक और कैमरा प्रोजेक्शन GPU बफ़र पर ले जाए गए, भाषा, संगीत, संग्रह और पॉपअप मॉड्यूल अलग किए गए तथा मुख्य नियंत्रण व्यवस्थित हुए।',
      'सभी स्लाइडर शैलियाँ एक की गईं, अपडेट इतिहास जोड़ा गया और पिंड आकार, कक्षा दूरी, कैमरा पुनर्स्थापन व स्क्रॉल संकेत स्थिर किए गए।',
      'मंगल के अतिरंजित कृत्रिम क्रेटर हटाकर 12 पिंडों का विवरण संरचना-केंद्रित किया गया और कक्षीय अवधि की पुनरावृत्ति हटाई गई।',
      'यूरोपा को समान 4K बर्फीली सतह के रूप में बनाया गया, चंद्रमा व बुध की दोहरी उभार परत हटाई गई और सहयोग लिंक सुधारे गए।',
      'पृथ्वी को छोड़कर मुख्य पिंडों को लाइसेंसयुक्त उच्च-रिज़ॉल्यूशन गोलाकार टेक्सचर और दूरी-आधारित 2K/4K विवरण मिला।',
      'Chrome और Edge की पारदर्शी GPU कंपोज़िटिंग एक की गई और कक्षा, वलय, पॉपअप, मेनू व ज़ूम संक्रमण सहज बनाए गए।',
      'स्वीकृत डिफ़ॉल्ट लागू हुए, पिंड आकार व उप-कक्षा नियंत्रण जुड़े, वलय मोइरे घटा और रीसेट व पृष्ठभूमि आरंभ सुधरे।',
      'वास्तविक अनुपात और सामान्य दृश्य की श्रेणियाँ अलग हुईं, कक्षा दूरी व 24-घंटे विकल्प जुड़े और ज़ूम, डॉली, क्षेत्रीय समय व बहुभाषी UI सुधरा।',
      'ज़ूम व कैमरा-मूव मोड, मुक्त ऊर्ध्व घुमाव, बड़ा पैन, पूर्ण कैमरा प्रीसेट और स्पष्ट फुटर जानकारी जोड़ी गई।',
      'पिंड और वलय को 3D अभिभावक-शिशु संरचना में बदला गया, GPU रेंडरिंग व टेक्सचर LOD जोड़े गए और सूर्य व वास्तविक अनुपात दृश्य सुधरे।',
      'सूर्य का नज़दीकी ज़ूम बढ़ाया गया, पारदर्शी कार्ड अंतिम किए गए, अस्थायी डिज़ाइन नियंत्रण हटे और केवल नवीनतम स्टैंडअलोन बिल्ड रखा गया।',
      'तारों व धूमकेतुओं को पिंडों के पीछे छिपाया गया, अंक घड़ी को AM/PM से स्वतंत्र केंद्रित किया गया और चंद्रमा व यूरोपा की उप-कक्षाएँ जोड़ी गईं।',
      'कैमरे के साथ ग्रह घूमने की त्रुटि सुधरी, पिंड व वलय अक्ष एक हुए, अक्षीय झुकाव तथा सौर प्रभाव और तेज़ अपडेट सुधरे।',
      '12/24-घंटे घड़ी जोड़ी गई, तेज़ सतह कार्य सीमित हुआ, दूर के टेक्सचर घटे और बड़े दिखाई देने वाले पिंड प्राथमिक हुए।',
      'दृश्य मोड में क्षेत्र और UTC लेबल रखे गए, घड़ी अंतर व फ़ॉन्ट सुधरे, दोहरा समय-क्षेत्र UI और प्रति-फ़्रेम पुनरारंभ कार्य घटा।',
      'दृश्य मोड में घड़ी व तारीख स्थान एक किए गए, सिमुलेशन स्थिति सुधरी, घड़ी फ़ॉन्ट और दिखाई देने वाले टेक्सचर प्रीलोड जुड़े।',
      'तारीख चयन हटाया गया, प्लेबैक नियंत्रण छोटे किए गए, अनुपयोगी एम्बेडेड चित्र और पुराने गुणवत्ता मार्ग साफ़ हुए।',
      'सहेजे दृश्य का इंटरपोलेशन सहज हुआ, घुमाव आइकन व्यवहार से मिले, प्लेबैक छोटा हुआ और वास्तविक समय गति इकाइयाँ सुधरीं।',
      'मैनुअल कैमरा की तत्काल प्रतिक्रिया लौटी, पैन सीमा बढ़ी, ट्रैक पिंड केंद्रित हुए, गति सीमाएँ सुधरीं और दोहरा सहायता पाठ हटा।',
      'कैमरा संक्रमण ईज़िंग के साथ एक किए गए, अनचाहा रीफ्रेम हटाया गया, ऑटो-रोटेशन में फ्रेम सुरक्षित रहा और नज़दीकी दृश्य बढ़े।',
      'कैमरा एनीमेशन व सतत इनपुट एक हुए, प्रीसेट व पूर्णस्क्रीन कुंजियाँ स्थिर हुईं, गोलाकार पृष्ठभूमि और कैश सुधरे।',
      '4K गोलाकार अंतरिक्ष पृष्ठभूमि बनाई गई और पृष्ठभूमि रेंडरिंग, प्रोजेक्शन कैश, टैब निलंबन व WebGL पुनर्प्राप्ति स्थिर हुई।'
    ]),
    es:Object.freeze([
      "Las escenas estáticas pasan a 30 fps, mientras que el arrastre, la rotación automática, las transiciones de cámara y el tiempo acelerado mantienen 60 fps.; Se supervisa el retraso real de RAF para reducir automáticamente la carga si persisten las caídas de fotogramas, y se reducen las escrituras DOM repetidas de zoom/rotación y los cálculos de colisión de etiquetas.; El renderizado GPU de órbitas reutiliza el estado compartido de cámara y uniforms, y se ha ordenado el manejo del estado durante la carga de texturas.; La corrección de costuras de las texturas planetarias pasa del tiempo de ejecución a la fase de compilación, reduciendo lecturas/escrituras de píxeles y memoria temporal en primeros planos.; Se han depurado más las rutas críticas de renderizado, texturas, etiquetas e interfaz para reducir pequeños tirones en sesiones largas y equipos modestos.",
      'Al pulsar el reloj se recorren las fuentes configuradas; al pulsar AM/PM se cambia directamente entre 12 y 24 horas; ahora hay icono oficial y paneo con dos dedos en iPhone; se ajustaron espacios y comportamientos de fecha, estado, marca y apoyo.',
      'Se trasladó la corona y las prominencias solares a la GPU, se alojaron idiomas y recursos HD en la nube, se aumentó el brillo orbital máximo y se eliminaron compilaciones pesadas duplicadas.',
      'Las coordenadas orbitales y la proyección de cámara pasaron a búferes GPU; idioma, música, almacenamiento y ventanas se separaron en módulos y se reorganizaron los controles.',
      'Se unificaron los deslizadores y el historial de cambios, y se estabilizaron el tamaño de cuerpos, el espaciado orbital, la restauración de cámara y las guías de desplazamiento.',
      'Se eliminaron cráteres sintéticos exagerados de Marte y se actualizaron las descripciones de 12 cuerpos según su composición sin repetir periodos orbitales.',
      'Europa se reconstruyó como una superficie de hielo 4K uniforme, se quitó relieve duplicado de la Luna y Mercurio y se ordenaron los enlaces de apoyo.',
      'Los cuerpos principales salvo la Tierra recibieron texturas esféricas HD con licencia y detalle 2K/4K según la distancia.',
      'Se unificó la composición GPU transparente en Chrome y Edge y se suavizaron órbitas, anillos, ventanas, menús y transiciones de zoom.',
      'Se aplicaron los valores iniciales aprobados, se añadieron controles de tamaño y subórbitas, se redujo el moiré de anillos y se mejoraron reinicio y fondo.',
      'Se separaron las jerarquías de escala real y vista general, se añadieron espaciado orbital y formato de 24 horas y se mejoraron zoom, dolly, hora regional e idiomas.',
      'Se añadieron modos de zoom y desplazamiento de cámara, rotación vertical libre, paneo amplio, preajustes completos y créditos más claros.',
      'Cuerpos y anillos se reorganizaron en una jerarquía 3D, se añadieron renderizado GPU y LOD, y se mejoraron el Sol, la escala real y las horas regionales.',
      'Se amplió el acercamiento al Sol, se finalizaron las tarjetas transparentes, se retiraron controles temporales y quedó solo la compilación independiente más reciente.',
      'Los cuerpos ahora ocultan estrellas y cometas, el reloj numérico se centra sin depender de AM/PM, se mejoraron texturas y se añadieron subórbitas de Luna y Europa.',
      'Se corrigió la rotación de planetas con la cámara, se unificaron ejes de cuerpos y anillos, se ajustaron inclinaciones y se mejoraron efectos solares y alta velocidad.',
      'Se añadió reloj de 12/24 horas, se limitó el trabajo de superficie a alta velocidad, se redujo el límite de texturas lejanas y se priorizaron cuerpos grandes.',
      'Se conservaron región y UTC en modo contemplación, mejoraron el espaciado y las fuentes del reloj, y se redujeron UI duplicada y trabajo por fotograma.',
      'Se unificó la posición de reloj y fecha en modo contemplación, se ajustó el estado de simulación y se añadieron fuentes y precarga de texturas visibles.',
      'Se eliminó el selector de fecha, se compactaron los controles, se quitaron imágenes incrustadas sin uso y se limpiaron ramas de calidad antiguas.',
      'Se suavizó la interpolación de vistas guardadas, se alinearon iconos de giro con su función, se compactó la reproducción y se mejoraron unidades de tiempo real.',
      'Se restauró la respuesta inmediata de cámara, aumentó el paneo, se centraron cuerpos seguidos, se ajustaron velocidades y se eliminó ayuda duplicada.',
      'Se unificaron transiciones con suavizado, se evitó el reencuadre innecesario, se mantuvo el encuadre al autorrotar y se ampliaron vistas cercanas y velocidades.',
      'Se unificaron animación de cámara y entrada continua, se estabilizaron preajustes y teclas de pantalla completa y se mejoraron el fondo esférico y la caché.',
      'Se creó un fondo espacial esférico 4K y se estabilizaron su renderizado, la caché de proyección, la suspensión de pestañas y la recuperación WebGL.'
    ]),
    de:Object.freeze([
      "Statische Ansichten werden nun mit 30 fps gerendert, während Ziehen, automatische Rotation, Kameraübergänge und beschleunigte Zeit weiterhin 60 fps nutzen.; Die tatsächliche RAF-Verzögerung wird überwacht, sodass bei anhaltenden Frame-Drops die Last automatisch sinkt; zugleich werden doppelte DOM-Aktualisierungen für Zoom/Rotation und Label-Kollisionsberechnungen reduziert.; Das GPU-Orbit-Rendering verwendet gemeinsame Kamera- und Uniform-Zustände wieder, und die Zustandsverwaltung beim Textur-Upload wurde bereinigt.; Die Nahtkorrektur von Planetentexturen wurde von der Laufzeit in den Build-Prozess verlagert, wodurch Pixel-Lese-/Schreibarbeit und temporärer Speicher bei Nahansichten sinken.; Weitere Bereinigungen der Hot Paths für Rendering, Texturen, Labels und UI reduzieren kleine Ruckler bei langen Sitzungen und auf schwächerer Hardware.",
      'Ein Klick auf die Uhr wechselt der Reihe nach durch die eingerichteten Schriften; ein Klick auf AM/PM schaltet direkt zwischen 12 und 24 Stunden um; iPhone-Startsymbol und Zwei-Finger-Schwenken werden unterstützt; Abstände und Verhalten von Datum, Status, Marke und Unterstützung wurden verfeinert.',
      'Sonnenkorona und Protuberanzen wurden auf die GPU verlagert, Sprach- und HD-Daten in die Cloud gelegt, die maximale Orbithelligkeit erhöht und doppelte große Builds entfernt.',
      'Orbitkoordinaten und Kameraprojektion wurden in GPU-Puffer verlagert, Sprach-, Musik-, Speicher- und Popupmodule getrennt und die Hauptsteuerung neu geordnet.',
      'Alle Regler und der Änderungsverlauf wurden vereinheitlicht; Körpergröße, Orbitabstand, Kamerawiederherstellung und Scrollhinweise wurden stabilisiert.',
      'Übertriebene synthetische Marskrater wurden entfernt und die Beschreibungen aller 12 Körper ohne doppelte Umlaufzeiten auf ihre Zusammensetzung ausgerichtet.',
      'Europa wurde als einheitliche 4K-Eisoberfläche neu erstellt, doppelte Reliefs von Mond und Merkur entfernt und Unterstützungslinks überarbeitet.',
      'Alle Hauptkörper außer der Erde erhielten lizenzierte hochauflösende Kugeltexturen und entfernungsabhängige 2K/4K-Details.',
      'Die transparente GPU-Komposition in Chrome und Edge wurde vereinheitlicht und Übergänge von Orbits, Ringen, Popups, Menüs und Zoom geglättet.',
      'Bestätigte Standardwerte, Größen- und Unterorbitregler, weniger Ring-Moiré sowie bessere Rücksetzung und Hintergrundinitialisierung wurden umgesetzt.',
      'Echte Skalierung und Übersicht wurden getrennt, Orbitabstand und 24-Stunden-Anzeige ergänzt sowie Zoom, Dolly, Regionalzeit und Mehrsprachigkeit verbessert.',
      'Zoom- und Kamerafahrtmodi, freie vertikale Drehung, größerer Schwenkbereich, vollständige Kameravoreinstellungen und klarere Fußzeilen wurden ergänzt.',
      'Körper und Ringe wurden als 3D-Hierarchie aufgebaut, GPU-Rendering und Textur-LOD ergänzt und Sonne, echte Skalierung und Regionalzeiten verbessert.',
      'Der Sonnen-Nahzoom wurde erweitert, transparente Karten finalisiert, temporäre Designregler entfernt und nur der neueste Einzelbuild beibehalten.',
      'Körperscheiben verdecken nun Sterne und Kometen, die Zahlenuhr ist unabhängig von AM/PM zentriert, Texturen wurden verbessert und Mond- sowie Europa-Orbits ergänzt.',
      'Das Mitdrehen der Planeten mit der Kamera wurde behoben, Körper- und Ringachsen vereinheitlicht, Achsneigungen korrigiert und Sonneneffekte verbessert.',
      '12/24-Stunden-Anzeige wurde ergänzt, Oberflächenarbeit bei hoher Geschwindigkeit begrenzt, ferne Texturen reduziert und große sichtbare Körper priorisiert.',
      'Regional- und UTC-Anzeigen bleiben im Ansichtsmodus erhalten; Uhrabstände und Schriften wurden verbessert und doppelte UI- sowie Frame-Arbeit reduziert.',
      'Uhr- und Datumsposition im Ansichtsmodus wurden vereinheitlicht, der Simulationsstatus angepasst und Uhrschriften sowie Texturvorladen ergänzt.',
      'Die Datumsauswahl wurde entfernt, Wiedergabesteuerungen verkleinert, ungenutzte eingebettete Bilder gelöscht und alte Qualitätszweige bereinigt.',
      'Gespeicherte Ansichten werden weich interpoliert, Drehsymbole entsprechen der Funktion, die Wiedergabe ist kompakter und Echtzeiteinheiten wurden verbessert.',
      'Die direkte manuelle Kamerareaktion wurde wiederhergestellt, Schwenken erweitert, verfolgte Körper zentriert und doppelte Hilfetexte entfernt.',
      'Kameraübergänge wurden mit Easing vereinheitlicht, unnötiges Reframing entfernt, der Bildausschnitt bei Auto-Rotation erhalten und Nahansichten erweitert.',
      'Kameraanimation und kontinuierliche Eingabe wurden vereinheitlicht, Presets und Vollbildtasten stabilisiert sowie Kugelhintergrund und Cache verbessert.',
      'Ein sphärischer 4K-Weltraumhintergrund wurde erstellt und Hintergrundrendering, Projektionscache, Tab-Pause und WebGL-Wiederherstellung stabilisiert.'
    ]),
    fr:Object.freeze([
      "Les scènes statiques passent à 30 i/s, tandis que le glissement, la rotation automatique, les transitions de caméra et le temps accéléré restent à 60 i/s.; Le retard RAF réel est surveillé afin de réduire automatiquement la charge en cas de pertes d’images persistantes, tout en diminuant les écritures DOM répétées du zoom/de la rotation et les calculs de collision des étiquettes.; Le rendu GPU des orbites réutilise l’état commun de la caméra et des uniforms, et la gestion d’état lors du chargement des textures a été simplifiée.; La correction des coutures des textures planétaires est déplacée de l’exécution vers la phase de build, réduisant les lectures/écritures de pixels et la mémoire temporaire lors des gros plans.; Un nettoyage supplémentaire des chemins critiques du rendu, des textures, des étiquettes et de l’interface réduit les petits à-coups pendant les longues sessions et sur les machines modestes.",
      'Un clic sur l’horloge fait défiler les polices configurées; un clic sur AM/PM bascule directement entre 12 et 24 heures; l’icône officielle et le panoramique à deux doigts sont pris en charge sur iPhone; les espacements et comportements de la date, du statut, de la marque et du soutien ont été affinés.',
      'La couronne et les protubérances solaires ont été transférées au GPU, les langues et ressources HD au cloud, la luminosité orbitale maximale augmentée et les builds lourds en double supprimés.',
      'Les coordonnées orbitales et la projection caméra ont été déplacées vers des tampons GPU, les modules langue, musique, stockage et fenêtres séparés, et les commandes réorganisées.',
      'Tous les curseurs et l’historique ont été unifiés, et la taille des corps, l’espacement orbital, la restauration caméra et les repères de défilement stabilisés.',
      'Les cratères synthétiques exagérés de Mars ont été retirés et les descriptions des 12 corps recentrées sur leur composition sans répéter les périodes orbitales.',
      'Europe a été reconstruite avec une surface glacée 4K uniforme, les reliefs doublons de la Lune et Mercure retirés et les liens de soutien réorganisés.',
      'Les principaux corps hors Terre ont reçu des textures sphériques HD sous licence et un niveau de détail 2K/4K selon la distance.',
      'La composition GPU transparente a été unifiée dans Chrome et Edge, avec des transitions plus douces pour orbites, anneaux, fenêtres, menus et zoom.',
      'Les réglages initiaux validés ont été appliqués, les contrôles de taille et sous-orbite ajoutés, le moiré réduit et la réinitialisation améliorée.',
      'Les hiérarchies échelle réelle et vue générale ont été séparées, avec espacement orbital, format 24 h et améliorations du zoom, dolly, fuseaux et langues.',
      'Des modes zoom et déplacement caméra, une rotation verticale libre, un panoramique étendu, des préréglages complets et des crédits plus clairs ont été ajoutés.',
      'Corps et anneaux ont été réorganisés en hiérarchie 3D, avec rendu GPU et LOD, et des améliorations du Soleil, de l’échelle réelle et des heures régionales.',
      'Le zoom rapproché du Soleil a été étendu, les cartes transparentes finalisées, les réglages temporaires retirés et seul le dernier build autonome conservé.',
      'Les corps masquent désormais étoiles et comètes, l’horloge numérique est centrée indépendamment de AM/PM, les textures améliorées et les orbites de Lune et Europe ajoutées.',
      'La rotation des planètes avec la caméra a été corrigée, les axes des corps et anneaux unifiés, les inclinaisons ajustées et les effets solaires améliorés.',
      'L’horloge 12/24 h a été ajoutée, le travail de surface rapide limité, les textures lointaines réduites et les grands corps visibles priorisés.',
      'Les indications régionales et UTC restent en mode contemplation, l’espacement et les polices de l’horloge sont améliorés et le travail par image réduit.',
      'La position de l’horloge et de la date a été unifiée en mode contemplation, le statut ajusté et les polices ainsi que le préchargement ajoutés.',
      'Le sélecteur de date a été supprimé, les commandes compactées, les images intégrées inutiles retirées et les anciennes branches de qualité nettoyées.',
      'L’interpolation des vues enregistrées a été adoucie, les icônes de rotation alignées sur leur action et les unités de temps réel améliorées.',
      'La réponse immédiate de la caméra a été restaurée, le panoramique étendu, les corps suivis centrés, les vitesses ajustées et l’aide en double supprimée.',
      'Les transitions caméra ont été unifiées avec accélération, le recadrage inutile supprimé, le cadrage conservé en rotation automatique et les vues proches étendues.',
      'L’animation caméra et les entrées continues ont été unifiées, les préréglages et touches plein écran stabilisés, et le fond sphérique ainsi que le cache améliorés.',
      'Un fond spatial sphérique 4K a été créé et le rendu de fond, le cache de projection, la suspension d’onglet et la récupération WebGL stabilisés.'
    ]),
    pt:Object.freeze(["As cenas estáticas passam a 30 fps, enquanto arrasto, rotação automática, transições de câmara e tempo acelerado continuam a 60 fps.; O atraso real do RAF é monitorizado para reduzir automaticamente a carga quando há quedas persistentes de frames, ao mesmo tempo que se reduzem escritas DOM repetidas de zoom/rotação e cálculos de colisão das etiquetas.; A renderização GPU das órbitas reutiliza o estado partilhado da câmara e dos uniforms, e o tratamento do estado no carregamento de texturas foi simplificado.; A correção das costuras das texturas planetárias passou do runtime para a fase de build, reduzindo leituras/escritas de píxeis e memória temporária nos close-ups.; Uma limpeza adicional dos caminhos críticos de renderização, texturas, etiquetas e interface reduz pequenos engasgos em sessões longas e em hardware mais modesto."]),
    it:Object.freeze(["Le scene statiche ora vengono renderizzate a 30 fps, mentre trascinamento, rotazione automatica, transizioni della camera e tempo accelerato restano a 60 fps.; Viene monitorato il ritardo reale del RAF per ridurre automaticamente il carico in caso di cali di frame persistenti, diminuendo anche le scritture DOM duplicate di zoom/rotazione e i calcoli di collisione delle etichette.; Il rendering GPU delle orbite riutilizza lo stato condiviso di camera e uniform, mentre la gestione dello stato durante il caricamento delle texture è stata ripulita.; La correzione delle giunzioni delle texture planetarie è stata spostata dal runtime alla fase di build, riducendo letture/scritture dei pixel e memoria temporanea nei primi piani.; Ulteriori ottimizzazioni dei percorsi critici di rendering, texture, etichette e UI riducono i piccoli scatti nelle sessioni lunghe e sui sistemi meno potenti."]),
    id:Object.freeze(["Adegan statis kini dirender pada 30 fps, sedangkan drag, rotasi otomatis, transisi kamera, dan percepatan waktu tetap berjalan pada 60 fps.; Delay RAF nyata dipantau agar beban dapat diturunkan otomatis saat frame drop berlanjut, sekaligus mengurangi penulisan DOM zoom/rotasi yang berulang dan perhitungan benturan label.; Render orbit GPU kini memakai ulang state kamera dan uniform yang sama, serta penanganan state saat upload tekstur dirapikan.; Koreksi seam tekstur planet dipindahkan dari runtime ke tahap build, sehingga pembacaan/penulisan piksel dan penggunaan memori sementara saat close-up berkurang.; Hot path renderer, tekstur, label, dan UI dirapikan lebih lanjut untuk mengurangi stutter kecil pada sesi panjang dan perangkat dengan performa lebih rendah."])
  });

  function splitSummary(summary,count,language) {
    const punctuation=language==='chn'||language==='jpn'?'。':language==='hi'?'।':'.';
    let fragments=String(summary).replace(/[。।.]$/u,'').split(/\s*[,，、;；]\s*/u).filter(Boolean);
    while(fragments.length>count){
      let shortest=0;for(let i=1;i<fragments.length;i++)if(fragments[i].length<fragments[shortest].length)shortest=i;
      const previous=shortest-1,next=shortest+1,joinPrevious=next>=fragments.length||previous>=0&&/^(?:and|und|et|y|并|そして|तथा)\b/iu.test(fragments[shortest]);
      if(joinPrevious)fragments.splice(previous,2,fragments[previous]+', '+fragments[shortest]);
      else fragments.splice(shortest,2,fragments[shortest]+', '+fragments[next]);
    }
    const fallback={en:'Additional usability and stability improvements',chn:'进一步改善易用性和稳定性',jpn:'使いやすさと安定性をさらに改善しました',hi:'उपयोगिता और स्थिरता में अतिरिक्त सुधार',es:'Mejoras adicionales de usabilidad y estabilidad',de:'Weitere Verbesserungen bei Bedienung und Stabilität',fr:'Améliorations supplémentaires de l’ergonomie et de la stabilité'}[language]||'Additional usability and stability improvements';
    while(fragments.length<count)fragments.push(fallback);
    const shortSuffix={en:' behavior and presentation were improved',chn:'相关功能与显示效果得到改进',jpn:'に関する機能と表示を改善しました',hi:' से जुड़ी कार्यक्षमता और प्रस्तुति सुधारी गई',es:' recibió mejoras de funcionamiento y presentación',de:' bezogene Funktionen und Darstellung wurden verbessert',fr:' a bénéficié d’améliorations fonctionnelles et visuelles'}[language]||' behavior and presentation were improved';
    const shortLimit=language==='chn'||language==='jpn'?11:16;
    const items=[];
    for(let i=0;i<count;i++){
      let piece=fragments.shift().replace(/^(?:and|und|et|y)\s+/iu,'').trim();
      if(piece.length<shortLimit)piece=piece.replace(/[-–—]\s*$/u,'')+shortSuffix;
      items.push(piece+punctuation);
    }
    return Object.freeze(items);
  }

  function itemsFor(release,language='kor') {
    if(!release)return Object.freeze([]);
    const code=language==='eu'?'en':language;
    if(code==='kor')return release.items;
    const index=RELEASES.indexOf(release),summary=LOCALIZED_SUMMARIES[code]?.[index]??LOCALIZED_SUMMARIES.en[index];
    return summary?splitSummary(summary,release.items.length,code):release.items;
  }

  function createReleaseNotesNavigator(releases=RELEASES) {
    const source=Array.isArray(releases)&&releases.length?releases:RELEASES;
    let index=0;
    const state=()=>Object.freeze({release:source[index],index,total:source.length,hasNewer:index>0,hasOlder:index<source.length-1});
    return Object.freeze({
      current:state,
      newer(){index=Math.max(0,index-1);return state();},
      older(){index=Math.min(source.length-1,index+1);return state();},
      reset(){index=0;return state();}
    });
  }

  const serialized=JSON.stringify([RELEASES,LOCALIZED_SUMMARIES]);
  const SOURCE_BYTES=typeof Blob==='function'?new Blob([serialized]).size:serialized.length;
  const api=Object.freeze({RELEASES,LOCALIZED_SUMMARIES,SOURCE_BYTES,itemsFor,createReleaseNotesNavigator});
  root.SolarReleaseNotes=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
