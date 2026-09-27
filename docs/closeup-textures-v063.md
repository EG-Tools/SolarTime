# v0.63 r1 — progressive close-up texture delivery

Baseline: `309650ba9ed60b1394b2bd2105e94821a89b32a8` (v0.62 r1).
The user's final instruction makes a medium-resolution preview the default;
cache reuse, early requests and scheduling supplement it, not replace it.

## Display contract

- Ordinary first visibility keeps the small 256 baseline. A close-up with only
  that baseline first requests 1024; only after publishing that preview does a
  later render tick request the final tier (4096 where the original supports it).
- Explicit selection / tracking prepares 1024 through the same loader before the
  camera arrives. It does not create a second fetch path or request all planets.
- Existing resident final detail is the fast path. Otherwise 4K is never made a
  prerequisite for showing the preview. No mandatory 512/2048 waterfall, new
  compressed format, lower-quality original or new shader is introduced.
- Failed upgrades keep the last good preview. A 256 emergency fallback cannot
  replace a better 1024 surface while waiting for a failed 4096 request to retry.
- The compatibility surface also publishes 1024 before full detail and requests
  the second stage even for an otherwise static scene.

## Scheduling and reuse

Queued jobs are reprioritized against the current focus; focused previews lead,
followed by focused detail and required visible maps. Obsolete queued/active work
is cancelled. The existing two active load slots remain bounded. A changed final
LOD does not restart the same required 1024 request.

Recently replaced 1024+ GPU textures are retained separately from the displayed
LOD. Ready exact-tier reuse avoids fetching, decoding and uploading again.
The existing 96 MiB mobile / 192 MiB desktop texture budgets cover BOTH current
and retained textures. Retention is additionally limited to at most one third of
that budget (32/64 MiB), and retained entries yield first for upload space.
The existing 650 ms downgrade hysteresis and exact Earth night-light LOD remain.
Pause, source replacement, renderer disposal and context restoration invalidate
obsolete work; there is no persistent browser storage or all-planet preload.

## Corrected Cloudflare finding

The previous suggestion that `workers.dev` necessarily prevents cache hits was
not supported by the observed production response. Before these changes, run
`36312430770` downloaded Earth and Moon 4K three times each from the existing
public Worker route. Repeated responses included `CF-Cache-Status: HIT`.
Artifact `10929419069` SHA-256:
`fa1e98c7476ebc72cf79f586d1fb7ed41658c3421fe185a864343c0725f752d3`.
The initial baseline-only staging run failed because checkout was shallow; it
never sampled media or changed production. The corrected run succeeded.

These measurements are single-runner samples, not the user's connection or a
multi-country performance guarantee. Keep the working origin and protected R2
route; no DNS changes, public R2 bucket access, new services or paid cache options.

Public media now reports `X-Solar-Media-Cache: HIT/MISS/BYPASS`, exposes safe
cross-origin resource timing and keeps original hash-based immutable URLs.
Cache-read errors can fall through to R2. The unchanged helper API is no-store,
private `releases/runtime/` paths remain inaccessible, and mutable UI is bypassed.
A bounded GET-only deployment check verifies original hashes and observes real
cache hits for Earth/Moon 1024/4096. There is no bucket mutation in that check.

## Validation and scope

New unit cases cover progressive ordering, ready-cache bypass, stale cancellation,
priority, failed high-resolution upgrades, mobile/desktop budgets, disposal,
source replacement and compatibility staging. Real Chromium tests use 1024 and
4096 synthetic images, delay the high-resolution response, and read actual GPU
pixels to verify the visible preview and atomic replacement. Revisit tests assert
zero additional downloads, decodes or GPU uploads. Existing regression suites
remain mandatory before publication. Exact results are recorded on the PR.

Original texture bytes/asset manifest, renderer shaders, sky, camera trajectories,
CSS, audio, Windows helper and 48-country language/time behavior are retained.
New release notes are generated from the existing i18n sources. Deferred items
17/18/19/21/22/24 and unapproved 25/26 are not part of this change. No physical
Windows shutdown or physical iPhone test is implied by automated checks.
