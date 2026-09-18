# Solar Time

**Life User · Solar Time v0.47**

실제 기기 시각으로 움직이는 감상용 태양계 시계입니다. 관측·항법용 정밀 천문력이 아닙니다.

공개 사이트: https://solartime.app/

## v0.47

공통 카드 구조와 닫기·스크롤 동작, 업데이트 내역, 렌더러·셰이더 소유권, 원본/가공 미디어 및 업로드 절차를 정리했습니다. 정상화된 v0.46 r6의 iPhone 상태표시줄 `default`, standalone 화면 기준, 카메라·휠·드래그, 공식 아이콘과 미디어 주소는 유지합니다.

업데이트 내역의 유일한 데이터 원본은 `src/release-notes.js`입니다. 앱 본문에 별도 릴리스 문구를 추가하지 않습니다.

## 실행과 검증

Node.js 22.16 이상을 사용합니다. 의존성은 lockfile대로 설치합니다.

```sh
npm ci
npm test
npm run build:cloudflare
```

현재 `tests/*.test.cjs` 전체를 실행합니다. 과거 버전 전용 테스트와 제거된 기능은 Git 이력에 남아 있습니다. 소스 배포와 테스트 성공은 구분합니다.

```sh
python -m pip install playwright==1.57.0
python -m playwright install --with-deps chromium
npm run test:ui
```

브라우저 검사는 합성 이미지와 로컬 번역을 사용하는 오프라인 Chromium 검사입니다. 실제 iPhone·물리 GPU 검증을 대신하지 않습니다.

## 배포 구조

`solartime.app`의 HTML/CSS/JS는 GitHub Pages가 제공합니다. 미디어는 `assets/deployment.json`의 Cloudflare Worker CDN과 R2에 있습니다. GitHub Pages의 `/media/...` 주소를 R2 주소로 간주하지 않습니다.

`version.json`은 공개 버전과 페이지 리비전, 각 script/style의 쿼리는 변경된 코드의 캐시 버전입니다. `assets/revision.json`과 `assets/manifest.json`은 별도 미디어 버전입니다. 변경하지 않은 아이콘이나 미디어 버전까지 일괄 교체하지 않습니다.

```sh
npm run deploy:cloudflare
```

위 명령은 현재 테스트 → 코드 사이트 빌드 → Wrangler 배포 순서입니다. R2 미디어를 업로드하지 않습니다. Cloudflare 인증은 로컬 Wrangler에서 수행합니다.

GitHub 검증 workflow는 Linux/Windows의 Node 22·24와 공통 카드 동작을 검사합니다. **Pages Source가 `Deploy from a branch`인 저장소는 그 배포가 테스트를 기다리지 않습니다.** 자동 배포를 완전히 검사에 연결하려면 Settings → Pages → Source를 GitHub Actions로 설정해야 합니다. 저장소 관리 설정을 코드에서 몰래 변경하지 않습니다.

## 단일 구현 소유자

| 영역 | 소유자 |
|---|---|
| 카드 배경·테두리·그림자 | `styles.css`의 `card-surface` |
| 내부 스크롤·고정 닫기 | `card-scroll`, 카드 역할별 크기 변형 |
| fade·바깥 클릭·Escape·동적 로더 | `src/ui-runtime.js` |
| safe-area·설치형 viewport | `src/page-runtime.js`, `src/runtime-optimizations.css` |
| 유일한 resize 구현 | `src/renderer.js` |
| DPR/FPS·텍스처 예산 정책 | `src/performance.js` |
| 공통 재질 매개변수·GLSL 조각 | `src/surface-style.js` |
| GPU/Worker/CPU adapter | `src/surface.js` |
| 별 생성·밀도·명시적 셰이더 | `src/visual-effects.js` |

GPU/Worker/CPU는 서로 다른 환경을 위한 adapter이므로 유지합니다. 전역 WebGL 함수를 바꾸거나 Renderer.resize를 나중에 덮어쓰지 않습니다. 이미 seam-baked된 텍스처는 재보정하지 않되 CPU의 필수 픽셀 읽기는 구별합니다.

## 원본과 가공 미디어

```sh
npm run fetch:derived
npm run pack:originals
npm run pack:originals -- --publish
npm run fetch:assets
```

`fetch:derived`는 검사 용도로 `.cloudflare/derived`에만 받습니다. 원본 archive가 없으면 `fetch:assets`는 설명과 함께 중단됩니다. 이미 가공된 파일에서 잃어버린 원본을 복원했다고 표시하지 않습니다. 알려진 배포 tier의 해시와 같은 파일은 재빌드 전에 거부합니다. 임의의 다른 파일의 출처까지 자동 판별할 수는 없으므로, originals archive는 실제 master인지 확인한 뒤 발행합니다.

일반 코드 변경 때는 미디어를 재생성하지 않습니다. 미디어 변경 시에만 `build:assets`, `pack:media`, `upload:r2`를 사용합니다.

## 공식 아이콘·워터마크

```sh
npm run upload:ui
npm run upload:ui -- --approve
npm run upload:ui -- --apply
npm run upload:ui -- --watermark
```

기본은 아이콘 3개 dry-run입니다. `--approve`는 검토한 로컬 파일 해시를 기록하며, `--apply`가 명시적 업로드입니다. 둘은 함께 실행하지 않습니다. `assets/ui-approval.json`을 검토해 커밋하세요. 변경된 이미지에는 변경된 사용처 버전 쿼리도 필요합니다. 워터마크는 명시적으로 선택한 경우에만 포함합니다.

과거 파일이 필요하면 `npm run restore:ui:history -- <정확한 40자리 커밋> [파일명]`으로 `.cloudflare/ui-history`에만 복원해 검토합니다. 현재 파일이나 R2를 자동으로 덮어쓰지 않습니다.

업로드가 중간에 실패하면 이미 완료된 파일 수를 표시합니다. R2 여러 객체의 업로드가 자동 롤백된다고 주장하지 않습니다.

## 조작

좌클릭 드래그는 회전, 가운데 버튼 또는 두 손가락은 화면 이동, 오른쪽 드래그는 전후 이동입니다. 휠은 선택한 줌/이동 모드를 따릅니다. `0`은 기본 시점, `1·2·3`은 저장 시점, `F`는 전체 화면, `H`는 감상 모드, `Space`는 재생/정지, `R`은 실제 시간입니다. 시계 숫자로 폰트, AM/PM으로 시간 표기를 바꿉니다.

출처는 [assets/CREDITS.md](assets/CREDITS.md), 변경 요약은 [CHANGELOG.md](CHANGELOG.md)에 있습니다.
