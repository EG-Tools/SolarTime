# v0.61 r1 — shared-language regions and fixed AUTO

- Keep the automatic language option outside the scrolling country list; retain keyboard navigation and scroll cues.
- Add Norway, Sweden, Denmark, Finland, Iceland, Malta, Philippines, Malaysia, South Africa, Nigeria and Ghana using the existing English locale.
- Add the Dominican Republic and Guatemala using the existing Spanish locale. Connect each selection to its IANA time zone and representative Earth-view city.
- Preserve existing locales, audio, native helper, rendering and all explicitly deferred work.

# v0.60 r2 — help music credits

- Show `BACKGROUND MUSIC SUNO AI - Lyrikey` with the author linked to the requested Suno profile.
- Add `Alram Music - Maryan Dembitskyi` directly below it with the author linked to the requested Pixabay profile.
- Open both author links in an isolated new tab, retaining shared credit styling. Audio behavior and deferred work are unchanged.

# v0.60 r1 — audio maintenance, items 20 and 23 only

- Recover mid-playback music errors and stalled playback with bounded retries, source failover and track exhaustion; manual controls and alarm OFF always take priority.
- Bound default-alarm preparation to 12 seconds; stream sounds longer than 45 seconds. Short decoding has 4 MiB compressed and 16 MiB retained PCM budgets.
- Preserve alarm gain 0.864, preview gain 0.696, fallback gain 0.192 and the existing default music file. No Windows helper reinstall is required.
- Items 17/18/19/21/22/24 are explicitly deferred until the owner asks. No branch protection changes (25) or performance-recording work (26).

# v0.59 r1 — 2026-09-25

- Alarm/preview gain +20% (0.72→0.864 / 0.58→0.696); preserve music OFF and native shutdown compatibility.
- Optimizations 6–16: on-demand timer wakeups, lazy streaming sound resources, last-selection-wins persistence, adaptive installation polling, content-derived cache URLs, deduplicated helper upload, shared deployment runner, flattened translations, identical shared card rules, diagnostic R2 round trip and receipt rate limits/cleanup progress.
- Existing Windows helper bytes/hash and media artwork remain unchanged.

# v0.58 r1 — alarm music OFF

- Stop background music through its shared controller before alarm playback. Keep the music button OFF after stop/snooze.
- Correct the five-minute snooze delay and test default/custom alarms, previews and pending music playback.
- Windows shutdown helper and Cloudflare receipt API are unchanged; no PC helper reinstall is required.

# v0.57 r1 — verified Windows shutdown

- Confirm scheduling, cancellation and removal from native exit codes, not URI dispatch.
- Replace the VBScript/command-shell chain with direct PowerShell registration and installed-file verification.
- Keep unknown operations cancellable; reject delayed schedules after newer cancellations.
- Add short-lived Cloudflare receipts, private runtime storage, hourly cleanup and explicit coordinated deployment.
- Add behavioral browser/Worker tests and isolated Windows PowerShell 5.1 tests.
- Reinstall the Windows helper after deployment. Cloudflare authentication and physical Windows end-to-end validation remain deployment prerequisites.

# Maintenance changelog

## v0.55 r1 · 2026-09-23

- Added Microsoft Clarity behind the shared cookie consent owner, using Consent V2 updates for later approval or rejection.
- Improved large-clock fitting when seconds are visible.
- Stopped redundant rendering on stable paused scenes and reused same-time ephemeris work.
- Strengthened staged texture and sky loading, timeout recovery, cache keys, Cloudflare media handling, and public release verification.
- Reduced runtime manifest data and kept the deployment file set derived from actual public dependencies.

## v0.53 r2 · 2026-09-22

- Added a compact 200×200 desktop ad drawer that stays in preview mode until a real AdSense slot is configured.
- Added Google Analytics with denied consent defaults and a shared-fade cookie choice card controlling analytics and advertising measurement consent.
- Localized cookie consent text across all 13 supported interface languages, including local-file fallbacks.
- Added ads.txt plus About, Privacy and Terms pages to both source control and Cloudflare static deployment output.
- Reduced the cookie consent card to its translated content width while retaining safe wrapping on narrow screens.
- Persisted random rotation across refreshes with backward compatibility for existing left/right rotation preferences.

## v0.52 r1 · 2026-09-22

- Added optional Earth night lights based directly on NASA Black Marble 2016 grayscale radiance data.
- Preserved the source light distribution while reducing it from 13,500×6,750 to 4K and applying only a warm colour tone.
- Added a wider twilight fade and distance-specific night-light texture levels to reduce distant flicker and GPU cost.
- Moved Earth Night Lights and Sun Shine into the shared bottom section of their respective body cards.
- Removed obsolete R2 night-light texture generations after the verified v0.52 deployment.

## v0.51 r1 · 2026-09-21

