# Solar Time — Complete Update History

Current and past Solar Time updates, listed from newest to oldest.

## v0.75 · 2026.10.09

- Improved camera transitions between the opening, warp and Saturn travel.
- Fixed planets and orbits becoming misaligned during distant Saturn travel.
- Made Saturn-entry particles appear and disappear more naturally.
- Fixed particles cutting out or appearing abruptly during transitions.
- Improved initial loading and overall performance.

## v0.74 · 2026.10.08

- Improved the default view and the display of distant planets.
- Made camera movement smoother in the opening, warp and Saturn ring travel sequences.
- Fixed planet sizes and orbits shifting when starting or returning from Saturn travel at long distances.
- Improved Saturn travel particles and the sense of depth in background stars.
- Added Russian and Ukrainian language and region support and individual reset controls for setting sliders.

## v0.73 · 2026.10.04

- Improved alarm, scheduled shutdown and automatic update reliability.
- Improved opening and travel sequences and ring visibility at screen edges.
- Optimized performance and expanded automated checks across browsers.

## v0.72 · 2026.10.04

- Improved the opening sequence.
- You can now travel through Saturn’s rings at any time.
- Press T to start a journey.
- Use the UFO button to choose an opening sequence.
- Press Space to pause or resume the cinematic camera.
- Improved performance through various optimizations.

## v0.71 · 2026.10.02

- Refined sizes, orbit spacing, and reset defaults in normal and true-scale views.
- Improved the default view, camera transitions, and saved camera settings.
- Added a new Saturn ring texture with distance-based LOD.

## v0.70 · 2026.10.01

- Refined the opening camera, particles, and orbit and label reveals.
- Improved camera controls, tracking transitions, true scale, and orbit spacing.
- Updated planetary alignment controls, help, and shortcuts.
- Optimized cloud and orbit rendering and initial loading.

## v0.69 · 2026.09.30

- Improved Earth cloud visuals and performance; range 0–100%, default 100%.
- Added Venus terrain and cloud controls with smoother close-up loading; default 80%.
- Refined cloud-control placement and clock spacing, and added WeChat donations.
- Automated the latest 10 updates in 13 languages and the full Korean archive.

## v0.68 · 2026.09.29

- The in-app update history now keeps only the latest ten releases translated into the selected language.
- After the tenth entry, a link opens Solar Time's standalone complete Korean update-history page.
- The complete Korean archive is generated automatically from the translation source, substantially reducing the app's update-data payload.
- The README and media credits now focus on the app's enduring purpose, features, controls and sources that are actually in use.

## v0.67 · 2026.09.29

- Reorganized Help with a concise screen-saver purpose, key features and non-duplicated desktop controls.
- Localized the new introduction in all 13 interface languages; Auto Language prioritizes the browser language on first launch and reset.
- Extended wheel zoom and right-drag camera travel to a 0.1× overview, so the whole solar system can be viewed from much farther away.
- Removed the lower-left watermark from the main view, aligned the information text to the left, and kept the watermark only in Help.
- Use the left and right arrow keys to cycle through the footer bodies; active tracking continues smoothly onto the next body.

## v0.66 · 2026.09.28

- Remember cookie acceptance and rejection for six months, then ask for a new choice.
- Add an X button that closes without saving a choice and Cookie settings in Help.
- Reopening settings or closing with X preserves the existing choice and expiry; music, alarms and image quality remain unchanged.

## v0.65 · 2026.09.28

- Keep existing visit measurement and record actual feature use as separate events after consent.
- Distinguish music playback, body tracking, alarms and confirmed shutdown actions without adding personal input or false lead conversions.
- Keep visits separate from feature use, with existing visuals, image quality, alarms and music unchanged.

## v0.64 · 2026.09.28

- Connect Google Ads to the existing Google tag while preserving cookie consent choices.
- Remove the oldest half of the release history together with its translations in every supported language.
- Preserve recent release navigation, regional clocks, alarms, music and 4K display behavior.

## v0.63 · 2026.09.27

- Close-ups display a medium-resolution preview before replacing it with the original 4K texture.
- Prioritize selected bodies and reuse recent textures within the existing memory budget, preserving image quality and alarm/music behavior.
- Deployment checks original texture hashes and real cache hits while retaining the existing media origin and access restrictions.

