# Solar Time v0.08 verification

## Changes verified
- Background generator: corrected periodic lattice interpolation (40 samples rather than the prior `%39` discontinuities); circular longitude envelope; uncropped, smoothly tapered galaxy support; polar convergence; lossless WebP.
- Software sky raster: periodic bilinear sampling with texel-centre coordinates, clamped poles and matching tone response. WebGL uses the existing REPEAT-S, CLAMP-T and LINEAR settings with a polar atan guard.
- Camera: ordinary scene magnification no longer depends on the tracking target. Only that target receives screen-size normalization. Moon and Pluto remain as enlargeable as the Sun. Local Earth-Moon spacing uses one value for position and path.
- Drag/double-click discrimination prevents accidental focus after captured rotation or pinch gestures.
- Browser and image-inclusive export title: exactly `Solar Time`.

## Results
- 86 Node unit tests passed (including 8 new camera regressions and 7 title/panorama sampler regressions).
- 7 Python background bake/decoded-image continuity tests passed.
- 44 offline Chromium workflow checks passed, including actual pointer drag, middle drag, deliberate double-click, rejected post-drag double-click, the Moon information-panel tracking button, body-radius invariance during camera gestures, reset, mobile layout and common max target fill.
- 19 image integration checks passed using **synthetic network fixtures**. No public image bytes were downloaded by these checks.

At 1648x928 and zoom 40 with Moon tracking, the old shared normalization gave a Sun radius of about 1730.67 CSS pixels and Jupiter 1792.47. The revised values are about 200.41 and 207.57; Moon remains 241.06. All unfocused radii are invariant when the focus identity changes at the same zoom.

## Environment and limits
Linux Node.js, Python Playwright and headless Chromium. WebGL is unavailable in this test environment: screenshots and rendering checks exercised the CPU/worker compatibility path, not a physical hardware GPU. Direct Windows file launch, physical GPU rendering and live remote-image CORS remain unverified. The photographs' original download/credit/cache workflow is unchanged, as are all astronomy, spin, shader output limits, planet assets, shine timing and zen-button rules.

Reports: `unit-results-v0.08.txt`, `sky-bake-results-v0.08.txt`, `release-browser-v0.08.json`, `materials-browser-v0.08.json`, `release-verification-v0.08.json`.

## Publication
Local package only. No repository or website was changed and no branch was created.