- Added layered JPL orbital elements for 1800–2050 and long-range approximation through 2999, with precision Moon, Europa and Pluto models.
- Fixed repeated previous/next eclipse navigation so it continues strictly beyond the currently displayed event.
- Separated Earth-sky planetary gatherings from strict heliocentric alignments of five or more planets.
- Added gold viewport alignment guides and distinct date colours for sky and space events.
- Centered eclipse and planetary-alignment titles and controls in their cards.
- Added Horizons comparison fixtures, long-range alignment scanning and regression coverage for the new astronomy paths.

## v0.50 r1 · 2026-09-21

- Added a browser-language/device-time-zone Auto Language default while preserving explicit country choices, and added Taiwan and Hong Kong with Traditional Chinese locale data.
- Added previous/next eclipse time travel for Moon and Europa. The current camera framing and tracking state are preserved throughout the transition.
- Decoupled Moon/Europa display scale from satellite-orbit spacing, corrected Europa transit geometry and made repeated focus commands idempotent.
- Unified popup dismissal and presentation-mode behavior across shared cards and overlays.
- Improved GPU texture planning, cancellation and disposal, plus Cloudflare HEAD/Range media caching behavior.
- Simplified support links into one compact row and bumped all changed runtime resources to the v0.50 r1 cache key.

## v0.48 r3 · 2026-09-19

- Clarified random rotation: choose one yaw/pitch direction on each OFF-to-ON activation and keep that direction until OFF. Re-enabling selects a new direction.
- Keep the same 1.8 degrees/second speed as left/right, with no direction-change timer or easing.
- Preserve the direction through manual input, wheel/preset transitions and tab suspension.
- No changes to stars, palette, 250x country view, camera limits, shared card styling, iPhone layout, icons or R2 media.

## v0.48 r2 · 2026-09-19

- Fixed the almost-stationary random rotation startup. Its speed now uses the same 1.8 degrees/second constant as left/right; only the yaw/pitch heading changes.
- Smooth heading turns maintain speed without fading through zero. Manual controls, pole crossings, wheel, presets, hidden-tab pause and OFF behavior are preserved.
- Added quantitative startup/speed/continuity checks; the previous nonzero-angle checks did not reject imperceptibly slow motion.
- No star generation, star shaders, palette, iPhone layout, media or icon changes.

## v0.48 r1 · 2026-09-19

- Country inspection starts at a 250× Zoom reference; Move mode keeps its wheel mode with an equivalent Earth radius. Manual wheel range is unchanged.
- Added the shared-style crossed-orbits random rotation toggle below Rotate left. The existing camera owner integrates smoothly changing yaw/pitch; no extra rAF, zoom or star regeneration. Manual orbit drag, wheel and presets preserve its intent. Pointer deltas are added to the current camera, including beyond both poles and across the +/-180 wrap, without snapping back to pointerdown angles. Random mode starts OFF on a new page.
- Kept per-launch random stars, r2 tiny-star filter, approved star colours, iPhone status-bar default and all common card surfaces.
- Reuse stat DOM nodes and cache static body information. Preserve dynamic orbital values.
- Preserve frame deadlines across 90/144/165 Hz callbacks, without changing actual animation time or adaptive frame-rate policy.

## v0.47 r3 · 2026-09-19

- Added Netherlands (NL) and Belgium (BE) with one complete shared Dutch locale.
- Kept separate nl-NL/nl-BE date formatting, Europe/Amsterdam/Europe/Brussels time and representative Earth-view cities.
- Belgium is multilingual; the BE entry currently selects the Dutch interface, following the existing one-language-per-country design.
- Preserved the r2 tiny-star filter, colour balance, iPhone layout, common cards and approved R2 media.

## v0.47 r2

- Stabilize tiny stars using pixel-integrated footprints in GPU and whole-output-pixel coverage in the compatibility path; preserve large-star animation and drift.
- Reduce red and yellow probabilities by 30% each (7% -> 4.9%; 3% -> 2.1%); split the freed 3% equally between white (73.5%) and blue (19.5%), retaining total star count.

## v0.47 · 2026-09-18

- Added Singapore (SG), reusing English translations with en-SG formatting, Asia/Singapore time and the existing regional Earth-view path.

- Unified diagnostics, help, settings, body and QR card surfaces and dismissal ownership.
- Corrected QR padding/scrolling, scrolling close controls, nested Escape and card-interior click dismissal.
- Consolidated release history and fixed failed-load retries without changing historical wording.
- Removed renderer and global shader prototype patches; GPU, Worker and CPU use shared material settings.
- Shared source selection/decoding/preparation and skipped already baked seam processing.
- Separated original-source restoration from derived-media inspection. UI uploads require preflight, approval and explicit execution; watermark is opt-in.
- Preserved the user-approved v0.46 r6 iPhone layout, status-bar default, camera behavior, official icons and media revision.
- Added regression checks and a release verification workflow. Repository Pages Source remains an explicit administration setting.

Historical public release wording is maintained only in src/release-notes.js. Historical implementations and obsolete tests remain in Git history at 94fa46401571dcb6363d153dab3b66030f91830c and earlier.
