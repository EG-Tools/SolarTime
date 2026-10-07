# Current implementation contracts

현재 검증·배포 절차는 [CI 파이프라인](ci-pipeline.md), [GitHub 자동 배포](cloudflare-github-deployment.md), [Windows 종료 보조 모듈](windows-shutdown.md)을 참고합니다. 버전 번호가 붙은 문서는 당시의 검증 기록이며 현재 배포 상태를 뜻하지 않습니다.

루트의 버전별 배포 실행 파일 대신 기존 npm 명령과 GitHub Actions를 사용합니다. 미디어 빌드는 `npm run build:assets`를 사용합니다. 로컬 백업(`.backup/`), 패치 묶음(`patch/`), 일회성 프리뷰 실행 파일은 Git에 올리지 않습니다.

The accepted visual baseline is v0.46 r6, commit 94fa46401571dcb6363d153dab3b66030f91830c.

Do not remove standalone viewport handling because it listens to resize. Measurement, applying bounds and resizing the renderer have distinct responsibilities. Do not replace the approved default iOS status bar or add arbitrary whole-screen offsets.

All cards use the existing shared surface. Dialogs register with UI.bindDialog; long content scrolls inside a card while its close control stays outside that scroller. Diagnostics allow text selection. Small menus need not become modals.

Source/code deployment must not rebuild or upload media. Lost photographic masters are not recoverable merely by renaming a derived tier. Review original archives and UI approval hashes explicitly.

Offline browser tests use synthetic textures and local language data. Their success does not certify physical iPhone rendering, native GPU output, live R2 delivery or completed Cloudflare deployment.

## Long-term roadmaps

- [행성 재질·고리 파티클·우주선 비행 모드](planet-materials-and-flight-roadmap.md)
