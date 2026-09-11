# Solar Time v0.04 — verification

- Base: `4db386c475c9055516197ee3f91f81a05aaf5b5d` (v0.03 with contact credit).
- Node unit tests: **55 passed**, 0 failed.
- General Chromium regression checks: **83 passed**.
- New viewport/closeup/surface/pan checks: **32 passed**.
- Built standalone HTML: `npm run build`; no runtime packages, textures or CDN requests.
- Browser environment: Linux, Chromium, Python Playwright; desktop and mobile viewport sizes, DPR 1/2, reduced motion. Tests inject the built HTML directly. They do not establish Windows double-click or public deployment behavior.
- The initial combined shell execution exceeded the container command lifetime; the stable full run subsequently completed successfully, with all spawned test/browser processes closed.

## Checked invariants

All camera input paths share -90°/+90° limits. Saturn/Uranus ring planes are perpendicular to the same body pole as the sphere surface; front/back halves use view-space depth. All bodies reach the same screen-relative diameter at maximum tracked zoom. Closeups upgrade to 1024×512 textures, and longitude borders join without a hard seam. High-resolution raster/geometry caches are bounded. Middle-button dragging applies only vertical screen-relative translation, clamped to ±20%; default framing is 5% higher than v0.03. Mouse default autoscroll is suppressed only over the viewport. Cursor idle, pause, date selection, relative periods, contact credits, responsive controls and the common label easing remain covered. Shine trace at 5 seconds matches the old 15-second decorative trace exactly, without changing the physics timestamp.

## Rotation audit

The unmodified v0.03 runtime was observed for 61.036 real seconds: its simulated clock matched wall time, frames advanced, and all orbital/rotation angles changed. Controlled same-camera, effects-disabled sprite comparisons 60 seconds apart found changed Jupiter/Saturn/Earth/Mars/Uranus/Neptune/Pluto images. Sun/Mercury/Venus/Moon could reuse the same sprite because the cache rounded the rotation phase. v0.04 removes that phase rounding for every body. All 11 new sprites change pixels in the same controlled test while representative sidereal periods remain unchanged. A completely unchanged paused timestamp reuses its sprite.

## Reproduce

```sh
npm test
npm run build
python tests/browser_test.py
python tests/view_browser_test.py
```

Python Playwright and Chromium are required for browser checks; `CHROMIUM_PATH` overrides the executable path.

## Publication status

The source-upload tool call was blocked before any source commit was created. The newly created `update/v0.04-viewport-closeup` branch was subsequently compared to main and was identical. No v0.04 PR was merged or deployed. The source ZIP and standalone HTML are the v0.04 deliverables. See `release-verification-v0.04.json` for results and `rotation-audit-v0.04.json` for raw observations.
