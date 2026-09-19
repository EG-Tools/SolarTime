# Maintenance changelog

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