## v0.62 · 2026.09.27

- Translation sources for the interface, timers and release history now share one workflow with generated runtime language files.
- Checks now catch missing text, placeholder errors, duplicate keys and stale generated files.
- All 48 countries and regions keep their existing text, time zones, alarm, music and display behavior.

## v0.61 · 2026.09.27

- Pinned the automatic language option so only the country list scrolls.
- Added 11 regions sharing English plus the Dominican Republic and Guatemala sharing Spanish, with regional clocks and Earth locations.
- Verified time zones, daylight-saving transitions, automatic region detection, and saved selections.

## v0.60 · 2026.09.25

- Music now detects errors and stalls, retries briefly, then skips the track or switches off.
- Default alarm preparation now has time and memory limits; long audio streams instead of being fully decoded into memory.
- Existing alarm and preview volumes and music OFF on alarm are preserved; delayed recovery cannot restart audio after it is stopped.

## v0.59 · 2026.09.25

- Increased alarm playback volume to 1.2 times its previous level while retaining background music OFF when ringing begins.
- Reduced idle timer checks and hidden display updates, streamed custom alarm files, and made the latest sound selection take precedence.
- Unified caches, translations, cards and deployment while tightening upload, receipt, storage and expiry checks.

## v0.58 · 2026.09.25

- An alarm switches background music and its button OFF before the first tone.
- Stopping or snoozing an alarm never restarts the music automatically; default and custom sounds behave alike.
- Fixed snooze reusing the previous delay instead of five minutes. Sound previews leave background music unchanged.

## v0.57 · 2026.09.25

- Scheduling, cancellation and removal complete only after a native Windows result; unknown results remain cancellable.
- Replaced the VBScript intermediary with a verified PowerShell helper. Older installations require reinstalling.
- Added Cloudflare result receipts, automatic expiry cleanup and post-deployment hash/API verification.

## v0.56 · 2026.09.24

- Added alarm and Windows shutdown timers with custom audio, five-minute snooze and a ten-second countdown.
- Added verified download, installation confirmation, state restoration, and safe removal for the Windows shutdown helper.
- Moved shutdown actions to a windowless bridge so CMD and PowerShell windows no longer appear.
- Help can now open above Timer without closing its settings; opening Settings still closes Timer as expected.

## v0.55 · 2026.09.23

- Connected Microsoft Clarity to cookie consent so it loads only after approval and revokes analytics storage when declined.
- Improved automatic clock fitting so large sizes with seconds stay inside the viewport.
- Stopped unnecessary drawing on stable paused scenes and reused same-time body calculations to reduce CPU and GPU work.
- Strengthened staged texture and sky loading, failure recovery, cache handling, and release-file verification.

## v0.54 · 2026.09.23

- Combined About, Privacy and Terms in one translucent in-app dialog with top tabs.
- Linked the cookie notice privacy link to the same dialog and unified the translucent information-card design.
- Hid internal build details from Help and restored the approved Life User watermark sizes on the main screen and Help.
- Hid the ad drawer when no real ad slot exists and refined spacing between body descriptions and information dividers.
- Added a 50–200% clock-size slider and reorganized settings after removing the duplicate 24-hour option.

## v0.53 · 2026.09.22

- Added a 200×200 desktop ad drawer at the lower right; it shows only a safe preview until a real ad slot is configured.
- Google Analytics and AdSense consent now start denied, with Allow and Reject controlling analytics and advertising measurement consent.
- Localized the cookie notice in all 13 supported languages and linked it to both automatic and manual language changes.
- Added ads.txt plus About, Privacy and Terms pages to the Cloudflare deployment output.

## v0.52 · 2026.09.22

- Added a Night Lights toggle to the Earth card and applied NASA's observed Black Marble 2016 map directly.
- Reduced the measured night-light source to 4K while preserving light shapes, brightness and a warm tint.
- Lights now fade in across the day–night boundary, while distance-specific resolutions reduce distant flicker and GPU use.
- Body-specific visual options such as Sun Shine and Earth Night Lights now share the bottom section of each body card.

## v0.51 · 2026.09.21

