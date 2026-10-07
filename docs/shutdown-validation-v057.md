# v0.57 shutdown validation — 2026-09-25 KST

## Verified implementation

Runtime/source commit: `70433f878baf9452f77e1e2a13750154d2046c86`.
PR: https://github.com/EG-Tools/SolarTime/pull/8
Verification run: https://github.com/EG-Tools/SolarTime/actions/runs/36067004249
Artifact: `shutdown-verification`, ID `10836089467`.

- Full Node regression suite on Windows with locked dependencies: **290 passed, 0 failed, 0 skipped**.
- Windows PowerShell 5.1 integration checks: **19 passed**.
- `npm run build:cloudflare`: passed.
- Windows checks cover actual runtime extraction, child PowerShell loading, temporary registry registration, spaced/Korean paths, URI validation, exit-code handling, cancellation, stale request ordering and failed commands.
- `shutdown.exe` itself is replaced by a mock in these tests. No real computer was shut down. A Windows Server runner is not the user's Windows 11 browser environment.

## Delivery checked before modification

The previously served helper's SHA-256 was
`EA76A5DBDC6E256734ADB430BE04EE5B049CE647E664F3054C4CC11EC1F345FA`.
It matched the v0.56 r2 Git helper exactly. Both public origins reported v0.56 r2.
That rules out an outdated public helper for that check, but does not prove the version installed on the user's PC.

## Fixes in the candidate

The browser no longer treats URI dispatch as successful scheduling. It waits for a matching, versioned native-result receipt. Missing responses remain visibly uncertain and cancellable, including after refresh. Cancellation/removal failures do not clear the browser state as if successful. Manual installation confirmation now probes the actual installed helper. The native helper registers PowerShell directly instead of chaining VBScript and cmd. Cloudflare accepts bounded, expiring result receipts and the deployment tool verifies uploaded installer/source hashes and Worker delivery.

New CRLF installer SHA-256:
`4A6A6F50FC48ADA93996B036CD3F21C68F083ABB3B946A72FECD9ADC07C37F41`.

## Deployment status — not deployed

The run's Cloudflare authorization check found no configured `CLOUDFLARE_API_TOKEN`. The actual R2/Worker deployment step was **skipped**, not successfully deployed. The provided dashboard URL identifies the account and bucket but does not grant API access. No token value was read or exposed.

당시 검증에서는 `main`을 v0.56 r2에 유지했고, v2 영수증 API와 설치 파일 업로드보다 브라우저 코드를 먼저 병합하지 않도록 했습니다. 이 내용은 v0.57 당시의 기록이며 현재 배포 상태가 아닙니다. 구버전 배포 실행 파일은 제거되었으므로 현재 작업은 [CI 파이프라인](ci-pipeline.md)을 따릅니다. 비밀번호나 API 토큰을 채팅으로 전달하지 않습니다.

After Cloudflare delivery verification, merge PR #8 to publish the matching Pages files and reinstall the helper from the updated site. Save work before a real shutdown test. An independent Windows `shutdown /a` can cancel a pending system shutdown.

See [deployment and recovery instructions](windows-shutdown.md). Subsequent CI workflow cleanup/documentation changes do not alter the runtime files tested in the commit above.
