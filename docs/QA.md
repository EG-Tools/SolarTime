# Solar Time v0.09 verification

## Scope
Removed the tracking/overview banner for all bodies. Reused the existing home action and mode exit inside one action group. One idle owner controls visibility, pointer targets, keyboard focus, accessibility and cursor state. No astronomy, rendering or image changes.

## Results
- 86 Node tests passed.
- 35 focused Chromium checks passed: tracking, mouse movement and click, hidden-button hit testing, idle, inert state, middle drag, reset without mode exit, keyboard shortcuts, focus transfer, mode exit, 390px/320px touch layouts and image-inclusive HTML export.
- 22 rendering/calculation/generated-asset/image files are byte-identical to the v0.08 ZIP.
- Generated HTML exactly matches current source HTML, CSS and JavaScript.
- No tracking-card elements or disconnected listeners remain in runtime code.

## Environment and limits
Linux headless Chromium; standalone HTML injected offline. Direct file navigation returned ERR_BLOCKED_BY_ADMINISTRATOR. No successful direct file or Windows launch is claimed. Screenshots used worker surfaces and CPU sky compatibility. Physical hardware GPU and physical input devices were not tested.

Reports: `unit-results-v0.09.txt`, `viewing-controls-v0.09.json`, `release-verification-v0.09.json`. Earlier version-named reports are historical.

## Publication
Local files only. No GitHub branch, commit, push or deployment was performed.
