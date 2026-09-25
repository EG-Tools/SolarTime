# v0.59 r1 — alarm volume and optimization items 6–16

Baseline: `2ddcfe5d44e8e70938f4321b986bc36987ee45ba` (v0.58 r1).
GitHub Pages Source was changed by the owner; the previous unified deployment,
run 36112458954 attempt 2, passed on 2026-09-25 before this change.

## User-visible change

Alarm playback gain is multiplied by 1.2: 0.72 → 0.864; previews 0.58 → 0.696;
emergency synthesized tone 0.16 → 0.192. This is not a 20-percentage-point
increase or a claim that perceived acoustic loudness rises by exactly 20%.
Background music still switches OFF before an alarm and never resumes by itself.
Snooze stays five minutes. The native Windows helper bytes, hashes, URL protocol,
layout, cameras, sky texture, astronomy and shaders are unchanged.

## Completed implementation

6. Idle timer controllers have no recurring wake. Active timers use wall-clock
   deadlines, visible countdowns update once per second, hidden/closed panels
   skip periodic DOM writes, and target date formatting is cached. Resume events
   recheck overdue timers. Browser/OS suspension can still delay web alarms;
   this does not replace a native alarm service.
7. Saved custom audio is loaded on demand, not at every launch. Short files
   (up to 60 seconds) keep the Web Audio path. Longer custom files use Blob media
   streaming rather than whole-file PCM. The 30 MiB input limit remains; retained
   custom decode fallback is capped at 32 MiB. This cap is NOT a guarantee on
   temporary decoder allocations or the built-in default track. Buffers/Blob
   URLs are released when idle; unused default fetches are aborted.
8. Installation confirmation polls at 1, 3, then 10 seconds (15 while hidden),
   checks immediately on return, and ends at ten minutes. A controlled foreground
   ten-minute wait now makes 84 checks instead of approximately 600. This is a
   request-count simulation, not a measured Cloudflare bill reduction.
9. Generation/abort guards discard stale metadata, decoding and saved-file reads.
   IndexedDB writes are serialized and accepted on transaction commit; a later
   selected file wins even when the earlier operation completes last. Cancellation
   and disposal cannot revive old selections or keep a late decoded buffer.
10. JS/CSS and locale URLs are derived from normalized content. A version-only
    bump no longer invalidates unrelated files. Generated asset-script keys derive
    from canonical asset inputs; each origin still publishes its proper CDN base.
    `npm run update:cache` updates keys; builds/tests reject stale keys. Media/icon
    revisions and images are unchanged. Existing Pages/CDN cache TTLs remain.
11. The helper uploader verifies public bytes and headers before writing. Identical
    installer and source objects are skipped; missing objects alone are uploaded.
    Errors or immutable-URL mismatches stop deployment, not silently overwrite it.
    A helper reinstall is only necessary when the actual helper hash changes.
12. `tools/deployment.cjs` owns all build/helper/Worker phases. Existing local CLI
    aliases delegate to it. Commands default to a no-write plan and require
    `--apply`. Actions phases recheck the exact-main gate; local deployment runs
    unit/browser checks and Windows native mocks where available. Local browser
    checks need Python, Playwright and Chromium; the authorized Actions path
    already installs them. Pages still publishes through its official action.
13. Timer copy is one immutable cached English fallback plus language overrides in
    `src/timer-copy.js`. Effective copy for all 13 languages is preserved and tested
    against baseline SHA-256 fixtures. No duplicated override priority stacks.
14. The common card and toast surface share one declaration while retaining both
    original selectors and specificity. No opacity, spacing, blur or color change.
15. Explicit deployment verification writes, reads, deletes and confirms removal
    of a random diagnostic probe receipt. It cannot invoke a native command or
    delete operation/install receipts. Default audits remain read-only. A failed
    round trip prevents Pages publication and is not called a completed rollout.
16. Worker rate limits: per request ID 240/minute, network read/write safety ceilings
    1800/120 per minute. Network keys are SHA-256 values, never raw IPs in R2 or
    custom log output. Separate quotas preserve normal polling/cancel traffic.
    A limiter-backend error logs a warning and leaves confirmations available.
    Cloudflare counters are location-local/eventually consistent, not an absolute
    global spending cap. Cleanup cursors advance beyond bounded ten-page batches;
    only ephemeral receipts are deleted, with scoped progress/failure logs.

Rate-limit binding reference:
https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/

## Validation and rollout

The PR and deployment records carry the final tested commit and results.
Tests cover idle/hidden/visible timers, countdown and uncertain native states,
installation backoff/resume/expiry, audio races and disposal, real Chromium silent
WAV decode/stream/gain, effective translations, content-key stability, no-op helper
uploads, diagnostic isolation, rate limits, and resumable cleanup.

No real PC shutdown is performed by these checks. Chromium installed-mode layout
checks are simulations, not physical iPhone testing. No FPS/battery percentage
improvement is claimed. Preserve the existing native helper; reinstall is not
required for this release.

After deployment: refresh the site, test alarm sound and music OFF, snooze, custom
sound selection/preview, native schedule then cancellation, and iPhone layout.