- Applied a layered astronomy model using precise JPL formulas for the current era and long-range approximations from 2051 through 2999.
- Moved the Moon, Europa and Pluto to dedicated precision models and added automatic comparisons against JPL Horizons reference data.
- Fixed previous and next eclipse navigation getting stuck on the same event, so travel now continues in either direction.
- Separated Earth-sky planetary gatherings from strict Sun-centred alignments containing five or more planets.
- Added gold viewport guides linking the alignment axis and participating planets, with distinct colours for sky and space dates.
- Centred eclipse and planetary-alignment titles, dates and navigation controls within their cards.

## v0.50 · 2026.09.21

- Added Auto Language as the default, following browser language and device time zone while remembering manual country choices separately.
- Added Taiwan and Hong Kong with Traditional Chinese, local time, Earth locations and a safe locale fallback.
- Added previous and next eclipse navigation for the Moon and Europa while preserving camera framing and tracking.
- Separated Moon and Europa display size from satellite-orbit spacing, and corrected Europa alignment and repeated close-up tracking.
- Unified popup dismissal and presentation-mode transitions across help, settings, body cards and other overlays.
- Improved Cloudflare media range handling and GPU texture loading and disposal for steadier music playback and long sessions.

## v0.48 · 2026.09.19

- Country views start at the 250× lens reference; use the wheel to move closer or farther afterward.
- Random rotation keeps one direction at 1.8°/s until switched off. Enabling it again chooses a new direction.
- Kept new star positions on every visit or reload, the tiny-star filter and the approved colour balance.
- Reused static body information and number nodes to avoid redundant card updates.
- Corrected accumulated frame-scheduling drift on high-refresh displays.
- Left-drag crosses both poles without limits, and automatic rotation resumes from the current view.

## v0.47 · 2026.09.18

- Unified the shared appearance, dismissal and scrolling of diagnostics, help, settings, body and QR cards.
- Moved release history into one data module and restored retries after loading failures.
- Removed renderer method replacement and global shader interception, sharing material settings across GPU, Worker and CPU adapters.
- Separated original sources from derived media and added preflight checks, approval and explicit UI uploads.
- Preserved the approved iPhone layout, camera controls and icons while strengthening regression and deployment checks.
- Added Singapore to the country list, reusing English translations with Singapore time and the shared Earth-view location control.
- Pixel-area filtering stabilizes tiny stars in motion. Yellow and red stars are 30% rarer; white and blue stars share the difference.
- Added Belgium and the Netherlands with a shared Dutch interface, regional time, Earth-view locations and saved country selection.

## v0.46 · 2026.09.18

- Static scenes now render at 30 fps, while dragging, auto-rotation, camera transitions and accelerated time continue at 60 fps.
- Monitored frame delay lowers load during sustained drops and reduces repeated interface and label calculations.
- GPU orbit rendering now reuses shared camera and uniform state, and texture-upload state handling has been cleaned up.
- Moved texture seam correction into the build pipeline to reduce close-up processing and temporary memory.
- Additional renderer, texture, label and UI hot-path cleanup reduces small stutters during long sessions and on lower-end hardware.

## v0.45 · 2026.09.17

- Star density defaults to 100%. Reloads and resets randomize positions while size, brightness and colour remain independent.
- Most stars stay steady. Some twinkle over 5–25 seconds; a few disappear for 5–10 seconds or show rare cross flares.
- The Sun keeps its fine flow structure while the current motion strength is reduced by another 5% for a calmer result.
- Jupiter’s experimental jets, turbulence and Great Red Spot shader are removed, fully restoring the original gas-giant shader.
- Dragging vertically with the right mouse button over the viewport now dollies the camera in and out independently of the wheel mode.

## v0.43 · 2026.09.17

- Star density defaults to 200%, with position, size, brightness, colour and twinkle timing randomized independently.
- Low-saturation red, white, blue-white and yellow stars are mixed, with rare cross-shaped flares only on a few bright stars.
- The Sun keeps its motion speed but uses stronger fine-scale warping so small-scale surface motion is clearly visible.
- Uploaded the maximum star pool once; density changes adjust only the draw count to reduce GPU load.

## v0.42 · 2026.09.17

- iPhone safe areas are respected, and clicking the region label tracks that location on Earth.
- GPU texture LRU plus adaptive DPR and 30/60 fps reduce mobile memory and rendering load.
- A 256×128 texture tier and same-origin Cloudflare media loading reduce transfer and connection overhead.
- Release notes now load on demand, and r1/r2 patches can update automatically within the same public version.

