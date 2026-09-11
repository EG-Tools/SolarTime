# Solar Time v0.10 verification

## Changes
- Persistent static timezone readout in viewing mode; no invisible button hit target.
- Three camera bookmarks anchored beneath Help, storing angle, zoom, pan and focus. Left click saves/overwrites; number keys recall; clock and playback remain untouched.
- Right-click deletion dialog at the pointer, clamped to the viewport. Cancel receives focus; Delete requires explicit confirmation. Escape/outside click cancel.
- Per-body render-job identity and image-size validation, atomic replacement of healthy frames, correlated stale error handling, GPU context-loss detection and CPU recovery. No astronomy, texture asset or shader-material styling changes.

## Results
- 95 Node tests passed.
- 73 Chromium checks passed (38 camera/popup/timezone/surface checks plus 35 existing viewing-mode regressions).
- Offline startup, desktop and 390/320px touch layouts, popup cancellation/deletion, keyboard recall, disabled body validation, save/reload fixture, denied storage, generated HTML export, image-generation continuity, old idle controls and all 11 tracking choices are covered.
- Settled paused Jupiter image samples remained nonempty and color-stable in the CPU path.

## Limitations
- Browser HTTP/file navigation was blocked by policy; standalone HTML was injected offline.
- localStorage persistence/denial cases use an explicit in-memory Storage fixture, not a successful direct-file browser-storage test.
- No hardware GPU was available. GPU-loss safety checks are unit/source tests, not a real GPU device test. The user's specific purple flash was not reproduced; no confirmed elimination of that symptom on their GPU is claimed.
- Physical Windows, physical touch devices and current external texture-server responses were not tested.

## Source preservation and publication
All texture/baked assets and astronomy remain byte-identical to the supplied v0.09 ZIP. The changed-only ZIP lists its baseline and checksums. No GitHub changes or deployment were requested/performed for this revision.

Reports: `unit-results-v0.10.txt`, `camera-presets-v0.10.json`, `viewing-controls-v0.10.json`, `release-verification-v0.10.json`.
