# Solar Time v0.07 verification

## Passed

- 71 Node unit tests: orbital/time invariants retained, spin continuity, spherical body/ring geometry, zoom/pan, label motion, render lifecycles, shared material catalogue/cache checks, normalized curved comet path, 1024 output ceiling, zen visibility and the exact 4× shine multiplier.
- 36 offline Chromium workflow checks: injected standalone document, local boot/position calibration, embedded materials, planet-nav centering, camera controls, zen/no buttons, keyboard restore, curved comet, backdrop wrap/motion, close-up sizing, contact identity, 390/320px layouts and no outgoing HTTP requests.
- 18 material integration checks using **explicit synthetic fetch responses**: all eight slots, bounded concurrency/retries, native image dimensions, material revision consumption by the renderer, Earth preservation, removal of unrelated relief, source-specific credits, corrupt-cache byte rejection, export and offline reopen, failure fallback, shared loading producer and cancellation.

Reports: `unit-results-v0.07.txt`, `release-browser-v0.07.json`, `materials-browser-v0.07.json`.

## Environment and measurements

Node.js 22.16.0, Python Playwright, headless Chromium on Linux. No usable WebGL context in the test environment: rendering was checked using the CPU compatibility path. Offline standalone first scene was measured at about 1.56 seconds; this is one test environment, not a performance guarantee. Moon maximum-view measurement is in the raw report, not presented as a hardware-GPU frame rate.

The offline overview/zen screenshots show the bundled fallbacks. They are **not screenshots of the newly selected NASA/Solar System Scope replacement maps**. Earth continues to use the pre-existing NASA Blue Marble image.

## Unverified

- Actual public image-host responses/CORS and external file download: unavailable in this build environment. Source pages, map URLs and license information were checked, but originals were not downloaded into the package.
- Hardware WebGL shader rendering and real-user GPU performance.
- Windows double-click and direct file/HTTP navigation in this test browser (restricted by environment policy).
- Real IndexedDB persistence across browser restarts; cache validation and decode rules were tested at the owner boundary.
- GitHub publication/Pages deployment: not performed for this package.

## Deliberate behavior

No change to `src/astro.js` or physical rotation periods. All position calculations and embedded graphics start without an internet wait. At most three image fetches are active; each approved URL has a 6.5-second timeout and each body has at most three approved sources. Received maps publish as one snapshot, invalidate prior rendered surfaces and can be exported with their bytes. Complete failure retains the embedded images and reports 0/8, never claims a successful photo upgrade.
