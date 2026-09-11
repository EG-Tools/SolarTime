# SolarTime v0.03 validation

Local release gate: Node.js 22 and Linux Chromium 144 (system executable) through Python Playwright. No runtime libraries or external image dependencies.

- 39 Node tests passed: orbital mathematics, shared simulation time, signed physical rotation periods, compact lunar spacing, and the common label-layout owner.
- 83 Chromium checks passed: desktop 1648×928, mobile 390×844, narrow 320×780, reduced motion and restricted storage. The standalone HTML was injected offline. Requests to external resources: 0; JavaScript runtime errors: 0.
- 64× zoom, target tracking, wheel/button/keyboard paths, 10% lower overview, lunar path/position agreement, deterministic cached corona, all-body label hit geometry, and intermediate Earth/Moon label positions were checked.
- Label-layout tests verify all 11 bodies, stable priority independent of depth sorting, delayed switching, easing at different frame rates, body-relative anchoring, hit testing, bounded cleanup, and inactive-interval handling.
- Physics and decorative-effects pause tests exclude label easing: label avoidance is UI motion and may finish after the simulation is paused.

Measured overview frame rate in this run: 59.8 fps. This is a measurement on the test machine, not a frame-rate guarantee; closeups and accelerated textured spheres cost more.

Existing `docs/preview.png` is the v0.02 reference image. Updated v0.03 screenshots and offline build are provided with the release conversation. The website serves root sources directly; `npm run build` generates the standalone v0.03 file. Older committed files under `dist/` remain versioned archives.

Not verified on physical Windows, macOS, Android or iOS devices; Safari and Firefox were not exercised. Direct file:// and localhost HTTP navigation were blocked by the test browser policy (ERR_BLOCKED_BY_ADMINISTRATOR), so those entry paths are not verified. No browser policy was changed. Public Pages version/source verification is recorded with the release conversation. Repository deployment success must be confirmed from GitHub Pages Actions and the published application version, not from an old static release-status JSON.