## v0.41 · 2026.09.16

- Clicking the clock cycles through the configured fonts.
- clicking AM/PM switches directly between 12- and 24-hour time.
- iPhone home-screen icons and two-finger panning are now supported.
- spacing and behavior were refined across date, status, branding, and support areas.

## v0.40 · 2026.09.15

- Moved solar corona and prominence compositing to the GPU.
- cloud-hosted language and high-resolution assets.
- increased maximum orbit brightness.
- removed duplicate heavy builds.

## v0.39 · 2026.09.15

- Moved orbit coordinates and camera projection to GPU buffers.
- separated language, music, storage, and popup modules.
- reorganized the main controls.

## v0.38 · 2026.09.15

- Unified all slider styles.
- consolidated update history.
- stabilized saved body size.
- orbit spacing, camera restore, and scroll cues.

## v0.37 · 2026.09.14

- Removed exaggerated synthetic craters from Mars and refreshed all 12 body descriptions around composition without repeating orbital periods.
- Additional usability and stability improvements.
- Additional usability and stability improvements.

## v0.36 · 2026.09.14

- Rebuilt Europa as a uniform 4K ice surface.
- removed duplicate relief from the Moon and Mercury.
- refined support links and credits.

## v0.35 · 2026.09.14

- Upgraded major bodies except Earth to licensed high-resolution spherical textures with 2K/4K distance-based detail.
- Additional usability and stability improvements.
- Additional usability and stability improvements.

## v0.34 · 2026.09.14

- Unified transparent GPU compositing in Chrome and Edge and smoothed orbit.
- ring, popup behavior and presentation were improved.
- menu behavior and presentation were improved.
- zoom transitions.

## v0.33 · 2026.09.13

- Applied the approved defaults.
- added body-size and child-orbit controls.
- reduced ring moiré.
- refined reset and background startup behavior.

## v0.32 · 2026.09.13

- Separated true-scale and overview hierarchies.
- added orbit-spacing and 24-hour options.
- improved zoom behavior and presentation were improved.
- dolly, regional time.
- multilingual UI behavior and presentation were improved.

## v0.31 · 2026.09.13

- Added zoom and dolly camera modes.
- free vertical rotation.
- wider panning, complete camera presets.
- clearer footer credits.

## v0.3 · 2026.09.13

- Rebuilt body and ring transforms as a 3D hierarchy.
- added GPU rendering and texture LOD.
- improved the Sun.
- expanded true-scale and regional-time views.
- Additional usability and stability improvements.

## v0.26 · 2026.09.13

- Extended close solar zoom.
- finalized transparent cards.
- removed temporary design controls.
- kept only the latest standalone build.

## v0.25 · 2026.09.13

- Made body discs opaque to stars and comets.
- centered the numeric clock independently of AM/PM.
- improved key textures.
- added Moon and Europa child orbits.
- Additional usability and stability improvements.

## v0.24 · 2026.09.12

- Fixed planets rotating with the camera.
- unified body and ring axes.
- corrected axial tilts.
- improved solar effects and high-speed updates.
- Additional usability and stability improvements.

## v0.23 · 2026.09.12

- Added 12/24-hour clocks.
- limited high-speed surface work.
- lowered distant texture limits.
- prioritized large visible bodies.

## v0.22 · 2026.09.12

- Preserved region and UTC labels in viewing mode.
- improved clock spacing and fonts.
- removed duplicate timezone UI.
- reduced per-frame resume work.

## v0.21 · 2026.09.12

- Unified clock and date placement in viewing mode.
- adjusted simulation status.
- added clock fonts.
- preloaded visible body textures.

## v0.20 · 2026.09.12

- Removed the date picker.
- compacted playback controls.
- removed unused embedded images.
- cleaned obsolete quality branches.

## v0.18 · 2026.09.12

- Smoothed saved-view interpolation.
- matched rotation icons to behavior.
- compacted playback controls.
- refined real-time speed units.

## v0.17 · 2026.09.12

- Restored immediate manual camera response.
- expanded panning.
- centered tracked bodies.
- refined speed ranges.
- removed duplicate help text.

## v0.16 · 2026.09.12

- Unified camera transitions with easing.
- removed unwanted reframing.
- preserved framing during auto-rotation.
- expanded close views and time rates.

