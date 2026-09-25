# v0.60 r1 — only music recovery (20) and default alarm resources (23)

Approved scope: user message on 2026-09-25. Baseline main is
`097390e47de78c4e92eb179f55322127a9fdf49e` (v0.59 r1).

## Scope decision — do not silently expand the work

Items 17, 18, 19, 21, 22 and 24 are deferred until the owner explicitly requests
one of them. Do not add update guards, cross-tab timers, missed-alarm notices,
render-error isolation, WebKit/autoplay-readiness UI, or rollback machinery here.
No branch protection/ruleset changes (25) and no performance recording work (26).
Existing approved CI and deployment gates stay unchanged.

## 20 — background music recovery

Listen for real playback errors after startup, not just a rejected play promise.
Retry a failing URL once after one second, then use a distinct fallback URL if
available, then the next track. An exhausted playlist turns playback and its
button OFF and uses the existing music-unavailable notification. Duplicate error
and play-rejection callbacks count only once. Only actual playback progress of
at least five seconds restores the transient failure budget; mere play-promise
success cannot create an endless rapid failure/retry cycle.

Startup and stalled/waiting checks have a 15-second watchdog. A stalled event
while buffered playback keeps advancing is not treated as a failed song. There
is no recurring timer on healthy music. Intentional pause/abort is not a failure.
Manual OFF, previous/next, alarm OFF and disposal cancel pending recovery and
remove attempt-specific media handlers. A late old promise cannot select an old
track or re-enable playback. The established shuffle and volume remain.

## 23 — default alarm preparation and playback

The default sound file is unchanged. Probe metadata before choosing a playback
path. Default sounds longer than 45 seconds remain media URLs and do not enter
whole-file JavaScript PCM decoding. Short default sounds retain the existing Web
Audio path with a four-MiB compressed input and 16-MiB retained PCM budget. Both
Content-Length and streamed byte counts are checked. Decode failures can retain
the media streaming alternative rather than disabling the alarm.

Preparation has a 12-second overall deadline (including metadata, download and
decode waiting); an individual metadata probe has a four-second timeout.
Cancellation aborts fetches, releases metadata elements and ignores late decoder
results. A decoder already executing cannot be forcibly stopped by JavaScript;
the retained-buffer limit is not an absolute bound on temporary browser/decoder
allocations. Browser-managed streaming buffers are also outside that bound.

Default media playback has a three-second startup/stall watchdog and a finite
URL attempt list. Failure restores the existing synthesized fallback tone while
ringing. Stop/snooze and disposal cancel playback timers and release resources;
late media completion cannot restart a stopped alarm or preview.

Existing gains are unchanged: alarm 0.864, preview 0.696, synthesized fallback
0.192, background music 0.55. The user-custom-alarm preparation policy remains
unchanged (60-second threshold and its existing limits). No native Windows
helper, hash, protocol, cloud API, camera, renderer, artwork or layout changes.

## Validation

Regression tests cover music error/rejection de-duplication, URL budgets, rapid
error loops, stalled-but-progressing playback, hung startup, saved-position seeks,
manual/alarm OFF, disposal, short/long default preparation, declared/chunked limits,
hung response/decoder, cancellation, default fallback and gain preservation.
Existing Chromium audio tests additionally exercise real media-error recovery
and remote short/long WAV preparation. The full platform/UI/native-mock suite and
published file verification are recorded in this release's PR/deployment record.

These tests do not shut down a real PC, measure acoustic loudness, or certify
locked/background iPhone playback. Keep those existing browser limitations clear.
