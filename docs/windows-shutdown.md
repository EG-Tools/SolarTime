# Windows shutdown helper v2 (Solar Time v0.57)

## What changed

The old site displayed success when it dispatched a custom URI. That did not prove that Windows had accepted the command. v2 waits for a receipt containing the action, request timestamp, installed helper SHA-256, native result code and accepted deadline. No receipt means **unknown**, not failure and not success. The cancellation switch remains available for an unknown schedule.

The protocol association launches Windows PowerShell directly with `-File` and a single validated URI argument. The old VBScript/secondary cmd launcher is not used. The signed Windows PowerShell executable is used, but the project helper script itself is **not code-signed**. Corporate application control or browser policy may prevent it from running; these protections are not disabled by the installer.

Requests have an unguessable 128-bit identifier and an issue time. The URI only permits schedule (60–359940 seconds), cancel, probe and uninstall. The helper rejects expired requests. A per-user mutex and persisted issue-time ordering stop a delayed schedule from reversing a newer cancellation. No local HTTP listener, background Windows service, startup task, or administrator permission is installed.

The helper invokes the real Windows `shutdown.exe` only for an explicit schedule/cancel/uninstall action. A scheduled shutdown replaces an existing system shutdown as the previous implementation did. Windows `/t > 0` implies forced application closing: **save all work first**. An accepted command does not guarantee a sleeping, powered-off, or policy-restricted PC will power off at the intended wall-clock time.

## Cloudflare deployment

A dashboard URL is not an API credential. Use an authorized local Wrangler login, or configure `CLOUDFLARE_API_TOKEN` with access to this account's Worker and this R2 bucket. Never place credentials in source files or send them in chat.

Account: `4640527a19614f7b65a034f422704b64`
Worker: `solar-time`
R2 bucket: `solar-time-media`

From this release's source directory, double-click `Deploy_SolarTime_v0.57.cmd`. It installs the locked dependencies, opens Cloudflare authorization when an API token is not supplied, and runs the guarded deployment. Alternatively:

```sh
npm ci
npm run deploy:shutdown          # dry-run; no remote writes
npm run deploy:shutdown -- --apply
```

The deployment order is tests → build → versioned helper/source upload → remote byte verification → Worker/assets deployment → receipt API and Worker release-file verification. It never re-uploads planet textures or other media. On any failed step, it stops and does not report completion. Immutable helper uploads may remain even if a later deployment step fails; do not switch the public Pages frontend to this release until the Worker and helper checks pass.

GitHub Pages and Worker assets must serve the **same commit**. After the Cloudflare step succeeds, merge the release PR into `main` and verify Pages using `node tools/verify-public-release.cjs`. A Cloudflare-only deployment does not update GitHub Pages.

## Existing PC installations

Reload the site after both deployments. Download and run the new helper. If the download's Windows Zone.Identifier metadata is missing or network completion feedback fails, click the helper switch again and use **verify installed helper**; confirmation requires a real protocol probe, not a Yes/No assertion. Allow the browser's external-application prompt. The helper is installed under `%LOCALAPPDATA%\SolarTime`.

Error diagnostics are written to `%LOCALAPPDATA%\SolarTime\shutdown-helper.log` (bounded to roughly 64 KB). Removal deletes executable helper files and the protocol registration but keeps the small diagnostic log and request-ordering tombstone to reject delayed requests. They do not execute anything.

To cancel a real pending Windows shutdown independently of the browser, run `shutdown /a` in Windows. This cancels the system's pending shutdown, not just this site's timer.

## Receipts and privacy

Cloudflare receives random per-operation IDs, action, helper version, numeric result code, request time and accepted deadline, not account names, computer names, file contents or native command output. Standard hosting request/security logs still apply. Results are readable for three minutes; installation receipts for ten minutes. The Worker cron at minute 17 of every hour cleans receipt objects older than an hour; runtime keys are blocked from the public media route. This is a capability-token feedback channel, not hardware attestation or a guarantee against a compromised local machine. Deployment-wide rate limits remain an operational consideration for a high-traffic public service.

## Tests and limitations

`tests/shutdown-confirmation.test.cjs` executes the bridge and controller with browser/OS-result substitutes. `tests/shutdown-receipts.test.cjs` covers receipt validation, retry preservation, expiry and private runtime paths. `tests/windows-shutdown.integration.ps1` exercises the actual Windows PowerShell 5.1 parser, module extraction and isolated HKCU protocol registration with mocked shutdown execution. It never powers off a test runner. Existing renderer/camera/astronomy tests remain in the suite.

A physical Windows Chrome/Edge end-to-end test is still required after authenticated deployment. Do not claim that the PC has shut down merely because automated tests passed.