## v0.15 · 2026.09.12

- Unified camera animation and continuous input.
- stabilized presets and fullscreen keys.
- upgraded the spherical background.
- expanded caching.
- Additional usability and stability improvements.

## v0.14 · 2026.09.12

- Created a 4K spherical space background and stabilized dedicated background rendering.
- projection caching.
- tab suspension behavior and presentation were improved.
- WebGL recovery behavior and presentation were improved.
- Additional usability and stability improvements.

## v0.13 · 2026.09.12

- Unified Camera 1–3 apply, save, delete and cancel actions in one popup.
- Moved viewing mode into the right controls and hid controls and the cursor after inactivity.
- Corrected texture seams and increased zoom and close-view limits.
- Stabilized surface-material swaps after tab return and during camera movement.
- Improved label overlap and made clock seconds optional.

## v0.12 · 2026.09.12

- Reorganized zoom, reset, saved-camera and rotation controls in the right panel.
- Added automatic left and right rotation that preserves current framing.
- Kept the same controls available during activity in viewing mode.
- Prevented surface textures from freezing during automatic rotation.

## v0.11 · 2026.09.12

- Blended dust lanes and a spiral galaxy into the 360° sky.
- Rebuilt the comet tail as one curved band with a transparency gradient.
- Added saved-camera confirmation and smooth view transitions.
- Reused completed CPU background frames during camera movement.

## v0.10 · 2026.09.11

- Preserved regional time labels in viewing mode.
- Added Camera 1–3 presets for angle, zoom, position and tracking.
- Added preset deletion confirmation and keyboard recall.
- Kept the last valid texture during asynchronous material updates.

## v0.09 · 2026.09.11

- Removed separate tracking cards and unified return behavior with the default-view button.
- Showed default-view and mode controls only during activity in viewing mode.
- Hid buttons and the cursor after about 1.8 seconds of inactivity.

## v0.08 · 2026.09.11

- Fixed seams and pole discontinuities in the 360° sky.
- Matched GPU and CPU texel sampling and brightness.
- Stopped close-up values from leaking between bodies.
- Fixed accidental post-drag tracking and Earth–Moon spacing.

## v0.07 · 2026.09.11

- Applied clearly licensed spherical textures to major planets and the Moon.
- Removed duplicate artificial relief and separated GPU and CPU resolution limits.
- Reduced sky haze and added a decorative curved comet.
- Fully hid the interface in viewing mode and quickened Sun-shine changes.

## v0.06 · 2026.09.11

- Centered initial and close views on the Sun.
- Added spherical materials for Earth, major bodies and the sky.
- Organized GPU, CPU and worker surface-rendering paths.
- Linked local orbits and rotation to device time and added Seoul day/night guidance.
- Simplified the Sun around its shine effect.

## v0.05 · 2026.09.11

- Restored worker rendering for visible body surfaces.
- Added 2048×1024 close-up surfaces and 1024×1024 focused-body output.
- Merged duplicate surface requests and discarded stale offscreen work.
- Refined footer body controls, playback layout and creator credit.

## v0.04 · 2026.09.11

- Expanded vertical camera rotation from −90° to +90°.
- Aligned Saturn and Uranus rings with each planet’s equator.
- Unified close-view resolution and maximum body size.
- Added vertical movement and a broader default-view reset.
- Refined solar effects, Help and playback layout.

## v0.03 · 2026.09.11

- Added granular solar texture, layered corona, prominences and subtle flow.
- Separated the Moon’s display size from its orbit size.
- Expanded zoom to 64× and added double-click close tracking.
- Added label collision avoidance and smooth movement for every body.

## v0.02 · 2026.09.11

- Increased Earth’s display size by 50%.
- Linked every body’s rotation to sidereal periods and simulated time.
- Fixed duplicate retrograde reversal for Venus, Uranus and Pluto.
- Added automatic cursor hiding in viewing mode.

## v0.01 · 2026.09.11

- Released the first Solar Time clock on a real-time device timeline.
- Rendered the Sun, eight planets, Moon, Pluto, orbits, rotation and time speed in Canvas 2D.
- Added camera rotation, zoom, body information, viewing mode and display options.
- Supported the web and a standalone HTML build without installation or an account.
